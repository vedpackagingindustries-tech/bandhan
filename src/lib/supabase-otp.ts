// ═══════════════════════════════════════════════════════════
// SUPABASE OTP EMAIL SERVICE — Free email delivery
// Uses Supabase Auth's built-in OTP/magic-link to send emails
// Free tier: Supabase sends OTP emails at no extra cost
// ═══════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

interface SupabaseOTPResult {
  success: boolean
  error?: string
  method: 'supabase_auth'
}

/**
 * Send OTP email using Supabase Auth's built-in email delivery.
 * Supabase sends a 6-digit OTP to the email address for free.
 * 
 * Flow:
 * 1. Call supabase.auth.signInWithOtp({ email }) — Supabase sends OTP email
 * 2. User receives email with OTP code
 * 3. Our custom verifyOTP() handles the verification against our DB
 * 
 * Note: Supabase Auth OTP and our custom OTP are separate systems.
 * We use Supabase ONLY for email delivery — the actual OTP 
 * verification is done by our custom HMAC-based system.
 */
export async function sendOTPViaSupabase(email: string, otpCode: string): Promise<SupabaseOTPResult> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return { success: false, error: 'Supabase not configured', method: 'supabase_auth' }
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    // Use Supabase Auth to send OTP email
    // This leverages Supabase's built-in email delivery (FREE)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false, // Don't create user if doesn't exist
        emailRedirectTo: undefined,
        data: {
          otp_code: otpCode, // Pass our OTP for reference
          purpose: 'bandhan_verification',
        }
      }
    })

    if (error) {
      // If user doesn't exist in Supabase Auth, that's OK — 
      // we still want to send the OTP via our own email template
      if (error.message.includes('not found') || error.status === 404) {
        // Create the Supabase Auth user first, then send OTP
        const { error: signupError } = await supabase.auth.signUp({
          email,
          password: `temp_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          options: {
            data: { is_otp_only: true, source: 'bandhan_custom_auth' },
            emailRedirectTo: undefined,
          }
        })
        
        if (signupError && !signupError.message.includes('already registered')) {
          console.warn('[SUPABASE-OTP] Signup error (continuing):', signupError.message)
        }

        // Now send OTP
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: true }
        })
        
        if (otpError) {
          return { success: false, error: otpError.message, method: 'supabase_auth' }
        }
      } else {
        return { success: false, error: error.message, method: 'supabase_auth' }
      }
    }

    return { success: true, method: 'supabase_auth' }
  } catch (err) {
    console.error('[SUPABASE-OTP] Error:', err)
    return { success: false, error: String(err), method: 'supabase_auth' }
  }
}

/**
 * Verify an OTP that was sent via Supabase Auth.
 * This calls supabase.auth.verifyOtp() to confirm the code.
 */
export async function verifySupabaseOTP(
  email: string, 
  token: string
): Promise<SupabaseOTPResult> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return { success: false, error: 'Supabase not configured', method: 'supabase_auth' }
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    })

    if (error) {
      return { success: false, error: error.message, method: 'supabase_auth' }
    }

    return { success: true, method: 'supabase_auth' }
  } catch (err) {
    console.error('[SUPABASE-OTP] Verify error:', err)
    return { success: false, error: String(err), method: 'supabase_auth' }
  }
}
