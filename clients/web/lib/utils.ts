import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
export { formatCurrency, normalizeCurrency, relativeTime } from "@autix/shared-lib"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
