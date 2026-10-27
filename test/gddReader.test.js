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

// ---------- inventory ----------
const inv1 = R.parseInventoryMD(`## inimigos
- Jacaré Rei :: 3 fases
- Garça Sombria :: mergulho
## fases
- Pântano :: arena do Jacaré
## audio
- nenhum`);
const inv2 = R.parseInventoryMD(`## Inimigos (Inimigos e bosses)
- **Jacare rei** :: onda de água
## interface
- HUD de vida :: barra do boss`);
assert.equal(inv1.inimigos.length, 2);
assert.equal(inv1.audio, undefined, '"nenhum" should be ignored');
const merged = R.mergeInventories([inv1, inv2]);
assert.equal(merged.inimigos.length, 2, 'same name with different accents/case should be merged');
assert.match(merged.inimigos[0].detail, /3 fases; onda de água/);
assert.equal(R.inventoryCount(merged), 4);
const artInv = R.formatInventory(merged, { area: 'audio' });
assert.match(artInv, /Pântano/);
assert.doesNotMatch(artInv, /HUD de vida/, 'interface is not an audio category');

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
