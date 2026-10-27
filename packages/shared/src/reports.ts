import { z } from "zod";

export const reportTypeSchema = z.enum([
  "does_not_open",
  "wrong_category",
  "outdated",
  "region_unavailable",
  "incorrect_details",
  "other",
]);

export const reportStatusSchema = z.enum(["open", "in_review", "resolved", "dismissed"]);

export const issueReportInputSchema = z.object({
  categoryId: z.string().min(1).max(100),
  type: reportTypeSchema,
  details: z.string().trim().max(1200).optional(),
}).strict();

export const issueReportUpdateSchema = z.object({
  status: reportStatusSchema,
  adminNote: z.string().trim().max(1200).nullable().optional(),
}).strict();

export const reportListQuerySchema = z.object({
  status: reportStatusSchema.optional(),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
}).strict();

export type ReportType = z.infer<typeof reportTypeSchema>;
export type ReportStatus = z.infer<typeof reportStatusSchema>;
export type IssueReportInput = z.infer<typeof issueReportInputSchema>;
