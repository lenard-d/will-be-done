import { selectFrom, selector, v } from "@will-be-done/hyperdb-lib";
import { inboxProjectId, projectById } from "./projects";
import { defaultProject } from "./projects";
import { Project, projectsTable } from "./tables";

export const allProjects = selector({
  name: "allProjects",
  args: {},
  handler: function* allProjects() {
    const projects = yield* selectFrom(projectsTable, "byOrderToken");
    return projects;
  },
});

export const allProjectsSorted = selector({
  name: "allProjectsSorted",
  args: {},
  handler: function* allProjectsSorted() {
    const projects = yield* selectFrom(projectsTable, "byOrderToken");
    return projects;
  },
});

export const projectChildrenIds = selector({
  name: "projectChildrenIds",
  args: {},
  handler: function* projectChildrenIds() {
    return (yield* allProjectsSorted({})).map((p) => p.id);
  },
});

export const projectChildrenIdsWithoutInbox = selector({
  name: "projectChildrenIdsWithoutInbox",
  args: {},
  handler: function* projectChildrenIdsWithoutInbox() {
    const projects = yield* allProjectsSorted({});
    return projects.filter((p) => !p.isInbox).map((p) => p.id);
  },
});

export const firstProjectChild = selector({
  name: "firstProjectChild",
  args: {},
  handler: function* firstProjectChild() {
    const ids = yield* projectChildrenIds({});
    const firstChildId = ids[0];
    return firstChildId ? yield* projectById({ id: firstChildId }) : undefined;
  },
});

export const lastProjectChild = selector({
  name: "lastProjectChild",
  args: {},
  handler: function* lastProjectChild() {
    const ids = yield* projectChildrenIds({});
    const lastChildId = ids[ids.length - 1];
    return lastChildId ? yield* projectById({ id: lastChildId }) : undefined;
  },
});

export const inboxProject = selector({
  name: "inboxProject",
  args: {},
  handler: function* inboxProject() {
    return (
      (yield* projectById({ id: yield* inboxProjectId({}) })) || defaultProject
    );
  },
});

export const projectSiblings = selector({
  name: "projectSiblings",
  args: { projectId: v.string() },
  handler: function* projectSiblings({ projectId }) {
    const ids = yield* projectChildrenIds({});
    const index = ids.findIndex((id) => id === projectId);

    if (index === -1)
      return [undefined, undefined] as [
        Project | undefined,
        Project | undefined,
      ];

    const beforeId = index > 0 ? ids[index - 1] : undefined;
    const afterId = index < ids.length - 1 ? ids[index + 1] : undefined;

    const before = beforeId ? yield* projectById({ id: beforeId }) : undefined;
    const after = afterId ? yield* projectById({ id: afterId }) : undefined;

    return [before, after] as [Project | undefined, Project | undefined];
  },
});

export const dropdownProjectsList = selector({
  name: "dropdownProjectsList",
  args: {},
  handler: function* dropdownProjectsList() {
    const projects = yield* allProjectsSorted({});
    return projects.map((p) => {
      return { value: p.id, label: p.title };
    });
  },
});
