# E2E TODO

Note: you can add data- attrs to easily access needed component and make e2e tests more reliable.
Note: if you find bug during covering e2e - fix it.

## Current Coverage

- `apps/web/e2e/auth.spec.ts`: signup, sign out, sign in.
- `apps/web/e2e/task-persistence.spec.ts`: signup, create space, create today's task, reload persistence.
- `apps/web/e2e/sidebar-toggle.spec.ts`: create space and toggle the sidebar trigger.
- `apps/web/e2e/task-lifecycle.spec.ts`: create, edit, toggle done/todo, and delete across Today and Inbox.
- `apps/web/e2e/task-details-checklist.spec.ts`: open task details, edit description, create/check checklist item, and verify persistence.
- `apps/web/e2e/offline-local-first.spec.ts`: create and edit a task while offline, then reconnect/reload and verify persistence.
- `apps/web/e2e/backup-restore.spec.ts`: restore a tiny JSON backup through Settings, verify imported project/task/checklist/schedule, and reload persistence.

## Setup Work First

- [x] Add shared Playwright helpers/fixtures for repeated setup:
  - Added `apps/web/e2e/helpers.ts` and refactored existing auth, task persistence, and sidebar specs to use it.
  - [x] `signupUser`
  - [x] `createSpace`
  - [x] `openSpace`
  - [x] `createTodayTask`
  - [x] `taskCard(title)`
- Prefer stable role/label selectors where possible.
- Add test ids only for hard-to-address app surfaces such as task cards, stash panel/button, card details panel, and task action controls.
- Avoid repeating full signup/space setup inside every spec once helpers exist.
- Consider using the existing `[DEV] Generate Test Data` flow for large-data tests, but keep core user workflows driven through normal UI.

## Priority Specs

### 1. [x] Task Lifecycle Across Views

Create a task in Today, edit it, mark it done/todo, delete it, and verify the changes across Today and Inbox/project views.

Status: Done. Added `apps/web/e2e/task-lifecycle.spec.ts` covering Today task creation, title edit persistence after reload, done/todo transitions with Inbox count changes, Inbox reflection, and full-task deletion from Today removing the task from Inbox after reload. Added shared `openTaskActions` helper.

Checks:

- Task appears after creation.
- Edited title persists after reload.
- Done state updates visual state/counts.
- Deleted task disappears after reload.
- Inbox/project view reflects the same task state.

### 2. [x] Stash Workflow

