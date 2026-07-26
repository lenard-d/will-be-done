import { describe, expect, test } from "bun:test";
import { DB } from "@will-be-done/hyperdb";
import { BptreeInmemDriver } from "@will-be-done/hyperdb/drivers/inmemory";
import { createAppRouter } from "./appRouter";
import { createServer } from "./server";

describe("API documentation", () => {
  test("serves the OpenAPI document through Scalar", async () => {
    const appRouter = createAppRouter({
      mainDB: new DB(new BptreeInmemDriver()),
      captchaConfig: null,
    });
    const server = createServer({
      appRouter,
      logger: false,
      serveFrontend: false,
    });

    try {
      await server.ready();

      const docsResponse = await server.inject({
        method: "GET",
        url: "/api/docs/",
      });
      const openApiResponse = await server.inject({
        method: "GET",
        url: "/api/openapi.json",
      });

      expect(docsResponse.statusCode).toBe(200);
      expect(docsResponse.headers["content-type"]).toContain("text/html");
      expect(docsResponse.body).toContain("Scalar");
      expect(docsResponse.body).toContain("/api/openapi.json");

      expect(openApiResponse.statusCode).toBe(200);
      expect(openApiResponse.json()).toMatchObject({
        openapi: "3.1.0",
        info: {
          title: "Will Be Done API",
        },
      });
    } finally {
      await server.close();
    }
  });
});
