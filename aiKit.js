// ============================================================
// KIT DE IA — skills para Claude Code / Codex
// Gera os arquivos que vão junto com o projeto exportado:
//   .producer/roadmap.json   → roadmap com o status de cada tarefa
//   .producer/producer.js    → CLI sem dependências (status, statusline, next, show, set, add, sync)
//   ROADMAP.md               → roadmap legível do projeto, gerado a partir do JSON
//   .claude/skills/*         → skills para o Claude Code
//   .agents/skills/*         → as mesmas skills para o Codex
// ============================================================
(function (root) {
    // Núcleo compartilhado entre o navegador e a CLI. Precisa ser autocontido:
    // o código desta função é copiado como texto para dentro de .producer/producer.js.
    function kitCore() {
        const STAGE_LABELS = {
            poc: 'PoC', prototype: 'Protótipo', demo: 'Demo', vertical_slice: 'Vertical Slice',
            alpha: 'Alpha', beta: 'Beta', gold: 'Gold', release: 'Lançamento',
        };
        const STATUSES = ['todo', 'doing', 'done'];
        const NO_STAGE = '_sem_etapa';

        function taskDays(task) {
            const d = Number(task && task.estimatedDays);
            return d > 0 ? d : 1;
        }

        const KNOWN_STATUS_WORDS = ['todo', 'pendente', 'a fazer', 'done', 'feito', 'feita', 'concluido', 'concluida',
            'doing', 'fazendo', 'andamento', 'em andamento', 'wip', 'in_progress'];
        function isKnownStatus(value) {
            return KNOWN_STATUS_WORDS.includes(String(value || '').toLowerCase().trim());
        }

        function normalizeStatus(value) {
            const v = String(value || '').toLowerCase().trim();
            if (['done', 'feito', 'feita', 'concluido', 'concluida', 'ok', 'x', 'true'].includes(v)) return 'done';
            if (['doing', 'fazendo', 'andamento', 'em andamento', 'wip', 'progress', 'in_progress'].includes(v)) return 'doing';
            return 'todo';
        }

        function stageLabel(milestone) {
            if (!milestone) return 'Sem etapa';
            const type = String(milestone.type || '').toLowerCase();
            return milestone.title || STAGE_LABELS[type] || milestone.id;
        }

        function shortStageLabel(milestone) {
            if (!milestone) return 'Sem etapa';
            const type = String(milestone.type || '').toLowerCase();
            return STAGE_LABELS[type] || milestone.title || milestone.id;
        }

        function eachTask(roadmap, fn) {
            (roadmap.objectives || []).forEach(obj => {
                (obj.keyResults || []).forEach(kr => {
                    (kr.tasks || []).forEach(task => fn(task, kr, obj));
                });
            });
        }

        // Quanto falta em cada etapa (marco) do projeto, na ordem do cronograma
        function computeStageStatus(roadmap) {
            const milestones = (roadmap.milestones || []).slice()
                .sort((a, b) => (Number(a.month) || 0) - (Number(b.month) || 0));
            const byId = new Map();
            milestones.forEach(m => byId.set(m.id, {
                id: m.id, type: m.type || '', label: stageLabel(m), short: shortStageLabel(m),
                month: m.month, total: 0, done: 0, doing: 0, todo: 0,
                totalDays: 0, remainingDays: 0,
            }));
            const noStage = {
                id: NO_STAGE, type: '', label: 'Sem etapa', short: 'Sem etapa', month: Infinity,
                total: 0, done: 0, doing: 0, todo: 0, totalDays: 0, remainingDays: 0,
            };

            eachTask(roadmap, task => {
                const stage = byId.get(task.milestoneId) || noStage;
                const status = normalizeStatus(task.status);
                const days = taskDays(task);
                stage.total += 1;
                stage[status] += 1;
                stage.totalDays += days;
                if (status !== 'done') stage.remainingDays += days;
            });

            const stages = Array.from(byId.values());
            if (noStage.total > 0) stages.push(noStage);
            stages.forEach(s => {
                s.remaining = s.total - s.done;
                s.percent = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
                s.complete = s.total > 0 && s.remaining === 0;
            });

            const total = stages.reduce((acc, s) => {
                acc.total += s.total; acc.done += s.done; acc.doing += s.doing;
                acc.totalDays += s.totalDays; acc.remainingDays += s.remainingDays;
                return acc;
            }, { total: 0, done: 0, doing: 0, totalDays: 0, remainingDays: 0 });
            total.remaining = total.total - total.done;
            total.percent = total.total > 0 ? Math.round((total.done / total.total) * 100) : 0;

            const current = stages.find(s => s.total > 0 && !s.complete) || null;
            return { stages, total, currentId: current ? current.id : null };
        }

        function progressBar(percent, width) {
            const w = width || 10;
            const filled = Math.round((Math.max(0, Math.min(100, percent)) / 100) * w);
            return '█'.repeat(filled) + '░'.repeat(w - filled);
        }

        const STATUSLINE_LABELS = {
            poc: 'poc', prototype: 'proto', demo: 'demo', vertical_slice: 'slice',
            alpha: 'alpha', beta: 'beta', gold: 'gold', release: 'launch',
        };

        function statuslineLabel(stage) {
            const type = String(stage.type || '').toLowerCase().replace(/[\s-]+/g, '_');
            if (STATUSLINE_LABELS[type]) return STATUSLINE_LABELS[type];
            const word = String(stage.label || stage.id).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .toLowerCase().split(/[^a-z0-9]+/).find(Boolean);
            return word || String(stage.id);
        }

        // Uma linha só, para a statusline: "demo:68%  slice:33%  alpha:10%"
        function formatStatusline(roadmap, status) {
            const st = status || computeStageStatus(roadmap);
            const parts = st.stages
                .filter(s => s.total > 0 && s.id !== NO_STAGE)
                .map(s => `${statuslineLabel(s)}:${s.percent}%`);
            return parts.length ? parts.join('  ') : `total:${st.total.percent}%`;
        }

        // Tabela com quanto falta em cada etapa
        function formatStatusTable(roadmap, status) {
            const st = status || computeStageStatus(roadmap);
            const lines = ['| Etapa | Progresso | Feitas | Em andamento | Faltam | Dias restantes |', '|---|---|---|---|---|---|'];
            st.stages.filter(s => s.total > 0).forEach(s => {
                const marker = s.id === st.currentId ? '▶ ' : (s.complete ? '✓ ' : '');
                lines.push(`| ${marker}${s.label} | ${progressBar(s.percent)} ${s.percent}% | ${s.done}/${s.total} | ${s.doing} | ${s.remaining} | ~${s.remainingDays}d |`);
            });
            const t = st.total;
            lines.push(`| **Total** | ${progressBar(t.percent)} ${t.percent}% | ${t.done}/${t.total} | ${t.doing} | ${t.remaining} | ~${t.remainingDays}d |`);
            return lines.join('\n');
        }

        // Próximas tarefas pendentes da etapa atual (ou de uma etapa escolhida)
        function nextTasks(roadmap, limit, stageId) {
            const st = computeStageStatus(roadmap);
            const target = stageId || st.currentId;
            const prio = { high: 0, alta: 0, medium: 1, media: 1, low: 2, baixa: 2 };
            const list = [];
            eachTask(roadmap, (task, kr, obj) => {
                const sid = (roadmap.milestones || []).some(m => m.id === task.milestoneId) ? task.milestoneId : NO_STAGE;
                if (sid !== target) return;
                const status = normalizeStatus(task.status);
                if (status === 'done') return;
                list.push({ task, kr, obj, status });
            });
            list.sort((a, b) => {
                if (a.status !== b.status) return a.status === 'doing' ? -1 : 1;
                return (prio[String(a.task.priority || '').toLowerCase()] ?? 1) - (prio[String(b.task.priority || '').toLowerCase()] ?? 1);
            });
            return list.slice(0, limit || 10);
        }

        function findTask(roadmap, taskId) {
            let found = null;
            eachTask(roadmap, (task, kr, obj) => {
                if (!found && String(task.id) === String(taskId)) found = { task, kr, obj };
            });
            return found;
        }

        function setTaskStatus(roadmap, taskId, status) {
            const ref = findTask(roadmap, taskId);
            if (!ref) return false;
            ref.task.status = normalizeStatus(status);
            return true;
        }

        function addTask(roadmap, krId, fields) {
            let kr = null;
            (roadmap.objectives || []).forEach(o => (o.keyResults || []).forEach(k => { if (String(k.id) === String(krId)) kr = k; }));
            if (!kr) return null;
            const ids = new Set();
            eachTask(roadmap, t => ids.add(String(t.id)));
            let n = (kr.tasks || []).length + 1;
            let id = `${kr.id}-t${n}`;
            while (ids.has(id)) id = `${kr.id}-t${++n}`;
            const task = {
                id,
                title: fields.title,
                estimatedDays: Number(fields.days) > 0 ? Number(fields.days) : 1,
                priority: fields.priority || 'medium',
                type: fields.type || 'feature',
                status: normalizeStatus(fields.status),
            };
            const milestoneId = fields.milestone || (kr.tasks || []).find(t => t.milestoneId)?.milestoneId;
            if (milestoneId) task.milestoneId = milestoneId;
            kr.tasks = kr.tasks || [];
            kr.tasks.push(task);
            return task;
        }

        // ROADMAP.md do projeto, organizado por etapa → área → KR
        function buildRoadmapMarkdown(roadmap) {
            const st = computeStageStatus(roadmap);
            const title = (roadmap.metadata && roadmap.metadata.title) || (roadmap.overview && roadmap.overview.title) || 'Projeto';
            const out = [
                `# Roadmap — ${title}`,
                '',
                '> Gerado pelo Producer a partir de `.producer/roadmap.json`. Para mudar o status de uma tarefa,',
                '> marque a caixa aqui e rode `node .producer/producer.js sync`, ou use `node .producer/producer.js set <id> done`.',
                '',
                '## Quanto falta em cada etapa',
                '',
                formatStatusTable(roadmap, st),
                '',
            ];
            const milestoneIds = new Set((roadmap.milestones || []).map(m => m.id));
            st.stages.filter(s => s.total > 0).forEach(stage => {
                const icon = stage.complete ? '✅' : (stage.id === st.currentId ? '▶️' : '⏳');
                out.push(`## ${icon} ${stage.label} — ${stage.done}/${stage.total} (${stage.percent}%)`, '');
                const milestone = (roadmap.milestones || []).find(m => m.id === stage.id);
                if (milestone && milestone.description) out.push(milestone.description, '');
                (roadmap.objectives || []).forEach(obj => {
                    const krBlocks = [];
                    (obj.keyResults || []).forEach(kr => {
                        const tasks = (kr.tasks || []).filter(t => (milestoneIds.has(t.milestoneId) ? t.milestoneId : NO_STAGE) === stage.id);
                        if (!tasks.length) return;
                        krBlocks.push(`#### ${kr.title} \`${kr.id}\``);
                        tasks.forEach(t => {
                            const s = normalizeStatus(t.status);
                            const doing = s === 'doing' ? ' _(em andamento)_' : '';
                            krBlocks.push(`- [${s === 'done' ? 'x' : ' '}] ${t.title} — ${taskDays(t)}d \`${t.id}\`${doing}`);
                        });
                        krBlocks.push('');
                    });
                    if (krBlocks.length) out.push(`### ${obj.title}${obj.area ? ` (${obj.area})` : ''}`, '', ...krBlocks);
                });
            });
            return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
        }

        // Lê as caixas do ROADMAP.md e devolve { taskId: marcada? }
        function parseRoadmapCheckboxes(markdown) {
            const result = {};
            const re = /^\s*- \[([ xX])\] .*`([^`]+)`(?:\s+_\(em andamento\)_)?\s*$/gm;
            let m;
            while ((m = re.exec(String(markdown || '')))) result[m[2]] = m[1].toLowerCase() === 'x';
            return result;
        }

        // Aplica no JSON as caixas que mudaram no ROADMAP.md. Retorna quantas tarefas mudaram.
        function applyRoadmapCheckboxes(roadmap, markdown) {
            const boxes = parseRoadmapCheckboxes(markdown);
            let changed = 0;
            eachTask(roadmap, task => {
                if (!(task.id in boxes)) return;
                const isDone = normalizeStatus(task.status) === 'done';
                if (boxes[task.id] && !isDone) { task.status = 'done'; changed++; }
                else if (!boxes[task.id] && isDone) { task.status = 'todo'; changed++; }
            });
            return changed;
        }

        return {
            STATUSES, STAGE_LABELS, isKnownStatus, normalizeStatus, computeStageStatus, formatStatusline, formatStatusTable,
            nextTasks, findTask, setTaskStatus, addTask, buildRoadmapMarkdown, parseRoadmapCheckboxes,
            applyRoadmapCheckboxes,
        };
    }

    const core = kitCore();

    // ── CLI (.producer/producer.js) ─────────────────────────────
    function cliMain(core) {
        const fs = require('fs');
        const path = require('path');
        const ROADMAP_JSON = path.join(__dirname, 'roadmap.json');
        const ROADMAP_MD = path.join(__dirname, '..', 'ROADMAP.md');

        const load = () => JSON.parse(fs.readFileSync(ROADMAP_JSON, 'utf8'));
        const save = (roadmap) => {
            roadmap.metadata = roadmap.metadata || {};
            roadmap.metadata.updatedAt = new Date().toISOString();
            fs.writeFileSync(ROADMAP_JSON, JSON.stringify(roadmap, null, 2) + '\n');
            fs.writeFileSync(ROADMAP_MD, core.buildRoadmapMarkdown(roadmap));
        };
        const fail = (msg) => { console.error(msg); process.exit(1); };
        const flag = (args, name) => {
            const i = args.indexOf(`--${name}`);
            return i >= 0 ? args[i + 1] : undefined;
        };

        const [cmd, ...args] = process.argv.slice(2);
        switch (cmd) {
            case 'statusline': {
                // A statusline do Claude Code manda um JSON no stdin; não precisamos dele.
                try { console.log(core.formatStatusline(load())); }
                catch { console.log('Producer: .producer/roadmap.json não encontrado'); }
                break;
            }
            case 'status': {
                const roadmap = load();
                if (args.includes('--json')) console.log(JSON.stringify(core.computeStageStatus(roadmap), null, 2));
                else console.log(core.formatStatusTable(roadmap));
                break;
            }
            case 'next': {
                const roadmap = load();
                const limit = Number(args.find(a => /^\d+$/.test(a))) || 10;
                const list = core.nextTasks(roadmap, limit, flag(args, 'etapa'));
                if (!list.length) console.log('Nenhuma tarefa pendente nesta etapa.');
                list.forEach(({ task, kr, obj, status }) => {
                    console.log(`${status === 'doing' ? '▶' : '○'} ${task.id} — ${task.title} (${task.estimatedDays || 1}d, ${obj.area || '?'}, KR ${kr.id})`);
                });
                break;
            }
            case 'show': {
                const ref = core.findTask(load(), args[0]);
                if (!ref) fail(`Tarefa "${args[0]}" não encontrada.`);
                console.log(JSON.stringify({ objective: ref.obj.title, keyResult: ref.kr.title, task: ref.task }, null, 2));
                break;
            }
            case 'set': {
                const status = args[args.length - 1];
                const ids = args.slice(0, -1);
                if (!ids.length || !core.isKnownStatus(status)) {
                    fail('Uso: node .producer/producer.js set <id> [<id>...] <todo|doing|done>');
                }
                const roadmap = load();
                const missing = ids.filter(id => !core.setTaskStatus(roadmap, id, status));
                save(roadmap);
                console.log(`${ids.length - missing.length} tarefa(s) → ${core.normalizeStatus(status)}`);
                if (missing.length) fail(`Não encontradas: ${missing.join(', ')}`);
                break;
            }
            case 'add': {
                const krId = flag(args, 'kr');
                const title = flag(args, 'title');
                if (!krId || !title) fail('Uso: node .producer/producer.js add --kr <krId> --title "..." [--days 1] [--milestone m2] [--priority high] [--type feature]');
                const roadmap = load();
                const task = core.addTask(roadmap, krId, {
                    title, days: flag(args, 'days'), milestone: flag(args, 'milestone'),
                    priority: flag(args, 'priority'), type: flag(args, 'type'), status: flag(args, 'status'),
                });
                if (!task) fail(`KR "${krId}" não encontrado.`);
                save(roadmap);
                console.log(`Tarefa criada: ${task.id} — ${task.title}`);
                break;
            }
            case 'sync': {
                const roadmap = load();
                let changed = 0;
                if (fs.existsSync(ROADMAP_MD)) changed = core.applyRoadmapCheckboxes(roadmap, fs.readFileSync(ROADMAP_MD, 'utf8'));
                save(roadmap);
                console.log(`ROADMAP.md atualizado (${changed} tarefa(s) sincronizada(s) a partir das caixas).`);
                break;
            }
            default:
                console.log([
                    'Producer CLI — comandos:',
                    '  status [--json]                 quanto falta em cada etapa',
                    '  statusline                      uma linha para a statusline',
                    '  next [n] [--etapa <id>]         próximas tarefas da etapa atual',
                    '  show <id>                       detalhes de uma tarefa',
                    '  set <id>... <todo|doing|done>   muda o status e regenera o ROADMAP.md',
                    '  add --kr <id> --title "..."     cria uma tarefa nova',
                    '  sync                            aplica as caixas do ROADMAP.md e regenera',
                ].join('\n'));
        }
    }

    function buildCliSource() {
        return [
            '#!/usr/bin/env node',
            '// Gerado pelo Producer. Sem dependências: precisa só do Node 16+.',
            '// Uso: node .producer/producer.js help',
            "'use strict';",
            `const core = (${kitCore.toString()})();`,
            `(${cliMain.toString()})(core);`,
            '',
        ].join('\n');
    }

    // ── Skills ─────────────────────────────────────────────────
    function statusSkill(title) {
        return `---
name: producer-status
description: Mostra quanto falta em cada etapa (PoC, Protótipo, Demo, Vertical Slice, Alpha, Beta, Gold, Lançamento) do roadmap de ${title} e configura a statusline. Use quando perguntarem "quanto falta", "em que etapa estamos", "qual o progresso", pedirem a próxima tarefa, ou pedirem para configurar a statusline do projeto.
---

# Status do projeto por etapa

O roadmap do projeto fica em \`.producer/roadmap.json\` (exportado pelo Producer). A CLI \`.producer/producer.js\` calcula tudo — não conte tarefas à mão.

## Ver quanto falta

\`\`\`bash
node .producer/producer.js status        # tabela: feitas, em andamento, faltam e dias restantes por etapa
node .producer/producer.js status --json # mesmos dados em JSON
node .producer/producer.js next 5        # próximas 5 tarefas da etapa atual (em andamento primeiro)
\`\`\`

Ao responder, mostre a tabela e diga em uma frase qual é a etapa atual (marcada com ▶), quantas tarefas e dias faltam nela e quais são as próximas tarefas.

## Configurar a statusline

A statusline mostra o percentual concluído de cada etapa numa linha, por exemplo:

\`demo:68%  slice:33%  alpha:10%  beta:4%  gold:0%  launch:0%\`

**Claude Code:** adicione em \`.claude/settings.json\` (junte com o que já existir no arquivo, sem apagar outras chaves):

\`\`\`json
{
  "statusLine": { "type": "command", "command": "node .producer/producer.js statusline" }
}
\`\`\`

**Codex:** o Codex não executa comandos na barra de status. Rode \`node .producer/producer.js statusline\` no começo da sessão e sempre que terminar uma tarefa, e mostre a linha para a pessoa.

## Regras

- Nunca edite \`.producer/roadmap.json\` à mão para mudar status: use a skill \`producer-roadmap\`.
- Se o arquivo não existir, peça para exportar de novo no Producer (Ações → Exportar para Claude Code / Codex).
`;
    }

    function roadmapSkill(title) {
        return `---
name: producer-roadmap
description: Atualiza o roadmap de ${title} — marca tarefas como feitas ou em andamento, cria tarefas novas e regenera o ROADMAP.md e o .producer/roadmap.json que é importado de volta no site do Producer. Use sempre que terminar ou começar uma tarefa do roadmap, quando pedirem para atualizar o roadmap, ou quando surgir trabalho novo que não está no roadmap.
---

# Atualizar o roadmap

Existem duas cópias do roadmap, e a CLI mantém as duas iguais:

- **Projeto:** \`ROADMAP.md\` na raiz do repositório (para pessoas lerem).
- **Site:** \`.producer/roadmap.json\` (importado de volta no Producer, com o status de cada tarefa).

Sempre altere pela CLI. Ela grava o JSON e regenera o \`ROADMAP.md\` na mesma hora.

## Comandos

\`\`\`bash
node .producer/producer.js next 10                     # tarefas pendentes da etapa atual, com ids
node .producer/producer.js show <id>                   # detalhes de uma tarefa
node .producer/producer.js set <id> doing              # comecei
node .producer/producer.js set <id> [<id>...] done     # terminei (aceita vários ids)
node .producer/producer.js set <id> todo               # reabrir
node .producer/producer.js add --kr <krId> --title "Verbo + entrega concreta" --days 1 [--milestone <id>] [--priority high|medium|low]
node .producer/producer.js sync                        # se alguém marcou caixas no ROADMAP.md à mão
\`\`\`

## Fluxo de trabalho

1. **Antes de começar** algo do roadmap: encontre a tarefa (\`next\` ou procure o título no \`ROADMAP.md\`) e rode \`set <id> doing\`.
2. **Ao terminar**: confirme que a entrega funciona (build/teste rodando), depois \`set <id> done\`.
   Só marque como feita a tarefa cuja entrega está pronta. Trabalho parcial fica em \`doing\`.
3. **Trabalho novo** que apareceu no caminho: crie com \`add\` no KR certo, com tarefas pequenas (1 a 2 dias, um verbo e uma entrega verificável). Divida qualquer coisa maior que 2 dias em várias tarefas.
4. **No fim**, rode \`node .producer/producer.js status\` e informe à pessoa quanto falta na etapa atual.
5. **Commit:** inclua \`ROADMAP.md\` e \`.producer/roadmap.json\` no mesmo commit da mudança de código.

## Levar para o site

Para ver o progresso no site do Producer: abra o Producer, clique em **Importar JSON** e escolha \`.producer/roadmap.json\`. O status de cada tarefa (a fazer, em andamento, feita) volta para o quadro.

## Regras

- Não apague tarefas nem mude ids: o site usa os ids para casar o progresso.
- Não edite o \`ROADMAP.md\` diretamente além das caixas de seleção — ele é regenerado a cada comando.
`;
    }

    const SKILL_DIRS = { claude: '.claude/skills', codex: '.agents/skills' };

    // Mapa { caminho: conteúdo } com os arquivos do kit. options.target: 'claude' | 'codex' (padrão: os dois)
    function buildKitFiles(roadmap, options = {}) {
        const title = (roadmap.metadata && roadmap.metadata.title) || (roadmap.overview && roadmap.overview.title) || 'Projeto';
        const files = {
            '.producer/roadmap.json': JSON.stringify(roadmap, null, 2) + '\n',
            '.producer/producer.js': buildCliSource(),
            'ROADMAP.md': core.buildRoadmapMarkdown(roadmap),
        };
        const targets = SKILL_DIRS[options.target] ? [options.target] : Object.keys(SKILL_DIRS);
        targets.forEach(t => {
            files[`${SKILL_DIRS[t]}/producer-status/SKILL.md`] = statusSkill(title);
            files[`${SKILL_DIRS[t]}/producer-roadmap/SKILL.md`] = roadmapSkill(title);
        });
        return files;
    }

    const api = { ...core, buildCliSource, buildKitFiles };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }

    root.AiKit = api;
})(typeof globalThis !== 'undefined' ? globalThis : window);
