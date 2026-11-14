/**
 * A tiny hash router. The site has four screens and no nested routes, so a full router library would add
 * weight without adding anything. It uses plain "#name" hashes, which work everywhere the site is hosted,
 * including inside an artifact frame where "#/path" style hashes are not passed through.
 *
 * A world screen link can also name a seed, as "#seed-37", so a world can be shared. That opens the world
 * screen on that seed.
 *
 * Screen changes run inside the View Transitions API when the browser supports it, so the old and new
 * screens cross-fade and shared elements (marked with view-transition-name in CSS) morph between them.
 */
import { nextTick, readonly, shallowRef } from 'vue';
import { useReducedMotion } from './useReducedMotion';

export const ROUTES = [
  { name: 'overview', label: 'World' },
  { name: 'systems', label: 'Systems map' },
  { name: 'entity', label: 'An entity' },
  { name: 'near-another', label: 'Near another entity' },
] as const;

export type RouteName = (typeof ROUTES)[number]['name'];

const names = new Set<string>(ROUTES.map((r) => r.name));
const SEED_HASH = /^seed-(\d+)$/;

/** The seed named in the address, when the address is a "#seed-N" link. */
export const linkedSeed = shallowRef<number | null>(null);

/**
 * Reads the current screen from the address hash, and the seed when the hash names one.
 * @returns The screen name, or "overview" when the hash is empty, unknown, or names a seed.
 */
function parse(): RouteName {
  const hash = location.hash.slice(1);
  const seed = SEED_HASH.exec(hash);
  if (seed) {
    linkedSeed.value = Number(seed[1]);
    return 'overview';
  }
  return (names.has(hash) ? hash : 'overview') as RouteName;
}

const current = shallowRef<RouteName>(parse());

/**
 * Puts the seed on screen into the address, so copying the link shares that world. It replaces the
 * current history entry instead of adding one, so rolling many seeds does not fill the back button.
 * @param seed The seed being shown.
 */
export function showSeedInAddress(seed: number): void {
  if (current.value !== 'overview') return;
  history.replaceState(history.state, '', `#seed-${seed}`);
}
let listening = false;

/**
 * Applies a screen change, inside a view transition when available.
 * @param next The screen to show.
 */
function apply(next: RouteName): void {
  if (next === current.value) return;
  const reduce = useReducedMotion().value;
  const doc = document as Document & { startViewTransition?: (cb: () => Promise<void>) => unknown };
  const update = async () => {
    current.value = next;
    await nextTick();
    window.scrollTo({ top: 0 });
  };
  if (doc.startViewTransition && !reduce) doc.startViewTransition(update);
  else void update();
}

/**
 * Gives access to the current screen and a way to change it.
 * @returns The read-only current screen and a navigate function.
 */
export function useRouter() {
  if (!listening) {
    listening = true;
    window.addEventListener('hashchange', () => apply(parse()));
    // A seed link opened while already on the world screen still needs to switch seeds.
  }
  return {
    route: readonly(current),
    /**
     * Shows a screen. Updating the hash keeps the back button and shared links working.
     * @param name The screen to show.
     */
    navigate(name: RouteName): void {
      if (location.hash.slice(1) === name) apply(name);
      else location.hash = name;
    },
  };
}
