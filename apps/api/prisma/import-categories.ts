import "dotenv/config";
import { readFile } from "node:fs/promises";
import type { CategoryAdminInput } from "@wachoo/shared";
import { categoryAdminInputSchema } from "@wachoo/shared";
import { getPrisma } from "../src/db.js";

const statusToDb = {
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

function asDate(value: string | null): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

function upsertCategory(input: CategoryAdminInput) {
  const categoryData = {
    provider: "NETFLIX" as const,
    code: input.code,
    name: input.name,
    alternateNames: input.alternateNames,
    description: input.description,
    keywords: input.keywords,
    moods: input.moods,
    providerUrl: input.providerUrl,
    verificationStatus: statusToDb[input.verificationStatus],
    lastVerifiedAt: asDate(input.lastVerifiedAt),
    verificationRegion: input.verificationRegion,
    active: true,
  };
  const sources = input.sources.map((source) => ({
    url: source.url,
    sourceType: sourceTypeToDb[source.sourceType],
    evidenceType: evidenceTypeToDb[source.evidenceType],
    observedAt: asDate(source.observedAt),
    observedLabel: source.observedLabel ?? null,
    note: source.note ?? null,
  }));
  const parentLinks = input.parentCategories.map((parent) => ({
    parentCode: parent.providerCode,
    parentName: parent.name,
  }));

  return getPrisma().category.upsert({
    where: { provider_code: { provider: "NETFLIX", code: input.code } },
    create: {
      ...categoryData,
      sources: { create: sources },
      parentLinks: { create: parentLinks },
    },
    update: {
      ...categoryData,
      sources: { deleteMany: {}, create: sources },
      parentLinks: { deleteMany: {}, create: parentLinks },
    },
    select: { id: true },
  });
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) throw new Error("Usage: npm run db:import -- /path/to/categories.json");
  const raw: unknown = JSON.parse(await readFile(filePath, "utf8"));
  if (!Array.isArray(raw)) throw new Error("The import file must contain a JSON array.");

  const categories: CategoryAdminInput[] = [];
  const problems: string[] = [];
  const seenCodes = new Set<string>();
  raw.forEach((entry: unknown, index: number) => {
    const parsed = categoryAdminInputSchema.safeParse(entry);
    if (!parsed.success) {
      problems.push(`Row ${index + 1}: ${parsed.error.issues.map((issue) => issue.message).join("; ")}`);
      return;
    }
    if (seenCodes.has(parsed.data.code)) {
      problems.push(`Row ${index + 1}: duplicate Netflix code ${parsed.data.code}; merge parent paths into one record.`);
      return;
    }
    seenCodes.add(parsed.data.code);
    categories.push(parsed.data);
  });
  if (problems.length) {
    throw new Error(`Import stopped before writing because ${problems.length} row(s) need correction:\n${problems.slice(0, 30).join("\n")}`);
  }

  const prisma = getPrisma();
  let created = 0;
  let updated = 0;
  for (let offset = 0; offset < categories.length; offset += 100) {
    const batch = categories.slice(offset, offset + 100);
    const existing = await prisma.category.findMany({
      where: { provider: "NETFLIX", code: { in: batch.map((category) => category.code) } },
      select: { code: true },
    });
    const existingCodes = new Set(existing.map(({ code }) => code));
    await prisma.$transaction(batch.map(upsertCategory));
    for (const category of batch) {
      if (existingCodes.has(category.code)) updated += 1;
      else created += 1;
    }
  }

  // Resolve parent links after all category rows exist, preserving source-listed
  // parent snapshots for parent codes that were not included in this import.
  const parentCodes = [...new Set(categories.flatMap((category) => category.parentCategories.map((parent) => parent.providerCode)))];
  if (parentCodes.length) {
    const parents = await prisma.category.findMany({
      where: { provider: "NETFLIX", code: { in: parentCodes } },
      select: { id: true, code: true },
    });
    const idByCode = new Map(parents.map(({ id, code }) => [code, id]));
    const unresolved = await prisma.categoryParent.findMany({
      where: { parentCode: { in: parentCodes }, parentCategoryId: null },
      select: { id: true, parentCode: true },
    });
    for (let offset = 0; offset < unresolved.length; offset += 100) {
      const writes = unresolved.slice(offset, offset + 100).flatMap((link) => {
        const parentCategoryId = idByCode.get(link.parentCode);
        return parentCategoryId
          ? [prisma.categoryParent.update({ where: { id: link.id }, data: { parentCategoryId } })]
          : [];
      });
      if (writes.length) await prisma.$transaction(writes);
    }
  }

  console.info(`Catalogue import complete: ${created} created, ${updated} updated.`);
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Category import failed."}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await getPrisma().$disconnect();
    } catch {
      // Nothing to close if the database was not configured.
    }
  });
