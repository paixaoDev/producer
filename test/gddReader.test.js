const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const R = require('../gddReader.js');

const GDD = `# Capivara Rush

Boss rush 2D em pixel art.

## Mecânicas
O jogador atira com o botão X e esquiva com dash (0.2s de invencibilidade).

## Bosses
- Jacaré Rei: 3 fases, ataque de mordida e onda de água.
- Garça Sombria: voa e mergulha no player.

PERSONAGENS
Capi, a capivara protagonista.

Trilha:
Chiptune com 6 faixas.
`;

// ---------- splitSections ----------
const sections = R.splitSections(GDD);
assert.deepEqual(
  sections.map(s => s.title),
  ['Capivara Rush', 'Mecânicas', 'Bosses', 'PERSONAGENS', 'Trilha'],
  'should split on markdown, all-caps and "Title:" headings'
);
assert.match(sections[2].body, /Jacaré Rei/);

const longText = '# Longa\n' + Array.from({ length: 200 }, (_, i) => `Linha ${i} com bastante texto para encher.`).join('\n');
const longSections = R.splitSections(longText, { maxSectionChars: 1000 });
assert.ok(longSections.length > 3, 'long sections should be split in parts');
assert.ok(longSections.every(s => s.body.length <= 1000), 'parts should respect the size limit');

