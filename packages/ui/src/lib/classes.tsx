/** Joins conditional class names without introducing a runtime styling dependency. */
export function classes(...values: readonly (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(' ');
}
