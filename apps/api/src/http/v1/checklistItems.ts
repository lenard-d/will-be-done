import type { FastifyReply, FastifyRequest } from "fastify";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { authenticateBearerToken } from "../../services/authentication";
import {
  createChecklistItem,
  deleteChecklistItem,
  getChecklistItem,
  listChecklistItems,
  moveChecklistItem,
  updateChecklistItem,
} from "../../services/checklistItems";
import { DatabaseAccessDeniedError } from "../../services/databaseAccess";
import {
  InvalidPlacementError,
  ResourceNotFoundError,
} from "../../services/errors";
import {
  ChecklistItemParamsSchema,
  ChecklistItemResponseSchema,
  ChecklistItemsResponseSchema,
  CreateChecklistItemBodySchema,
  ErrorResponseSchema,
  MoveChecklistItemBodySchema,
  TaskChecklistParamsSchema,
  TaskTemplateChecklistParamsSchema,
  UpdateChecklistItemBodySchema,
} from "../schemas";

export const checklistItemRoutes: FastifyPluginAsyncZod = async (server) => {
  server.get(
    "/spaces/:spaceId/tasks/:taskId/checklist-items",
    {
      schema: {
        operationId: "listTaskChecklistItems",
        summary: "List a task's checklist items",
        tags: ["Checklist items"],
        security: [{ bearerAuth: [] }],
        params: TaskChecklistParamsSchema,
        response: {
          200: ChecklistItemsResponseSchema,
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
      if (!user) return unauthorized(reply);
      try {
        const checklistItems = listChecklistItems({
          spaceId: request.params.spaceId,
          userId: user.id,
          parentType: "task",
          parentId: request.params.taskId,
        });
        return reply.code(200).send({ checklistItems });
      } catch (error) {
        return handleError(
          request,
          reply,
          error,
          "Failed to list checklist items",
        );
      }
    },
  );

  server.post(
    "/spaces/:spaceId/tasks/:taskId/checklist-items",
    {
      schema: {
        operationId: "createTaskChecklistItem",
        summary: "Create a checklist item for a task",
        tags: ["Checklist items"],
        security: [{ bearerAuth: [] }],
        params: TaskChecklistParamsSchema,
        body: CreateChecklistItemBodySchema,
        response: {
          201: ChecklistItemResponseSchema,
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
        const checklistItem = createChecklistItem({
          spaceId: request.params.spaceId,
          userId: user.id,
          parentType: "task",
          parentId: request.params.taskId,
          ...request.body,
        });
        return reply.code(201).send({ checklistItem });
      } catch (error) {
        return handleError(
          request,
          reply,
          error,
          "Failed to create checklist item",
        );
      }
    },
  );

  server.get(
    "/spaces/:spaceId/task-templates/:templateId/checklist-items",
    {
      schema: {
        operationId: "listTaskTemplateChecklistItems",
        summary: "List a task template's checklist items",
        tags: ["Checklist items"],
        security: [{ bearerAuth: [] }],
        params: TaskTemplateChecklistParamsSchema,
        response: {
          200: ChecklistItemsResponseSchema,
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
      if (!user) return unauthorized(reply);
      try {
        const checklistItems = listChecklistItems({
          spaceId: request.params.spaceId,
          userId: user.id,
          parentType: "template",
          parentId: request.params.templateId,
        });
        return reply.code(200).send({ checklistItems });
      } catch (error) {
        return handleError(
          request,
          reply,
          error,
          "Failed to list checklist items",
        );
      }
    },
  );

  server.post(
    "/spaces/:spaceId/task-templates/:templateId/checklist-items",
    {
      schema: {
        operationId: "createTaskTemplateChecklistItem",
        summary: "Create a checklist item for a task template",
        tags: ["Checklist items"],
        security: [{ bearerAuth: [] }],
        params: TaskTemplateChecklistParamsSchema,
        body: CreateChecklistItemBodySchema,
        response: {
          201: ChecklistItemResponseSchema,
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
        const checklistItem = createChecklistItem({
          spaceId: request.params.spaceId,
          userId: user.id,
          parentType: "template",
          parentId: request.params.templateId,
          ...request.body,
        });
        return reply.code(201).send({ checklistItem });
      } catch (error) {
        return handleError(
          request,
          reply,
          error,
          "Failed to create checklist item",
        );
      }
    },
  );

  server.get(
    "/spaces/:spaceId/checklist-items/:checklistItemId",
    {
      schema: {
        operationId: "getChecklistItem",
        summary: "Get a checklist item",
        tags: ["Checklist items"],
        security: [{ bearerAuth: [] }],
        params: ChecklistItemParamsSchema,
        response: {
          200: ChecklistItemResponseSchema,
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
      if (!user) return unauthorized(reply);
      try {
        const checklistItem = getChecklistItem({
          spaceId: request.params.spaceId,
          userId: user.id,
          checklistItemId: request.params.checklistItemId,
        });
        return reply.code(200).send({ checklistItem });
      } catch (error) {
        return handleError(
          request,
          reply,
          error,
          "Failed to get checklist item",
        );
      }
    },
  );

  server.patch(
    "/spaces/:spaceId/checklist-items/:checklistItemId",
    {
      schema: {
        operationId: "updateChecklistItem",
        summary: "Update a checklist item",
        tags: ["Checklist items"],
        security: [{ bearerAuth: [] }],
        params: ChecklistItemParamsSchema,
        body: UpdateChecklistItemBodySchema,
        response: {
          200: ChecklistItemResponseSchema,
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
      if (!user) return unauthorized(reply);
      try {
        const checklistItem = updateChecklistItem({
          spaceId: request.params.spaceId,
          userId: user.id,
          checklistItemId: request.params.checklistItemId,
          updates: request.body,
        });
        return reply.code(200).send({ checklistItem });
      } catch (error) {
        return handleError(
          request,
          reply,
          error,
          "Failed to update checklist item",
        );
      }
    },
  );

  server.delete(
    "/spaces/:spaceId/checklist-items/:checklistItemId",
    {
      schema: {
        operationId: "deleteChecklistItem",
        summary: "Delete a checklist item",
        tags: ["Checklist items"],
        security: [{ bearerAuth: [] }],
        params: ChecklistItemParamsSchema,
        response: {
          204: z.null(),
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
      if (!user) return unauthorized(reply);
      try {
        deleteChecklistItem({
          spaceId: request.params.spaceId,
          userId: user.id,
          checklistItemId: request.params.checklistItemId,
        });
        return reply.code(204).send(null);
      } catch (error) {
        return handleError(
          request,
          reply,
          error,
          "Failed to delete checklist item",
        );
      }
    },
  );

  server.post(
    "/spaces/:spaceId/checklist-items/:checklistItemId/move",
    {
      schema: {
        operationId: "moveChecklistItem",
        summary: "Move a checklist item",
        tags: ["Checklist items"],
        security: [{ bearerAuth: [] }],
        params: ChecklistItemParamsSchema,
        body: MoveChecklistItemBodySchema,
        response: {
          200: ChecklistItemResponseSchema,
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
        const checklistItem = moveChecklistItem({
          spaceId: request.params.spaceId,
          userId: user.id,
          checklistItemId: request.params.checklistItemId,
          ...request.body,
        });
        return reply.code(200).send({ checklistItem });
      } catch (error) {
        return handleError(
          request,
          reply,
          error,
          "Failed to move checklist item",
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

function handleError(
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
  if (error instanceof InvalidPlacementError) {
    return reply.code(409).send({ code: "CONFLICT", message: error.message });
  }
  request.log.error(error, fallbackMessage);
  return reply.code(500).send({
    code: "INTERNAL_SERVER_ERROR",
    message: fallbackMessage,
  });
}
