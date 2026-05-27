# Filtro de Marcos Jira-Style Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Jira-style searchable milestone filter for the backlog.

**Architecture:** Keep the existing static app structure. Add pure milestone filter helpers to `script.js`, test those helpers with Node, and use them from the existing `jiraRenderMilestoneFilters()` flow.

**Tech Stack:** Plain HTML, CSS, browser JavaScript, Node built-in `assert` for tests.

---

### Task 1: Milestone Filter Helpers

**Files:**
- Test: `tests/milestone-filter.test.js`
- Modify: `script.js`

- [ ] **Step 1: Write the failing test**

Create `tests/milestone-filter.test.js` with sample milestones and assertions for sorting, search matching, first milestone label, and selected milestone label.

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/milestone-filter.test.js`

Expected: FAIL because `jiraSortMilestonesForFilter` is not defined in the extracted helper scope.

- [ ] **Step 3: Write minimal implementation**

Add `jiraSortMilestonesForFilter`, `jiraNormalizeMilestoneText`, `jiraFilterMilestoneOptions`, `jiraGetMilestoneQuickLabel`, and `jiraGetMilestoneSelectedLabel` to `script.js`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/milestone-filter.test.js`

Expected: PASS.

### Task 2: Searchable Filter UI

**Files:**
- Modify: `script.js`
- Modify: `styles.css`

- [ ] **Step 1: Replace milestone chips**

Update `jiraRenderMilestoneFilters()` so it renders the first-milestone quick button, a search input, a suggestions popover, and a selected milestone pill instead of all milestone chips.

- [ ] **Step 2: Wire interactions**

Use existing `jiraSetMilestoneFilter()` for selecting and clearing. Add input, focus, keyboard escape, and outside-click handling.

- [ ] **Step 3: Style the field**

Add compact Jira-like styles for the search field, popover, suggestion rows, and selected pill.

- [ ] **Step 4: Verify manually**

Open the app and confirm the backlog filter can select by typing `proto`, clear the selection, and use the first milestone shortcut.
