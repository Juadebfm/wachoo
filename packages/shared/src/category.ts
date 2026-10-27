import { z } from "zod";

export const categoryVerificationStatusSchema = z.enum([
  "unverified",
  "third_party_listed",
  "live_checked",
  "live_check_failed",
  "retired",
]);

export const categoryEvidenceSchema = z.object({
  url: z.string().url(),
  sourceType: z.enum(["provider", "third_party"]),
  evidenceType: z.enum([
    "third_party_listing",
    "official_mention",
    "direct_provider_page",
  ]),
  observedAt: z.string().nullable(),
  observedLabel: z.string().optional(),
  note: z.string().optional(),
});

export const categoryParentSchema = z.object({
  providerCode: z.string(),
  name: z.string(),
});

export const providerCategorySchema = z.object({
  id: z.string(),
  provider: z.literal("netflix"),
  code: z.string().regex(/^\d+$/, "Provider codes must be stored as digits."),
  name: z.string().min(1),
  alternateNames: z.array(z.string()),
  description: z.string().nullable(),
  parentCategories: z.array(categoryParentSchema),
  keywords: z.array(z.string()),
  moods: z.array(z.string()),
  providerUrl: z.string().url(),
  verificationStatus: categoryVerificationStatusSchema,
  lastVerifiedAt: z.string().nullable(),
  verificationRegion: z.string().nullable(),
  sources: z.array(categoryEvidenceSchema).min(1),
});

export type CategoryVerificationStatus = z.infer<
  typeof categoryVerificationStatusSchema
>;
export type CategoryEvidence = z.infer<typeof categoryEvidenceSchema>;
export type ProviderCategory = z.infer<typeof providerCategorySchema>;

export const categorySourceInputSchema = categoryEvidenceSchema;

export const categoryAdminInputSchema = providerCategorySchema
  .omit({ id: true, provider: true })
  .extend({
    provider: z.literal("netflix").default("netflix"),
  })
  .strict()
  .refine(
    (category) => category.providerUrl === `https://www.netflix.com/browse/genre/${category.code}`,
    { path: ["providerUrl"], message: "The Netflix URL must match the category code." },
  );

export const categoryListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  mood: z.string().trim().min(1).max(64).optional(),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
}).strict();

export type CategoryAdminInput = z.infer<typeof categoryAdminInputSchema>;
export type CategoryListQuery = z.infer<typeof categoryListQuerySchema>;