Status: Done. Added `apps/web/e2e/stash-workflow.spec.ts` covering stashing a Today task through the task action menu, removal from the Today projection, stash count updates, `\` open/close behavior, visibility from Today and Inbox, and persistence after reload. Added stash-specific e2e helpers and stable stash `data-testid` hooks.

Create a task, stash it through keyboard shortcut `S` or the task action menu, toggle stash with `\`, and verify it remains available from multiple pages.

Checks:

- Stashed task disappears from the original scheduled/project placement if expected.
- Stash count updates.
- Stash opens/closes with `\`.
- Task is visible in Stash from Today and from a Project page.
- Stash contents persist after reload.

### 3. [x] Scheduling And Clearing Schedule

Status: Done. Added `apps/web/e2e/scheduling.spec.ts` covering Inbox task creation through the project column keyboard-add path, scheduling that task for Today, clearing the schedule from the Today projection, verifying the task remains in Inbox, and reload persistence. Added shared `createProjectTask` helper.

Create a task in Inbox/project, schedule it for today or a selected date, then clear the schedule.

Checks:

- Unscheduled task is visible in project context.
- Scheduling places it on the date board.
- Clearing schedule removes it from the date board.
- Task remains in its project after schedule reset.
- State persists after reload.

### 4. [x] Task Details And Checklist

Status: Done. Added `apps/web/e2e/task-details-checklist.spec.ts` covering task details opening from a focused Today task, description editing, checklist item creation, checklist done-state toggling, board card checklist visibility, and reload persistence. Added shared `openTaskDetails` and `checklistItemRow` helpers.

Open details with `v` or the details toggle, edit description, add checklist items, check one off, reload, and verify the details remain.

Checks:

- Details panel opens for the focused task.
- Description saves.
- Checklist item can be created and edited.
- Checklist item done state saves.
- Board task indicates checklist presence if the UI exposes it.

### 5. [x] Keyboard Workflow Smoke

Status: Done. Added `apps/web/e2e/keyboard-workflow.spec.ts` covering a keyboard-driven Inbox planning loop: sibling creation with `o`/`O`, focus movement with `j`/`k`, done toggling with `space`, scheduling with `t`, clearing with `r`, stashing with `S`, stash toggle with `\`, details toggle with `v`, and zen close with `z`.

Cover one realistic keyboard-only planning loop rather than every shortcut individually.

Suggested flow:

- Create/focus a task.
- `o` creates a task below.
- `O` creates a task above.
- `j`/`k` move focus.
- `space` toggles done.
- `t` schedules for today.
- `r` clears schedule.
- `S` stashes.
- `z` closes stash/details/project view.

### 6. [x] Project Organization

Status: Done. Added `apps/web/e2e/project-organization.spec.ts` covering project creation through the sidebar prompt, opening the project route, creating a project task, moving it to another project through the card details move modal, sidebar count updates, destination project visibility, and reload persistence. Added shared `createProject` and `projectSidebarLink` helpers.

Create a project, add tasks to it, move a task to another project using the move modal, and verify sidebar/project counts.

Checks:

- New project appears in sidebar.
- Project route opens.
- Task appears under the selected project.
- Move modal moves task to another project.
- Source and destination project counts update.

### 7. [x] Recurring Task Happy Path

Status: Done. Added `apps/web/e2e/recurring-task.spec.ts` covering conversion of an Inbox task to a daily recurring template through the task action menu, repeat modal confirmation, visibility of both the template card and generated task instance, repeat metadata in details, and reload persistence. Added a shared
`templateCard` helper.

Convert a normal task into a recurring template and verify it survives reload.

Checks:

- `Make repeating` or `Convert to template` opens the repeat modal.
- Daily or weekly rule can be selected.
- Confirming creates a template/repeating card.
- Repeat metadata is visible in details.
- Reload preserves the template.

Note: if checking generated task instances, freeze browser time or use a controlled date to avoid flaky date-dependent assertions.

### 8. [x] Offline Local-First Write

Status: Done. Added `apps/web/e2e/offline-local-first.spec.ts` covering online signup/space setup, switching the browser context offline, creating and editing a Today task while offline, restoring the network, and verifying the edited task remains after reload.

Exercise the README promise that the app remains writable offline.

Suggested flow:

- Create/open a space while online.
- Set browser context offline or block API/WebSocket requests.
- Create and edit a task.
- Verify the UI updates immediately.
- Restore network.
- Reload and verify the task remains.

### 9. [x] Backup Restore Smoke

Status: Done. Added `apps/web/e2e/backup-restore.spec.ts` covering Settings -> Backup JSON restore with a tiny in-test backup fixture, native confirmation acceptance, restore success feedback, imported project/task/checklist rendering, scheduled Today placement, and reload persistence. Added shared `openSpaceSettings` helper plus stable restore/settings hooks.

Use Settings -> Backup -> Restore Backup with a tiny JSON backup.

Checks:

- Confirmation prompt appears.
- Restore success message appears.
- Imported project/task/checklist renders in the app.
- Reload keeps restored data.

### 10. TickTick Import Smoke

Use Settings -> Import -> TickTick CSV with a minimal CSV fixture.

Checks:

- Confirmation prompt appears.
- Import success message appears.
- Imported project and task render.
- Scheduled task from CSV appears on the expected date if included.

Parser edge cases already have unit coverage in `apps/slices/src/space/importer/ticktick.test.ts`, so e2e should only prove UI wiring.

## Defer Or Avoid Initially

- Todoist live API import: use API-level tests or mocked network before e2e.
- Docker self-hosting: better as a smoke/deployment test outside Playwright.
- Desktop global quick add: belongs in desktop-specific automation.
- Exhaustive keyboard matrix: keep one workflow smoke first.
- Exhaustive drag-and-drop: add one smoke later; prefer keyboard/action-menu flows for reliable coverage.
- Undo/redo: README marks it as planned/WIP, so do not cover until implemented.

## Suggested First Milestone

Implement these first:

1. Shared e2e helpers.
2. Task lifecycle across views.
3. Stash workflow.
4. Task details and checklist.
5. Scheduling and clearing schedule.

That gives coverage for the app's main README workflow: collect tasks, plan them on dates/projects, keep focus items in Stash, and persist local-first state.
