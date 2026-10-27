import type { CategoryAdminInput, CategoryListQuery, ProviderCategory } from "@wachoo/shared";
import { getPrisma } from "./db.js";

const categoryInclude = {
  sources: { orderBy: { createdAt: "asc" as const } },
  parentLinks: { orderBy: { parentCode: "asc" as const } },
};

const verificationToDb = {
  unverified: "UNVERIFIED",
  third_party_listed: "THIRD_PARTY_LISTED",
  live_checked: "LIVE_CHECKED",
  live_check_failed: "LIVE_CHECK_FAILED",
  retired: "RETIRED",
} as const;

const sourceTypeToDb = { provider: "PROVIDER", third_party: "THIRD_PARTY" } as const;
const evidenceTypeToDb = {
  third_party_listing: "THIRD_PARTY_LISTING",
  official_mention: "OFFICIAL_MENTION",
  direct_provider_page: "DIRECT_PROVIDER_PAGE",
} as const;

function dbDate(value: string | null): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function stringDate(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function fromEnum(value: string): string {
  return value.toLocaleLowerCase();
}

export function categoryToDto(category: {
  id: string;
  provider: string;
  code: string;
  name: string;
  alternateNames: string[];
  description: string | null;
  keywords: string[];
  moods: string[];
  providerUrl: string;
  verificationStatus: string;
  lastVerifiedAt: Date | null;
  verificationRegion: string | null;
  sources: Array<{
    url: string;
    sourceType: string;
    evidenceType: string;
    observedAt: Date | null;
    observedLabel: string | null;
    note: string | null;
  }>;
  parentLinks: Array<{ parentCode: string; parentName: string }>;
}): ProviderCategory {
  return {
    id: category.id,
    provider: "netflix",
    code: category.code,
    name: category.name,
    alternateNames: category.alternateNames,
    description: category.description,
    keywords: category.keywords,
    moods: category.moods,
    providerUrl: category.providerUrl,
    verificationStatus: fromEnum(category.verificationStatus) as ProviderCategory["verificationStatus"],
    lastVerifiedAt: stringDate(category.lastVerifiedAt),
    verificationRegion: category.verificationRegion,
    sources: category.sources.map((source) => ({
      url: source.url,
      sourceType: fromEnum(source.sourceType) as ProviderCategory["sources"][number]["sourceType"],
      evidenceType: fromEnum(source.evidenceType) as ProviderCategory["sources"][number]["evidenceType"],
      observedAt: stringDate(source.observedAt),
      ...(source.observedLabel ? { observedLabel: source.observedLabel } : {}),
      ...(source.note ? { note: source.note } : {}),
    })),
    parentCategories: category.parentLinks.map((parent) => ({
      providerCode: parent.parentCode,
      name: parent.parentName,
    })),
  };
}

function categoryData(input: CategoryAdminInput) {
  return {
    provider: "NETFLIX" as const,
    code: input.code,
    name: input.name,
    alternateNames: input.alternateNames,
    description: input.description,
    keywords: input.keywords,
    moods: input.moods,
    providerUrl: input.providerUrl,
    verificationStatus: verificationToDb[input.verificationStatus],
    lastVerifiedAt: dbDate(input.lastVerifiedAt),
    verificationRegion: input.verificationRegion,
  };
}

async function relationData(input: CategoryAdminInput) {
  const prisma = getPrisma();
  return {
    sources: {
      create: input.sources.map((source) => ({
        url: source.url,
        sourceType: sourceTypeToDb[source.sourceType],
        evidenceType: evidenceTypeToDb[source.evidenceType],
        observedAt: dbDate(source.observedAt),
        observedLabel: source.observedLabel ?? null,
        note: source.note ?? null,
      })),
    },
    parentLinks: {
      create: await Promise.all(input.parentCategories.map(async (parent) => {
        const parentCategory = await prisma.category.findUnique({
          where: { provider_code: { provider: "NETFLIX", code: parent.providerCode } },
          select: { id: true },
        });
        return {
          parentCode: parent.providerCode,
          parentName: parent.name,
          parentCategoryId: parentCategory?.id ?? null,
        };
      })),
    },
  };
}

export async function listCategories(query: CategoryListQuery) {
  const prisma = getPrisma();
  const tokens = query.q?.split(/\s+/).filter(Boolean) ?? [];
  const where = {
    active: true,
    ...(query.mood ? { moods: { has: query.mood.toLocaleLowerCase() } } : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: "insensitive" as const } },
            { code: { contains: query.q } },
            { alternateNames: { hasSome: tokens } },
            { keywords: { hasSome: tokens.map((token) => token.toLocaleLowerCase()) } },
            { moods: { hasSome: tokens.map((token) => token.toLocaleLowerCase()) } },
            { parentLinks: { some: { parentName: { contains: query.q, mode: "insensitive" as const } } } },
          ],
        }
      : {}),
  };
  const [records, total] = await Promise.all([
    prisma.category.findMany({
      where,
      include: categoryInclude,
      orderBy: [{ verificationStatus: "asc" }, { name: "asc" }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.category.count({ where }),
  ]);

  return {
    data: records.map(categoryToDto),
    total,
    page: query.page,
    pageSize: query.pageSize,
    hasMore: query.page * query.pageSize < total,
  };
}

export async function findCategoryById(id: string) {
  const category = await getPrisma().category.findFirst({
    where: { id, active: true },
    include: categoryInclude,
  });
  return category ? categoryToDto(category) : null;
}

export async function createCategory(input: CategoryAdminInput) {
  const relations = await relationData(input);
  const category = await getPrisma().category.create({
    data: { ...categoryData(input), ...relations },
    include: categoryInclude,
  });
  return categoryToDto(category);
}

export async function updateCategory(id: string, input: CategoryAdminInput) {
  const prisma = getPrisma();
  const relations = await relationData(input);
  const category = await prisma.$transaction(async (transaction) => {
    await transaction.categorySource.deleteMany({ where: { categoryId: id } });
    await transaction.categoryParent.deleteMany({ where: { categoryId: id } });
    return transaction.category.update({
      where: { id },
      data: { ...categoryData(input), ...relations },
      include: categoryInclude,
    });
  });
  return categoryToDto(category);
}

export async function disableCategory(id: string): Promise<boolean> {
  const result = await getPrisma().category.updateMany({ where: { id, active: true }, data: { active: false } });
  return result.count > 0;
}
