# Agent Notes

# Project structure

- `apps/web`: React web app built with Vite. Routes are in `src/routes`, UI components are in `src/components`, and browser storage and sync code are in `src/store`. Browser flow tests are in `e2e`.
- `apps/slices`: shared HyperDB schemas, selectors, and actions used by the web app and API. Space data is in `src/space`, user data is in `src/user`, and shared sync code is in `src/common`.
- `apps/api`: Bun server built with Fastify. The v1 HTTP API is in `src/http/v1`, server services are in `src/services`, and server database code is in `src/db`.
- `apps/desktop`: Electron app. Main process code is in `src/main`, preload code is in `src/preload`, and renderer code is in `src/renderer`.
- `apps/landing`: Astro website. Pages, components, and styles are in `src/pages`, `src/components`, and `src/styles`.
- `.guides`: project reference material, including the HyperDB guide.
- `.github/workflows/ci.yaml`: upstream continuous integration (CI) configuration, kept as a reference for checks.

# Development and checks

No CI runs have been confirmed for this fork. Run the relevant checks locally.
The workflow file is a reference, not evidence that checks have run. Report which
checks passed and which could not run.

Run the commands below from the repository root. Use the pnpm version set in
`package.json`. The API requires Bun.

Install dependencies with `pnpm install --frozen-lockfile`. Start the API with
`pnpm dev:server` and the web app with `pnpm dev:client` in separate terminals.

The commands are defined in the root and app `package.json` files:

| Command                          | Scope                                                              |
| -------------------------------- | ------------------------------------------------------------------ |
| `pnpm ts`                        | Type checks for web, slices, and API                               |
| `pnpm lint`                      | Lint checks for web, slices, and API                               |
| `pnpm test`                      | Unit tests for slices and web with Vitest, then API tests with Bun |
| `pnpm test:e2e`                  | Web browser flow tests with Playwright                             |
| `pnpm format:check`              | Repository formatting check with Prettier                          |
| `pnpm -C apps/api openapi:check` | Compare the generated API contract with `apps/api/openapi.json`    |
| `pnpm -C apps/desktop typecheck` | Desktop type checks                                                |
| `pnpm -C apps/desktop lint`      | Desktop lint checks                                                |
| `pnpm -C apps/desktop build`     | Desktop type checks and build                                      |
| `pnpm -C apps/landing build`     | Landing website build                                              |

For a check limited to web, slices, or API, use
`pnpm -C apps/<app> ts`, `pnpm -C apps/<app> lint`, or
`pnpm -C apps/<app> test`. Replace `<app>` with `web`, `slices`, or `api`.

The root type, lint, and unit test commands do not include desktop or landing.
Use the separate commands above when changing those apps.

After changing public API routes or schemas, run
`pnpm -C apps/api openapi:generate`, then
`pnpm -C apps/api openapi:check`. Review the change to `apps/api/openapi.json`.

Before the first browser test run, install Chromium with
`pnpm -C apps/web exec playwright install chromium`. Add `--with-deps` if the
required operating system dependencies are missing.

The upstream workflow also defines API compatibility and Flatpak packaging
checks (Flatpak is a Linux desktop package format). Do not assume these checks run
automatically in this fork. `openapi:check` checks the committed API contract;
it does not check compatibility with earlier API versions.

# Definitions

- Task: a concrete work item with a title, state, project section, order, and optional template origin.
- TaskNature: the optional color/nature marker for a Task or TaskTemplate: `red`, `green`, or `unknown`.
- TaskTemplate: a repeatable task blueprint that generates Tasks from a recurrence rule.
- Project: a top-level container for organizing project sections; one Project can be the inbox.
- Item: primary content shown in project sections. Currently a Task or TaskTemplate; may include other content such as Note in the future.
- ProjectSection: an ordered section inside a Project that contains Items directly. Tasks and TaskTemplates store their section and section order. Its persisted discriminator is `projectSection`.
- DailyList: a dated schedule list, identified by date, that contains DailyEntries.
- DailyEntry: a scheduled appearance of a Task in a DailyList. Its `id` is the Task id; it stores the DailyList and order for that task on that date. Its persisted discriminator is `dailyEntry`.
- Stash: the unscheduled holding area represented by StashEntries. It keeps items quickly accessible from any page.
- StashEntry: an unscheduled appearance of a Task in the stash. Its `id` is the Task id; it stores the stash order. Its persisted discriminator is `stashEntry`.
- Entry: a DailyEntry or StashEntry. This is a TypeScript union, not a shared database table.
- ListItem: an Item or Entry that can occupy an ordered view.
- ListItemType: the model type of a ListItem.
- ChecklistItem: an ordered checklist row attached to a Task or TaskTemplate.
- ChecklistParentType: the model types that can own ChecklistItems: Task or TaskTemplate.
- ProjectSectionTaskStats: derived counts of total, todo, and done Tasks for a ProjectSection.
- ScheduledTodoTask: a derived index row for a todo Task scheduled through a DailyEntry.
- SpaceMigration: a record that a space-level migration has been applied.
- Model / AnyModel: a syncable domain object from the space tables.
- ModelType / AnyModelType: a model discriminator used to route domain objects and include the virtual `stash` type.
- Table: a HyperDB table that stores one kind of model or derived record.

# HyperDB

If you are interacting with HyperDB(@will-be-done/hyperdb), read small guide what is it, and how
to work with it at @.guides/hyperdb.md

# API Support

When adding new functionality to `apps/slices`, also check whether it should be exposed through
the v1 HTTP API in `apps/api/src/http/v1`, and update the API when appropriate.
