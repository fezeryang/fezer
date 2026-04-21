import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { chatHandler } from "../routes/chat";
import { guideHandler } from "../routes/guide";
import { characterHandler } from "../routes/character";
import { assertEnvValid } from "./env";
import { createCorsMiddleware } from "./security";
import { initContentHotReload } from "../content/hot-reload";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  assertEnvValid();

  // Initialize content hot reload (only in development)
  if (process.env.NODE_ENV === "development") {
    initContentHotReload({
      enabled: true,
      debounceMs: 1000,
      onReload: timestamp => {
        console.log(`[Server] Content reloaded at ${timestamp.toISOString()}`);
      },
    });
  }

  const app = express();
  const server = createServer(app);

  // CORS middleware MUST run before all API routes
  app.use(createCorsMiddleware());

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Agent API routes
  app.post("/api/chat", chatHandler);
  app.post("/api/guide", guideHandler);
  app.post("/api/character", characterHandler);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
