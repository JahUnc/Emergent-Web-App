/**
 * Tracks the "reduce motion" accessibility setting. One media query listener is shared by the whole app.
 */
import { readonly, ref, type Ref } from 'vue';

let shared: Readonly<Ref<boolean>> | null = null;

/**
 * Whether the viewer asked for reduced motion. Updates live if they change the setting.
 * @returns A read-only boolean ref.
 */
export function useReducedMotion(): Readonly<Ref<boolean>> {
  if (shared) return shared;
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  const value = ref(query.matches);
  query.addEventListener('change', (e) => (value.value = e.matches));
  shared = readonly(value);
  return shared;
}
