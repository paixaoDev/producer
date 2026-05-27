# Redesign Workspace Produto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the results screen into a compact product workspace with Cronograma, Backlog and Board as primary tabs, plus a right-side contextual panel for secondary data.

**Architecture:** Keep the static app structure. Update `index.html` to introduce workspace wrappers, tab targets, and the side rail. Update `script.js` to switch workspace tabs, open side panels, and render task descriptions when present. Update `styles.css` to replace the current large-card/gradient feel with a sober product UI.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, Font Awesome, existing Node smoke test.

---

### Task 1: Workspace Markup

**Files:**
- Modify: `index.html`

- [x] **Step 1: Replace the results header and separate roadmap/backlog sections with workspace structure**

Wrap the current project overview, roadmap card, milestones, Jira shell and edital blocks inside a new workspace container. Add:

```html
<div class="product-workspace" id="productWorkspace">
    <div class="workspace-topbar">...</div>
    <div class="workspace-body">
        <main class="workspace-main">
            <div class="workspace-tabs" role="tablist">...</div>
            <section class="workspace-panel active" id="workspaceTimelinePanel">...</section>
            <section class="workspace-panel" id="workspaceBacklogPanel">...</section>
            <section class="workspace-panel" id="workspaceBoardPanel">...</section>
        </main>
        <aside class="workspace-side-rail">...</aside>
        <aside class="workspace-drawer" id="workspaceDrawer">...</aside>
    </div>
</div>
```

Move the existing `roadmap-card` into `workspaceTimelinePanel`. Move `jiraShell` into the workspace and keep both `jiraBacklogView` and `jiraBoardView` inside it. Move `projectOverview`, `milestonesContainer`, `teamConfigPanel`, and `editalContainer` into drawer content templates.

- [x] **Step 2: Preserve existing IDs**

Keep these IDs unchanged because existing JavaScript depends on them:

```text
resultsProjectTitle
saveProjectBtn
importJsonBtn
exportBtn
newAnalysisBtn
projectOverview
overviewContent
roadmapCard
teamConfigPanel
timelineToggleGroup
timeline
milestonesContainer
milestonesGrid
jiraShell
jiraNavBacklog
jiraNavBoard
jiraBoardSprintBar
jiraRoleAvatars
jiraMilestoneFiltersBar
jiraBacklogView
jiraBacklogSprints
jiraBoardView
kanbanBoard
editalContainer
editalContent
```

### Task 2: Workspace JavaScript

**Files:**
- Modify: `script.js`

- [x] **Step 1: Add workspace tab state and side panel helpers**

Add functions near the Jira navigation section:

```js
let workspaceActiveTab = 'timeline';
let workspaceActiveDrawer = null;

function setWorkspaceTab(tab) {
    workspaceActiveTab = tab;
    document.querySelectorAll('[data-workspace-tab]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.workspaceTab === tab);
    });
    document.querySelectorAll('[data-workspace-panel]').forEach(panel => {
        panel.classList.toggle('active', panel.dataset.workspacePanel === tab);
    });
    if (tab === 'backlog') jiraSetView('backlog');
    if (tab === 'board') jiraSetView('board');
}

function openWorkspaceDrawer(panel) {
    workspaceActiveDrawer = panel;
    const drawer = document.getElementById('workspaceDrawer');
    if (!drawer) return;
    document.querySelectorAll('[data-drawer-panel]').forEach(el => {
        el.hidden = el.dataset.drawerPanel !== panel;
    });
    document.querySelectorAll('[data-workspace-drawer]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.workspaceDrawer === panel);
    });
    drawer.classList.add('open');
}

function closeWorkspaceDrawer() {
    workspaceActiveDrawer = null;
    document.getElementById('workspaceDrawer')?.classList.remove('open');
    document.querySelectorAll('[data-workspace-drawer]').forEach(btn => btn.classList.remove('active'));
}
```

- [x] **Step 2: Keep Jira tab buttons in sync**

Update `jiraSetView(view)` so switching to backlog or board also marks the workspace tab active when the workspace exists. Avoid recursion by only toggling classes directly when called from `setWorkspaceTab`.

### Task 3: Task Description Rendering

**Files:**
- Modify: `script.js`

- [x] **Step 1: Add safe description helper**

Add:

```js
function jiraTaskDescription(task) {
    const value = task?.description || task?.desc || task?.details || '';
    return String(value || '').trim();
}
```

- [x] **Step 2: Render optional descriptions in backlog rows**

Replace the single title span in each `jira-sprint-task-row` with a text block:

```html
<span class="jira-task-copy">
    <span class="jira-task-title ${isDone ? 'done-title' : ''}">${t.title}</span>
    ${jiraTaskDescription(t) ? `<span class="jira-task-desc">${jiraTaskDescription(t)}</span>` : ''}
</span>
```

- [x] **Step 3: Render optional descriptions in board cards**

In `jiraCreateCard`, add:

```html
${jiraTaskDescription(task) ? `<div class="kcard-desc">${jiraTaskDescription(task)}</div>` : ''}
```

below the card title and above metadata.

### Task 4: Product Visual System

**Files:**
- Modify: `styles.css`

- [x] **Step 1: Update global palette**

Set the body background to a sober product background and change primary blue:

```css
:root {
    --primary-color: #0c66e4;
    --primary-dark: #0747a6;
    ...
}

body {
    background: #f4f5f7;
}
```

- [x] **Step 2: Add workspace layout CSS**

Add styles for:

```css
.product-workspace
.workspace-topbar
.workspace-brand
.workspace-title-block
.workspace-actions
.workspace-body
.workspace-main
.workspace-tabs
.workspace-tab
.workspace-panel
.workspace-side-rail
.workspace-rail-btn
.workspace-drawer
.workspace-drawer.open
.workspace-drawer-header
.workspace-drawer-panel
```

The drawer should be fixed/absolute on the right, white, bordered, and overlay content on mobile.

- [x] **Step 3: Tone down existing cards**

Update `.roadmap-card`, `.jira-shell`, `.milestones-container`, `.project-overview`, and `.edital-container` to use smaller radii, lighter shadows, and neutral headers.

- [x] **Step 4: Improve backlog and board task density**

Update:

```css
.jira-sprint-task-row
.jira-task-copy
.jira-task-title
.jira-task-desc
.kcard
.kcard-title
.kcard-desc
.kcard-context
```

Ensure long text truncates or wraps without overlapping metadata.

### Task 5: Verification

**Files:**
- Test: `tests/milestone-filter.test.js`
- Manual: `index.html`

- [x] **Step 1: Run existing smoke test**

Run:

```bash
node tests/milestone-filter.test.js
```

Expected:

```text
milestone-filter helpers ok
```

- [ ] **Step 2: Open the app locally**

Open `index.html` in a browser or serve it with a simple local server.

- [ ] **Step 3: Manual UI checks**

Confirm:

```text
Cronograma, Backlog and Board tabs switch correctly.
Backlog filters still render.
Board still renders selected tasks.
Side rail opens Marcos, Resumo, Equipe and Edital drawers.
No task row overlaps with long titles.
Mobile width keeps tabs usable and drawer overlays content.
```
