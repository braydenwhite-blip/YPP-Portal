-- Portal-wide admin-editable settings (key/value JSON, one row per module group).

-- CreateTable: PortalSetting
CREATE TABLE IF NOT EXISTS "PortalSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "PortalSetting_pkey" PRIMARY KEY ("key")
);

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "PortalSetting" ADD CONSTRAINT "PortalSetting_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
