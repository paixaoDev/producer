const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const AiKit = require('../aiKit');
const { createZip } = require('../agentExport');

const roadmap = {
  metadata: { title: 'Jogo Teste' },
  milestones: [
    { id: 'm2', title: 'Protótipo jogável', type: 'prototype', month: 3 },
    { id: 'm1', title: 'Prova de conceito', type: 'poc', month: 1 },
    { id: 'm3', title: 'Demo pública', type: 'demo', month: 6 },
  ],
  objectives: [
    {
      id: 'o1', title: 'Combate', area: 'programming',
      keyResults: [{
        id: 'kr1', title: 'Ataque básico',
        tasks: [
          { id: 't1', title: 'Spike do input', estimatedDays: 1, milestoneId: 'm1', status: 'done' },
          { id: 't2', title: 'Hitbox do ataque', estimatedDays: 2, milestoneId: 'm2', status: 'doing', priority: 'high' },
          { id: 't3', title: 'Combo de 3 golpes', estimatedDays: 2, milestoneId: 'm2' },
          { id: 't4', title: 'Polir feedback', estimatedDays: 1, milestoneId: 'm3' },
          { id: 't5', title: 'Sem marco', estimatedDays: 1 },
        ],
      }],
    },
  ],
};

// ── Status por etapa ─────────────────────────────────────────
const status = AiKit.computeStageStatus(roadmap);
assert.deepEqual(status.stages.map(s => s.id), ['m1', 'm2', 'm3', '_sem_etapa'], 'etapas seguem a ordem dos meses');
const [poc, proto, demo] = status.stages;
assert.equal(poc.complete, true);
assert.equal(proto.remaining, 2);
assert.equal(proto.remainingDays, 4);
assert.equal(proto.doing, 1);
assert.equal(status.currentId, 'm2', 'etapa atual é a primeira incompleta');
assert.equal(demo.percent, 0);
assert.equal(status.total.done, 1);
assert.equal(status.total.total, 5);

const line = AiKit.formatStatusline(roadmap);
assert.equal(line, 'poc:100%  proto:0%  demo:0%', 'statusline simples: etapa:percentual');
assert.ok(!line.includes('\n'), 'statusline tem uma linha só');

const next = AiKit.nextTasks(roadmap, 5);
assert.deepEqual(next.map(n => n.task.id), ['t2', 't3'], 'em andamento vem primeiro');

// ── Markdown ida e volta ─────────────────────────────────────
const md = AiKit.buildRoadmapMarkdown(roadmap);
assert.match(md, /- \[x\] Spike do input — 1d `t1`/);
assert.match(md, /- \[ \] Hitbox do ataque — 2d `t2` _\(em andamento\)_/);
const boxes = AiKit.parseRoadmapCheckboxes(md.replace('- [ ] Combo de 3 golpes', '- [x] Combo de 3 golpes'));
assert.equal(boxes.t3, true);
assert.equal(boxes.t2, false);

// ── Kit completo: zip válido + CLI funcionando ───────────────
const files = AiKit.buildKitFiles(roadmap);
for (const p of [
  '.producer/roadmap.json', '.producer/producer.js', 'ROADMAP.md',
  '.claude/skills/producer-status/SKILL.md', '.claude/skills/producer-roadmap/SKILL.md',
  '.agents/skills/producer-status/SKILL.md', '.agents/skills/producer-roadmap/SKILL.md',
]) assert.ok(files[p], `kit deve conter ${p}`);
assert.deepEqual(Object.keys(AiKit.buildKitFiles(roadmap, { target: 'claude' })).filter(p => p.includes('skills/')),
  ['.claude/skills/producer-status/SKILL.md', '.claude/skills/producer-roadmap/SKILL.md']);
assert.deepEqual(Object.keys(AiKit.buildKitFiles(roadmap, { target: 'codex' })).filter(p => p.includes('skills/')),
  ['.agents/skills/producer-status/SKILL.md', '.agents/skills/producer-roadmap/SKILL.md']);
for (const p of Object.keys(files).filter(p => p.endsWith('SKILL.md'))) {
  assert.match(files[p], /^---\nname: producer-[a-z]+\ndescription: .+\n---\n/, `${p} tem frontmatter de skill`);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aikit-'));
const zipPath = path.join(tmp, 'kit.zip');
fs.writeFileSync(zipPath, createZip(Object.entries(files).map(([p, content]) => ({ path: p, content }))));
let unzipped = false;
try {
  execFileSync('unzip', ['-q', zipPath, '-d', path.join(tmp, 'repo')]);
  unzipped = true;
} catch (err) {
  if (err.code !== 'ENOENT') throw err;
}
const repo = path.join(tmp, 'repo');
if (!unzipped) {
  for (const [p, c] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(repo, p)), { recursive: true });
    fs.writeFileSync(path.join(repo, p), c);
  }
}
for (const [p, c] of Object.entries(files)) {
  assert.equal(fs.readFileSync(path.join(repo, p), 'utf8'), c, `conteúdo de ${p} sobrevive ao zip`);
}

const cli = (...args) => execFileSync('node', ['.producer/producer.js', ...args], { cwd: repo, encoding: 'utf8', stdio: 'pipe' });
assert.equal(cli('statusline').trim(), line);
assert.match(cli('status'), /\| ▶ Protótipo jogável \| .* \| 0\/2 \| 1 \| 2 \| ~4d \|/);

cli('set', 't2', 't3', 'done');
let saved = JSON.parse(fs.readFileSync(path.join(repo, '.producer/roadmap.json'), 'utf8'));
assert.equal(AiKit.findTask(saved, 't3').task.status, 'done');
assert.match(fs.readFileSync(path.join(repo, 'ROADMAP.md'), 'utf8'), /- \[x\] Combo de 3 golpes/, 'set regenera o ROADMAP.md');
assert.equal(cli('statusline').trim(), 'poc:100%  proto:100%  demo:0%');

assert.throws(() => cli('set', 't4', 'banana'), 'status desconhecido falha');

const added = cli('add', '--kr', 'kr1', '--title', 'Som do golpe', '--days', '1', '--milestone', 'm3');
assert.match(added, /Tarefa criada: kr1-t6 — Som do golpe/);

const mdPath = path.join(repo, 'ROADMAP.md');
fs.writeFileSync(mdPath, fs.readFileSync(mdPath, 'utf8').replace('- [ ] Polir feedback', '- [x] Polir feedback'));
assert.match(cli('sync'), /1 tarefa\(s\) sincronizada/);
saved = JSON.parse(fs.readFileSync(path.join(repo, '.producer/roadmap.json'), 'utf8'));
assert.equal(AiKit.findTask(saved, 't4').task.status, 'done');
assert.equal(AiKit.findTask(saved, 'kr1-t6').task.milestoneId, 'm3');

fs.rmSync(tmp, { recursive: true, force: true });

// ── Integração com o site: export leva status, import restaura ──
const scriptSource = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
assert.match(scriptSource, /status: taskStatusFor\(obj, kr, t\)/, 'export inclui status da tarefa');
assert.match(scriptSource, /statusDataFromExport\(json\)/, 'import do export restaura o status');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
assert.match(html, /<script src="aiKit.js"><\/script>[\s\S]*<script src="script.js">/);
assert.match(scriptSource, /AiKit\.buildKitFiles\(buildExportData\(\), \{ target \}\)/, 'export para Claude/Codex inclui o kit');

console.log('aiKit tests passed');
