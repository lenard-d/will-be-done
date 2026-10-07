import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { DB, execSync, SubscribableDB } from "@will-be-done/hyperdb";
import { BptreeInmemDriver } from "@will-be-done/hyperdb/drivers/inmemory";
import {
  emptyTaskFilters,
  registeredSpaceSyncableTables,
} from "@will-be-done/slices/space";
import { createAppRouter } from "../../appRouter";
import { createServer } from "../../server";
import * as authentication from "../../services/authentication";
import * as access from "../../services/databaseAccess";

function setup() {
  const mainDB = new DB(new BptreeInmemDriver());
  const spaceDB = new SubscribableDB(new DB(new BptreeInmemDriver()));
  execSync(spaceDB.loadTables(registeredSpaceSyncableTables));
  spyOn(access, "getSpaceDatabase").mockReturnValue(spaceDB);
  spyOn(authentication, "authenticateBearerToken").mockImplementation(
    (header) =>
      header === "Bearer valid"
        ? { id: "user-1", email: "user@example.com" }
        : null,
  );
  const server = createServer({
    appRouter: createAppRouter({ mainDB, captchaConfig: null }),
    logger: false,
    serveFrontend: false,
  });
  return server;
}

const baseUrl = "/api/v1/spaces/space-1/all-tasks-columns";
const headers = { authorization: "Bearer valid" };
const filtersJson = JSON.stringify(emptyTaskFilters);

describe("All tasks column HTTP routes", () => {
  afterEach(() => mock.restore());

  test("requires a bearer token for all saved-view actions", async () => {
    const server = setup();
    try {
      for (const request of [
        { method: "GET" as const, url: baseUrl },
        {
          method: "POST" as const,
          url: baseUrl,
          payload: { title: "Tasks", filtersJson },
        },
        {
          method: "PATCH" as const,
          url: `${baseUrl}/column-1`,
          payload: { title: "Changed" },
        },
        {
          method: "POST" as const,
          url: `${baseUrl}/column-1/move`,
          payload: { direction: "left" },
        },
        { method: "DELETE" as const, url: `${baseUrl}/column-1` },
      ]) {
        expect((await server.inject(request)).statusCode).toBe(401);
      }
    } finally {
      await server.close();
    }
  });

  test("validates filter JSON and does not write invalid columns", async () => {
    const server = setup();
    try {
      const response = await server.inject({
        method: "POST",
        url: baseUrl,
        headers,
        payload: { title: "Invalid", filtersJson: "{}" },
      });
      expect(response.statusCode).toBe(400);
      const list = await server.inject({
        method: "GET",
        url: baseUrl,
        headers,
      });
      const result: unknown = list.json();
      expect(result).toEqual({ columns: [] });
    } finally {
      await server.close();
    }
  });

  test("returns forbidden when the user cannot access the space", async () => {
    const server = setup();
    spyOn(access, "getSpaceDatabase").mockImplementation(() => {
      throw new access.DatabaseAccessDeniedError("space");
    });
    try {
      const response = await server.inject({
        method: "GET",
        url: baseUrl,
        headers,
      });
      expect(response.statusCode).toBe(403);
    } finally {
      await server.close();
    }
  });

  test("creates, renames, reorders, and deletes independent saved views", async () => {
    const server = setup();
    try {
      const firstResponse = await server.inject({
        method: "POST",
        url: baseUrl,
        headers,
        payload: { title: "First", filtersJson },
      });
      expect(firstResponse.statusCode).toBe(201);
      const first = firstResponse.json().column;
      const secondResponse = await server.inject({
        method: "POST",
        url: baseUrl,
        headers,
        payload: { title: "Second", filtersJson },
      });
      const second = secondResponse.json().column;
      const renamed = await server.inject({
        method: "PATCH",
        url: `${baseUrl}/${second.id}`,
        headers,
        payload: {
          title: "Renamed",
          filtersJson: JSON.stringify({ ...emptyTaskFilters, query: "match" }),
        },
      });
      expect(renamed.statusCode).toBe(200);
      const moved = await server.inject({
        method: "POST",
        url: `${baseUrl}/${second.id}/move`,
        headers,
        payload: { direction: "left" },
      });
      expect(moved.statusCode).toBe(200);
      const list = await server.inject({
        method: "GET",
        url: baseUrl,
        headers,
      });
      expect(list.json().columns).toEqual([renamed.json().column, first]);
      const deleted = await server.inject({
        method: "DELETE",
        url: `${baseUrl}/${second.id}`,
        headers,
      });
      expect(deleted.statusCode).toBe(204);
      const finalDelete = await server.inject({
        method: "DELETE",
        url: `${baseUrl}/${first.id}`,
        headers,
      });
      expect(finalDelete.statusCode).toBe(409);
      const missing = await server.inject({
        method: "PATCH",
        url: `${baseUrl}/missing`,
        headers,
        payload: { title: "Missing" },
      });
      expect(missing.statusCode).toBe(404);
    } finally {
      await server.close();
    }
  });
});
