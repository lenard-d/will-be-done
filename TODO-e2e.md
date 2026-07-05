# E2E TODO

## Current Coverage

- `apps/web/e2e/auth.spec.ts`: signup, sign out, sign in.
- `apps/web/e2e/task-persistence.spec.ts`: signup, create space, create today's task, reload persistence.
- `apps/web/e2e/sidebar-toggle.spec.ts`: create space and toggle the sidebar trigger.

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

### 1. Task Lifecycle Across Views

Create a task in Today, edit it, mark it done/todo, delete it, and verify the changes across Today and Inbox/project views.

Checks:

- Task appears after creation.
- Edited title persists after reload.
- Done state updates visual state/counts.
- Deleted task disappears after reload.
- Inbox/project view reflects the same task state.

### 2. Stash Workflow

Create a task, stash it through keyboard shortcut `S` or the task action menu, toggle stash with `\`, and verify it remains available from multiple pages.

Checks:

- Stashed task disappears from the original scheduled/project placement if expected.
- Stash count updates.
- Stash opens/closes with `\`.
- Task is visible in Stash from Today and from a Project page.
- Stash contents persist after reload.

### 3. Scheduling And Clearing Schedule

Create a task in Inbox/project, schedule it for today or a selected date, then clear the schedule.

Checks:

- Unscheduled task is visible in project context.
- Scheduling places it on the date board.
- Clearing schedule removes it from the date board.
- Task remains in its project after schedule reset.
- State persists after reload.

### 4. Task Details And Checklist

Open details with `v` or the details toggle, edit description, add checklist items, check one off, reload, and verify the details remain.

Checks:

- Details panel opens for the focused task.
- Description saves.
- Checklist item can be created and edited.
- Checklist item done state saves.
- Board task indicates checklist presence if the UI exposes it.

### 5. Keyboard Workflow Smoke

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

### 6. Project Organization

Create a project, add tasks to it, move a task to another project using the move modal, and verify sidebar/project counts.

Checks:

- New project appears in sidebar.
- Project route opens.
- Task appears under the selected project.
- Move modal moves task to another project.
- Source and destination project counts update.

### 7. Recurring Task Happy Path

Convert a normal task into a recurring template and verify it survives reload.

Checks:

- `Make repeating` or `Convert to template` opens the repeat modal.
- Daily or weekly rule can be selected.
- Confirming creates a template/repeating card.
- Repeat metadata is visible in details.
- Reload preserves the template.

Note: if checking generated task instances, freeze browser time or use a controlled date to avoid flaky date-dependent assertions.

### 8. Offline Local-First Write

Exercise the README promise that the app remains writable offline.

Suggested flow:

- Create/open a space while online.
- Set browser context offline or block API/WebSocket requests.
- Create and edit a task.
- Verify the UI updates immediately.
- Restore network.
- Reload and verify the task remains.

### 9. Backup Restore Smoke

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
