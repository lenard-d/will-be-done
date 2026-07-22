import { describe, expect, test } from "bun:test";
import { DB } from "@will-be-done/hyperdb";
import { BptreeInmemDriver } from "@will-be-done/hyperdb/drivers/inmemory";
import { createAppRouter } from "./appRouter";
import { createServer } from "./server";
import { DatabaseAccessDeniedError } from "./services/databaseAccess";
import type { PublicProject } from "./services/projects";

const projects: PublicProject[] = [
  {
    id: "inbox-project",
    title: "Inbox",
    icon: "inbox",
    isInbox: true,
    createdAt: 100,
  },
  {
    id: "work-project",
    title: "Work",
    icon: "briefcase",
    isInbox: false,
    createdAt: 200,
  },
];

function buildTestServer(
  dependencies: Parameters<typeof createServer>[0]["v1Dependencies"] = {},
) {
  const appRouter = createAppRouter({
    mainDB: new DB(new BptreeInmemDriver()),
    captchaConfig: null,
  });

  return createServer({
    appRouter,
    logger: false,
    serveFrontend: false,
    v1Dependencies: dependencies,
  });
}

describe("public API", () => {
  test("lists projects for an authenticated user", async () => {
    let receivedInput: { spaceId: string; userId: string } | undefined;
    const server = buildTestServer({
      authenticateBearerToken: () => ({
        id: "user-1",
        email: "user@example.com",
      }),
      listSpaceProjects: (input) => {
        receivedInput = input;
        return projects;
      },
    });

    try {
      const response = await server.inject({
        method: "GET",
        url: "/api/v1/spaces/space-1/projects",
        headers: { authorization: "Bearer token-1" },
      });

      expect(response.statusCode).toBe(200);
      expect(response.json<unknown>()).toEqual({ projects });
      expect(receivedInput).toEqual({ spaceId: "space-1", userId: "user-1" });
    } finally {
      await server.close();
    }
  });

  test("requires a bearer token", async () => {
    const server = buildTestServer({
      authenticateBearerToken: () => null,
      listSpaceProjects: () => {
        throw new Error("listSpaceProjects must not be called");
      },
    });

    try {
      const response = await server.inject({
        method: "GET",
        url: "/api/v1/spaces/space-1/projects",
      });

      expect(response.statusCode).toBe(401);
      expect(response.json<unknown>()).toEqual({
        code: "UNAUTHORIZED",
        message: "A valid bearer token is required",
      });
    } finally {
      await server.close();
    }
  });

  test("rejects access to another user's space", async () => {
    const server = buildTestServer({
      authenticateBearerToken: () => ({
        id: "user-1",
        email: "user@example.com",
      }),
      listSpaceProjects: () => {
        throw new DatabaseAccessDeniedError("space");
      },
    });

    try {
      const response = await server.inject({
        method: "GET",
        url: "/api/v1/spaces/space-2/projects",
      });

      expect(response.statusCode).toBe(403);
      expect(response.json<unknown>()).toEqual({
        code: "FORBIDDEN",
        message: "You do not have access to this space",
      });
    } finally {
      await server.close();
    }
  });

  test("serves the OpenAPI document and interactive docs", async () => {
    const server = buildTestServer();

    try {
      const specificationResponse = await server.inject({
        method: "GET",
        url: "/api/openapi.json",
      });
      const specification = specificationResponse.json() as {
        paths: Record<
          string,
          {
            get?: {
              operationId?: string;
              security?: Array<Record<string, string[]>>;
            };
          }
        >;
      };
      const operation =
        specification.paths["/api/v1/spaces/{spaceId}/projects"]?.get;

      expect(specificationResponse.statusCode).toBe(200);
      expect(operation?.operationId).toBe("listProjects");
      expect(operation?.security).toEqual([{ bearerAuth: [] }]);
      expect(JSON.stringify(operation)).not.toContain("orderToken");

      const docsResponse = await server.inject({
        method: "GET",
        url: "/api/docs/",
      });
      expect(docsResponse.statusCode).toBe(200);
      expect(docsResponse.headers["content-type"]).toContain("text/html");
    } finally {
      await server.close();
    }
  });

  test("keeps the existing tRPC route mounted", async () => {
    const server = buildTestServer();

    try {
      const response = await server.inject({
        method: "GET",
        url: "/api/trpc/getCaptchaConfig",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json<unknown>()).toEqual({
        result: { data: { enabled: false, siteKey: null } },
      });
    } finally {
      await server.close();
    }
  });
});
