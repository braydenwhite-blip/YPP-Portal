-- Single active Chair (final applicant decision authority) + audit history.

-- CreateTable: ActiveChairAssignment (singleton — one row keyed by fixed id)
CREATE TABLE IF NOT EXISTS "ActiveChairAssignment" (
    "id" TEXT NOT NULL,
    "chairUserId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActiveChairAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ChairAssignmentHistory (append-only audit trail)
CREATE TABLE IF NOT EXISTS "ChairAssignmentHistory" (
    "id" TEXT NOT NULL,
    "previousChairId" TEXT,
    "newChairId" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChairAssignmentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ActiveChairAssignment_chairUserId_key" ON "ActiveChairAssignment"("chairUserId");
CREATE INDEX IF NOT EXISTS "ActiveChairAssignment_chairUserId_idx" ON "ActiveChairAssignment"("chairUserId");
CREATE INDEX IF NOT EXISTS "ChairAssignmentHistory_createdAt_idx" ON "ChairAssignmentHistory"("createdAt");
CREATE INDEX IF NOT EXISTS "ChairAssignmentHistory_newChairId_idx" ON "ChairAssignmentHistory"("newChairId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "ActiveChairAssignment" ADD CONSTRAINT "ActiveChairAssignment_chairUserId_fkey" FOREIGN KEY ("chairUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "ActiveChairAssignment" ADD CONSTRAINT "ActiveChairAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "ChairAssignmentHistory" ADD CONSTRAINT "ChairAssignmentHistory_previousChairId_fkey" FOREIGN KEY ("previousChairId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "ChairAssignmentHistory" ADD CONSTRAINT "ChairAssignmentHistory_newChairId_fkey" FOREIGN KEY ("newChairId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "ChairAssignmentHistory" ADD CONSTRAINT "ChairAssignmentHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
