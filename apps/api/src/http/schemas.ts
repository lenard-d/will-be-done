import { z } from "zod";

export const ErrorResponseSchema = z
  .object({
    code: z.enum([
      "BAD_REQUEST",
      "UNAUTHORIZED",
      "FORBIDDEN",
      "NOT_FOUND",
      "CONFLICT",
      "INTERNAL_SERVER_ERROR",
    ]),
    message: z.string(),
  })
  .describe("Error response");

export const PlacementSchema = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("first") }).strict(),
    z.object({ kind: z.literal("last") }).strict(),
    z
      .object({
        kind: z.literal("before"),
        anchorId: z
          .string()
          .min(1)
          .describe("Sibling to place the entity before"),
      })
      .strict(),
    z
      .object({
        kind: z.literal("after"),
        anchorId: z
          .string()
          .min(1)
          .describe("Sibling to place the entity after"),
      })
      .strict(),
  ])
  .describe("Position within an ordered collection");

export const ProjectSchema = z.object({
  id: z.string().describe("Project identifier"),
  title: z.string(),
  icon: z.string(),
  isInbox: z.boolean(),
  createdAt: z
    .number()
    .int()
    .nonnegative()
    .describe("Creation time as Unix milliseconds"),
  orderToken: z.string(),
});

export const ListProjectsParamsSchema = z.object({
  spaceId: z.string().min(1).describe("Space identifier"),
});

export const ListProjectsResponseSchema = z
  .object({
    projects: z.array(ProjectSchema),
  })
  .describe("Projects in display order");

export const ProjectParamsSchema = z.object({
  spaceId: z.string().min(1).describe("Space identifier"),
  projectId: z.string().min(1).describe("Project identifier"),
});

export const CreateProjectBodySchema = z
  .object({
    title: z.string().trim().min(1),
    icon: z.string().optional(),
    placement: PlacementSchema.optional(),
  })
  .strict();

export const ProjectResponseSchema = z.object({ project: ProjectSchema });

export const UpdateProjectBodySchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    icon: z.string().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field must be provided",
  });

export const MoveProjectBodySchema = z
  .object({ placement: PlacementSchema })
  .strict();

export const SpaceSchema = z.object({
  id: z.string().describe("Space identifier"),
  name: z.string(),
  createdAt: z.string().datetime().describe("Creation time in ISO 8601 format"),
  updatedAt: z.string().datetime().describe("Update time in ISO 8601 format"),
});

export const ListSpacesResponseSchema = z
  .object({
    spaces: z.array(SpaceSchema),
  })
  .describe("Spaces belonging to the authenticated user");

export const CreateSpaceBodySchema = z.object({
  name: z.string().trim().min(1).describe("Space name"),
});

export const CreateSpaceResponseSchema = z.object({
  space: SpaceSchema,
});

export const DeleteSpaceParamsSchema = z.object({
  spaceId: z.string().min(1).describe("Space identifier"),
});

export const ProjectCategoriesParamsSchema = z.object({
  spaceId: z.string().min(1).describe("Space identifier"),
  projectId: z.string().min(1).describe("Project identifier"),
});

export const ProjectCategorySchema = z.object({
  id: z.string().describe("Project category identifier"),
  projectId: z.string().describe("Parent project identifier"),
  title: z.string(),
  createdAt: z
    .number()
    .int()
    .nonnegative()
    .describe("Creation time as Unix milliseconds"),
});

export const ListProjectCategoriesResponseSchema = z.object({
  categories: z.array(ProjectCategorySchema),
});

export const CategoryParamsSchema = z.object({
  spaceId: z.string().min(1).describe("Space identifier"),
  categoryId: z.string().min(1).describe("Project category identifier"),
});

export const CreateProjectCategoryBodySchema = z
  .object({
    title: z.string().trim().min(1),
    placement: PlacementSchema.optional(),
  })
  .strict();

export const ProjectCategoryResponseSchema = z.object({
  category: ProjectCategorySchema,
});

export const UpdateProjectCategoryBodySchema = z
  .object({
    title: z.string().trim().min(1).optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field must be provided",
  });

export const MoveProjectCategoryBodySchema = z
  .object({
    projectId: z.string().min(1),
    placement: PlacementSchema,
  })
  .strict();

export const CategoryTasksParamsSchema = z.object({
  spaceId: z.string().min(1).describe("Space identifier"),
  categoryId: z.string().min(1).describe("Project category identifier"),
});

export const TaskParamsSchema = z.object({
  spaceId: z.string().min(1).describe("Space identifier"),
  taskId: z.string().min(1).describe("Task identifier"),
});

export const TaskStateSchema = z.enum(["todo", "done"]);
export const TaskNatureSchema = z.enum(["red", "green", "unknown"]);

export const TaskSchema = z.object({
  type: z.literal("task"),
  id: z.string().describe("Task identifier"),
  title: z.string(),
  content: z.string().optional(),
  state: TaskStateSchema,
  projectCategoryId: z.string().describe("Parent project category identifier"),
  nature: TaskNatureSchema,
  createdAt: z
    .number()
    .int()
    .nonnegative()
    .describe("Creation time as Unix milliseconds"),
  lastToggledAt: z
    .number()
    .int()
    .nonnegative()
    .describe("Last state change time as Unix milliseconds"),
});

export const TaskTemplateSchema = z.object({
  type: z.literal("template"),
  id: z.string().describe("Task template identifier"),
  title: z.string(),
  content: z.string().optional(),
  projectCategoryId: z.string().describe("Parent project category identifier"),
  nature: TaskNatureSchema,
  repeatRule: z.string(),
  repeatRuleDtStart: z.number().int().nonnegative(),
  createdAt: z.number().int().nonnegative(),
  lastGeneratedAt: z.number().int().nonnegative(),
});

export const CardSchema = z.discriminatedUnion("type", [
  TaskSchema,
  TaskTemplateSchema,
]);

export const ListCategoryCardsQuerySchema = z.object({
  taskState: TaskStateSchema.optional().default("todo"),
});

export const ListCategoryCardsResponseSchema = z.object({
  cards: z.array(CardSchema),
});

export const CreateTaskBodySchema = z
  .object({
    title: z.string().trim().min(1),
    content: z.string().optional(),
    nature: TaskNatureSchema.optional(),
    placement: PlacementSchema.optional(),
  })
  .strict();

export const TaskResponseSchema = z.object({ task: TaskSchema });

export const ScheduleTaskBodySchema = z
  .object({
    date: z.iso.date().describe("Schedule date in YYYY-MM-DD format"),
    placement: PlacementSchema.optional(),
  })
  .strict();

export const ScheduleTaskResponseSchema = z.object({
  task: TaskSchema,
  date: z.iso.date(),
});

export const UpdateTaskBodySchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    content: z.string().optional(),
    state: TaskStateSchema.optional(),
    nature: TaskNatureSchema.optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field must be provided",
  });

export const MoveTaskBodySchema = z
  .object({
    projectCategoryId: z.string().min(1),
    placement: PlacementSchema,
  })
  .strict();
