# Agent Notes

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
