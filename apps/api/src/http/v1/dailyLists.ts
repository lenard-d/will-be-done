import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { authenticateBearerToken } from "../../services/authentication";
import { DatabaseAccessDeniedError } from "../../services/databaseAccess";
import { listDailyListCards } from "../../services/dailyLists";
import {
  DailyListCardsParamsSchema,
  DailyListCardsQuerySchema,
  DailyListCardsResponseSchema,
  ErrorResponseSchema,
} from "../schemas";

export const dailyListRoutes: FastifyPluginAsyncZod = async (server) => {
  server.get(
    "/spaces/:spaceId/daily-lists/:date/cards",
    {
      schema: {
        operationId: "listDailyListCards",
        summary: "List daily-list cards",
        description:
          "Returns scheduled todo tasks in daily-list order by default, or completed tasks ordered by most recently completed.",
        tags: ["Daily lists"],
        security: [{ bearerAuth: [] }],
        params: DailyListCardsParamsSchema,
        querystring: DailyListCardsQuerySchema,
        response: {
          200: DailyListCardsResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
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
        const cards = listDailyListCards({
          spaceId: request.params.spaceId,
          userId: user.id,
          date: request.params.date,
          state: request.query.state,
        });
        return reply.code(200).send({ cards });
      } catch (error) {
        if (error instanceof DatabaseAccessDeniedError) {
          return reply.code(403).send({
            code: "FORBIDDEN",
            message: "You do not have access to this space",
          });
        }
        request.log.error(error, "Failed to list daily-list cards");
        return reply.code(500).send({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to list daily-list cards",
        });
      }
    },
  );
};
