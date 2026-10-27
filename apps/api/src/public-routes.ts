import { randomUUID } from "node:crypto";
import { Router } from "express";
import {
  categoryListQuerySchema,
  issueReportInputSchema,
  popularityEventInputSchema,
  popularityMetricSchema,
  popularityResponseSchema,
} from "@wachoo/shared";
import { categoryToDto, findCategoryById, listCategories } from "./category-service.js";
import { getPrisma } from "./db.js";
import { createIssueReport } from "./report-service.js";
import { isRateLimited } from "./rate-limit.js";
import {
  redisGet,
  redisSet,
  redisAddSortedSet,
  redisExpire,
  redisReadSortedSet,
  redisRemoveSortedSetThrough,
} from "./redis-store.js";

export const publicRouter = Router();
const popularityWindowMs = 7 * 24 * 60 * 60 * 1000;
const popularityTtlSeconds = 8 * 24 * 60 * 60;
const popularityKeyPrefix = "wachoo:popularity:v1";
const tmdbCacheSeconds = 12 * 60 * 60;

type TmdbTitle = {
  id: number;
  title: string;
  mediaType: "movie" | "tv";
  posterUrl: string | null;
  year: string | null;
  tmdbUrl: string;
};

function tmdbGenreFor(category: { name: string; moods: string[]; keywords: string[] }): number | null {
  const words = `${category.name} ${category.moods.join(" ")} ${category.keywords.join(" ")}`.toLowerCase();
  if (/horror|scare|witchcraft|dark arts|supernatural/.test(words)) return 27;
  if (/crime|mystery|scammer|schemer/.test(words)) return 80;
  if (/romance|rom-com|love|swipe right|swipe left/.test(words)) return 10749;
  if (/comedy|laugh|funny|irreverent/.test(words)) return 35;
  if (/action|cyberpunk|dystopian/.test(words)) return 28;
  if (/family|chosen family/.test(words)) return 10751;
  if (/documentar/.test(words)) return 99;
  if (/thriller/.test(words)) return 53;
  if (/animation|anime/.test(words)) return 16;
  if (/science fiction|sci-fi/.test(words)) return 878;
  if (/drama|k-drama/.test(words)) return 18;
  return null;
}

async function tmdbTitles(genreId: number): Promise<TmdbTitle[]> {
  const token = process.env.TMDB_API_READ_ACCESS_TOKEN;
  if (!token) return [];
  const cacheKey = `wachoo:tmdb:genre:${genreId}:v1`;
  try {
    const cached = await redisGet(cacheKey);
    if (cached) return JSON.parse(cached) as TmdbTitle[];
  } catch {
    // A cache outage should not prevent the optional poster suggestions.
  }

  const url = new URL("https://api.themoviedb.org/3/discover/movie");
  url.searchParams.set("with_genres", String(genreId));
  url.searchParams.set("sort_by", "popularity.desc");
  url.searchParams.set("include_adult", "false");
  url.searchParams.set("language", "en-US");
  url.searchParams.set("page", "1");
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("TMDB suggestions are temporarily unavailable.");
  const payload = await response.json() as {
    results?: Array<{ id: number; title?: string; poster_path?: string | null; release_date?: string }>;
  };
  const titles = (payload.results ?? []).slice(0, 8).flatMap((item) => {
    if (!item.id || !item.title) return [];
    return [{
      id: item.id,
      title: item.title,
      mediaType: "movie" as const,
      posterUrl: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
      year: item.release_date?.slice(0, 4) || null,
      tmdbUrl: `https://www.themoviedb.org/movie/${item.id}`,
    }];
  });
  try {
    await redisSet(cacheKey, JSON.stringify(titles), tmdbCacheSeconds);
  } catch {
    // Return the live response even when the optional cache is unavailable.
  }
  return titles;
}

function popularityKey(metric: "copies" | "opens"): string {
  return `${popularityKeyPrefix}:${metric}`;
}

function windowStart(now = Date.now()): number {
  return now - popularityWindowMs;
}

publicRouter.get("/categories", async (request, response) => {
  const parsed = categoryListQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    response.status(400).json({ error: "The category search options are invalid." });
    return;
  }
  try {
    response.json(await listCategories(parsed.data));
  } catch {
    response.status(503).json({ error: "The category catalogue is temporarily unavailable." });
  }
});

