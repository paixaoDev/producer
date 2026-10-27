const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const {
  buildAgentModel,
  buildAgentExportFiles,
  createZip,
  crc32,
} = require('../agentExport');
const AiKit = require('../aiKit');

const result = {
  overview: { title: 'Capivara Rush', description: 'Bullet hell boss rush.' },
  genreLabel: 'Ação',
  milestones: [
    { id: 'ms_alpha', title: 'Alpha', type: 'alpha', month: 9 },
    { id: 'ms_poc', title: 'Prova de conceito', type: 'poc', month: 1 },
  ],
  objectives: [
    {
      id: 'obj_alpha_0', title: 'Bosses', area: 'programming',
      keyResults: [{ id: 'kr1', title: 'Bosses', tasks: [
        { id: 't1', title: 'Padrão de tiro do boss 1', estimatedDays: 2, milestoneId: 'ms_alpha' },
      ] }],
    },
    {
      id: 'obj_poc_0', title: 'Movimento', area: 'programming',
      keyResults: [{ id: 'kr2', title: 'Movimento', tasks: [
        { id: 't2', title: 'Movimento 8 direções', estimatedDays: 1, milestoneId: 'ms_poc', status: 'done' },
        { id: 't3', title: 'Dash com i-frames', estimatedDays: 1, milestoneId: 'ms_poc' },
      ] }],
    },
  ],
};

const model = buildAgentModel(result);
assert.equal(model.title, 'Capivara Rush');
assert.equal(model.totalTasks, 3);

// Claude Code: CLAUDE.md + comando /proxima-tarefa + kit (roadmap, CLI, skills)
const claude = buildAgentExportFiles(result, 'claude', { kitFiles: AiKit.buildKitFiles(result, { target: 'claude' }) });
const claudePaths = claude.files.map(f => f.path);
assert.deepEqual(claudePaths, [
  'CLAUDE.md', '.claude/commands/proxima-tarefa.md',
  '.producer/roadmap.json', '.producer/producer.js', 'ROADMAP.md',
  '.claude/skills/producer-status/SKILL.md', '.claude/skills/producer-roadmap/SKILL.md',
]);
assert.equal(claude.fileName, 'capivara-rush-claude.zip');
assert.match(claude.files[0].content, /node \.producer\/producer\.js next 5/);
assert.match(claude.files[0].content, /\.claude\/skills\//);
assert.match(claude.files[1].content, /\$ARGUMENTS/);
assert.match(claude.files[1].content, /set <id> done/);
assert.match(claude.files.find(f => f.path === 'ROADMAP.md').content, /- \[x\] Movimento 8 direções — 1d `t2`/);

// Codex: AGENTS.md + skills em .agents/skills, sem comando do Claude
const codex = buildAgentExportFiles(result, 'codex', { kitFiles: AiKit.buildKitFiles(result, { target: 'codex' }) });
const codexPaths = codex.files.map(f => f.path);
assert.equal(codexPaths[0], 'AGENTS.md');
assert.ok(codexPaths.includes('.agents/skills/producer-status/SKILL.md'));
assert.ok(!codexPaths.some(p => p.startsWith('.claude/')));
assert.doesNotMatch(codex.files[0].content, /proxima-tarefa/);
assert.match(codex.files[0].content, /\.agents\/skills\//);

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
