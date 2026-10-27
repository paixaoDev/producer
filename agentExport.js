(function (root) {
    // Exportação das tarefas do roadmap para agentes de código (Claude Code e Codex).
    // Gera um .zip com as tarefas em Markdown + JSON e o arquivo de instruções
    // que cada ferramenta lê automaticamente (CLAUDE.md ou AGENTS.md).

    const PHASE_ORDER = ['poc', 'prototype', 'demo', 'vertical_slice', 'alpha', 'beta', 'gold', 'release'];

    const AREA_LABELS = {
        programming: 'Programação',
        art: 'Arte',
        design: 'Design',
        audio: 'Áudio',
        qa: 'QA',
        production: 'Produção',
    };

    const TARGETS = {
        claude: { label: 'Claude Code', instructionsFile: 'CLAUDE.md' },
        codex: { label: 'Codex', instructionsFile: 'AGENTS.md' },
    };

    const TASKS_DIR = 'producer';

    function oneLine(value) {
        return String(value || '').replace(/\s+/g, ' ').trim();
    }

    function slugify(value) {
        return String(value || '')
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 50) || 'projeto';
    }

    function phaseIndex(type) {
        const idx = PHASE_ORDER.indexOf(String(type || '').toLowerCase());
        return idx === -1 ? PHASE_ORDER.length : idx;
    }

    // Achata objetivos → KRs → tarefas numa lista ordenada por marco,
    // com códigos curtos (T001, T002...) que o agente usa para se referir às tarefas.
    // isCompleted(objId, krId, taskId) diz se a tarefa já foi marcada na interface.
    function buildAgentTaskModel(result, isCompleted) {
        const done = typeof isCompleted === 'function' ? isCompleted : () => false;
        const milestones = (result?.milestones || []).map((m, i) => ({
            id: m.id || `ms_${m.type || i}`,
            title: oneLine(m.title) || `Marco ${i + 1}`,
            type: m.type || '',
            month: m.month,
            criteria: (m.criteria || []).map(oneLine).filter(Boolean),
            order: i,
        }));
        const byId = new Map(milestones.map(m => [m.id, m]));
        const fallback = { id: 'sem_marco', title: 'Sem marco definido', type: '', criteria: [], order: Infinity };

        const groups = new Map();
        (result?.objectives || []).forEach(obj => {
            (obj.keyResults || []).forEach(kr => {
                (kr.tasks || []).forEach(task => {
                    const ms = byId.get(task.milestoneId) || byId.get(obj.milestoneId) || fallback;
                    if (!groups.has(ms.id)) groups.set(ms.id, { milestone: ms, tasks: [] });
                    groups.get(ms.id).tasks.push({
                        id: task.id,
                        title: oneLine(task.title) || 'Tarefa sem título',
                        description: oneLine(task.description),
                        area: obj.area || 'programming',
                        areaLabel: AREA_LABELS[obj.area] || obj.area || 'Geral',
                        feature: oneLine(obj.title),
                        keyResult: oneLine(kr.title),
                        estimatedDays: task.estimatedDays || 1,
                        priority: task.priority || 'medium',
                        type: task.type || 'feature',
                        milestoneId: ms.id,
                        done: !!done(obj.id, kr.id, task.id),
                    });
                });
            });
        });

        const ordered = Array.from(groups.values()).sort((a, b) => {
            const ma = a.milestone, mb = b.milestone;
            if (Number.isFinite(ma.month) && Number.isFinite(mb.month) && ma.month !== mb.month) return ma.month - mb.month;
            const pa = phaseIndex(ma.type), pb = phaseIndex(mb.type);
            if (pa !== pb) return pa - pb;
            return ma.order - mb.order;
        });

        let seq = 0;
        ordered.forEach(group => group.tasks.forEach(task => {
            seq += 1;
            task.code = `T${String(seq).padStart(3, '0')}`;
        }));

        const tasks = ordered.flatMap(g => g.tasks);
        return {
            title: oneLine(result?.overview?.title) || 'Projeto',
            genre: oneLine(result?.genreLabel || result?.overview?.genre),
            description: oneLine(result?.overview?.description),
            groups: ordered,
            totalTasks: tasks.length,
            doneTasks: tasks.filter(t => t.done).length,
        };
    }

    function taskLine(task) {
        const meta = [task.areaLabel, `${task.estimatedDays}d`, task.priority, task.type].join(' · ');
        let line = `- [${task.done ? 'x' : ' '}] **${task.code}** ${task.title}\n  - ${meta}\n  - Feature: ${task.feature}`;
        if (task.keyResult && task.keyResult !== task.feature) line += ` › ${task.keyResult}`;
        if (task.description) line += `\n  - ${task.description}`;
        return line;
    }

    function buildTasksMarkdown(model) {
        const out = [
            `# Tarefas — ${model.title}`,
            '',
            `> Gerado pelo Producer. ${model.doneTasks}/${model.totalTasks} tarefas concluídas.`,
            '> Marque `[x]` ao concluir uma tarefa. Mantenha o código (T001...) para rastrear o progresso.',
            '',
        ];
        model.groups.forEach(group => {
            const ms = group.milestone;
            const done = group.tasks.filter(t => t.done).length;
            out.push(`## ${ms.title}${ms.type ? ` (${ms.type})` : ''} — ${done}/${group.tasks.length}`, '');
            if (ms.criteria.length) {
                out.push('Critérios de aceite do marco:');
                ms.criteria.forEach(c => out.push(`- ${c}`));
                out.push('');
            }
            group.tasks.forEach(task => out.push(taskLine(task)));
            out.push('');
        });
        return out.join('\n');
    }

    function buildTasksJSON(model, exportDate) {
        return JSON.stringify({
            project: model.title,
            genre: model.genre,
            exportDate: exportDate || new Date().toISOString(),
            totalTasks: model.totalTasks,
            doneTasks: model.doneTasks,
            milestones: model.groups.map(g => ({
                id: g.milestone.id,
                title: g.milestone.title,
                type: g.milestone.type,
                criteria: g.milestone.criteria,
                tasks: g.tasks.map(t => ({
                    code: t.code,
                    id: t.id,
                    title: t.title,
                    description: t.description,
                    area: t.area,
                    feature: t.feature,
                    keyResult: t.keyResult,
                    estimatedDays: t.estimatedDays,
                    priority: t.priority,
                    type: t.type,
                    status: t.done ? 'done' : 'todo',
                })),
            })),
        }, null, 2) + '\n';
    }

    function buildAgentInstructions(model, target) {
        const tool = TARGETS[target] || TARGETS.claude;
        const lines = [
            `# ${model.title}`,
            '',
            model.description || `Projeto de jogo${model.genre ? ` (${model.genre})` : ''} planejado com o Producer.`,
            '',
            '## Tarefas do projeto',
            '',
            `O backlog está em \`${TASKS_DIR}/tarefas.md\` (leitura humana) e \`${TASKS_DIR}/tarefas.json\` (leitura por script).`,
            'As tarefas estão ordenadas por marco (PoC → protótipo → ... → lançamento) e cada uma tem um código `T001`, `T002`...',
            '',
            '## Como trabalhar nas tarefas',
            '',
            '1. Se nenhuma tarefa for indicada, pegue a primeira tarefa `[ ]` do marco mais cedo que ainda tem pendências.',
            '2. Leia a descrição, a feature e os critérios de aceite do marco antes de mexer no código.',
            '3. Faça só o escopo da tarefa. Se ela for grande demais, divida em passos e conclua um de cada vez.',
            `4. Ao concluir, marque \`[x]\` na tarefa em \`${TASKS_DIR}/tarefas.md\` e mude o \`status\` para \`"done"\` em \`${TASKS_DIR}/tarefas.json\`.`,
            '5. Cite o código da tarefa na mensagem de commit (ex.: `T014: implementa pulo duplo`).',
            '6. Tarefas de arte, áudio ou design que não são código: prepare o que der (estrutura de pastas, placeholders, integração) e avise o que falta para a pessoa.',
        ];
        if (target === 'claude') {
            lines.push('', 'Use o comando `/proxima-tarefa` para começar a próxima tarefa pendente, ou `/proxima-tarefa T014` para uma específica.');
        }
        lines.push('', `<!-- Exportado pelo Producer para ${tool.label}. -->`, '');
        return lines.join('\n');
    }

    function buildClaudeCommand() {
        return [
            '---',
            'description: Executa a próxima tarefa pendente do roadmap do Producer (ou a tarefa indicada)',
            'argument-hint: "[código da tarefa, ex.: T014]"',
            '---',
            '',
            `Leia \`${TASKS_DIR}/tarefas.md\`.`,
            '',
            'Tarefa pedida: $ARGUMENTS',
            '',
            '- Se um código foi informado, trabalhe nessa tarefa. Senão, escolha a primeira tarefa `[ ]` do marco mais cedo com pendências.',
            '- Diga qual tarefa vai fazer e o plano em poucas linhas antes de começar.',
            '- Implemente só o escopo da tarefa, respeitando os critérios de aceite do marco.',
            `- Ao terminar, marque a tarefa como concluída em \`${TASKS_DIR}/tarefas.md\` e em \`${TASKS_DIR}/tarefas.json\`, e resuma o que foi feito.`,
            '',
        ].join('\n');
    }

    function buildAgentExportFiles(result, target, options = {}) {
        const model = buildAgentTaskModel(result, options.isCompleted);
        const tool = TARGETS[target] || TARGETS.claude;
        const files = [
            { path: tool.instructionsFile, content: buildAgentInstructions(model, target) },
            { path: `${TASKS_DIR}/tarefas.md`, content: buildTasksMarkdown(model) },
            { path: `${TASKS_DIR}/tarefas.json`, content: buildTasksJSON(model, options.exportDate) },
        ];
        if (target === 'claude') {
            files.push({ path: '.claude/commands/proxima-tarefa.md', content: buildClaudeCommand() });
        }
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
        buildAgentTaskModel,
        buildTasksMarkdown,
        buildTasksJSON,
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
