import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authenticateBearerToken } from "../../services/authentication";
import { DatabaseAccessDeniedError } from "../../services/databaseAccess";
import {
  createProjectCategory,
  deleteProjectCategory,
  listProjectCategories,
  moveProjectCategory,
  updateProjectCategory,
} from "../../services/categories";
import { ConflictError, ResourceNotFoundError } from "../../services/errors";
import {
  CategoryParamsSchema,
  CreateProjectCategoryBodySchema,
  ErrorResponseSchema,
  ListProjectCategoriesResponseSchema,
  MoveProjectCategoryBodySchema,
  ProjectCategoryResponseSchema,
  ProjectCategoriesParamsSchema,
  UpdateProjectCategoryBodySchema,
} from "../schemas";

export const categoryRoutes: FastifyPluginAsyncZod = async (server) => {
  server.get(
    "/spaces/:spaceId/projects/:projectId/categories",
    {
      schema: {
        operationId: "listProjectCategories",
        summary: "List project categories",
        description: "Returns a project's categories in display order.",
        tags: ["Project categories"],
        security: [{ bearerAuth: [] }],
        params: ProjectCategoriesParamsSchema,
        response: {
          200: ListProjectCategoriesResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const user = authenticateBearerToken(request.headers.authorization);
      if (!user) {
        return reply.code(401).send({
          code: "UNAUTHORIZED",
          message: "A valid bearer token is required",
        });
      }

      try {
        const categories = listProjectCategories({
          spaceId: request.params.spaceId,
          projectId: request.params.projectId,
          userId: user.id,
        });
        return reply.code(200).send({ categories });
      } catch (error) {
        if (error instanceof DatabaseAccessDeniedError) {
          return reply.code(403).send({
            code: "FORBIDDEN",
            message: "You do not have access to this space",
          });
        }
        if (error instanceof ResourceNotFoundError) {
          return reply.code(404).send({
            code: "NOT_FOUND",
            message: error.message,
          });
        }
        request.log.error(error, "Failed to list project categories");
        return reply.code(500).send({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to list project categories",
        });
      }
    },
  );

  server.post(
    "/spaces/:spaceId/projects/:projectId/categories",
    {
      schema: {
        operationId: "createProjectCategory",
        summary: "Create a project category",
        tags: ["Project categories"],
        security: [{ bearerAuth: [] }],
        params: ProjectCategoriesParamsSchema,
        body: CreateProjectCategoryBodySchema,
        response: {
          201: ProjectCategoryResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const user = authenticateBearerToken(request.headers.authorization);
      if (!user) return unauthorized(reply);
      try {
        const category = createProjectCategory({
          spaceId: request.params.spaceId,
          projectId: request.params.projectId,
          userId: user.id,
          ...request.body,
        });
        return reply.code(201).send({ category });
      } catch (error) {
        return sendCategoryError(
          request,
          reply,
          error,
          "Failed to create project category",
        );
      }
    },
  );

  server.patch(
    "/spaces/:spaceId/categories/:categoryId",
    {
      schema: {
        operationId: "updateProjectCategory",
        summary: "Update, move, or reposition a project category",
        tags: ["Project categories"],
        security: [{ bearerAuth: [] }],
        params: CategoryParamsSchema,
        body: UpdateProjectCategoryBodySchema,
        response: {
          200: ProjectCategoryResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const user = authenticateBearerToken(request.headers.authorization);
      if (!user) return unauthorized(reply);
      try {
        const category = updateProjectCategory({
          spaceId: request.params.spaceId,
          categoryId: request.params.categoryId,
          userId: user.id,
          updates: request.body,
        });
        return reply.code(200).send({ category });
      } catch (error) {
        return sendCategoryError(
          request,
          reply,
          error,
          "Failed to update project category",
        );
      }
    },
  );

  server.delete(
    "/spaces/:spaceId/categories/:categoryId",
    {
      schema: {
        operationId: "deleteProjectCategory",
        summary: "Delete a project category",
        tags: ["Project categories"],
        security: [{ bearerAuth: [] }],
        params: CategoryParamsSchema,
        response: {
          204: z.null(),
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const user = authenticateBearerToken(request.headers.authorization);
      if (!user) return unauthorized(reply);
      try {
        deleteProjectCategory({
          spaceId: request.params.spaceId,
          categoryId: request.params.categoryId,
          userId: user.id,
        });
        return reply.code(204).send(null);
      } catch (error) {
        return sendCategoryError(
          request,
          reply,
          error,
          "Failed to delete project category",
        );
      }
    },
  );

  server.post(
    "/spaces/:spaceId/categories/:categoryId/move",
    {
      schema: {
        operationId: "moveProjectCategory",
        summary: "Move a project category",
        tags: ["Project categories"],
        security: [{ bearerAuth: [] }],
        params: CategoryParamsSchema,
        body: MoveProjectCategoryBodySchema,
        response: {
          200: ProjectCategoryResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const user = authenticateBearerToken(request.headers.authorization);
      if (!user) return unauthorized(reply);
      try {
        const category = moveProjectCategory({
          spaceId: request.params.spaceId,
          categoryId: request.params.categoryId,
          userId: user.id,
          ...request.body,
        });
        return reply.code(200).send({ category });
      } catch (error) {
        return sendCategoryError(
          request,
          reply,
          error,
          "Failed to move project category",
        );
      }
    },
  );
};

function unauthorized(reply: FastifyReply) {
  return reply.code(401).send({
    code: "UNAUTHORIZED",
    message: "A valid bearer token is required",
  });
}

function sendCategoryError(
  request: FastifyRequest,
  reply: FastifyReply,
  error: unknown,
  fallbackMessage: string,
) {
  if (error instanceof DatabaseAccessDeniedError) {
    return reply.code(403).send({
      code: "FORBIDDEN",
      message: "You do not have access to this space",
    });
  }
  if (error instanceof ResourceNotFoundError) {
    return reply.code(404).send({ code: "NOT_FOUND", message: error.message });
  }
  if (error instanceof ConflictError) {
    return reply.code(409).send({ code: "CONFLICT", message: error.message });
  }
  request.log.error(error, fallbackMessage);
  return reply.code(500).send({
    code: "INTERNAL_SERVER_ERROR",
    message: fallbackMessage,
  });
}
