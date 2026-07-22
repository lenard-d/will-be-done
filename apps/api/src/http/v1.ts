import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { projectRoutes } from "./v1/projects";
import { spaceRoutes } from "./v1/spaces";
import { categoryRoutes } from "./v1/categories";
import { taskRoutes } from "./v1/tasks";

export const v1Routes: FastifyPluginAsyncZod = async (server) => {
  server.register(spaceRoutes);
  server.register(projectRoutes);
  server.register(categoryRoutes);
  server.register(taskRoutes);
};
