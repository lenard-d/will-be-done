import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authenticateBearerToken } from "../../services/authentication";
import { DatabaseAccessDeniedError } from "../../services/databaseAccess";
import {
  createProjectSection,
  deleteProjectSection,
  listProjectSections,
  moveProjectSection,
  updateProjectSection,
} from "../../services/sections";
import { ConflictError, ResourceNotFoundError } from "../../services/errors";
import {
  SectionParamsSchema,
  CreateProjectSectionBodySchema,
  ErrorResponseSchema,
  ListProjectSectionsResponseSchema,
  MoveProjectSectionBodySchema,
  ProjectSectionResponseSchema,
  ProjectSectionsParamsSchema,
  UpdateProjectSectionBodySchema,
} from "../schemas";

export const sectionRoutes: FastifyPluginAsyncZod = async (server) => {
  server.get(
    "/spaces/:spaceId/projects/:projectId/sections",
    {
      schema: {
        operationId: "listProjectSections",
        summary: "List project sections",
        description: "Returns a project's sections in display order.",
        tags: ["Project sections"],
        security: [{ bearerAuth: [] }],
        params: ProjectSectionsParamsSchema,
        response: {
          200: ListProjectSectionsResponseSchema,
          400: ErrorResponseSchema,
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
        const sections = listProjectSections({
          spaceId: request.params.spaceId,
          projectId: request.params.projectId,
          userId: user.id,
        });
        return reply.code(200).send({ sections });
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
        request.log.error(error, "Failed to list project sections");
        return reply.code(500).send({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to list project sections",
        });
      }
    },
  );

  server.post(
    "/spaces/:spaceId/projects/:projectId/sections",
    {
      schema: {
        operationId: "createProjectSection",
        summary: "Create a project section",
        tags: ["Project sections"],
        security: [{ bearerAuth: [] }],
        params: ProjectSectionsParamsSchema,
        body: CreateProjectSectionBodySchema,
        response: {
          201: ProjectSectionResponseSchema,
          400: ErrorResponseSchema,
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
        const section = createProjectSection({
          spaceId: request.params.spaceId,
          projectId: request.params.projectId,
          userId: user.id,
          ...request.body,
        });
        return reply.code(201).send({ section });
      } catch (error) {
        return sendSectionError(
          request,
          reply,
          error,
          "Failed to create project section",
        );
      }
    },
  );

  server.patch(
    "/spaces/:spaceId/sections/:sectionId",
    {
      schema: {
        operationId: "updateProjectSection",
        summary: "Update a project section",
        tags: ["Project sections"],
        security: [{ bearerAuth: [] }],
        params: SectionParamsSchema,
        body: UpdateProjectSectionBodySchema,
        response: {
          200: ProjectSectionResponseSchema,
          400: ErrorResponseSchema,
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
        const section = updateProjectSection({
          spaceId: request.params.spaceId,
          sectionId: request.params.sectionId,
          userId: user.id,
          updates: request.body,
        });
        return reply.code(200).send({ section });
      } catch (error) {
        return sendSectionError(
          request,
          reply,
          error,
          "Failed to update project section",
        );
      }
    },
  );

  server.delete(
    "/spaces/:spaceId/sections/:sectionId",
    {
      schema: {
        operationId: "deleteProjectSection",
        summary: "Delete a project section",
        tags: ["Project sections"],
        security: [{ bearerAuth: [] }],
        params: SectionParamsSchema,
        response: {
          204: z.null(),
          400: ErrorResponseSchema,
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
        deleteProjectSection({
          spaceId: request.params.spaceId,
          sectionId: request.params.sectionId,
          userId: user.id,
        });
        return reply.code(204).send(null);
      } catch (error) {
        return sendSectionError(
          request,
          reply,
          error,
          "Failed to delete project section",
        );
      }
    },
  );

  server.post(
    "/spaces/:spaceId/sections/:sectionId/move",
    {
      schema: {
        operationId: "moveProjectSection",
        summary: "Move a project section",
        tags: ["Project sections"],
        security: [{ bearerAuth: [] }],
        params: SectionParamsSchema,
        body: MoveProjectSectionBodySchema,
        response: {
          200: ProjectSectionResponseSchema,
          400: ErrorResponseSchema,
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
        const section = moveProjectSection({
          spaceId: request.params.spaceId,
          sectionId: request.params.sectionId,
          userId: user.id,
          ...request.body,
        });
        return reply.code(200).send({ section });
      } catch (error) {
        return sendSectionError(
          request,
          reply,
          error,
          "Failed to move project section",
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

function sendSectionError(
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
