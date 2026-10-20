DO $$ BEGIN
  CREATE TYPE "CampaignLayout" AS ENUM ('CLASSIC', 'IMPACT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Company"
ADD COLUMN IF NOT EXISTS "campaignLayout" "CampaignLayout" NOT NULL DEFAULT 'CLASSIC';
