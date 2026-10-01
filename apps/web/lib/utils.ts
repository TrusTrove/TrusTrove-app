import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges class names conditionally using `clsx` and resolves Tailwind CSS class conflicts using `twMerge`.
 *
 * @param inputs - A variable list of class names, objects, arrays, or expressions to merge.
 * @returns The merged and deduplicated CSS class string.
 *
 * @example
 * ```ts
 * cn("px-2 py-1", "bg-blue-500", { "opacity-50": isDisabled });
 * // If both "p-4" and "p-2" are provided, twMerge resolves the conflict:
 * cn("p-4", "p-2"); // returns "p-2"
 * ```
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
