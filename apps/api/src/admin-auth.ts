import { createHash, randomBytes } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { getPrisma } from "./db.js";
import { redisDelete, redisGet, redisSet } from "./redis-store.js";

const cookieName = "wachoo_admin_session";
const sessionTtlSeconds = 12 * 60 * 60;
const sessionKeyPrefix = "wachoo:admin-session:v1:";

type AdminSession = { adminId: string; authVersion: number };

function sessionKey(token: string): string {
  return `${sessionKeyPrefix}${createHash("sha256").update(token).digest("hex")}`;
}

function sessionToken(request: Request): string | null {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return null;
  const cookie = cookieHeader.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`));
  if (!cookie) return null;
  try {
    return decodeURIComponent(cookie.slice(cookieName.length + 1)) || null;
  } catch {
    return null;
  }
}

function setSessionCookie(response: Response, token: string): void {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader(
    "Set-Cookie",
    `${cookieName}=${encodeURIComponent(token)}; Path=/api/v1/admin; HttpOnly; SameSite=Strict; Max-Age=${sessionTtlSeconds}${secure}`,
  );
}

export function clearAdminSessionCookie(response: Response): void {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  response.setHeader(
    "Set-Cookie",
    `${cookieName}=; Path=/api/v1/admin; HttpOnly; SameSite=Strict; Max-Age=0${secure}`,
  );
}

export async function createAdminSession(adminId: string, authVersion: number, response: Response): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const session: AdminSession = { adminId, authVersion };
  await redisSet(sessionKey(token), JSON.stringify(session), sessionTtlSeconds);
  setSessionCookie(response, token);
}

export async function revokeAdminSession(request: Request): Promise<void> {
  const token = sessionToken(request);
  if (token) await redisDelete(sessionKey(token));
}

export async function requireAdmin(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const token = sessionToken(request);
    if (!token) {
      response.status(401).json({ error: "Admin sign-in is required." });
      return;
    }

    const stored = await redisGet(sessionKey(token));
    if (!stored) {
      clearAdminSessionCookie(response);
      response.status(401).json({ error: "Admin sign-in is required." });
      return;
    }

    let session: AdminSession;
    try {
      session = JSON.parse(stored) as AdminSession;
    } catch {
      await redisDelete(sessionKey(token));
      clearAdminSessionCookie(response);
      response.status(401).json({ error: "Admin sign-in is required." });
      return;
    }

    const admin = await getPrisma().admin.findUnique({
      where: { id: session.adminId },
      select: { id: true, email: true, disabled: true, authVersion: true },
    });
    if (!admin || admin.disabled || admin.authVersion !== session.authVersion) {
      await redisDelete(sessionKey(token));
      clearAdminSessionCookie(response);
      response.status(401).json({ error: "Admin sign-in is required." });
      return;
    }

    response.locals.admin = { id: admin.id, email: admin.email };
    next();
  } catch {
    response.status(503).json({ error: "Admin authentication is temporarily unavailable." });
  }
}

export function verifyAdminOrigin(request: Request): boolean {
  const origin = request.get("origin");
  const expected = process.env.APP_ORIGIN;
  if (!origin || !expected) return process.env.NODE_ENV !== "production" && !origin;
  return origin === expected;
}
