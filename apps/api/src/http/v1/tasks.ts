import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { authenticateBearerToken } from "../../services/authentication";
import { DatabaseAccessDeniedError } from "../../services/databaseAccess";
import { listSectionItems } from "../../services/items";
import {
  InvalidPlacementError,
  ResourceNotFoundError,
} from "../../services/errors";
import {
  createSectionTask,
  deleteTask,
  getTask,
  moveTask,
  updateTask,
} from "../../services/tasks";
import { scheduleTask } from "../../services/scheduling";
import {
  SectionTasksParamsSchema,
  CreateTaskBodySchema,
  ErrorResponseSchema,
  ListSectionItemsQuerySchema,
  ListSectionItemsResponseSchema,
  MoveTaskBodySchema,
  ScheduleTaskBodySchema,
  ScheduleTaskResponseSchema,
  TaskParamsSchema,
  TaskResponseSchema,
  UpdateTaskBodySchema,
} from "../schemas";

export const taskRoutes: FastifyPluginAsyncZod = async (server) => {
  server.get(
    "/spaces/:spaceId/sections/:sectionId/items",
    {
      schema: {
        operationId: "listSectionItems",
        summary: "List section items",
        description:
          "Returns todo tasks and templates in display order by default. When taskState is done, returns completed tasks only.",
        tags: ["Items"],
        security: [{ bearerAuth: [] }],
        params: SectionTasksParamsSchema,
        querystring: ListSectionItemsQuerySchema,
        response: {
          200: ListSectionItemsResponseSchema,
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
        const items = listSectionItems({
          spaceId: request.params.spaceId,
          sectionId: request.params.sectionId,
          userId: user.id,
          taskState: request.query.taskState,
        });
        return reply.code(200).send({ items });
      } catch (error) {
        return handleTaskError(request, reply, error, "Failed to list items");
      }
    },
  );

  server.post(
    "/spaces/:spaceId/sections/:sectionId/tasks",
    {
      schema: {
        operationId: "createSectionTask",
        summary: "Create a task",
        tags: ["Tasks"],
        security: [{ bearerAuth: [] }],
        params: SectionTasksParamsSchema,
        body: CreateTaskBodySchema,
        response: {
          201: TaskResponseSchema,
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
        const task = createSectionTask({
          spaceId: request.params.spaceId,
          sectionId: request.params.sectionId,
          userId: user.id,
          ...request.body,
        });
        return reply.code(201).send({ task });
      } catch (error) {
        return handleTaskError(request, reply, error, "Failed to create task");
      }
    },
  );

  server.get(
    "/spaces/:spaceId/tasks/:taskId",
    {
      schema: {
        operationId: "getTask",
        summary: "Get a task",
        tags: ["Tasks"],
        security: [{ bearerAuth: [] }],
        params: TaskParamsSchema,
        response: {
          200: TaskResponseSchema,
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
        const task = getTask({
          spaceId: request.params.spaceId,
          taskId: request.params.taskId,
          userId: user.id,
        });
        return reply.code(200).send({ task });
      } catch (error) {
        return handleTaskError(request, reply, error, "Failed to get task");
      }
    },
  );

  server.patch(
    "/spaces/:spaceId/tasks/:taskId",
    {
      schema: {
        operationId: "updateTask",
        summary: "Update or move a task",
        tags: ["Tasks"],
        security: [{ bearerAuth: [] }],
        params: TaskParamsSchema,
        body: UpdateTaskBodySchema,
        response: {
          200: TaskResponseSchema,
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
        const task = updateTask({
          spaceId: request.params.spaceId,
          taskId: request.params.taskId,
          userId: user.id,
          updates: request.body,
        });
        return reply.code(200).send({ task });
      } catch (error) {
        return handleTaskError(request, reply, error, "Failed to update task");
      }
    },
  );

  server.delete(
    "/spaces/:spaceId/tasks/:taskId",
    {
      schema: {
        operationId: "deleteTask",
        summary: "Delete a task",
        tags: ["Tasks"],
        security: [{ bearerAuth: [] }],
        params: TaskParamsSchema,
        response: {
          204: z.null(),
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
        deleteTask({
          spaceId: request.params.spaceId,
          taskId: request.params.taskId,
          userId: user.id,
        });
        return reply.code(204).send(null);
      } catch (error) {
        return handleTaskError(request, reply, error, "Failed to delete task");
      }
    },
  );

  server.post(
    "/spaces/:spaceId/tasks/:taskId/schedule",
    {
      schema: {
        operationId: "scheduleTask",
        summary: "Schedule a task",
        description:
          "Schedules or reschedules a task on a date. Existing schedules are replaced.",
        tags: ["Tasks"],
        security: [{ bearerAuth: [] }],
        params: TaskParamsSchema,
        body: ScheduleTaskBodySchema,
        response: {
          200: ScheduleTaskResponseSchema,
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
        return reply.code(200).send(
          scheduleTask({
            spaceId: request.params.spaceId,
            taskId: request.params.taskId,
            userId: user.id,
            ...request.body,
          }),
        );
      } catch (error) {
        return handleTaskError(
          request,
          reply,
          error,
          "Failed to schedule task",
        );
      }
    },
  );

  server.post(
    "/spaces/:spaceId/tasks/:taskId/move",
    {
      schema: {
        operationId: "moveTask",
        summary: "Move a task",
        tags: ["Tasks"],
        security: [{ bearerAuth: [] }],
        params: TaskParamsSchema,
        body: MoveTaskBodySchema,
        response: {
          200: TaskResponseSchema,
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
        const task = moveTask({
          spaceId: request.params.spaceId,
          taskId: request.params.taskId,
          userId: user.id,
          ...request.body,
        });
        return reply.code(200).send({ task });
      } catch (error) {
        return handleTaskError(request, reply, error, "Failed to move task");
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

function handleTaskError(
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
