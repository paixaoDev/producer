const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  partitionSprintSections,
  partitionBacklogItems,
  selectMilestoneIdForTask,
  calculatePhaseCosts,
} = require('../workBacklogHelpers');

const scriptSource = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');

const sections = [
  { sprintNumber: 1, percentComplete: 100 },
  { sprintNumber: 2, percentComplete: 40 },
  { sprintNumber: 3, percentComplete: 100 },
  { sprintNumber: 4, percentComplete: 0 },
];

const result = partitionSprintSections(sections);

assert.deepEqual(
  result.active.map(section => section.sprintNumber),
  [2, 4],
  'active sprints should keep their original order'
);

assert.deepEqual(
  result.completed.map(section => section.sprintNumber),
  [1, 3],
  'completed sprints should be moved to a separate list in original order'
);

const backlogItems = [
  { id: 'setup', percentComplete: 100 },
  { id: 'combat', percentComplete: 65 },
  { id: 'audio', percentComplete: 100 },
];

const backlogResult = partitionBacklogItems(backlogItems);

assert.deepEqual(
  backlogResult.active.map(item => item.id),
  ['combat'],
  'active backlog groups should stay in the main list'
);

assert.deepEqual(
  backlogResult.completed.map(item => item.id),
  ['setup', 'audio'],
  'completed backlog groups should move to the completed list'
);

const milestones = [
  { id: 'm1', type: 'prototype', month: 4 },
  { id: 'm2', type: 'demo', month: 8 },
  { id: 'm3', type: 'vertical_slice', month: 12 },
  { id: 'm4', type: 'alpha', month: 16 },
  { id: 'm5', type: 'beta', month: 20 },
  { id: 'm6', type: 'gold', month: 22 },
  { id: 'm7', type: 'release', month: 24 },
];

assert.equal(
  selectMilestoneIdForTask(
    { title: 'Implementar primeiro boss', description: 'Provar mecanica chave com um boss em arena cinza' },
    { title: 'Combate core' },
    { title: 'Programacao - Mecanicas chave', area: 'programming' },
    milestones,
    0.05
  ),
  'm1',
  'prototype should stay focused on one boss or one core mechanic'
);

assert.equal(
  selectMilestoneIdForTask(
    { title: 'Projetar state machines', description: 'Projetar state machines para 5 bosses com fases completas' },
    { title: 'Sistema de estados dos bosses' },
    { title: 'Programacao - Bosses', area: 'programming' },
    milestones,
    0.05
  ),
  'm4',
  'complete boss state machines should not be assigned to prototype'
);

assert.equal(
  selectMilestoneIdForTask(
    { title: 'Montar demo publica', description: 'Criar caminho curto com um personagem para interagir e luta com boss' },
    { title: 'Demo jogavel' },
    { title: 'Design - Demo', area: 'design' },
    milestones,
    0.2
  ),
  'm2',
  'demo should represent a sellable public loop'
);

assert.equal(
  selectMilestoneIdForTask(
    { title: 'Construir vertical slice', description: 'Hub, personagens, itens para pegar e dois bosses jogaveis' },
    { title: 'Fatia vertical' },
    { title: 'Design - Conteudo', area: 'design' },
    milestones,
    0.35
  ),
  'm3',
  'vertical slice should map to a representative slice of the game'
);

assert.equal(
  selectMilestoneIdForTask(
    { title: 'Definir style guide visual', description: 'Criar paleta, shape language e guia de materiais para assets temporarios jogaveis' },
    { title: 'Direcao visual jogavel' },
    { title: 'Arte - Pre-producao visual', area: 'art' },
    milestones,
    0.5
  ),
  'm1',
  'art prototype should include playable visual direction beyond concept art or the main character'
);

assert.equal(
  selectMilestoneIdForTask(
    { title: 'Guiar todos biomas', description: 'Definir style guide visual completo para todos os biomas e todas as fases finais' },
    { title: 'Direcao visual completa' },
    { title: 'Arte - Pre-producao visual', area: 'art' },
    milestones,
    0.05
  ),
  'm4',
  'alpha-scale art scope should not be assigned to prototype just because tasks are small'
);

const costResult = calculatePhaseCosts({
  objectives: [
    {
      area: 'programming',
      keyResults: [
        {
          tasks: [
            { estimatedDays: 2, milestoneId: 'm1' },
            { estimatedDays: 1, milestoneId: 'm2' },
          ],
        },
      ],
    },
    {
      area: 'art',
      keyResults: [
        {
          tasks: [
            { estimatedDays: 3, milestoneId: 'm1' },
          ],
        },
      ],
    },
  ],
  milestones: [
    { id: 'm1', title: 'Prototipo', type: 'prototype' },
    { id: 'm2', title: 'Demo', type: 'demo' },
  ],
  hourlyRates: { programming: 100, art: 50 },
  hoursPerDay: 6,
});

assert.equal(costResult.total.hours, 36, 'total hours should use 6 hours per estimated day');
assert.equal(costResult.total.cost, 2700, 'total cost should sum area hourly rates');
assert.equal(costResult.phases[0].hours, 30, 'prototype should include programming and art hours');
assert.equal(costResult.phases[0].cost, 2100, 'prototype cost should be grouped by milestone');
assert.equal(costResult.phases[0].areas.programming.cost, 1200, 'programming cost should use its hourly rate');
assert.equal(costResult.phases[0].areas.art.cost, 900, 'art cost should use its hourly rate');
assert.equal(costResult.phases[1].cost, 600, 'demo cost should include its own phase tasks');

assert.match(
  scriptSource,
  /Gere de 12 a 22 sub-áreas/,
  'subarea generation should keep the roadmap at a practical planning scale'
);

assert.match(
  scriptSource,
  /Entre 3 e 6 KRs concretos/,
  'each subarea should generate a focused number of KRs'
);

assert.match(
  scriptSource,
  /3-7 tarefas pequenas por KR/,
  'each KR should generate enough small sprint tasks without inflating phase scope'
);

assert.match(
  scriptSource,
  /1 ou 2 dias/,
  'generated tasks should stay small and quick to execute'
);

assert.match(
  scriptSource,
  /estimatedDays:\s*Math\.min\(2,/,
  'parsed generated tasks should be capped at two days'
);

assert.match(
  scriptSource,
  /Arte no prototipo:/,
  'prototype guidance should require playable art work beyond concept art or the main character'
);
