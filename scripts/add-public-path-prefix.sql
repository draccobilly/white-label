ALTER TABLE "Company"
ADD COLUMN IF NOT EXISTS "publicPathPrefix" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Company_publicPathPrefix_key"
ON "Company" ("publicPathPrefix");
