import type { IssueReportInput } from "@wachoo/shared";
import { getPrisma } from "./db.js";

const typeToDb = {
  does_not_open: "DOES_NOT_OPEN",
  wrong_category: "WRONG_CATEGORY",
  outdated: "OUTDATED",
  region_unavailable: "REGION_UNAVAILABLE",
  incorrect_details: "INCORRECT_DETAILS",
  other: "OTHER",
} as const;

const statusToDb = {
  open: "OPEN",
  in_review: "IN_REVIEW",
  resolved: "RESOLVED",
  dismissed: "DISMISSED",
} as const;

export async function createIssueReport(input: IssueReportInput) {
  return getPrisma().issueReport.create({
    data: {
      categoryId: input.categoryId,
      type: typeToDb[input.type],
      details: input.details || null,
    },
    select: { id: true, status: true, createdAt: true },
  });
}

export async function listIssueReports(query: {
  status?: keyof typeof statusToDb;
  page: number;
  pageSize: number;
}) {
  const where = query.status ? { status: statusToDb[query.status] } : {};
  const [reports, total] = await Promise.all([
    getPrisma().issueReport.findMany({
      where,
      include: { category: { select: { id: true, code: true, name: true, provider: true } } },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    getPrisma().issueReport.count({ where }),
  ]);
  return {
    data: reports.map((report) => ({
      id: report.id,
      category: {
        ...report.category,
        provider: "netflix" as const,
      },
      type: report.type.toLocaleLowerCase(),
      details: report.details,
      status: report.status.toLocaleLowerCase(),
      reviewedAt: report.reviewedAt?.toISOString() ?? null,
      adminNote: report.adminNote,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
    hasMore: query.page * query.pageSize < total,
  };
}

export async function updateIssueReport(
  id: string,
  update: { status: keyof typeof statusToDb; adminNote?: string | null },
) {
  const report = await getPrisma().issueReport.update({
    where: { id },
    data: {
      status: statusToDb[update.status],
      adminNote: update.adminNote,
      reviewedAt: update.status === "open" ? null : new Date(),
    },
    select: { id: true, status: true, reviewedAt: true, adminNote: true },
  });
  return {
    ...report,
    status: report.status.toLocaleLowerCase(),
    reviewedAt: report.reviewedAt?.toISOString() ?? null,
  };
}
