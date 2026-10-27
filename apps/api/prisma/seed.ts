import "dotenv/config";
import { categoriesSeed } from "@wachoo/shared";
import { getPrisma } from "../src/db.js";

function enumValue<T extends string>(value: string): T {
  return value.toLocaleUpperCase().replaceAll("-", "_") as T;
}

function asDate(value: string | null): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

const prisma = getPrisma();

try {
  for (const sourceCategory of categoriesSeed) {
    const category = await prisma.category.upsert({
      where: { provider_code: { provider: "NETFLIX", code: sourceCategory.code } },
      create: {
        provider: "NETFLIX",
        code: sourceCategory.code,
        name: sourceCategory.name,
        alternateNames: [...sourceCategory.alternateNames],
        description: sourceCategory.description,
        keywords: [...sourceCategory.keywords],
        moods: [...sourceCategory.moods],
        providerUrl: sourceCategory.providerUrl,
        verificationStatus: enumValue(sourceCategory.verificationStatus),
        lastVerifiedAt: asDate(sourceCategory.lastVerifiedAt),
        verificationRegion: sourceCategory.verificationRegion,
        active: true,
      },
      update: {
        name: sourceCategory.name,
        alternateNames: [...sourceCategory.alternateNames],
        description: sourceCategory.description,
        keywords: [...sourceCategory.keywords],
        moods: [...sourceCategory.moods],
        providerUrl: sourceCategory.providerUrl,
        verificationStatus: enumValue(sourceCategory.verificationStatus),
        lastVerifiedAt: asDate(sourceCategory.lastVerifiedAt),
        verificationRegion: sourceCategory.verificationRegion,
        active: true,
      },
    });

    await prisma.$transaction(async (transaction) => {
      await transaction.categorySource.deleteMany({ where: { categoryId: category.id } });
      await transaction.categoryParent.deleteMany({ where: { categoryId: category.id } });

      if (sourceCategory.sources.length) {
        await transaction.categorySource.createMany({
          data: sourceCategory.sources.map((source) => ({
            categoryId: category.id,
            url: source.url,
            sourceType: enumValue(source.sourceType),
            evidenceType: enumValue(source.evidenceType),
            observedAt: asDate(source.observedAt),
            observedLabel: source.observedLabel,
            note: source.note,
          })),
        });
      }

      for (const parent of sourceCategory.parentCategories) {
        const parentRecord = await transaction.category.findUnique({
          where: { provider_code: { provider: "NETFLIX", code: parent.providerCode } },
          select: { id: true },
        });
        await transaction.categoryParent.create({
          data: {
            categoryId: category.id,
            parentCode: parent.providerCode,
            parentName: parent.name,
            parentCategoryId: parentRecord?.id ?? null,
          },
        });
      }
    });
  }

  console.info(`Seeded ${categoriesSeed.length} reviewed categories.`);
} finally {
  await prisma.$disconnect();
}