// ---------- chunkSections ----------
const chunks = R.chunkSections(longSections, 2500);
assert.ok(chunks.length >= 3);
assert.ok(chunks.every(c => c.length <= 2500 + 1100), 'chunks should stay close to the limit');
assert.equal(chunks.join('').match(/### /g).length, longSections.length, 'no section should be lost');

// ---------- findRelevantExcerpts ----------
const excerpt = R.findRelevantExcerpts(sections, 'Comportamento do boss Jacaré Rei');
assert.match(excerpt, /### Bosses/);
assert.doesNotMatch(excerpt, /Chiptune/);
assert.equal(R.findRelevantExcerpts(sections, 'de para com'), '', 'stopwords only should return nothing');

// ---------- feature document (incremental) ----------
let doc = R.createFeatureDoc();
doc = R.applyFeatureDocOps(doc, R.parseFeatureDocOps(`## NOVA: Dash
- categoria: mecânica
- resumo: esquiva rápida
- detalhe: 0.2s de invencibilidade

## NOVA: **Jacaré Rei**
- categoria: Boss
- resumo: primeiro boss
- conteudo: Fase 1 :: mordida
- depende de: Dash
`), { source: 'Mecânicas' });
assert.deepEqual(doc.features.map(f => [f.id, f.name, f.category]), [['F01', 'Dash', 'mecanica'], ['F02', 'Jacaré Rei', 'inimigo']]);
assert.deepEqual(doc.features[1].dependsOn, ['F01'], 'dependency by name becomes id');

// second chunk adds to existing features and creates a new one
const before = JSON.stringify(doc);
const doc2 = R.applyFeatureDocOps(doc, R.parseFeatureDocOps(`## ATUALIZA F02
- detalhe: 3 fases de combate
- conteudo: Fase 1 :: onda de água
- conteudo: Fase 2 :: investida

## NOVA: dash
- detalhe: cooldown 1s
- detalhe: 0.2s de invencibilidade

## ATUALIZA F99
- detalhe: ignorado

## NOVA: HUD de vida
- categoria: interface
- barra do boss no topo
`), { source: 'Bosses' });
assert.equal(JSON.stringify(doc), before, 'applying ops must not mutate the previous document');
assert.equal(doc2.features.length, 3, 'same name is merged and an unknown id without name is ignored');
const jacare = doc2.features.find(f => f.id === 'F02');
assert.deepEqual(jacare.details, ['3 fases de combate']);
assert.deepEqual(jacare.content.map(c => c.name), ['Fase 1', 'Fase 2']);
assert.equal(jacare.content[0].detail, 'mordida; onda de água');
assert.deepEqual(jacare.sources, ['Mecânicas', 'Bosses']);
assert.deepEqual(doc2.features[0].details, ['0.2s de invencibilidade', 'cooldown 1s'], 'duplicate details are skipped');
assert.equal(doc2.features[2].id, 'F03');
assert.deepEqual(doc2.features[2].details, ['barra do boss no topo'], 'plain bullet becomes a detail');

const index = R.formatFeatureIndex(doc2);
assert.match(index, /^F01 \[mecanica\] Dash — esquiva rápida$/m);
assert.doesNotMatch(R.formatFeatureIndex(doc2, { area: 'audio' }), /HUD/);
const spec = R.formatFeatureSpec(jacare);
assert.match(spec, /F02 — Jacaré Rei \(Inimigos e bosses\)/);
assert.match(spec, /- Fase 2 — investida/);
assert.match(spec, /Depende de: F01/);
const fullMd = R.featureDocToMarkdown(doc2, 'Capivara Rush');
assert.match(fullMd, /^# Capivara Rush/);
assert.ok(fullMd.indexOf('## Mecânicas') < fullMd.indexOf('## Inimigos'), 'grouped in category order');
assert.equal(R.featureDocCount(doc2), 3);

assert.deepEqual(R.findFeatureRefs('### [area: art] [ref: F01, f3, F01] Boss'), ['F01', 'F3']);
assert.deepEqual(R.findFeatureRefs('### [area: art] Boss'), []);

// ---------- parseTaskLine ----------
const t1 = R.parseTaskLine('- [ ] Implementar estado Ataque >> hitbox 0.3s | 2h | critical | feature | pronto quando: HP do player cai 10');
assert.equal(t1.title, 'Implementar estado Ataque');
assert.equal(t1.description, 'hitbox 0.3s');
assert.equal(t1.estimatedHours, 2);
assert.equal(t1.estimatedDays, 0.33);
assert.equal(t1.priority, 'critical');
assert.equal(t1.type, 'feature');
assert.equal(t1.doneWhen, 'HP do player cai 10');

const legacy = R.parseTaskLine('- [x] Modelar boss >> Blender | 2d | high | art');
assert.equal(legacy.estimatedHours, 12, 'legacy day estimates are converted to hours');
assert.equal(legacy.doneWhen, '');

const pipeInDesc = R.parseTaskLine('- [ ] Configurar input >> teclado | gamepad | 1,5h | medium | config');
assert.equal(pipeInDesc.description, 'teclado | gamepad');
assert.equal(pipeInDesc.estimatedHours, 1.5);

assert.equal(R.parseTaskLine('- [ ] Sem estimativa nenhuma'), null);
assert.equal(R.parseTaskLine('Texto solto | 2h'), null);
assert.equal(R.parseTaskLines('## X\n- [ ] A | 1h | low | doc\n- [ ] B | 3h | low | doc').length, 2);

// ---------- analyzeTaskGranularity ----------
const small = Array.from({ length: 8 }, () => ({ estimatedHours: 2 }));
assert.equal(R.analyzeTaskGranularity(small, 'prototype').ok, true);
assert.equal(R.analyzeTaskGranularity(small.slice(0, 3), 'prototype').tooFew, true);
const big = [...small, { title: 'Grande', estimatedHours: 12 }];
assert.equal(R.analyzeTaskGranularity(big, 'prototype').oversized.length, 1);

// scope notes and per-op source
const doc3 = R.applyFeatureDocOps(doc2, R.parseFeatureDocOps(`## ESCOPO
- detalhe: prazo total de 14 meses
- demo para o Next Fest com o Mangue

## NOVA: Garça
- categoria: inimigo
- detalhe: bicada em linha reta`), { source: op => `sec-${op.name}` });
assert.deepEqual(doc3.scopeNotes, ['prazo total de 14 meses', 'demo para o Next Fest com o Mangue']);
assert.equal(doc3.features.length, 4, 'scope block is not a feature');
assert.deepEqual(doc3.features[3].sources, ['sec-Garça']);
assert.match(R.featureDocToMarkdown(doc3), /## Notas de escopo e cronograma do GDD\n\n- prazo total de 14 meses/);
assert.equal(R.bestSectionTitle(sections, 'Garça Sombria mergulha'), 'Bosses');

// excerpts: weak matches dropped, cut at a boundary
const many = R.splitSections('# Arte\nPixel art com tiles.\n# Movimento\nPulo variável e dash. Coyote time de 0.1s. Wall jump liberado.\n# Inimigos\nUm inimigo usa dash.');
const ex = R.findRelevantExcerpts(many, 'pulo variável wall jump coyote dash', { maxChars: 400 });
assert.match(ex, /### Movimento/);
assert.doesNotMatch(ex, /### Arte/);
const longBody = R.formatExcerpts([{ id: 0, title: 'T', body: 'Primeira frase longa aqui. ' + 'palavra '.repeat(200) }], 400);
assert.match(longBody, /\[…\]$/);
assert.doesNotMatch(longBody, /palavr \[…\]|alavra[^ ]/);

// ---------- version budgets ----------
assert.equal(R.VERSION_BUDGETS.poc.weeks, 2, 'PoC takes two weeks');
assert.equal(R.VERSION_BUDGETS.prototype.weeks, 8, 'MVP takes two months');
assert.equal(R.formatWeeks(2), '2 semanas');
assert.equal(R.formatWeeks(8), '2 meses');
assert.equal(R.parseTeamSize('solo'), 1);
assert.equal(R.parseTeamSize('3 pessoas'), 3);
assert.equal(R.parseTeamSize('não especificado'), 1);
assert.equal(R.versionBudgetHours('poc', 1), 60);
assert.equal(R.versionBudgetHours('prototype', 2), 480);
const budget = R.checkVersionBudgets({ prototype: 100, poc: 90 }, 1);
assert.deepEqual(budget.map(r => [r.type, r.status]), [['poc', 'acima'], ['prototype', 'abaixo']], 'ordered by version');

// ---------- DOCX ----------
function buildZip(name, content) {
  const data = Buffer.from(content, 'utf8');
  const comp = zlib.deflateRawSync(data);
  const nameBuf = Buffer.from(name);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(comp.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(comp.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(nameBuf.length, 28);
  central.writeUInt32LE(0, 42);
  const localPart = Buffer.concat([local, nameBuf, comp]);
  const centralPart = Buffer.concat([central, nameBuf]);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(centralPart.length, 12);
  eocd.writeUInt32LE(localPart.length, 16);
  const buf = Buffer.concat([localPart, centralPart, eocd]);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
}

const xml = `<w:document><w:body>
<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Bosses</w:t></w:r></w:p>
<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/></w:numPr></w:pPr><w:r><w:t xml:space="preserve">Jacaré </w:t></w:r><w:r><w:t>Rei &amp; filhotes</w:t></w:r></w:p>
<w:p><w:pPr><w:pStyle w:val="Ttulo2"/><w:tabs><w:tab w:val="left" w:pos="100"/></w:tabs></w:pPr><w:r><w:t>Fases</w:t></w:r></w:p>
<w:p><w:r><w:t>Pântano</w:t></w:r><w:r><w:tab/><w:t>arena</w:t></w:r></w:p>
</w:body></w:document>`;

(async () => {
  const text = await R.extractDocxText(buildZip('word/document.xml', xml));
  assert.equal(text, '# Bosses\n- Jacaré Rei & filhotes\n## Fases\nPântano\tarena');
  assert.deepEqual(R.splitSections(text).map(s => s.title), ['Bosses', 'Fases']);
  await assert.rejects(() => R.extractDocxText(buildZip('outro.xml', xml)), /não encontrado/);
  console.log('gddReader tests passed');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
