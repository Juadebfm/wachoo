import { z } from "zod";
import { providerCategorySchema } from "./category.js";

export const popularityMetricSchema = z.enum(["copies", "opens"]);

export const popularityEventInputSchema = z.object({
  categoryId: z.string().min(1).max(100),
  metric: popularityMetricSchema,
}).strict();

export const popularCategorySchema = z.object({
  category: providerCategorySchema,
  count: z.number().int().nonnegative(),
});

export const popularityResponseSchema = z.object({
  metric: popularityMetricSchema,
  windowStart: z.string().datetime(),
  data: z.array(popularCategorySchema),
});

export type PopularityMetric = z.infer<typeof popularityMetricSchema>;
export type PopularityEventInput = z.infer<typeof popularityEventInputSchema>;
export type PopularCategory = z.infer<typeof popularCategorySchema>;
export type PopularityResponse = z.infer<typeof popularityResponseSchema>;
