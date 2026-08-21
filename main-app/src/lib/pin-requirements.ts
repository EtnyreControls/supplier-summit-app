/**
 * Single source of truth for the PIN rule — shared by the server action
 * (change-pin.ts, the actual enforcement) and the client form's live
 * requirements checklist, so the two never drift out of sync. Kept out of
 * change-pin.ts itself since a "use server" file may only export async
 * functions.
 */
export const PIN_REQUIREMENTS = [
  { key: "length", label: "At least 8 characters", test: (v: string) => v.length >= 8 },
  { key: "upper", label: "One uppercase letter", test: (v: string) => /[A-Z]/.test(v) },
  { key: "lower", label: "One lowercase letter", test: (v: string) => /[a-z]/.test(v) },
  { key: "special", label: "One special character", test: (v: string) => /[^A-Za-z0-9]/.test(v) },
] as const;

export function pinError(pin: string): string | null {
  const failed = PIN_REQUIREMENTS.find((r) => !r.test(pin));
  if (!failed) return null;
  return `PIN needs ${failed.label.toLowerCase()}.`;
}
