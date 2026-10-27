import { createHmac } from "node:crypto";
import type { Request } from "express";
import { redisIncrementWithExpiry } from "./redis-store.js";

export async function isRateLimited(
  request: Request,
  bucket: string,
  maximum: number,
  windowSeconds: number,
): Promise<boolean> {
  const address = request.ip || request.socket.remoteAddress || "unknown";
  const secret = process.env.RATE_LIMIT_HASH_KEY;
  if (process.env.NODE_ENV === "production" && !secret) {
    throw new Error("RATE_LIMIT_HASH_KEY is not configured.");
  }

  const addressHash = createHmac("sha256", secret ?? "local-development-only")
    .update(address)
    .digest("hex");
  const count = await redisIncrementWithExpiry(`wachoo:rate:v1:${bucket}:${addressHash}`, windowSeconds);
  return count > maximum;
}
