// ============================================================
// GDD READER — leitura estruturada do GDD e parsing de tarefas
// Funções puras (sem DOM) para poderem ser testadas em Node.
//
// Fluxo de leitura:
//   1. extractDocxText()  → texto do DOCX preservando títulos (# Heading)
//   2. splitSections()    → GDD em seções { title, body }
//   3. chunkSections()    → blocos de ~12k chars para a IA ler o GDD inteiro
//   4. parseFeatureDocOps() / applyFeatureDocOps() → documento de features,
//      montado bloco a bloco: cada bloco cria features novas ou complementa
//      as que já existem no documento
//   5. findRelevantExcerpts() → trechos ORIGINAIS do GDD para cada feature
//   6. parseTaskLine() / analyzeTaskGranularity() → tarefas em horas, pequenas
// ============================================================
(function (root) {
    // Tamanho máximo de GDD lido (o restante é ignorado com aviso)
    const MAX_GDD_CHARS = 120000;
    // Tamanho de cada bloco do GDD enviado à IA ao montar o documento de features
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

    // Tamanho de cada versão do jogo, em semanas de calendário. É o orçamento usado
    // para decidir quanto escopo cabe em cada versão (horas = semanas × 5 dias × horas/dia × pessoas).
    const VERSION_BUDGETS = {
        poc:            { label: 'PoC',             weeks: 2 },
        prototype:      { label: 'MVP (protótipo)', weeks: 8 },
        demo:           { label: 'Demo',            weeks: 8 },
        vertical_slice: { label: 'Vertical Slice',  weeks: 12 },
        alpha:          { label: 'Alpha',           weeks: 16 },
        beta:           { label: 'Beta',            weeks: 8 },
        gold:           { label: 'Gold',            weeks: 4 },
        release:        { label: 'Lançamento',      weeks: 2 },
    };
    const VERSION_ORDER = Object.keys(VERSION_BUDGETS);

    // Categorias das features do documento. areas = quem costuma trabalhar nelas.
    const FEATURE_CATEGORIES = [
        { key: 'mecanica',   label: 'Mecânicas e ações do jogador', areas: ['programming', 'design'] },
        { key: 'sistema',    label: 'Sistemas (progressão, economia, save, IA...)', areas: ['programming', 'design'] },
        { key: 'personagem', label: 'Personagens e NPCs', areas: ['art', 'design', 'audio'] },
        { key: 'inimigo',    label: 'Inimigos e bosses', areas: ['programming', 'art', 'design', 'audio'] },
        { key: 'fase',       label: 'Fases, níveis, mapas e ambientes', areas: ['design', 'art', 'audio'] },
        { key: 'item',       label: 'Itens, armas, power-ups e coletáveis', areas: ['design', 'art', 'programming'] },
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
    // Ordena as seções por relevância para um texto (TF-IDF simples, título pesa mais).
    // Seções com menos de minRelative da nota da melhor são descartadas (evita trechos fora do assunto).
    function rankSections(sections, query, { minRelative = 0.35 } = {}) {
        const terms = Array.from(new Set(tokenize(query)));
        if (!terms.length || !sections?.length) return [];

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
          .sort((a, b) => b.score - a.score || a.s.id - b.s.id);
        const top = scored[0]?.score || 0;
        return scored.filter(x => x.score >= top * minRelative);
    }

    // Corta no fim de uma linha ou frase, nunca no meio de uma palavra
    function trimAtBoundary(text, maxChars) {
        if (text.length <= maxChars) return text;
        const cut = text.slice(0, maxChars);
        const at = Math.max(cut.lastIndexOf('\n'), cut.lastIndexOf('. '));
        return `${(at > maxChars * 0.5 ? cut.slice(0, at + 1) : cut.slice(0, cut.lastIndexOf(' '))).trim()} […]`;
    }

    function formatExcerpts(sections, maxChars) {
        const perSection = Math.max(400, Math.floor(maxChars / Math.max(1, sections.length)));
        return sections
            .slice()
            .sort((a, b) => a.id - b.id)
            .map(s => `### ${s.title}\n${trimAtBoundary(s.body, perSection)}`)
            .join('\n\n');
    }

    // Busca os trechos originais do GDD mais relevantes para um texto (ex: título da feature)
    function findRelevantExcerpts(sections, query, { maxChars = 3000, maxSections = 4 } = {}) {
        const ranked = rankSections(sections, query).slice(0, maxSections).map(x => x.s);
        return formatExcerpts(ranked, maxChars);
    }

    // Título da seção que mais fala de um texto (usado para registrar de onde veio cada feature)
    function bestSectionTitle(sections, query) {
        return rankSections(sections, query)[0]?.s.title || '';
    }


    // ---------------- Documento de features ----------------
    // O documento é montado lendo o GDD bloco a bloco. A cada bloco a IA devolve
    // operações em Markdown:
    //   ## NOVA: Nome da feature          → cria uma feature
    //   ## ATUALIZA F03                    → complementa a feature F03
    //   - categoria: / - resumo: / - detalhe: / - conteudo: nome :: detalhe / - depende de: F01
    // O código aplica as operações; assim a IA nunca reescreve (nem perde) o que já foi lido.

    function nameKey(str) {
        return normalizeText(str).replace(/[^a-z0-9]/g, '');
    }

    function normalizeCategory(str) {
        const h = nameKey(str);
        if (!h) return 'mecanica';
        const found = FEATURE_CATEGORIES.find(c => h.startsWith(c.key) || (h.length >= 4 && c.key.startsWith(h)));
        if (found) return found.key;
        if (/boss|inimig|enem/.test(h)) return 'inimigo';
        if (/nivel|level|mapa|ambiente|bioma|mundo/.test(h)) return 'fase';
        if (/menu|hud|tela|ui/.test(h)) return 'interface';
        if (/som|music|sfx|trilha/.test(h)) return 'audio';
        if (/arma|power|colet/.test(h)) return 'item';
        if (/npc/.test(h)) return 'personagem';
        if (/hist|dialog|final|cena/.test(h)) return 'narrativa';
        return 'mecanica';
    }

    function createFeatureDoc() {
        return { features: [], scopeNotes: [] };
    }

    function parseFeatureDocOps(md) {
        const ops = [];
        let current = null;
        for (const raw of String(md || '').split('\n')) {
            const line = raw.trim();
            if (/^#{1,4}\s*ESCOPO\b/i.test(line)) {
                current = { op: 'scope', details: [], content: [], dependsOn: [] };
                ops.push(current);
                continue;
            }
            const novo = line.match(/^#{1,4}\s*NOVA\s*[:\-—]?\s*(.+)$/i);
            const upd = line.match(/^#{1,4}\s*(?:ATUALIZA|ADICIONA|COMPLEMENTA)\w*\s*[:\-—]?\s*(F\d+)\b\s*[:\-—]?\s*(.*)$/i);
            if (novo || upd) {
                current = novo
                    ? { op: 'new', name: novo[1].replace(/\*\*/g, '').trim(), details: [], content: [], dependsOn: [] }
                    : { op: 'update', id: upd[1].toUpperCase(), name: upd[2].replace(/\*\*/g, '').trim(), details: [], content: [], dependsOn: [] };
                ops.push(current);
                continue;
            }
            if (!current) continue;
            const item = line.match(/^[-*•]\s+(.+)$/);
            if (!item) continue;
            const field = item[1].match(/^\**([a-zçãõáéíóúê ]+?)\**\s*:\s*(.+)$/i);
            const key = field ? nameKey(field[1]) : '';
            const value = field ? field[2].trim() : item[1].trim();
            if (key === 'categoria') current.category = normalizeCategory(value);
            else if (key === 'resumo') current.summary = value;
            else if (key === 'conteudo') {
                const [n, ...rest] = value.split('::');
                if (n.trim()) current.content.push({ name: n.replace(/\*\*/g, '').trim(), detail: rest.join('::').trim() });
            } else if (key === 'dependede' || key === 'dependencias' || key === 'depende') {
                current.dependsOn.push(...value.split(/[,;]/).map(v => v.trim()).filter(Boolean));
            } else if (key === 'detalhe' || key === 'regra' || !field) {
                current.details.push(value);
            } else {
                current.details.push(`${field[1].trim()}: ${value}`);
            }
        }
        return ops;
    }

    function pushUnique(list, value, keyOf = nameKey) {
        if (!value) return;
        const k = keyOf(value);
        if (k && !list.some(x => keyOf(x) === k)) list.push(value);
    }

    // Aplica as operações de um bloco ao documento (retorna um documento novo)
    // source pode ser um texto ou uma função (op) => texto
    function applyFeatureDocOps(doc, ops, { source = '' } = {}) {
        const out = { features: (doc?.features || []).map(f => ({
            ...f,
            details: [...f.details],
            content: f.content.map(c => ({ ...c })),
            dependsOn: [...f.dependsOn],
            sources: [...f.sources],
        })), scopeNotes: [...(doc?.scopeNotes || [])] };
        const byId = id => out.features.find(f => f.id === id);
        const byName = name => out.features.find(f => nameKey(f.name) === nameKey(name));
        let next = out.features.reduce((m, f) => Math.max(m, parseInt(f.id.slice(1), 10) || 0), 0);

        for (const op of ops || []) {
            if (op.op === 'scope') {
                op.details.forEach(d => pushUnique(out.scopeNotes, d));
                continue;
            }
            let feature = op.op === 'update' ? (byId(op.id) || (op.name && byName(op.name))) : byName(op.name);
            if (!feature) {
                if (!op.name) continue; // atualização de uma feature que não existe e sem nome
                next++;
                feature = {
                    id: `F${String(next).padStart(2, '0')}`,
                    name: op.name,
                    category: op.category || 'mecanica',
                    summary: '',
                    details: [],
                    content: [],
                    dependsOn: [],
                    sources: [],
                };
                out.features.push(feature);
            }
            if (op.summary) feature.summary = op.summary;
            op.details.forEach(d => pushUnique(feature.details, d));
            for (const c of op.content) {
                const existing = feature.content.find(x => nameKey(x.name) === nameKey(c.name));
                if (!existing) feature.content.push({ ...c });
                else if (c.detail && !existing.detail.includes(c.detail)) {
                    existing.detail = existing.detail ? `${existing.detail}; ${c.detail}` : c.detail;
                }
            }
            op.dependsOn.forEach(d => pushUnique(feature.dependsOn, d));
            pushUnique(feature.sources, typeof source === 'function' ? source(op) : source);
        }

        // Dependências por nome viram IDs quando possível
        for (const f of out.features) {
            f.dependsOn = f.dependsOn
                .map(d => (/^F\d+$/i.test(d) ? d.toUpperCase() : (byName(d)?.id || d)))
                .filter((d, i, arr) => d !== f.id && arr.indexOf(d) === i);
        }
        return out;
    }

    function featureDocCount(doc) {
        return (doc?.features || []).length;
    }

    function categoryLabel(key) {
        return FEATURE_CATEGORIES.find(c => c.key === key)?.label || key;
    }

    // Índice curto (uma linha por feature) — vai em todo prompt para a IA saber o que já existe
    function formatFeatureIndex(doc, { maxChars = 8000, area = null } = {}) {
        const cats = new Set(FEATURE_CATEGORIES.filter(c => !area || c.areas.includes(area)).map(c => c.key));
        let out = '';
        for (const f of doc?.features || []) {
            if (area && !cats.has(f.category)) continue;
            const line = `${f.id} [${f.category}] ${f.name}${f.summary ? ` — ${f.summary}` : ''}\n`;
            if (out.length + line.length > maxChars) {
                out += `${f.id} ${f.name}\n`;
                if (out.length > maxChars) break;
            } else {
                out += line;
            }
        }
        return out.trim();
    }

    // Especificação completa de uma feature — base para quebrar em tarefas
    function formatFeatureSpec(feature) {
        if (!feature) return '';
        const lines = [`### ${feature.id} — ${feature.name} (${categoryLabel(feature.category)})`];
        if (feature.summary) lines.push(feature.summary);
        if (feature.details.length) lines.push('Regras e detalhes:', ...feature.details.map(d => `- ${d}`));
        if (feature.content.length) lines.push('Conteúdo a produzir:', ...feature.content.map(c => `- ${c.name}${c.detail ? ` — ${c.detail}` : ''}`));
        if (feature.dependsOn.length) lines.push(`Depende de: ${feature.dependsOn.join(', ')}`);
        if (feature.sources.length) lines.push(`Seções do GDD: ${feature.sources.join('; ')}`);
        return lines.join('\n');
    }

    // Documento completo em Markdown, agrupado por categoria (para revisar ou baixar)
    function featureDocToMarkdown(doc, title = 'Documento de features') {
        const parts = [`# ${title}`, '', `${featureDocCount(doc)} features encontradas no GDD.`];
        for (const c of FEATURE_CATEGORIES) {
            const features = (doc?.features || []).filter(f => f.category === c.key);
            if (!features.length) continue;
            parts.push('', `## ${c.label}`, '');
            features.forEach(f => parts.push(formatFeatureSpec(f), ''));
        }
        if (doc?.scopeNotes?.length) {
            parts.push('', '## Notas de escopo e cronograma do GDD', '', ...doc.scopeNotes.map(n => `- ${n}`));
        }
        return parts.join('\n').trim() + '\n';
    }

    // "[ref: F01, F03]" → ['F01', 'F03']
    function findFeatureRefs(text) {
        const m = String(text || '').match(/\[ref:\s*([^\]]+)\]/i);
        if (!m) return [];
        return Array.from(new Set((m[1].match(/F\d+/gi) || []).map(r => r.toUpperCase())));
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
        // Só pede mais tarefas quando faltam muitas: completar contagem gera tarefa inventada
        const tooFew = (tasks || []).length < Math.ceil(target.min / 2);
        return { oversized, tooFew, target, ok: !oversized.length && !tooFew };
    }

    // ---------------- Orçamento por versão ----------------

    // "solo" → 1, "3 pessoas" → 3, "2-4 devs" → 2; sem número → 1
    function parseTeamSize(value) {
        const text = normalizeText(value);
        if (!text || /solo|sozinh|indie de 1|uma pessoa/.test(text)) return 1;
        const n = parseInt(text.match(/\d+/)?.[0], 10);
        return n > 0 && n < 500 ? n : 1;
    }

    function formatWeeks(weeks) {
        if (weeks >= 8 && weeks % 4 === 0) return `${weeks / 4} meses`;
        return weeks === 1 ? '1 semana' : `${weeks} semanas`;
    }

    function versionBudgetHours(type, teamSize = 1, hoursPerDay = HOURS_PER_DAY) {
        const weeks = VERSION_BUDGETS[type]?.weeks || 4;
        return weeks * 5 * hoursPerDay * Math.max(1, teamSize);
    }

    // Compara as horas planejadas de cada versão com o orçamento dela
    function checkVersionBudgets(hoursByType, teamSize = 1, { hoursPerDay = HOURS_PER_DAY } = {}) {
        return VERSION_ORDER
            .filter(type => hoursByType[type] !== undefined)
            .map(type => {
                const budgetHours = versionBudgetHours(type, teamSize, hoursPerDay);
                const plannedHours = Math.round(hoursByType[type] * 10) / 10;
                const ratio = budgetHours ? plannedHours / budgetHours : 0;
                const status = ratio > 1.25 ? 'acima' : ratio < 0.5 ? 'abaixo' : 'ok';
                return { type, label: VERSION_BUDGETS[type].label, weeks: VERSION_BUDGETS[type].weeks, budgetHours, plannedHours, ratio, status };
            });
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
        VERSION_BUDGETS,
        VERSION_ORDER,
        parseTeamSize,
        formatWeeks,
        versionBudgetHours,
        checkVersionBudgets,
        FEATURE_CATEGORIES,
        normalizeText,
        tokenize,
        splitSections,
        chunkSections,
        rankSections,
        formatExcerpts,
        findRelevantExcerpts,
        bestSectionTitle,
        normalizeCategory,
        createFeatureDoc,
        parseFeatureDocOps,
        applyFeatureDocOps,
        featureDocCount,
        formatFeatureIndex,
        formatFeatureSpec,
        featureDocToMarkdown,
        findFeatureRefs,
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
