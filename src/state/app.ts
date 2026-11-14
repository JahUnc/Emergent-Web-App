/**
 * The little bit of state screens share: which entity the visitor followed from the world map, what is
 * selected on the systems map, and which part of the meeting scene is open. Screens hand off to each
 * other through it, for example "open this system on the map" or "open the family rules".
 */
import { reactive } from 'vue';

export type Sex = 'Female' | 'Male';

/** What the systems map has focused: a system on one side, a piece of shared state, or a loop. */
export type MapFocus =
  | { kind: 'system'; key: string; side: 'L' | 'R' }
  | { kind: 'state'; key: string }
  | { kind: 'loop'; index: number };

export const app = reactive({
  /** The sex of the entity followed from the world map, which colors the entity screen. */
  sex: 'Female' as Sex,
  /** Whether the visitor arrived at the entity screen by clicking a dot on the world map. */
  followedFromMap: false,
  /** The systems map selection. Starts on the first feedback loop. */
  mapFocus: { kind: 'loop', index: 0 } as MapFocus,
  /** The open part of the meeting scene: 0 bond, 1 conception checks, 2 family rules, 3 birth. */
  meetPanel: 0,
});

/** Whether the command palette is open. The header button and the keyboard shortcut both set it. */
export const palette = reactive({ open: false });