publicRouter.get("/categories/suggestions", async (request, response) => {
  const rawIds = typeof request.query.ids === "string" ? request.query.ids : "";
  const ids = [...new Set(rawIds.split(",").map((id) => id.trim()).filter(Boolean))];
  if (ids.length > 24 || ids.some((id) => id.length > 80)) {
    response.status(400).json({ error: "Request up to 24 category suggestions at a time." });
    return;
  }
  if (ids.length === 0) {
    response.json({ configured: Boolean(process.env.TMDB_API_READ_ACCESS_TOKEN), data: {} });
    return;
  }
  try {
    const categories = await getPrisma().category.findMany({
      where: { id: { in: ids }, active: true },
      select: { id: true, name: true, moods: true, keywords: true },
    });
    const genres = new Map<number, Promise<TmdbTitle[]>>();
    const data: Record<string, TmdbTitle[]> = {};
    await Promise.all(categories.map(async (category) => {
      const genreId = tmdbGenreFor(category);
      if (genreId === null || !process.env.TMDB_API_READ_ACCESS_TOKEN) {
        data[category.id] = [];
        return;
      }
      let titles = genres.get(genreId);
      if (!titles) {
        titles = tmdbTitles(genreId);
        genres.set(genreId, titles);
      }
      data[category.id] = await titles;
    }));
    response.json({ configured: Boolean(process.env.TMDB_API_READ_ACCESS_TOKEN), data });
  } catch {
    response.status(503).json({ error: "Poster suggestions are temporarily unavailable." });
  }
});

publicRouter.get("/categories/:id", async (request, response) => {
  try {
    const category = await findCategoryById(request.params.id ?? "");
    if (!category) {
      response.status(404).json({ error: "The category was not found." });
      return;
    }
    response.json({ data: category });
  } catch {
    response.status(503).json({ error: "The category catalogue is temporarily unavailable." });
  }
});

publicRouter.post("/reports", async (request, response) => {
  const parsed = issueReportInputSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "The issue report is invalid." });
    return;
  }
  try {
    if (await isRateLimited(request, "report", 5, 60 * 60)) {
      response.setHeader("Retry-After", "3600");
      response.status(429).json({ error: "Too many reports from this connection. Try again later." });
      return;
    }
    const category = await getPrisma().category.findFirst({
      where: { id: parsed.data.categoryId, active: true },
      select: { id: true },
    });
    if (!category) {
      response.status(404).json({ error: "The category was not found." });
      return;
    }
    const report = await createIssueReport(parsed.data);
    response.status(201).json({ data: report });
  } catch {
    response.status(503).json({ error: "Issue reporting is temporarily unavailable." });
  }
});

publicRouter.get("/popular", async (request, response) => {
  const parsedMetric = popularityMetricSchema.safeParse(request.query.metric);
  if (!parsedMetric.success) {
    response.status(400).json({ error: "Choose copies or opens as the popularity metric." });
    return;
  }
  try {
    const metric = parsedMetric.data;
    const key = popularityKey(metric);
    const since = windowStart();
    await redisRemoveSortedSetThrough(key, since);
    const members = await redisReadSortedSet(key);
    const counts = new Map<string, number>();
    members.forEach((member) => {
      const separator = member.indexOf(":");
      if (separator < 0) return;
      try {
        const categoryId = decodeURIComponent(member.slice(0, separator));
        if (categoryId) counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1);
      } catch {
        // Ignore malformed legacy members.
      }
    });
    const records = await getPrisma().category.findMany({
      where: { id: { in: [...counts.keys()] }, active: true },
      include: {
        sources: { orderBy: { createdAt: "asc" } },
        parentLinks: { orderBy: { parentCode: "asc" } },
      },
    });
    const data = records
      .map((category) => ({ category: categoryToDto(category), count: counts.get(category.id) ?? 0 }))
      .sort((first, second) => second.count - first.count || first.category.name.localeCompare(second.category.name))
      .slice(0, 8);
    response.json(popularityResponseSchema.parse({
      metric,
      windowStart: new Date(since).toISOString(),
      data,
    }));
  } catch {
    response.status(503).json({ error: "Weekly popularity is temporarily unavailable." });
  }
});

publicRouter.post("/popularity-events", async (request, response) => {
  const parsed = popularityEventInputSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: "The popularity event is invalid." });
    return;
  }
  try {
    if (await isRateLimited(request, "popularity", 60, 60)) {
      response.setHeader("Retry-After", "60");
      response.status(429).json({ error: "Too many activity events. Try again shortly." });
      return;
    }
    const category = await getPrisma().category.findFirst({
      where: { id: parsed.data.categoryId, active: true },
      select: { id: true },
    });
    if (!category) {
      response.status(404).json({ error: "The category was not found." });
      return;
    }
    const now = Date.now();
    const key = popularityKey(parsed.data.metric);
    const member = `${encodeURIComponent(parsed.data.categoryId)}:${randomUUID()}`;
    await redisAddSortedSet(key, now, member);
    await redisRemoveSortedSetThrough(key, windowStart(now));
    await redisExpire(key, popularityTtlSeconds);
    response.status(202).json({ accepted: true });
  } catch {
    response.status(503).json({ error: "Popularity tracking is temporarily unavailable." });
  }
});
