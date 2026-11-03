-- ═══════════════════════════════════════════════════════════════════
-- BANDHAN — Centralized UPI Payments, Favourites, Connect, Showcase
-- ADDITIVE-ONLY migration: creates new tables and adds nullable columns.
-- No data is modified, dropped or overwritten. Safe to re-run (IF NOT EXISTS).
-- ═══════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1. Payment — UPI verification & price snapshot columns
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "module" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "planName" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "planLabel" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "priceSnapshot" DOUBLE PRECISION;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "upiId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "utr" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "paymentDate" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "screenshotUrl" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "verifiedById" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "verificationNotes" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "receiptNo" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_utr_key" ON "Payment"("utr");
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_receiptNo_key" ON "Payment"("receiptNo");
CREATE INDEX IF NOT EXISTS "Payment_category_status_idx" ON "Payment"("category", "status");
CREATE INDEX IF NOT EXISTS "Payment_verifiedAt_idx" ON "Payment"("verifiedAt");

-- ─────────────────────────────────────────────────────────────
-- 2. Favourite (max 5 per user per module — enforced in app layer)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Favourite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Favourite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Favourite_userId_module_listingId_key" ON "Favourite"("userId", "module", "listingId");
CREATE INDEX IF NOT EXISTS "Favourite_userId_module_idx" ON "Favourite"("userId", "module");
CREATE INDEX IF NOT EXISTS "Favourite_module_listingId_idx" ON "Favourite"("module", "listingId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Favourite_userId_fkey') THEN
    ALTER TABLE "Favourite" ADD CONSTRAINT "Favourite_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 3. ConnectionRequest (CONNECT button — privacy-first workflow)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ConnectionRequest" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "ownerId" TEXT,
    "requesterName" TEXT,
    "requesterPhone" TEXT,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "adminNotes" TEXT,
    "ownerNotifiedVia" TEXT,
    "ownerNotifiedAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "respondedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ConnectionRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ConnectionRequest_module_listingId_requesterId_key" ON "ConnectionRequest"("module", "listingId", "requesterId");
CREATE INDEX IF NOT EXISTS "ConnectionRequest_status_createdAt_idx" ON "ConnectionRequest"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "ConnectionRequest_module_listingId_idx" ON "ConnectionRequest"("module", "listingId");
CREATE INDEX IF NOT EXISTS "ConnectionRequest_ownerId_idx" ON "ConnectionRequest"("ownerId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ConnectionRequest_requesterId_fkey') THEN
    ALTER TABLE "ConnectionRequest" ADD CONSTRAINT "ConnectionRequest_requesterId_fkey"
      FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 4. ModuleSubscription (per-module entitlements, price snapshot)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ModuleSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "listingId" TEXT,
    "planName" TEXT NOT NULL,
    "planLabel" TEXT,
    "priceSnapshot" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "durationDays" INTEGER,
    "isTrial" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "paymentId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'PAYMENT',
    "grantedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ModuleSubscription_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ModuleSubscription_userId_module_status_idx" ON "ModuleSubscription"("userId", "module", "status");
CREATE INDEX IF NOT EXISTS "ModuleSubscription_module_status_expiresAt_idx" ON "ModuleSubscription"("module", "status", "expiresAt");
CREATE INDEX IF NOT EXISTS "ModuleSubscription_paymentId_idx" ON "ModuleSubscription"("paymentId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ModuleSubscription_userId_fkey') THEN
    ALTER TABLE "ModuleSubscription" ADD CONSTRAINT "ModuleSubscription_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 5. PremiumShowcase (monthly top 10 — 2-day hero display)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "PremiumShowcase" (
    "id" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "title" TEXT,
    "subtitle" TEXT,
    "imageUrl" TEXT,
    "rank" INTEGER NOT NULL,
    "monthKey" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "selectedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PremiumShowcase_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PremiumShowcase_module_listingId_monthKey_key" ON "PremiumShowcase"("module", "listingId", "monthKey");
CREATE INDEX IF NOT EXISTS "PremiumShowcase_monthKey_status_idx" ON "PremiumShowcase"("monthKey", "status");
CREATE INDEX IF NOT EXISTS "PremiumShowcase_startsAt_endsAt_idx" ON "PremiumShowcase"("startsAt", "endsAt");

-- ─────────────────────────────────────────────────────────────
-- 6. Free listing period (5 days) expiry columns — additive
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Business_expiresAt_idx" ON "Business"("expiresAt");

ALTER TABLE "MatrimonyProfile" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "MatrimonyProfile_expiresAt_idx" ON "MatrimonyProfile"("expiresAt");

-- ─────────────────────────────────────────────────────────────
-- 7. Payment → verifying admin relation (auditability)
-- ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_verifiedById_fkey') THEN
    ALTER TABLE "Payment" ADD CONSTRAINT "Payment_verifiedById_fkey"
      FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
