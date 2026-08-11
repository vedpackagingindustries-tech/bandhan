// ═══════════════════════════════════════════════════════════
// REQUEST VALIDATION MIDDLEWARE
// Centralized input validation for API routes.
// ═══════════════════════════════════════════════════════════

import { NextRequest } from 'next/server'
import { isValidEmail, isValidPhone, isValidOTP, isValidPassword, isValidEnum, sanitizeString, stripHtml } from '@/lib/validation'
import { error } from '@/lib/api-response'

interface ValidationError {
  field: string
  message: string
}

interface ValidationRule {
  required?: boolean
  type?: 'string' | 'number' | 'boolean' | 'email' | 'phone' | 'otp' | 'enum'
  enumValues?: readonly string[]
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  sanitize?: boolean
  stripHtml?: boolean
}

/**
 * Validate request body fields against rules.
 * Returns null if valid, or a NextResponse error if invalid.
 */
export function validateBody(body: Record<string, unknown>, rules: Record<string, ValidationRule>): ValidationError[] {
  const errors: ValidationError[] = []

  for (const [field, rule] of Object.entries(rules)) {
    const value = body[field]

    // Required check
    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push({ field, message: `${field} is required` })
      continue
    }

    // Skip if not required and not provided
    if (value === undefined || value === null) continue

    // Type checks
    if (rule.type === 'string' && typeof value !== 'string') {
      errors.push({ field, message: `${field} must be a string` })
    }
    if (rule.type === 'number' && typeof value !== 'number') {
      errors.push({ field, message: `${field} must be a number` })
    }
    if (rule.type === 'boolean' && typeof value !== 'boolean') {
      errors.push({ field, message: `${field} must be a boolean` })
    }
    if (rule.type === 'email' && !isValidEmail(String(value))) {
      errors.push({ field, message: `Invalid email format` })
    }
    if (rule.type === 'phone' && !isValidPhone(String(value))) {
      errors.push({ field, message: `Invalid phone number (10 digits)` })
    }
    if (rule.type === 'otp' && !isValidOTP(String(value))) {
      errors.push({ field, message: `OTP must be 6 digits` })
    }
    if (rule.type === 'enum' && !isValidEnum(String(value), rule.enumValues!)) {
      errors.push({ field, message: `Invalid value for ${field}` })
    }

    // String length checks
    if (typeof value === 'string') {
      if (rule.minLength && value.length < rule.minLength) {
        errors.push({ field, message: `${field} must be at least ${rule.minLength} characters` })
      }
      if (rule.maxLength && value.length > rule.maxLength) {
        errors.push({ field, message: `${field} must be at most ${rule.maxLength} characters` })
      }
    }

    // Number range checks
    if (typeof value === 'number') {
      if (rule.min !== undefined && value < rule.min) {
        errors.push({ field, message: `${field} must be at least ${rule.min}` })
      }
      if (rule.max !== undefined && value > rule.max) {
        errors.push({ field, message: `${field} must be at most ${rule.max}` })
      }
    }
  }

  return errors
}

/**
 * Validate and return body, or return error response.
 */
export async function validateRequest(
  request: NextRequest,
  rules: Record<string, ValidationRule>
): Promise<{ body: Record<string, unknown> } | { error: ReturnType<typeof error> }> {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return { error: error('Invalid JSON body') }
  }

  const errors = validateBody(body, rules)
  if (errors.length > 0) {
    return { error: error('Validation failed', 400, { errors }) }
  }

  return { body }
}

// Common validation rule sets
export const COMMON_RULES = {
  email: { required: true, type: 'email' as const, maxLength: 255 },
  phone: { required: true, type: 'phone' as const },
  password: { required: true, type: 'string' as const, minLength: 8, maxLength: 128 },
  otp: { required: true, type: 'otp' as const },
  message: { required: false, type: 'string' as const, maxLength: 5000, stripHtml: true },
}

export const USER_CATEGORIES = ['MATRIMONY', 'BUSINESS', 'JOB', 'DIRECTORY', 'GENERAL'] as const
export const GENDER_VALUES = ['MALE', 'FEMALE', 'OTHER'] as const
export const MARITAL_STATUS_VALUES = ['NEVER_MARRIED', 'DIVORCED', 'WIDOWED'] as const
export const FAMILY_TYPE_VALUES = ['JOINT', 'NUCLEAR'] as const
export const BUSINESS_TYPE_VALUES = ['SOLE_PROPRIETORSHIP', 'PARTNERSHIP', 'PVT_LTD', 'LLP'] as const
export const ORG_TYPE_VALUES = ['TRUST', 'SAMITI', 'SANGATHAN', 'ASSOCIATION'] as const
