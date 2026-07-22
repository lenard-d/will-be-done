import type { FastifyPluginOptions } from "fastify";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  authenticateBearerToken,
  type AuthenticatedUser,
} from "../services/authentication";
import { DatabaseAccessDeniedError } from "../services/databaseAccess";
import { listSpaceProjects, type PublicProject } from "../services/projects";
import {
  ErrorResponseSchema,
  ListProjectsParamsSchema,
  ListProjectsResponseSchema,
} from "./schemas";

export interface V1RouteDependencies {
  authenticateBearerToken: (authHeader?: string) => AuthenticatedUser | null;
  listSpaceProjects: (input: {
    spaceId: string;
    userId: string;
  }) => PublicProject[];
}

export interface V1RouteOptions extends FastifyPluginOptions {
  dependencies?: Partial<V1RouteDependencies>;
}

const defaultDependencies: V1RouteDependencies = {
  authenticateBearerToken,
  listSpaceProjects,
};

export const v1Routes: FastifyPluginAsyncZod<V1RouteOptions> = async (
  server,
  options,
) => {
  const dependencies = { ...defaultDependencies, ...options.dependencies };

  server.get(
    "/spaces/:spaceId/projects",
    {
      schema: {
        operationId: "listProjects",
        summary: "List projects",
        description: "Returns the projects in a space in their display order.",
        tags: ["Projects"],
        security: [{ bearerAuth: [] }],
        params: ListProjectsParamsSchema,
        response: {
          200: ListProjectsResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const user = dependencies.authenticateBearerToken(
        request.headers.authorization,
      );

      if (!user) {
        return reply.code(401).send({
          code: "UNAUTHORIZED",
          message: "A valid bearer token is required",
        });
      }

      try {
        const projects = dependencies.listSpaceProjects({
          spaceId: request.params.spaceId,
          userId: user.id,
        });
        return reply.code(200).send({ projects });
      } catch (error) {
        if (error instanceof DatabaseAccessDeniedError) {
          return reply.code(403).send({
            code: "FORBIDDEN",
            message: "You do not have access to this space",
          });
        }

        request.log.error(error, "Failed to list projects");
        return reply.code(500).send({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to list projects",
        });
      }
    },
  );
};
