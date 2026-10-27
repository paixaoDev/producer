(function (root) {
    // Exportação para agentes de código (Claude Code e Codex).
    // Gera um .zip com o arquivo de instruções que cada ferramenta lê sozinha
    // (CLAUDE.md ou AGENTS.md) e, no Claude Code, o comando /proxima-tarefa.
    // O roadmap, a CLI e as skills vêm do aiKit.js (options.kitFiles).

    const TARGETS = {
        claude: { label: 'Claude Code', instructionsFile: 'CLAUDE.md', skillsDir: '.claude/skills' },
        codex: { label: 'Codex', instructionsFile: 'AGENTS.md', skillsDir: '.agents/skills' },
    };

    const CLI = 'node .producer/producer.js';

    function oneLine(value) {
        return String(value || '').replace(/\s+/g, ' ').trim();
    }

    function slugify(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 50) || 'projeto';
    }

    function buildAgentModel(result) {
        let totalTasks = 0;
        (result?.objectives || []).forEach(obj => (obj.keyResults || []).forEach(kr => { totalTasks += (kr.tasks || []).length; }));
        return {
            title: oneLine(result?.overview?.title) || 'Projeto',
            genre: oneLine(result?.genreLabel || result?.overview?.genre),
            description: oneLine(result?.overview?.description),
            totalTasks,
        };
    }

    function buildAgentInstructions(model, target) {
        const tool = TARGETS[target] || TARGETS.claude;
        const lines = [
            `# ${model.title}`,
            '',
            model.description || `Projeto de jogo${model.genre ? ` (${model.genre})` : ''} planejado com o Producer.`,
            '',
            '## Roadmap do projeto',
            '',
            '- `ROADMAP.md`: tarefas por etapa (PoC → protótipo → ... → lançamento), cada uma com seu id entre crases.',
            '- `.producer/roadmap.json`: o mesmo roadmap com o status de cada tarefa. É o arquivo importado de volta no site do Producer.',
            `- \`${CLI}\`: CLI que lê e altera os dois. Não edite os arquivos à mão.`,
            '',
            `As skills \`producer-status\` e \`producer-roadmap\` (em \`${tool.skillsDir}/\`) explicam os comandos em detalhe.`,
            '',
            '## Como trabalhar nas tarefas',
            '',
            `1. Se nenhuma tarefa for indicada, rode \`${CLI} next 5\` e pegue a primeira (as em andamento vêm antes).`,
            `2. Leia a tarefa (\`${CLI} show <id>\`) e a descrição da etapa no \`ROADMAP.md\` antes de mexer no código.`,
            `3. Marque o início com \`${CLI} set <id> doing\`.`,
            '4. Faça só o escopo da tarefa. Se ela for grande demais, crie tarefas menores (1 a 2 dias) com `add` e faça uma de cada vez.',
            `5. Ao concluir e verificar, rode \`${CLI} set <id> done\` e depois \`${CLI} status\` para dizer quanto falta na etapa.`,
            '6. Cite o id da tarefa no commit e inclua `ROADMAP.md` e `.producer/roadmap.json` no mesmo commit.',
            '7. Tarefas de arte, áudio ou design que não são código: prepare o que der (estrutura de pastas, placeholders, integração) e avise o que falta para a pessoa.',
        ];
        if (target === 'claude') {
            lines.push('', 'Use o comando `/proxima-tarefa` para começar a próxima tarefa pendente, ou `/proxima-tarefa <id>` para uma específica.');
        }
        lines.push('', `<!-- Exportado pelo Producer para ${tool.label}. -->`, '');
        return lines.join('\n');
    }

    function buildClaudeCommand() {
        return [
            '---',
            'description: Executa a próxima tarefa pendente do roadmap do Producer (ou a tarefa indicada)',
            'argument-hint: "[id da tarefa]"',
            '---',
            '',
            'Tarefa pedida: $ARGUMENTS',
            '',
            `- Se um id foi informado, trabalhe nessa tarefa (\`${CLI} show <id>\`). Senão, pegue a primeira de \`${CLI} next 5\`.`,
            `- Diga qual tarefa vai fazer e o plano em poucas linhas, e rode \`${CLI} set <id> doing\`.`,
            '- Implemente só o escopo da tarefa, respeitando a descrição da etapa no `ROADMAP.md`.',
            `- Ao terminar e verificar, rode \`${CLI} set <id> done\`, depois \`${CLI} status\`, e resuma o que foi feito e quanto falta na etapa.`,
            '',
        ].join('\n');
    }

    function buildAgentExportFiles(result, target, options = {}) {
        const model = buildAgentModel(result);
        const tool = TARGETS[target] || TARGETS.claude;
        const files = [{ path: tool.instructionsFile, content: buildAgentInstructions(model, target) }];
        if (target === 'claude') {
            files.push({ path: '.claude/commands/proxima-tarefa.md', content: buildClaudeCommand() });
        }
        Object.entries(options.kitFiles || {}).forEach(([path, content]) => files.push({ path, content }));
        return { model, files, fileName: `${slugify(model.title)}-${target}.zip` };
    }

    // ---- ZIP mínimo (sem compressão) para empacotar os arquivos no navegador ----

    const CRC_TABLE = (() => {
        const table = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
            table[n] = c >>> 0;
        }
        return table;
    })();

    function crc32(bytes) {
        let crc = 0xFFFFFFFF;
        for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    function dosDateTime(date) {
        const d = date || new Date();
        return {
            time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
            date: ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
        };
    }

    function createZip(files, date) {
        const enc = new TextEncoder();
        const { time, date: dosDate } = dosDateTime(date);
        const locals = [];
        const centrals = [];
        let offset = 0;

        files.forEach(file => {
            const name = enc.encode(file.path);
            const data = typeof file.content === 'string' ? enc.encode(file.content) : file.content;
            const crc = crc32(data);

            const local = new DataView(new ArrayBuffer(30));
            local.setUint32(0, 0x04034b50, true);
            local.setUint16(4, 20, true);
            local.setUint16(6, 0x0800, true); // nomes em UTF-8
            local.setUint16(8, 0, true);      // sem compressão
            local.setUint16(10, time, true);
            local.setUint16(12, dosDate, true);
            local.setUint32(14, crc, true);
            local.setUint32(18, data.length, true);
            local.setUint32(22, data.length, true);
            local.setUint16(26, name.length, true);
            local.setUint16(28, 0, true);
            locals.push(new Uint8Array(local.buffer), name, data);

            const central = new DataView(new ArrayBuffer(46));
            central.setUint32(0, 0x02014b50, true);
            central.setUint16(4, 20, true);
            central.setUint16(6, 20, true);
            central.setUint16(8, 0x0800, true);
            central.setUint16(10, 0, true);
            central.setUint16(12, time, true);
            central.setUint16(14, dosDate, true);
            central.setUint32(16, crc, true);
            central.setUint32(20, data.length, true);
            central.setUint32(24, data.length, true);
            central.setUint16(28, name.length, true);
            central.setUint32(42, offset, true);
            centrals.push(new Uint8Array(central.buffer), name);

            offset += 30 + name.length + data.length;
        });

        const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
        const end = new DataView(new ArrayBuffer(22));
        end.setUint32(0, 0x06054b50, true);
        end.setUint16(8, files.length, true);
        end.setUint16(10, files.length, true);
        end.setUint32(12, centralSize, true);
        end.setUint32(16, offset, true);

        const parts = [...locals, ...centrals, new Uint8Array(end.buffer)];
        const out = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
        let pos = 0;
        parts.forEach(part => { out.set(part, pos); pos += part.length; });
        return out;
    }

    const api = {
        TARGETS,
        buildAgentModel,
        buildAgentInstructions,
        buildClaudeCommand,
        buildAgentExportFiles,
        createZip,
        crc32,
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    root.AgentExport = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
