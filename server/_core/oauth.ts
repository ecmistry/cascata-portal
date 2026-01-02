import { COOKIE_NAME, SESSION_DURATION_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  // Development mode: Allow dev login when OAuth is not configured
  if (process.env.NODE_ENV === "development" && !process.env.OAUTH_SERVER_URL) {
    app.get("/api/oauth/dev-login", async (req: Request, res: Response) => {
      try {
        // Create or get a dev user
        const devOpenId = "dev-user-local";
        const devUser = {
          openId: devOpenId,
          name: "Dev User",
          email: "dev@localhost",
          loginMethod: "dev",
          role: "admin" as const,
          lastSignedIn: new Date(),
        };

        // Try to create user in database (may fail if DB not configured)
        try {
          await db.upsertUser(devUser);
          if (process.env.NODE_ENV === "development") {
            console.log("[Dev Auth] Created/updated dev user in database");
          }
        } catch (dbError) {
          if (process.env.NODE_ENV === "development") {
            const message = dbError instanceof Error ? dbError.message : String(dbError);
            console.warn("[Dev Auth] Database not available, continuing without DB user:", message);
          }
          // Continue without database - session will still work
        }

        // Create session token (this works even without database)
        const sessionToken = await sdk.createSessionToken(devOpenId, {
          name: devUser.name,
          expiresInMs: SESSION_DURATION_MS,
        });

        const cookieOptions = getSessionCookieOptions(req);
        res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: SESSION_DURATION_MS });

        if (process.env.NODE_ENV === "development") {
          console.log("[Dev Auth] Created dev session for", devOpenId);
        }
        res.redirect(302, "/");
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          const message = error instanceof Error ? error.message : String(error);
          console.error("[Dev Auth] Failed to create dev session:", message);
        }
        res.status(500).json({ 
          error: "Dev login failed", 
          details: String(error),
          message: "Make sure JWT_SECRET is set or the app is in development mode"
        });
      }
    });
  }

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: SESSION_DURATION_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: SESSION_DURATION_MS });

      res.redirect(302, "/");
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[OAuth] Callback failed", message);
      }
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
