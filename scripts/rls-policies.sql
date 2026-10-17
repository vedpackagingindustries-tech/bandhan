-- ═══════════════════════════════════════════════════════════
-- BANDHAN — Row Level Security (RLS) Policies for Supabase
-- Execute via: Supabase SQL Editor or psql
-- ═══════════════════════════════════════════════════════════
-- Strategy: Application-level auth (Bearer token) is primary.
-- RLS is defense-in-depth: prevents direct DB access bypass.
-- We use a "service_role" app user for Prisma connections
-- and RLS policies to restrict direct table access.
-- ═══════════════════════════════════════════════════════════

-- 1. Enable RLS on all sensitive tables
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Profile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OtpVerification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SecurityEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContactRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Membership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Media" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Job" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JobApplication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Business" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Directory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MatrimonyProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MatchScore" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LoginHistory" ENABLE ROW LEVEL SECURITY;

-- 2. Service role bypass (used by Prisma app connection)
-- The anon key should NEVER have direct table access.
-- The service_role key bypasses RLS (used by Prisma only).

-- 3. Public read policies (anon users can see active public data)
CREATE POLICY "public_read_active_jobs" ON "Job"
  FOR SELECT USING (status = 'ACTIVE');

CREATE POLICY "public_read_active_businesses" ON "Business"
  FOR SELECT USING (status = 'ACTIVE');

CREATE POLICY "public_read_active_directories" ON "Directory"
  FOR SELECT USING (status = 'ACTIVE');

CREATE POLICY "public_read_active_gotras" ON "Gotra"
  FOR SELECT USING ("isActive" = true);

CREATE POLICY "public_read_active_locations" ON "Location"
  FOR SELECT USING ("isActive" = true);

CREATE POLICY "public_read_visible_profiles" ON "Profile"
  FOR SELECT USING ("profileVisible" = true);

CREATE POLICY "public_read_membership_plans" ON "MembershipPlan"
  FOR SELECT USING (status = 'ACTIVE');

-- 4. Authenticated user policies
-- Users can only see/modify their own data
CREATE POLICY "users_own_data" ON "User"
  FOR ALL USING (auth.uid()::text = id);

CREATE POLICY "users_own_profile" ON "Profile"
  FOR ALL USING (auth.uid()::text = "userId");

CREATE POLICY "users_own_sessions" ON "UserSession"
  FOR ALL USING (auth.uid()::text = "userId");

CREATE POLICY "users_own_otp" ON "OtpVerification"
  FOR SELECT USING (auth.uid()::text = "userId");

CREATE POLICY "users_own_notifications" ON "Notification"
  FOR ALL USING (auth.uid()::text = "userId");

CREATE POLICY "users_own_media" ON "Media"
  FOR ALL USING (auth.uid()::text = "userId");

CREATE POLICY "users_own_membership" ON "Membership"
  FOR SELECT USING (auth.uid()::text = "userId");

CREATE POLICY "users_own_login_history" ON "LoginHistory"
  FOR SELECT USING (auth.uid()::text = "userId");

-- 5. Contact requests: can see sent and received
CREATE POLICY "contact_requests_participant" ON "ContactRequest"
  FOR ALL USING (
    auth.uid()::text = "senderId" OR auth.uid()::text = "receiverId"
  );

-- 6. Job applications: can see own applications
CREATE POLICY "job_applications_own" ON "JobApplication"
  FOR ALL USING (auth.uid()::text = "applicantId");

-- 7. Audit log: read-only for all authenticated users (admin view)
CREATE POLICY "audit_read_authenticated" ON "AuditLog"
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 8. Security events: read-only for authenticated users
CREATE POLICY "security_events_read_authenticated" ON "SecurityEvent"
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ═══════════════════════════════════════════════════════════
-- NOTES:
-- - Prisma connects with service_role key which BYPASSES RLS
-- - RLS protects against direct Supabase client access (anon key)
-- - Application-level auth (Bearer token) is the primary defense
-- - This is defense-in-depth, not the sole security layer
-- ═══════════════════════════════════════════════════════════
