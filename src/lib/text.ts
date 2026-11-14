/**
 * Small text helpers.
 */

/**
 * Turns a test method name like "TryConceive_WhenPartnersAreSiblings_DoesNotConceive" into
 * "TryConceive: when partners are siblings, does not conceive".
 * @param name The test method name.
 * @returns A readable sentence.
 */
export function prettyTestName(name: string): string {
  const words = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  const parts = name.split('_');
  if (parts.length >= 3) return `${parts[0]}: ${words(parts.slice(1, -1).join(' '))}, ${words(parts.at(-1)!)}`;
  return words(name);
}

/**
 * Formats a share as a percent.
 * @param share A fraction from 0 to 1.
 * @param digits Decimal places.
 * @returns Such as "75" or "37.63".
 */
export function percent(share: number, digits = 0): string {
  return (share * 100).toFixed(digits);
}

/**
 * The label for a meeting frame. Frame 0 is the start; frame n shows the world after tick n - 1 ran,
 * which matches the tick numbers Core uses for due dates.
 * @param frameTick The frame's tick count.
 * @returns Such as "start" or "tick 4".
 */
export function frameLabel(frameTick: number): string {
  return frameTick === 0 ? 'start' : `tick ${frameTick - 1}`;
}
