const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('script.js', 'utf8');
const helperNames = [
    'jiraSortMilestonesForFilter',
    'jiraNormalizeMilestoneText',
    'jiraFilterMilestoneOptions',
    'jiraGetMilestoneQuickLabel',
    'jiraGetMilestoneSelectedLabel',
    'jiraGetMilestoneForObjective',
    'jiraGetMilestoneTaskLabel',
    'jiraGetSprintGroupLabel',
    'jiraBuildBacklogItemsForMilestoneFilter',
];
const helperStart = source.indexOf('function jiraSortMilestonesForFilter');
const helperEnd = source.indexOf('// ── Filtro de marco', helperStart);
const helperSource = helperNames.map(name => `globalThis.${name} = typeof ${name} === 'function' ? ${name} : undefined;`).join('\n');
const context = {};

vm.createContext(context);
vm.runInContext(`${source.slice(helperStart, helperEnd)}\n${helperSource}`, context);

const milestones = [
    { id: 'm3', title: 'Beta Fechada', month: 8, type: 'beta' },
    { id: 'm1', title: 'Prototipo Jogavel', month: 2, type: 'prototype' },
    { id: 'm2', title: 'Vertical Slice', month: 5, type: 'vertical_slice' },
];

assert.deepEqual(
    context.jiraSortMilestonesForFilter(milestones).map(ms => ms.id),
    ['m1', 'm2', 'm3'],
);

assert.equal(context.jiraNormalizeMilestoneText('Protótipo Jogável'), 'prototipo jogavel');

assert.deepEqual(
    context.jiraFilterMilestoneOptions(milestones, 'proto').map(ms => ms.id),
    ['m1'],
);

assert.deepEqual(
    context.jiraFilterMilestoneOptions(milestones, 'vertical slice').map(ms => ms.id),
    ['m2'],
);

assert.deepEqual(
    context.jiraFilterMilestoneOptions(milestones, 'mês 8').map(ms => ms.id),
    ['m3'],
);

assert.equal(
    context.jiraGetMilestoneQuickLabel(milestones[1]),
    'Primeiro marco: Prototipo Jogavel',
);

assert.equal(
    context.jiraGetMilestoneSelectedLabel(milestones[2]),
    'Vertical Slice · Mês 5',
);

assert.equal(
    context.jiraGetMilestoneForObjective({ startMonth: 1, endMonth: 4 }, milestones).id,
    'm1',
);

assert.equal(
    context.jiraGetMilestoneTaskLabel(milestones[1]),
    'Prototipo Jogavel',
);

assert.equal(
    context.jiraGetSprintGroupLabel(0),
    'Selecionar tudo',
);

const objectives = [
    {
        id: 'obj_proto',
        area: 'programming',
        startMonth: 1,
        endMonth: 4,
        keyResults: [{ id: 'kr_proto', tasks: [{ id: 't1' }] }],
    },
    {
        id: 'obj_beta',
        area: 'art',
        startMonth: 7,
        endMonth: 9,
        keyResults: [{ id: 'kr_beta', tasks: [{ id: 't2' }] }],
    },
];

assert.equal(
    JSON.stringify(
        context.jiraBuildBacklogItemsForMilestoneFilter(objectives, milestones, new Set(['programming', 'art']), 'm1')
            .map(item => [item.obj.id, item.kr.id, item.ms.id])
    ),
    JSON.stringify([['obj_proto', 'kr_proto', 'm1']]),
);

console.log('milestone-filter helpers ok');
