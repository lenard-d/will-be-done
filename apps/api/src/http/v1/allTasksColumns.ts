import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { normalizeTaskFiltersJson } from "@will-be-done/slices/space";
import { authenticateBearerToken } from "../../services/authentication";
import {
  listAllTasksColumns,
  createAllTasksColumn,
  updateAllTasksColumn,
  moveAllTasksColumn,
  deleteAllTasksColumn,
} from "../../services/allTasksColumns";
import { sendError, unauthorized } from "../errors";
import { ErrorResponseSchema, SpaceParamsSchema } from "../schemas";

const filtersJsonSchema = z.string().refine((value) => {
  try {
    normalizeTaskFiltersJson(value);
    return true;
  } catch {
    return false;
  }
}, "Must contain valid task filters as JSON");
const titleSchema = z.string().trim().min(1);
const columnSchema = z.object({
  id: z.string(),
  title: z.string(),
  createdAt: z.number(),
  filtersJson: z.string(),
});
const columnResponse = z.object({ column: columnSchema });
const columnParams = SpaceParamsSchema.extend({ columnId: z.string().min(1) });
const errorResponses = {
  400: ErrorResponseSchema,
  401: ErrorResponseSchema,
  403: ErrorResponseSchema,
  404: ErrorResponseSchema,
  409: ErrorResponseSchema,
  500: ErrorResponseSchema,
};
const commonSchema = {
  tags: ["All tasks columns"],
  security: [{ bearerAuth: [] }],
};

export const allTasksColumnRoutes: FastifyPluginAsyncZod = async (server) => {
  server.get(
    "/spaces/:spaceId/all-tasks-columns",
    {
      schema: {
        ...commonSchema,
        operationId: "listAllTasksColumns",
        summary: "List saved All tasks columns",
        params: SpaceParamsSchema,
        response: {
          200: z.object({ columns: z.array(columnSchema) }),
          ...errorResponses,
        },
      },
    },
    async (request, reply) => {
      const user = authenticateBearerToken(request.headers.authorization);
      if (!user) return unauthorized(reply);
      try {
        return reply.send({
          columns: listAllTasksColumns({ ...request.params, userId: user.id }),
        });
      } catch (error) {
        return sendError(
          request,
          reply,
          error,
          "Failed to list All tasks columns",
        );
      }
    },
  );

  server.post(
    "/spaces/:spaceId/all-tasks-columns",
    {
      schema: {
        ...commonSchema,
        operationId: "createAllTasksColumn",
        summary: "Create a saved All tasks column",
        params: SpaceParamsSchema,
        body: z
          .object({
            title: titleSchema,
            filtersJson: filtersJsonSchema,
            afterId: z.string().min(1).optional(),
          })
          .strict(),
        response: { 201: columnResponse, ...errorResponses },
      },
    },
    async (request, reply) => {
      const user = authenticateBearerToken(request.headers.authorization);
      if (!user) return unauthorized(reply);
      try {
        return reply.code(201).send({
          column: createAllTasksColumn({
            ...request.params,
            ...request.body,
            userId: user.id,
          }),
        });
      } catch (error) {
        return sendError(
          request,
          reply,
          error,
          "Failed to create All tasks column",
        );
      }
    },
  );

  server.patch(
    "/spaces/:spaceId/all-tasks-columns/:columnId",
    {
      schema: {
        ...commonSchema,
        operationId: "updateAllTasksColumn",
        summary: "Update a saved All tasks column",
        params: columnParams,
        body: z
          .object({
            title: titleSchema.optional(),
            filtersJson: filtersJsonSchema.optional(),
          })
          .strict()
          .refine(
            (body) => Object.keys(body).length > 0,
            "At least one field must be provided",
          ),
        response: { 200: columnResponse, ...errorResponses },
      },
    },
    async (request, reply) => {
      const user = authenticateBearerToken(request.headers.authorization);
      if (!user) return unauthorized(reply);
      try {
        return reply.send({
          column: updateAllTasksColumn({
            ...request.params,
            ...request.body,
            userId: user.id,
          }),
        });
      } catch (error) {
        return sendError(
          request,
          reply,
          error,
          "Failed to update All tasks column",
        );
      }
    },
  );

  server.post(
    "/spaces/:spaceId/all-tasks-columns/:columnId/move",
    {
      schema: {
        ...commonSchema,
        operationId: "moveAllTasksColumn",
        summary: "Move a saved All tasks column",
        params: columnParams,
        body: z.object({ direction: z.enum(["left", "right"]) }).strict(),
        response: { 200: columnResponse, ...errorResponses },
      },
    },
    async (request, reply) => {
      const user = authenticateBearerToken(request.headers.authorization);
      if (!user) return unauthorized(reply);
      try {
        return reply.send({
          column: moveAllTasksColumn({
            ...request.params,
            ...request.body,
            userId: user.id,
          }),
        });
      } catch (error) {
        return sendError(
          request,
          reply,
          error,
          "Failed to move All tasks column",
        );
      }
    },
  );

  server.delete(
    "/spaces/:spaceId/all-tasks-columns/:columnId",
    {
      schema: {
        ...commonSchema,
        operationId: "deleteAllTasksColumn",
        summary: "Delete a saved All tasks column",
        params: columnParams,
        response: { 204: z.null(), ...errorResponses },
      },
    },
    async (request, reply) => {
      const user = authenticateBearerToken(request.headers.authorization);
      if (!user) return unauthorized(reply);
      try {
        deleteAllTasksColumn({ ...request.params, userId: user.id });
        return reply.code(204).send(null);
      } catch (error) {
        return sendError(
          request,
          reply,
          error,
          "Failed to delete All tasks column",
        );
      }
    },
  );
};
