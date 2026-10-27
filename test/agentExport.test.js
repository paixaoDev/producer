const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const {
  buildAgentTaskModel,
  buildAgentExportFiles,
  createZip,
  crc32,
} = require('../agentExport');

const result = {
  overview: { title: 'Capivara Rush', description: 'Bullet hell boss rush.' },
  genreLabel: 'Ação',
  milestones: [
    { id: 'ms_alpha', title: 'Alpha', type: 'alpha', criteria: ['Todos os bosses jogáveis'] },
    { id: 'ms_poc', title: 'Prova de conceito', type: 'poc', criteria: ['Movimento responsivo'] },
  ],
  objectives: [
    {
      id: 'obj_alpha_0', title: 'Bosses', area: 'programming', milestoneId: 'ms_alpha',
      keyResults: [{ id: 'kr1', title: 'Bosses', tasks: [
        { id: 't1', title: 'Padrão de tiro do boss 1', description: 'Espiral com 3 fases', estimatedDays: 2, priority: 'high', type: 'feature' },
      ] }],
    },
    {
      id: 'obj_poc_0', title: 'Movimento', area: 'programming', milestoneId: 'ms_poc',
      keyResults: [{ id: 'kr1', title: 'Movimento', tasks: [
        { id: 't1', title: 'Movimento 8 direções', estimatedDays: 1, priority: 'high', type: 'feature' },
        { id: 't2', title: 'Dash com i-frames', estimatedDays: 1, priority: 'medium', type: 'feature', milestoneId: 'ms_poc' },
      ] }],
    },
  ],
};

const isCompleted = (obj, kr, task) => obj === 'obj_poc_0' && task === 't1';

// Ordenação por fase do marco (poc antes de alpha) e códigos sequenciais
const model = buildAgentTaskModel(result, isCompleted);
assert.deepEqual(model.groups.map(g => g.milestone.id), ['ms_poc', 'ms_alpha']);
assert.deepEqual(model.groups.flatMap(g => g.tasks.map(t => t.code)), ['T001', 'T002', 'T003']);
assert.equal(model.groups[0].tasks[0].title, 'Movimento 8 direções');
assert.equal(model.totalTasks, 3);
assert.equal(model.doneTasks, 1);

// Claude Code: CLAUDE.md + comando /proxima-tarefa
const claude = buildAgentExportFiles(result, 'claude', { isCompleted, exportDate: '2026-01-01T00:00:00.000Z' });
const claudePaths = claude.files.map(f => f.path);
assert.deepEqual(claudePaths, ['CLAUDE.md', 'producer/tarefas.md', 'producer/tarefas.json', '.claude/commands/proxima-tarefa.md']);
assert.equal(claude.fileName, 'capivara-rush-claude.zip');
const tasksMd = claude.files[1].content;
assert.match(tasksMd, /- \[x\] \*\*T001\*\* Movimento 8 direções/);
assert.match(tasksMd, /- \[ \] \*\*T003\*\* Padrão de tiro do boss 1/);
assert.match(tasksMd, /Espiral com 3 fases/);
assert.match(tasksMd, /Movimento responsivo/);
const tasksJson = JSON.parse(claude.files[2].content);
assert.equal(tasksJson.milestones[0].tasks[0].status, 'done');
assert.equal(tasksJson.milestones[1].tasks[0].code, 'T003');
assert.match(claude.files[3].content, /\$ARGUMENTS/);

// Codex: AGENTS.md, sem comando do Claude
const codex = buildAgentExportFiles(result, 'codex');
assert.deepEqual(codex.files.map(f => f.path), ['AGENTS.md', 'producer/tarefas.md', 'producer/tarefas.json']);
assert.doesNotMatch(codex.files[0].content, /proxima-tarefa/);

// CRC32 conhecido
assert.equal(crc32(new TextEncoder().encode('123456789')), 0xCBF43926);

// O zip abre com unzip e preserva o conteúdo (incluindo acentos)
const zip = createZip(claude.files);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-export-'));
const zipPath = path.join(dir, 'out.zip');
fs.writeFileSync(zipPath, zip);
let hasUnzip = true;
try { execFileSync('unzip', ['-v'], { stdio: 'ignore' }); } catch { hasUnzip = false; }
if (hasUnzip) {
  execFileSync('unzip', ['-q', zipPath, '-d', path.join(dir, 'x')]);
  for (const file of claude.files) {
    assert.equal(fs.readFileSync(path.join(dir, 'x', file.path), 'utf8'), file.content);
  }
}
fs.rmSync(dir, { recursive: true, force: true });

// A interface chama o módulo
const scriptSource = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
assert.match(scriptSource, /function exportForAgent\(target\)/);
assert.match(html, /<script src="agentExport.js"><\/script>/);
assert.match(html, /exportForAgent\('claude'\)/);
assert.match(html, /exportForAgent\('codex'\)/);

console.log('agentExport tests passed');
