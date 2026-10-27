import { createClient } from "redis";
import { Redis } from "@upstash/redis";

type LocalRedisClient = ReturnType<typeof createClient>;

const upstashConfigured = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
);
const localRedisConfigured = Boolean(process.env.REDIS_URL);
const upstash = upstashConfigured ? Redis.fromEnv() : null;
let localRedis: LocalRedisClient | null = null;
let localConnect: Promise<LocalRedisClient> | null = null;

async function getLocalRedis(): Promise<LocalRedisClient> {
  if (!localRedisConfigured) throw new Error("Redis is not configured.");
  if (localRedis?.isOpen) return localRedis;
  if (localConnect) return localConnect;

  localRedis = createClient({ url: process.env.REDIS_URL });
  localRedis.on("error", () => {
    // Do not log connection strings or Redis command values.
  });
  localConnect = localRedis.connect().then(() => localRedis as LocalRedisClient);
  try {
    return await localConnect;
  } finally {
    localConnect = null;
  }
}

function assertOneRedisTarget(): void {
  if (upstashConfigured && localRedisConfigured) {
    throw new Error("Configure either Upstash Redis or local REDIS_URL, not both.");
  }
  if (!upstashConfigured && !localRedisConfigured) throw new Error("Redis is not configured.");
}

export async function redisGet(key: string): Promise<string | null> {
  assertOneRedisTarget();
  if (upstash) return upstash.get<string>(key);
  return (await getLocalRedis()).get(key);
}

export async function redisSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  assertOneRedisTarget();
  if (upstash) {
    await upstash.set(key, value, { ex: ttlSeconds });
    return;
  }
  await (await getLocalRedis()).set(key, value, { EX: ttlSeconds });
}

export async function redisDelete(key: string): Promise<void> {
  assertOneRedisTarget();
  if (upstash) {
    await upstash.del(key);
    return;
  }
  await (await getLocalRedis()).del(key);
}

export async function redisIncrementWithExpiry(key: string, ttlSeconds: number): Promise<number> {
  assertOneRedisTarget();
  if (upstash) {
    const count = await upstash.incr(key);
    if (count === 1) await upstash.expire(key, ttlSeconds);
    return count;
  }
  const client = await getLocalRedis();
  const count = await client.incr(key);
  if (count === 1) await client.expire(key, ttlSeconds);
  return count;
}

export async function redisAddSortedSet(key: string, score: number, member: string): Promise<void> {
  assertOneRedisTarget();
  if (upstash) {
    await upstash.zadd(key, { score, member });
    return;
  }
  await (await getLocalRedis()).zAdd(key, { score, value: member });
}

export async function redisRemoveSortedSetThrough(key: string, score: number): Promise<void> {
  assertOneRedisTarget();
  if (upstash) {
    await upstash.zremrangebyscore(key, 0, score);
    return;
  }
  await (await getLocalRedis()).zRemRangeByScore(key, 0, score);
}

export async function redisReadSortedSet(key: string): Promise<string[]> {
  assertOneRedisTarget();
  if (upstash) return upstash.zrange<string[]>(key, 0, -1);
  return (await getLocalRedis()).zRange(key, 0, -1);
}

export async function redisExpire(key: string, ttlSeconds: number): Promise<void> {
  assertOneRedisTarget();
  if (upstash) {
    await upstash.expire(key, ttlSeconds);
    return;
  }
  await (await getLocalRedis()).expire(key, ttlSeconds);
}
