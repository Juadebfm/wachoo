import { verify } from "argon2";
import { Router } from "express";
import {
  adminLoginInputSchema,
  categoryAdminInputSchema,
  categoryListQuerySchema,
  issueReportUpdateSchema,
  reportListQuerySchema,
} from "@wachoo/shared";
import {
  clearAdminSessionCookie,
  createAdminSession,
  requireAdmin,
  revokeAdminSession,
  verifyAdminOrigin,
} from "./admin-auth.js";
import { createCategory, disableCategory, listCategories, updateCategory } from "./category-service.js";
import { getPrisma } from "./db.js";
import { listIssueReports, updateIssueReport } from "./report-service.js";
import { isRateLimited } from "./rate-limit.js";

export const adminRouter = Router();

adminRouter.post("/login", async (request, response) => {
  if (!verifyAdminOrigin(request)) {
    response.status(403).json({ error: "This sign-in request is not allowed." });
    return;
  }

  const parsed = adminLoginInputSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "Enter a valid email and password." });
    return;
  }

  try {
    if (await isRateLimited(request, "admin-login", 6, 15 * 60)) {
      response.setHeader("Retry-After", "900");
      response.status(429).json({ error: "Too many sign-in attempts. Try again later." });
      return;
    }

    const admin = await getPrisma().admin.findUnique({ where: { email: parsed.data.email } });
    let passwordMatches = false;
    if (admin && !admin.disabled) {
      try {
        passwordMatches = await verify(admin.passwordHash, parsed.data.password);
      } catch {
        passwordMatches = false;
      }
    }

    if (!admin || admin.disabled || !passwordMatches) {
      response.status(401).json({ error: "Email or password is incorrect." });
      return;
    }

    await createAdminSession(admin.id, admin.authVersion, response);
    response.json({ data: { email: admin.email } });
  } catch {
    response.status(503).json({ error: "Admin sign-in is temporarily unavailable." });
  }
});

adminRouter.post("/logout", async (request, response) => {
  if (!verifyAdminOrigin(request)) {
    response.status(403).json({ error: "This sign-out request is not allowed." });
    return;
  }
  try {
    await revokeAdminSession(request);
    clearAdminSessionCookie(response);
    response.status(204).end();
  } catch {
    response.status(503).json({ error: "Admin sign-out is temporarily unavailable." });
  }
});

adminRouter.use(requireAdmin);

adminRouter.get("/session", (_request, response) => {
  response.json({ data: response.locals.admin });
});

adminRouter.get("/categories", async (request, response) => {
  const parsed = categoryQuery(request.query);
  if (!parsed.ok) {
    response.status(400).json({ error: "The category search options are invalid." });
    return;
  }
  try {
    response.json(await listCategories({ ...parsed.data, pageSize: 100 }));
  } catch {
    response.status(503).json({ error: "The category catalogue is temporarily unavailable." });
  }
});

adminRouter.post("/categories", async (request, response) => {
  if (!verifyAdminOrigin(request)) {
    response.status(403).json({ error: "This admin request is not allowed." });
    return;
  }
  const parsed = categoryAdminInputSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "The category details are invalid.", issues: parsed.error.issues });
    return;
  }
  try {
    response.status(201).json({ data: await createCategory(parsed.data) });
  } catch (error) {
    if (isPrismaConflict(error)) {
      response.status(409).json({ error: "A category already uses this Netflix code." });
      return;
    }
    response.status(503).json({ error: "The category could not be saved." });
  }
});

adminRouter.patch("/categories/:id", async (request, response) => {
  if (!verifyAdminOrigin(request)) {
    response.status(403).json({ error: "This admin request is not allowed." });
    return;
  }
  const parsed = categoryAdminInputSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "The category details are invalid.", issues: parsed.error.issues });
    return;
  }
  try {
    response.json({ data: await updateCategory(request.params.id ?? "", parsed.data) });
  } catch (error) {
    if (isPrismaNotFound(error)) {
      response.status(404).json({ error: "The category was not found." });
      return;
    }
    if (isPrismaConflict(error)) {
      response.status(409).json({ error: "A category already uses this Netflix code." });
      return;
    }
    response.status(503).json({ error: "The category could not be updated." });
  }
});

adminRouter.patch("/categories/:id/disable", async (request, response) => {
  if (!verifyAdminOrigin(request)) {
    response.status(403).json({ error: "This admin request is not allowed." });
    return;
  }
  try {
    const disabled = await disableCategory(request.params.id ?? "");
    if (!disabled) {
      response.status(404).json({ error: "The active category was not found." });
      return;
    }
    response.status(204).end();
  } catch {
    response.status(503).json({ error: "The category could not be disabled." });
  }
});

adminRouter.get("/reports", async (request, response) => {
  const parsed = reportListQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    response.status(400).json({ error: "The report search options are invalid." });
    return;
  }
  try {
    response.json(await listIssueReports(parsed.data));
  } catch {
    response.status(503).json({ error: "Issue reports are temporarily unavailable." });
  }
});

adminRouter.patch("/reports/:id", async (request, response) => {
  if (!verifyAdminOrigin(request)) {
    response.status(403).json({ error: "This admin request is not allowed." });
    return;
  }
  const parsed = issueReportUpdateSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "The report update is invalid." });
    return;
  }
  try {
    response.json({ data: await updateIssueReport(request.params.id ?? "", parsed.data) });
  } catch (error) {
    if (isPrismaNotFound(error)) {
      response.status(404).json({ error: "The issue report was not found." });
      return;
    }
    response.status(503).json({ error: "The issue report could not be updated." });
  }
});

function categoryQuery(query: unknown) {
  // Admin catalogue view intentionally uses the same bounded search fields as the public API.
  const result = categoryListQuerySchema.safeParse(query);
  return result.success ? { ok: true as const, data: result.data } : { ok: false as const };
}

function isPrismaConflict(error: unknown): boolean {
  return isPrismaCode(error, "P2002");
}

function isPrismaNotFound(error: unknown): boolean {
  return isPrismaCode(error, "P2025");
}

function isPrismaCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}
