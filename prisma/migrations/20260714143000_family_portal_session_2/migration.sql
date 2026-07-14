-- CreateEnum
CREATE TYPE "FamilyEnrollmentMode" AS ENUM ('DIRECT', 'APPLICATION_REQUIRED', 'INVITATION_ONLY', 'WAITLIST', 'GUARDIAN_APPROVAL_REQUIRED', 'STUDENT_INTEREST', 'CLOSED', 'EXTERNAL_PARTNER_PLACEMENT');

-- CreateEnum
CREATE TYPE "FamilyApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FamilyWaitlistStatus" AS ENUM ('ACTIVE', 'LEFT', 'OFFERED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'REMOVED');

-- CreateEnum
CREATE TYPE "FamilySupportExternalStatus" AS ENUM ('SENT', 'REVIEWING', 'NEED_MORE_INFORMATION', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "FamilyFormRequirementStatus" AS ENUM ('REQUIRED', 'IN_PROGRESS', 'COMPLETED', 'SUPERSEDED', 'WAIVED');

-- CreateTable
CREATE TABLE "FamilyEnrollmentConfig" (
    "id" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "mode" "FamilyEnrollmentMode" NOT NULL DEFAULT 'DIRECT',
    "minGrade" INTEGER,
    "maxGrade" INTEGER,
    "minAge" INTEGER,
    "maxAge" INTEGER,
    "requiresGuardianApproval" BOOLEAN NOT NULL DEFAULT false,
    "applicationUrl" TEXT,
    "interestInstructions" TEXT,
    "externalPlacementNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyEnrollmentConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuardianApprovalRequest" (
    "id" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "guardianUserId" TEXT,
    "offeringId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "status" "FamilyApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "decisionById" TEXT,
    "decisionNote" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "auditMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuardianApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyWaitlistEntry" (
    "id" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "status" "FamilyWaitlistStatus" NOT NULL DEFAULT 'ACTIVE',
    "offerExpiresAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "decidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "FamilyWaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyWaitlistAudit" (
    "id" TEXT NOT NULL,
    "waitlistId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyWaitlistAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilySupportRequest" (
    "id" TEXT NOT NULL,
    "requesterUserId" TEXT NOT NULL,
    "requesterRole" TEXT NOT NULL,
    "studentUserId" TEXT,
    "guardianUserId" TEXT,
    "offeringId" TEXT,
    "sessionId" TEXT,
    "programId" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "externalStatus" "FamilySupportExternalStatus" NOT NULL DEFAULT 'SENT',
    "internalRoutingTeam" TEXT,
    "safetyFlag" BOOLEAN NOT NULL DEFAULT false,
    "internalActionItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilySupportRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilySupportResponse" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "body" TEXT NOT NULL,
    "familyVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilySupportResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilySupportStatusHistory" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "status" "FamilySupportExternalStatus" NOT NULL,
    "actorUserId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilySupportStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyFormTemplate" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "formType" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyFormTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyFormVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retiredAt" TIMESTAMP(3),

    CONSTRAINT "FamilyFormVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyFormRequirement" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "offeringId" TEXT,
    "programId" TEXT,
    "dueAt" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "status" "FamilyFormRequirementStatus" NOT NULL DEFAULT 'REQUIRED',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyFormRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyFormSubmission" (
    "id" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "guardianUserId" TEXT NOT NULL,
    "guardianRelationshipId" TEXT,
    "content" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SIGNED',
    "staffReviewState" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
    "supersededAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FamilyFormSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyFormSignature" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "guardianUserId" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "guardianRelationshipId" TEXT,
    "signerName" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgementText" TEXT NOT NULL,

    CONSTRAINT "FamilyFormSignature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FamilyEnrollmentConfig_offeringId_key" ON "FamilyEnrollmentConfig"("offeringId");

-- CreateIndex
CREATE INDEX "GuardianApprovalRequest_guardianUserId_status_idx" ON "GuardianApprovalRequest"("guardianUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "GuardianApprovalRequest_studentUserId_offeringId_status_key" ON "GuardianApprovalRequest"("studentUserId", "offeringId", "status");

-- CreateIndex
CREATE INDEX "FamilyWaitlistEntry_offeringId_status_idx" ON "FamilyWaitlistEntry"("offeringId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyWaitlistEntry_studentUserId_offeringId_key" ON "FamilyWaitlistEntry"("studentUserId", "offeringId");

-- CreateIndex
CREATE INDEX "FamilyWaitlistAudit_waitlistId_createdAt_idx" ON "FamilyWaitlistAudit"("waitlistId", "createdAt");

-- CreateIndex
CREATE INDEX "FamilySupportRequest_requesterUserId_createdAt_idx" ON "FamilySupportRequest"("requesterUserId", "createdAt");

-- CreateIndex
CREATE INDEX "FamilySupportRequest_studentUserId_externalStatus_idx" ON "FamilySupportRequest"("studentUserId", "externalStatus");

-- CreateIndex
CREATE INDEX "FamilySupportResponse_requestId_familyVisible_idx" ON "FamilySupportResponse"("requestId", "familyVisible");

-- CreateIndex
CREATE INDEX "FamilySupportStatusHistory_requestId_createdAt_idx" ON "FamilySupportStatusHistory"("requestId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyFormTemplate_key_key" ON "FamilyFormTemplate"("key");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyFormVersion_templateId_version_key" ON "FamilyFormVersion"("templateId", "version");

-- CreateIndex
CREATE INDEX "FamilyFormRequirement_studentUserId_status_idx" ON "FamilyFormRequirement"("studentUserId", "status");

-- CreateIndex
CREATE INDEX "FamilyFormSubmission_requirementId_createdAt_idx" ON "FamilyFormSubmission"("requirementId", "createdAt");

-- CreateIndex
CREATE INDEX "FamilyFormSignature_studentUserId_signedAt_idx" ON "FamilyFormSignature"("studentUserId", "signedAt");

-- AddForeignKey
ALTER TABLE "FamilyEnrollmentConfig" ADD CONSTRAINT "FamilyEnrollmentConfig_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "ClassOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianApprovalRequest" ADD CONSTRAINT "GuardianApprovalRequest_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianApprovalRequest" ADD CONSTRAINT "GuardianApprovalRequest_guardianUserId_fkey" FOREIGN KEY ("guardianUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianApprovalRequest" ADD CONSTRAINT "GuardianApprovalRequest_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "ClassOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianApprovalRequest" ADD CONSTRAINT "GuardianApprovalRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianApprovalRequest" ADD CONSTRAINT "GuardianApprovalRequest_decisionById_fkey" FOREIGN KEY ("decisionById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyWaitlistEntry" ADD CONSTRAINT "FamilyWaitlistEntry_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyWaitlistEntry" ADD CONSTRAINT "FamilyWaitlistEntry_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "ClassOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyWaitlistEntry" ADD CONSTRAINT "FamilyWaitlistEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyWaitlistEntry" ADD CONSTRAINT "FamilyWaitlistEntry_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyWaitlistAudit" ADD CONSTRAINT "FamilyWaitlistAudit_waitlistId_fkey" FOREIGN KEY ("waitlistId") REFERENCES "FamilyWaitlistEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilySupportRequest" ADD CONSTRAINT "FamilySupportRequest_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilySupportRequest" ADD CONSTRAINT "FamilySupportRequest_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilySupportRequest" ADD CONSTRAINT "FamilySupportRequest_guardianUserId_fkey" FOREIGN KEY ("guardianUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilySupportRequest" ADD CONSTRAINT "FamilySupportRequest_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "ClassOffering"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilySupportRequest" ADD CONSTRAINT "FamilySupportRequest_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilySupportResponse" ADD CONSTRAINT "FamilySupportResponse_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "FamilySupportRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilySupportStatusHistory" ADD CONSTRAINT "FamilySupportStatusHistory_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "FamilySupportRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyFormVersion" ADD CONSTRAINT "FamilyFormVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "FamilyFormTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyFormRequirement" ADD CONSTRAINT "FamilyFormRequirement_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "FamilyFormVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyFormRequirement" ADD CONSTRAINT "FamilyFormRequirement_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyFormRequirement" ADD CONSTRAINT "FamilyFormRequirement_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "ClassOffering"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyFormSubmission" ADD CONSTRAINT "FamilyFormSubmission_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "FamilyFormRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyFormSubmission" ADD CONSTRAINT "FamilyFormSubmission_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "FamilyFormVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyFormSubmission" ADD CONSTRAINT "FamilyFormSubmission_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyFormSubmission" ADD CONSTRAINT "FamilyFormSubmission_guardianUserId_fkey" FOREIGN KEY ("guardianUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyFormSignature" ADD CONSTRAINT "FamilyFormSignature_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "FamilyFormSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyFormSignature" ADD CONSTRAINT "FamilyFormSignature_guardianUserId_fkey" FOREIGN KEY ("guardianUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyFormSignature" ADD CONSTRAINT "FamilyFormSignature_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

