import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** HP → Tailwind text color class. Used by StatBar and history table. */
export function hpColor(hp: number): string {
  if (hp < 0) return "text-zinc-500"
  if (hp <= 25) return "text-red-400"
  if (hp <= 50) return "text-orange-400"
  if (hp <= 75) return "text-yellow-400"
  return "text-emerald-400"
}

/**
 * Parse a JSON string, returning the fallback on any error.
 * Used by API routes to deserialize stored JSON columns safely.
 *
 * When fallback is an array, also validates that the parsed value is an array
 * (catches corrupted JSON that is syntactically valid but structurally wrong).
 */
export function safeJsonParse<T>(s: string, fallback: T): T {
  try {
    const parsed = JSON.parse(s)
    // If the fallback is an array, the parsed value must also be an array.
    // This catches cases like the DB storing a string/object where an array is expected.
    if (Array.isArray(fallback) && !Array.isArray(parsed)) return fallback
    return parsed as T
  } catch {
    return fallback
  }
}
