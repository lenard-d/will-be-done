import { DB } from "@will-be-done/hyperdb";
import { BptreeInmemDriver } from "@will-be-done/hyperdb/drivers/inmemory";
import { createAppRouter } from "./appRouter";
import { createServer } from "./server";

export async function buildOpenApiDocument() {
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
    return server.swagger();
  } finally {
    await server.close();
  }
}
