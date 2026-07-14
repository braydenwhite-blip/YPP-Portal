-- CreateEnum
CREATE TYPE "FamilyRelationshipStatus" AS ENUM ('PENDING', 'ACTIVE', 'REVOKED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "FamilyVerificationState" AS ENUM ('UNVERIFIED', 'INVITED', 'VERIFIED', 'NEEDS_REVIEW', 'REJECTED');

-- CreateEnum
CREATE TYPE "FamilyInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');


-- CreateTable
CREATE TABLE "Household" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Household_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseholdMember" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memberType" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HouseholdMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuardianProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "preferredName" TEXT,
    "preferredLanguage" TEXT,
    "bestContactMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuardianProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentGuardianRelationship" (
    "id" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "guardianUserId" TEXT NOT NULL,
    "guardianProfileId" TEXT,
    "householdId" TEXT,
    "relationshipType" TEXT NOT NULL DEFAULT 'Guardian',
    "relationshipStatus" "FamilyRelationshipStatus" NOT NULL DEFAULT 'PENDING',
    "isPrimaryContact" BOOLEAN NOT NULL DEFAULT false,
    "isEmergencyContact" BOOLEAN NOT NULL DEFAULT false,
    "canViewLearning" BOOLEAN NOT NULL DEFAULT true,
    "canManageEnrollment" BOOLEAN NOT NULL DEFAULT false,
    "canApproveEnrollment" BOOLEAN NOT NULL DEFAULT false,
    "canSignForms" BOOLEAN NOT NULL DEFAULT false,
    "canUpdateContactInformation" BOOLEAN NOT NULL DEFAULT false,
    "canManageCommunicationPreferences" BOOLEAN NOT NULL DEFAULT false,
    "canSubmitSupportRequests" BOOLEAN NOT NULL DEFAULT true,
    "canReceiveProgramNotifications" BOOLEAN NOT NULL DEFAULT true,
    "legalRestrictionNotes" TEXT,
    "custodyRestrictionNotes" TEXT,
    "verificationState" "FamilyVerificationState" NOT NULL DEFAULT 'UNVERIFIED',
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "legacyParentStudentId" TEXT,
    "legacyParentStudentConnectionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "StudentGuardianRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FamilyInvitation" (
    "id" TEXT NOT NULL,
    "householdId" TEXT,
    "studentUserId" TEXT,
    "invitedEmail" TEXT NOT NULL,
    "invitedName" TEXT,
    "relationshipType" TEXT NOT NULL DEFAULT 'Guardian',
    "invitedByGuardianProfileId" TEXT,
    "status" "FamilyInvitationStatus" NOT NULL DEFAULT 'PENDING',
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyContact" (
    "id" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "guardianProfileId" TEXT,
    "name" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isAuthorizedPickup" BOOLEAN NOT NULL DEFAULT false,
    "verificationState" "FamilyVerificationState" NOT NULL DEFAULT 'UNVERIFIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "EmergencyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationPreference" (
    "id" TEXT NOT NULL,
    "guardianProfileId" TEXT NOT NULL,
    "studentUserId" TEXT,
    "channel" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "studentUserId" TEXT NOT NULL,
    "guardianUserId" TEXT,
    "consentType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "signedByName" TEXT,
    "signedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'PORTAL',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Household_createdById_idx" ON "Household"("createdById");

-- CreateIndex
CREATE INDEX "HouseholdMember_userId_leftAt_idx" ON "HouseholdMember"("userId", "leftAt");

-- CreateIndex
CREATE UNIQUE INDEX "HouseholdMember_householdId_userId_key" ON "HouseholdMember"("householdId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "GuardianProfile_userId_key" ON "GuardianProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentGuardianRelationship_legacyParentStudentId_key" ON "StudentGuardianRelationship"("legacyParentStudentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentGuardianRelationship_legacyParentStudentConnectionId_key" ON "StudentGuardianRelationship"("legacyParentStudentConnectionId");

-- CreateIndex
CREATE INDEX "StudentGuardianRelationship_guardianUserId_relationshipStat_idx" ON "StudentGuardianRelationship"("guardianUserId", "relationshipStatus", "revokedAt");

-- CreateIndex
CREATE INDEX "StudentGuardianRelationship_studentUserId_relationshipStatu_idx" ON "StudentGuardianRelationship"("studentUserId", "relationshipStatus", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudentGuardianRelationship_studentUserId_guardianUserId_re_key" ON "StudentGuardianRelationship"("studentUserId", "guardianUserId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyInvitation_tokenHash_key" ON "FamilyInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "FamilyInvitation_invitedEmail_status_idx" ON "FamilyInvitation"("invitedEmail", "status");

-- CreateIndex
CREATE INDEX "FamilyInvitation_studentUserId_status_idx" ON "FamilyInvitation"("studentUserId", "status");

-- CreateIndex
CREATE INDEX "EmergencyContact_studentUserId_archivedAt_idx" ON "EmergencyContact"("studentUserId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommunicationPreference_guardianProfileId_studentUserId_cha_key" ON "CommunicationPreference"("guardianProfileId", "studentUserId", "channel", "topic");

-- CreateIndex
CREATE INDEX "ConsentRecord_studentUserId_status_revokedAt_idx" ON "ConsentRecord"("studentUserId", "status", "revokedAt");

-- CreateIndex
CREATE INDEX "ConsentRecord_guardianUserId_idx" ON "ConsentRecord"("guardianUserId");

-- AddForeignKey
ALTER TABLE "Household" ADD CONSTRAINT "Household_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdMember" ADD CONSTRAINT "HouseholdMember_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdMember" ADD CONSTRAINT "HouseholdMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardianProfile" ADD CONSTRAINT "GuardianProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGuardianRelationship" ADD CONSTRAINT "StudentGuardianRelationship_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGuardianRelationship" ADD CONSTRAINT "StudentGuardianRelationship_guardianUserId_fkey" FOREIGN KEY ("guardianUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGuardianRelationship" ADD CONSTRAINT "StudentGuardianRelationship_guardianProfileId_fkey" FOREIGN KEY ("guardianProfileId") REFERENCES "GuardianProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGuardianRelationship" ADD CONSTRAINT "StudentGuardianRelationship_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGuardianRelationship" ADD CONSTRAINT "StudentGuardianRelationship_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGuardianRelationship" ADD CONSTRAINT "StudentGuardianRelationship_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyInvitation" ADD CONSTRAINT "FamilyInvitation_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyInvitation" ADD CONSTRAINT "FamilyInvitation_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FamilyInvitation" ADD CONSTRAINT "FamilyInvitation_invitedByGuardianProfileId_fkey" FOREIGN KEY ("invitedByGuardianProfileId") REFERENCES "GuardianProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyContact" ADD CONSTRAINT "EmergencyContact_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyContact" ADD CONSTRAINT "EmergencyContact_guardianProfileId_fkey" FOREIGN KEY ("guardianProfileId") REFERENCES "GuardianProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationPreference" ADD CONSTRAINT "CommunicationPreference_guardianProfileId_fkey" FOREIGN KEY ("guardianProfileId") REFERENCES "GuardianProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationPreference" ADD CONSTRAINT "CommunicationPreference_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_guardianUserId_fkey" FOREIGN KEY ("guardianUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Legacy compatibility backfill: approved, non-archived parent links become active guardian relationships.
INSERT INTO "GuardianProfile" ("id", "userId", "createdAt", "updatedAt")
SELECT 'gp_' || ps."parentId", ps."parentId", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ParentStudent" ps
WHERE ps."approvalStatus" = 'APPROVED' AND ps."archivedAt" IS NULL
ON CONFLICT ("userId") DO NOTHING;

INSERT INTO "StudentGuardianRelationship" (
  "id", "studentUserId", "guardianUserId", "guardianProfileId", "relationshipType", "relationshipStatus",
  "isPrimaryContact", "isEmergencyContact", "canViewLearning", "canManageEnrollment", "canApproveEnrollment",
  "canSignForms", "canUpdateContactInformation", "canManageCommunicationPreferences", "canSubmitSupportRequests",
  "canReceiveProgramNotifications", "verificationState", "verifiedAt", "legacyParentStudentId", "createdAt", "updatedAt"
)
SELECT
  'sgr_ps_' || ps."id", ps."studentId", ps."parentId", gp."id", ps."relationship", 'ACTIVE'::"FamilyRelationshipStatus",
  ps."isPrimary", false, true, true, true, true, true, true, true, true, 'VERIFIED'::"FamilyVerificationState",
  COALESCE(ps."reviewedAt", ps."createdAt"), ps."id", ps."createdAt", CURRENT_TIMESTAMP
FROM "ParentStudent" ps
JOIN "GuardianProfile" gp ON gp."userId" = ps."parentId"
WHERE ps."approvalStatus" = 'APPROVED' AND ps."archivedAt" IS NULL
ON CONFLICT ("legacyParentStudentId") DO NOTHING;

INSERT INTO "GuardianProfile" ("id", "userId", "createdAt", "updatedAt")
SELECT 'gp_' || pp."userId", pp."userId", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "ParentStudentConnection" psc
JOIN "ParentProfile" pp ON pp."id" = psc."parentId"
WHERE psc."approvedAt" IS NOT NULL
ON CONFLICT ("userId") DO NOTHING;

INSERT INTO "StudentGuardianRelationship" (
  "id", "studentUserId", "guardianUserId", "guardianProfileId", "relationshipType", "relationshipStatus",
  "isPrimaryContact", "canViewLearning", "canReceiveProgramNotifications", "verificationState", "verifiedAt",
  "legacyParentStudentConnectionId", "createdAt", "updatedAt"
)
SELECT
  'sgr_psc_' || psc."id", psc."studentId", pp."userId", gp."id", psc."relationship", 'ACTIVE'::"FamilyRelationshipStatus",
  psc."isPrimary", psc."canViewProgress", psc."canReceiveReports", 'VERIFIED'::"FamilyVerificationState", psc."approvedAt",
  psc."id", psc."createdAt", CURRENT_TIMESTAMP
FROM "ParentStudentConnection" psc
JOIN "ParentProfile" pp ON pp."id" = psc."parentId"
JOIN "GuardianProfile" gp ON gp."userId" = pp."userId"
WHERE psc."approvedAt" IS NOT NULL
ON CONFLICT ("legacyParentStudentConnectionId") DO NOTHING;
