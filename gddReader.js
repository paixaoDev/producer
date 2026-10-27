// ============================================================
// GDD READER — leitura estruturada do GDD e parsing de tarefas
// Funções puras (sem DOM) para poderem ser testadas em Node.
//
// Fluxo de leitura:
//   1. extractDocxText()  → texto do DOCX preservando títulos (# Heading)
//   2. splitSections()    → GDD em seções { title, body }
//   3. chunkSections()    → blocos de ~12k chars para a IA ler o GDD inteiro
//   4. parseInventoryMD() / mergeInventories() → inventário de conteúdo concreto
//   5. findRelevantExcerpts() → trechos ORIGINAIS do GDD para cada feature
//   6. parseTaskLine() / analyzeTaskGranularity() → tarefas em horas, pequenas
// ============================================================
(function (root) {
    // Tamanho máximo de GDD lido (o restante é ignorado com aviso)
    const MAX_GDD_CHARS = 120000;
    // Tamanho de cada bloco enviado à IA na extração do inventário
    const CHUNK_CHARS = 12000;
    // Tarefas maiores que isso são quebradas (várias tarefas por dia)
    const MAX_TASK_HOURS = 4;
    const HOURS_PER_DAY = 6;

    // Quantidade de tarefas por feature, por tipo de marco
    const TASK_TARGETS = {
        poc:            { min: 5,  max: 10 },
        prototype:      { min: 8,  max: 16 },
        demo:           { min: 8,  max: 14 },
        vertical_slice: { min: 10, max: 18 },
        alpha:          { min: 10, max: 20 },
        beta:           { min: 6,  max: 12 },
        gold:           { min: 5,  max: 10 },
        release:        { min: 5,  max: 10 },
    };

    // Categorias do inventário de conteúdo (o que existe de concreto no GDD)
    const INVENTORY_CATEGORIES = [
        { key: 'mecanicas',  label: 'Mecânicas e ações do jogador', areas: ['programming', 'design'] },
        { key: 'sistemas',   label: 'Sistemas (progressão, economia, save, IA...)', areas: ['programming', 'design'] },
        { key: 'personagens', label: 'Personagens e NPCs', areas: ['art', 'design', 'audio'] },
        { key: 'inimigos',   label: 'Inimigos e bosses', areas: ['programming', 'art', 'design', 'audio'] },
        { key: 'fases',      label: 'Fases, níveis, mapas e ambientes', areas: ['design', 'art', 'audio'] },
        { key: 'itens',      label: 'Itens, armas, power-ups e coletáveis', areas: ['design', 'art', 'programming'] },
        { key: 'interface',  label: 'Telas, menus e HUD', areas: ['programming', 'art', 'design'] },
        { key: 'narrativa',  label: 'Cenas, diálogos, finais e eventos de história', areas: ['design', 'art', 'audio'] },
        { key: 'audio',      label: 'Músicas, SFX e vozes', areas: ['audio'] },
        { key: 'tecnico',    label: 'Requisitos técnicos, plataformas e ferramentas', areas: ['programming', 'qa', 'production'] },
    ];

    const STOPWORDS = new Set(('a o os as um uma uns umas de do da dos das em no na nos nas por para pra com sem ' +
        'que e ou se ao aos à às é ser são está estão foi como mais menos muito muita seu sua seus suas ele ela eles elas ' +
        'isso esse essa este esta isto cada todo toda todos todas quando onde qual quais pelo pela pelos pelas entre sobre ' +
        'the and or of to in on for with from by is are be it this that an at as feature tarefa tarefas sistema implementar ' +
        'criar fazer jogo jogador player game base basico basica inicial final').split(/\s+/));

    function normalizeText(str) {
        return String(str || '')
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .toLowerCase();
    }

    function tokenize(str) {
        return normalizeText(str)
            .split(/[^a-z0-9]+/)
            .filter(t => t.length >= 3 && !STOPWORDS.has(t));
    }

    // ---------------- Seções ----------------

    function headingTitle(line) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.length > 90) return null;

        const md = trimmed.match(/^#{1,6}\s+(.+)$/);
        if (md) return md[1].trim();

        // "1. Mecânicas", "2.3 Inimigos", "3) Arte"
        const numbered = trimmed.match(/^\d+(?:\.\d+)*[.)]?\s+([A-ZÀ-Ý].{1,80})$/);
        if (numbered && !/[.;,]$/.test(trimmed)) return trimmed;

        // "MECÂNICAS PRINCIPAIS"
        const letters = trimmed.replace(/[^A-Za-zÀ-ÿ]/g, '');
        if (letters.length >= 3 && trimmed.length <= 60 && letters === letters.toUpperCase() && /[A-ZÀ-Ý]/.test(letters)) {
            return trimmed;
        }

        // "Personagens:" sozinho na linha
        const colon = trimmed.match(/^([A-ZÀ-Ý][^:]{1,50}):$/);
        if (colon) return colon[1].trim();

        return null;
    }

    function splitLongBody(title, body, maxChars) {
        if (body.length <= maxChars) return [{ title, body }];
        const parts = [];
        let current = '';
        for (const para of body.split(/\n+/)) {
            if (current && (current.length + para.length + 2) > maxChars) {
                parts.push(current);
                current = '';
            }
            if (para.length > maxChars) {
                for (let i = 0; i < para.length; i += maxChars) parts.push(para.slice(i, i + maxChars));
                continue;
            }
            current = current ? `${current}\n${para}` : para;
        }
        if (current) parts.push(current);
        return parts.map((p, i) => ({ title: parts.length > 1 ? `${title} (parte ${i + 1})` : title, body: p }));
    }

    // Divide o GDD em seções pelos títulos. Seções muito longas viram partes menores.
    function splitSections(text, { maxSectionChars = 4000 } = {}) {
        const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
        const raw = [];
        let current = { title: 'Introdução', lines: [] };

        for (const line of lines) {
            const title = headingTitle(line);
            if (title) {
                if (current.lines.join('').trim()) raw.push(current);
                current = { title, lines: [] };
            } else {
                current.lines.push(line);
            }
        }
        if (current.lines.join('').trim()) raw.push(current);

        const sections = [];
        for (const s of raw) {
            const body = s.lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
            if (!body) continue;
            sections.push(...splitLongBody(s.title, body, maxSectionChars));
        }
        return sections.map((s, i) => ({ id: i, ...s }));
    }

    // Agrupa seções em blocos de até maxChars, sem cortar seções no meio
    function chunkSections(sections, maxChars = CHUNK_CHARS) {
        const chunks = [];
        let current = '';
        for (const s of sections) {
            const piece = `### ${s.title}\n${s.body}`;
            if (current && current.length + piece.length + 2 > maxChars) {
                chunks.push(current);
                current = '';
            }
            current = current ? `${current}\n\n${piece}` : piece;
        }
        if (current) chunks.push(current);
        return chunks;
    }

    // Busca os trechos originais do GDD mais relevantes para um texto (ex: título da feature)
    function findRelevantExcerpts(sections, query, { maxChars = 3000, maxSections = 4 } = {}) {
        const terms = Array.from(new Set(tokenize(query)));
        if (!terms.length || !sections?.length) return '';

        const docs = sections.map(s => ({
            s,
            titleTokens: tokenize(s.title),
            bodyTokens: tokenize(s.body),
        }));
        const df = {};
        for (const t of terms) {
            df[t] = docs.filter(d => d.titleTokens.includes(t) || d.bodyTokens.includes(t)).length;
        }

        const scored = docs.map(d => {
            let score = 0;
            for (const t of terms) {
                if (!df[t]) continue;
                const idf = Math.log(1 + sections.length / df[t]);
                const tf = d.bodyTokens.filter(x => x === t).length;
                score += (Math.min(tf, 5) + (d.titleTokens.includes(t) ? 3 : 0)) * idf;
            }
            return { s: d.s, score };
        }).filter(x => x.score > 0)
          .sort((a, b) => b.score - a.score || a.s.id - b.s.id)
          .slice(0, maxSections);

        const perSection = Math.max(400, Math.floor(maxChars / Math.max(1, scored.length)));
        return scored
            .sort((a, b) => a.s.id - b.s.id)
            .map(({ s }) => {
                const body = s.body.length > perSection ? `${s.body.slice(0, perSection).trim()}…` : s.body;
                return `### ${s.title}\n${body}`;
            })
            .join('\n\n');
    }

    // ---------------- Inventário de conteúdo ----------------

    function categoryForHeading(heading) {
        const h = normalizeText(heading).replace(/[^a-z_]/g, '');
        return INVENTORY_CATEGORIES.find(c => h.startsWith(c.key) || (h.length >= 4 && c.key.startsWith(h)))?.key || null;
    }

    // Lê o Markdown do inventário: "## categoria" + "- Nome :: detalhe"
    function parseInventoryMD(md) {
        const inventory = {};
        let category = null;
        for (const line of String(md || '').split('\n')) {
            const head = line.match(/^#{1,3}\s+(.+)$/);
            if (head) {
                category = categoryForHeading(head[1]);
                continue;
            }
            const item = line.match(/^\s*[-*•]\s+(.+)$/);
            if (!item || !category) continue;
            const [rawName, ...rest] = item[1].split('::');
            const name = rawName.replace(/\*\*/g, '').trim();
            if (!name || /^(nenhum|n[aã]o especificado|n\/a|-)$/i.test(name)) continue;
            if (!inventory[category]) inventory[category] = [];
            inventory[category].push({ name, detail: rest.join('::').trim() });
        }
        return inventory;
    }

    // Junta inventários de vários blocos, sem duplicar nomes
    function mergeInventories(list) {
        const merged = {};
        for (const inv of list || []) {
            for (const [cat, items] of Object.entries(inv || {})) {
                if (!merged[cat]) merged[cat] = [];
                for (const it of items) {
                    const key = normalizeText(it.name).replace(/[^a-z0-9]/g, '');
                    const existing = merged[cat].find(x => normalizeText(x.name).replace(/[^a-z0-9]/g, '') === key);
                    if (!existing) {
                        merged[cat].push({ ...it });
                    } else if (it.detail && !existing.detail.includes(it.detail)) {
                        existing.detail = existing.detail ? `${existing.detail}; ${it.detail}` : it.detail;
                    }
                }
            }
        }
        return merged;
    }

    function inventoryCount(inv) {
        return Object.values(inv || {}).reduce((s, items) => s + items.length, 0);
    }

    // Formata o inventário para o prompt. area filtra categorias relevantes.
    function formatInventory(inv, { area = null, maxChars = 6000 } = {}) {
        const cats = INVENTORY_CATEGORIES.filter(c => !area || c.areas.includes(area));
        let out = '';
        for (const c of cats) {
            const items = inv?.[c.key] || [];
            if (!items.length) continue;
            const block = `${c.label}:\n${items.map(it => `- ${it.name}${it.detail ? ` — ${it.detail}` : ''}`).join('\n')}\n\n`;
            if (out.length + block.length > maxChars) {
                out += `${c.label}: ${items.map(it => it.name).join(', ')}\n\n`;
            } else {
                out += block;
            }
        }
        return out.slice(0, maxChars).trim();
    }

    // ---------------- Tarefas ----------------

    const ESTIMATE_RE = /^(\d+(?:[.,]\d+)?)\s*(h|hr|hrs|horas?|d|dias?)$/i;

    // Converte "- [ ] Título >> descrição | 2h | high | feature | pronto quando: X"
    // Aceita também o formato antigo em dias ("| 2d |").
    function parseTaskLine(line) {
        const m = String(line || '').match(/^\s*[-*]\s+\[[ xX]\]\s+(.+)$/);
        if (!m) return null;
        const parts = m[1].split('|').map(p => p.trim());
        const estIdx = parts.findIndex((p, i) => i > 0 && ESTIMATE_RE.test(p));
        if (estIdx < 0) return null;

        const head = parts.slice(0, estIdx).join(' | ');
        const sep = head.indexOf('>>');
        const title = (sep >= 0 ? head.slice(0, sep) : head).replace(/\*\*/g, '').trim();
        const description = sep >= 0 ? head.slice(sep + 2).trim() : '';
        if (!title) return null;

        const [, num, unit] = parts[estIdx].match(ESTIMATE_RE);
        const value = parseFloat(num.replace(',', '.'));
        const isDays = /^d/i.test(unit);
        const estimatedHours = Math.max(0.5, Math.min(isDays ? value * HOURS_PER_DAY : value, 40));

        const rest = parts.slice(estIdx + 1);
        const priority = (rest[0] || 'medium').toLowerCase().match(/critical|high|medium|low/)?.[0] || 'medium';
        const type = (rest[1] || 'feature').toLowerCase().replace(/[^a-z]/g, '') || 'feature';
        const doneWhen = rest.slice(2).join(' | ')
            .replace(/^(pronto|pronto quando|feito quando|done|aceite)\s*:\s*/i, '')
            .trim();

        return {
            title,
            description,
            estimatedHours,
            estimatedDays: Math.round((estimatedHours / HOURS_PER_DAY) * 100) / 100,
            priority,
            type,
            doneWhen,
        };
    }

    function parseTaskLines(md) {
        return String(md || '').split('\n').map(parseTaskLine).filter(Boolean);
    }

    // Diz se a lista de tarefas de uma feature precisa ser quebrada em tarefas menores
    function analyzeTaskGranularity(tasks, milestoneType, { maxHours = MAX_TASK_HOURS } = {}) {
        const target = TASK_TARGETS[milestoneType] || TASK_TARGETS.prototype;
        const oversized = (tasks || []).filter(t => (t.estimatedHours || 0) > maxHours);
        const tooFew = (tasks || []).length < target.min;
        return { oversized, tooFew, target, ok: !oversized.length && !tooFew };
    }

    // ---------------- DOCX ----------------

    function decodeXmlEntities(str) {
        return str
            .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
            .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .replace(/&amp;/g, '&');
    }

    // Converte o word/document.xml em texto, marcando títulos com "#"
    function docxXmlToText(xml) {
        const paragraphs = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [];
        const lines = paragraphs.map(p => {
            const style = p.match(/<w:pStyle\s+w:val="([^"]+)"/)?.[1] || '';
            const level = style.match(/(?:heading|t[ií]?tulo|ttulo)\s*(\d)/i)?.[1]
                || (/^(title|t[ií]tulo)$/i.test(style) ? '1' : null);
            const isList = /<w:numPr>/.test(p);
            const pieces = p.match(/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>|<w:tab\/>|<w:br[^>]*\/>/g) || [];
            const text = decodeXmlEntities(pieces.map(piece => {
                if (piece.startsWith('<w:tab')) return '\t';
                if (piece.startsWith('<w:br')) return '\n';
                return piece.replace(/<[^>]+>/g, '');
            }).join('')).trim();
            if (!text) return '';
            if (level) return `${'#'.repeat(Math.min(6, Number(level)))} ${text}`;
            return isList ? `- ${text}` : text;
        });
        return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    }

    async function inflateRaw(bytes) {
        if (typeof DecompressionStream === 'undefined') {
            throw new Error('Navegador sem suporte a DecompressionStream');
        }
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        return new Uint8Array(await new Response(stream).arrayBuffer());
    }

    // Lê um arquivo de dentro de um ZIP (DOCX é um ZIP) sem bibliotecas externas
    async function readZipEntry(arrayBuffer, entryName) {
        const bytes = new Uint8Array(arrayBuffer);
        const view = new DataView(arrayBuffer);
        let eocd = -1;
        for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
            if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
        }
        if (eocd < 0) throw new Error('Arquivo não é um ZIP/DOCX válido');

        const entries = view.getUint16(eocd + 10, true);
        let ptr = view.getUint32(eocd + 16, true);
        const decoder = new TextDecoder('utf-8');

        for (let n = 0; n < entries; n++) {
            if (view.getUint32(ptr, true) !== 0x02014b50) break;
            const method = view.getUint16(ptr + 10, true);
            const compSize = view.getUint32(ptr + 20, true);
            const nameLen = view.getUint16(ptr + 28, true);
            const extraLen = view.getUint16(ptr + 30, true);
            const commentLen = view.getUint16(ptr + 32, true);
            const localOffset = view.getUint32(ptr + 42, true);
            const name = decoder.decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen));

            if (name === entryName) {
                const lNameLen = view.getUint16(localOffset + 26, true);
                const lExtraLen = view.getUint16(localOffset + 28, true);
                const start = localOffset + 30 + lNameLen + lExtraLen;
                const data = bytes.subarray(start, start + compSize);
                if (method === 0) return decoder.decode(data);
                if (method === 8) return decoder.decode(await inflateRaw(data));
                throw new Error(`Compressão ZIP não suportada (${method})`);
            }
            ptr += 46 + nameLen + extraLen + commentLen;
        }
        throw new Error(`${entryName} não encontrado no arquivo`);
    }

    async function extractDocxText(arrayBuffer) {
        const xml = await readZipEntry(arrayBuffer, 'word/document.xml');
        return docxXmlToText(xml);
    }

    const api = {
        MAX_GDD_CHARS,
        CHUNK_CHARS,
        MAX_TASK_HOURS,
        HOURS_PER_DAY,
        TASK_TARGETS,
        INVENTORY_CATEGORIES,
        normalizeText,
        tokenize,
        splitSections,
        chunkSections,
        findRelevantExcerpts,
        parseInventoryMD,
        mergeInventories,
        inventoryCount,
        formatInventory,
        parseTaskLine,
        parseTaskLines,
        analyzeTaskGranularity,
        docxXmlToText,
        readZipEntry,
        extractDocxText,
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    root.GddReader = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
