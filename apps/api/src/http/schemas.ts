import { z } from "zod";

export const ErrorResponseSchema = z
  .object({
    code: z.enum(["UNAUTHORIZED", "FORBIDDEN", "INTERNAL_SERVER_ERROR"]),
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
});

export const ListProjectsParamsSchema = z.object({
  spaceId: z.string().min(1).describe("Space identifier"),
});

export const ListProjectsResponseSchema = z
  .object({
    projects: z.array(ProjectSchema),
  })
  .describe("Projects in display order");
