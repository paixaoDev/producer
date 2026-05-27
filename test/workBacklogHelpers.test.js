const assert = require('node:assert/strict');
const { partitionSprintSections, partitionBacklogItems } = require('../workBacklogHelpers');

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
