import { z } from "zod";

export const ErrorResponseSchema = z
  .object({
    code: z.enum([
      "UNAUTHORIZED",
      "FORBIDDEN",
      "NOT_FOUND",
      "INTERNAL_SERVER_ERROR",
    ]),
    message: z.string(),
  })
  .describe("Error response");

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
