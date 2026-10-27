import "dotenv/config";
import express, { type ErrorRequestHandler } from "express";
import { adminRouter } from "./admin-routes.js";
import { getPrisma } from "./db.js";
import { publicRouter } from "./public-routes.js";
import { redisGet } from "./redis-store.js";

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb", type: "application/json" }));

app.get("/health/live", (_request, response) => {
  response.json({ status: "ok" });
});

app.get("/health", async (_request, response) => {
  try {
    await getPrisma().$queryRaw`SELECT 1`;
    await redisGet("wachoo:health:v1");
    response.json({ status: "ready" });
  } catch {
    response.status(503).json({ status: "unavailable" });
  }
});

app.use("/api/v1", publicRouter);
app.use("/api/v1/admin", adminRouter);

app.use((_request, response) => {
  response.status(404).json({ error: "The requested route was not found." });
});

const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (typeof error === "object" && error !== null && "type" in error) {
    const type = String(error.type);
    if (type === "entity.parse.failed") {
      response.status(400).json({ error: "The request body is not valid JSON." });
      return;
    }
    if (type === "entity.too.large") {
      response.status(413).json({ error: "The request body is too large." });
      return;
    }
  }
  response.status(500).json({ error: "The request could not be completed." });
};
app.use(errorHandler);

if (process.env.VERCEL !== "1") {
  app.listen(port, () => {
    console.log(`Wachoo API listening on http://localhost:${port}`);
  });
}

export default app;
