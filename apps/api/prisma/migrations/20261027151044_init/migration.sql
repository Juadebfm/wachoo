-- CreateEnum
CREATE TYPE "Provider" AS ENUM ('NETFLIX');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('LIVE_CHECKED', 'THIRD_PARTY_LISTED', 'UNVERIFIED', 'LIVE_CHECK_FAILED', 'RETIRED');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('PROVIDER', 'THIRD_PARTY');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('THIRD_PARTY_LISTING', 'OFFICIAL_MENTION', 'DIRECT_PROVIDER_PAGE');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('DOES_NOT_OPEN', 'WRONG_CATEGORY', 'OUTDATED', 'REGION_UNAVAILABLE', 'INCORRECT_DETAILS', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED');

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "provider" "Provider" NOT NULL DEFAULT 'NETFLIX',
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "alternateNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "moods" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "providerUrl" TEXT NOT NULL,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "lastVerifiedAt" DATE,
    "verificationRegion" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategorySource" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sourceType" "SourceType" NOT NULL,
    "evidenceType" "EvidenceType" NOT NULL,
    "observedAt" DATE,
    "observedLabel" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CategorySource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryParent" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "parentCode" TEXT NOT NULL,
    "parentName" TEXT NOT NULL,
    "parentCategoryId" TEXT,

    CONSTRAINT "CategoryParent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueReport" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "type" "ReportType" NOT NULL,
    "details" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "reviewedAt" TIMESTAMP(3),
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IssueReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL DEFAULT 'wachoo-primary-admin',
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "authVersion" INTEGER NOT NULL DEFAULT 1,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Category_verificationStatus_active_name_idx" ON "Category"("verificationStatus", "active", "name");

-- CreateIndex
CREATE INDEX "Category_name_idx" ON "Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_provider_code_key" ON "Category"("provider", "code");

-- CreateIndex
CREATE INDEX "CategorySource_categoryId_idx" ON "CategorySource"("categoryId");

-- CreateIndex
CREATE INDEX "CategoryParent_parentCode_idx" ON "CategoryParent"("parentCode");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryParent_categoryId_parentCode_key" ON "CategoryParent"("categoryId", "parentCode");

-- CreateIndex
CREATE INDEX "IssueReport_status_createdAt_idx" ON "IssueReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "IssueReport_categoryId_createdAt_idx" ON "IssueReport"("categoryId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Admin_email_key" ON "Admin"("email");

-- AddForeignKey
ALTER TABLE "CategorySource" ADD CONSTRAINT "CategorySource_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryParent" ADD CONSTRAINT "CategoryParent_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryParent" ADD CONSTRAINT "CategoryParent_parentCategoryId_fkey" FOREIGN KEY ("parentCategoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueReport" ADD CONSTRAINT "IssueReport_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
