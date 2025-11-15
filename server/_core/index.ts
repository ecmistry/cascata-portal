import "dotenv/config";
import express from "express";
import { createServer as createHttpServer } from "http";
import { createServer as createHttpsServer } from "https";
import { readFileSync } from "fs";
import { existsSync } from "fs";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { loginRateLimiter, apiRateLimiter } from "./rateLimit";

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
  const app = express();
  
  // Trust proxy for HTTPS behind reverse proxy
  app.set("trust proxy", true);
  
  // Redirect HTTP to HTTPS in production if HTTPS is enabled
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_HTTPS === "true") {
    app.use((req, res, next) => {
      if (req.header("x-forwarded-proto") !== "https" && req.protocol !== "https") {
        return res.redirect(`https://${req.header("host")}${req.url}`);
      }
      next();
    });
  }

  // Configure body parser with reasonable size limit (reduced from 50mb)
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));
  
  // Rate limiting - apply to all API routes
  app.use("/api/trpc", apiRateLimiter);
  
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  
  // tRPC API with rate limiting
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  
  // Check for SSL certificates
  const sslCertPath = process.env.SSL_CERT_PATH;
  const sslKeyPath = process.env.SSL_KEY_PATH;
  const useHttps = sslCertPath && sslKeyPath && existsSync(sslCertPath) && existsSync(sslKeyPath);
  
  let server;
  if (useHttps) {
    try {
      const httpsOptions = {
        cert: readFileSync(sslCertPath),
        key: readFileSync(sslKeyPath),
      };
      server = createHttpsServer(httpsOptions, app);
      if (process.env.NODE_ENV === "development") {
        console.log("HTTPS enabled with SSL certificates");
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        const message = error instanceof Error ? error.message : String(error);
        console.warn("Failed to load SSL certificates, falling back to HTTP:", message);
      }
      server = createHttpServer(app);
    }
  } else {
    server = createHttpServer(app);
  }
  
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort && process.env.NODE_ENV === "development") {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  const protocol = useHttps ? "https" : "http";
  const domain = process.env.DOMAIN || "localhost";
  
  server.listen(port, () => {
    if (process.env.NODE_ENV === "development") {
      console.log(`Server running on ${protocol}://${domain}:${port}/`);
      if (useHttps) {
        console.log(`HTTPS enabled - accessible at https://${domain}${port === 443 ? "" : `:${port}`}`);
      }
    }
  });
}

startServer().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("Failed to start server:", message);
  process.exit(1);
});
