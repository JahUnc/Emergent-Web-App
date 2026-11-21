/**
 * The layers the world map can show. Each one can be switched on and off on its own, so a visitor can
 * look at one system at a time: just the food, just where entities crowd, just where they died.
 */

export const LAYERS = [
  { key: 'food', label: 'Food', hint: 'Food in each cell. Brighter is more.', on: true },
  { key: 'entities', label: 'Entities', hint: 'Every living entity. Pink is female, blue is male.', on: true },
  { key: 'trails', label: 'Trails', hint: 'Where each entity walked over the last few ticks.', on: false },
  { key: 'crowding', label: 'Crowding', hint: 'How many entities share a cell this tick. Hotter is more.', on: false },
  { key: 'deaths', label: 'Deaths', hint: 'Where every entity so far has died, colored by cause.', on: false },
  { key: 'shelters', label: 'Shelters', hint: 'Shelter cells, natural and built. Thicker lines are natural.', on: true },
  { key: 'trees', label: 'Trees', hint: 'Trees entities can cut for wood.', on: true },
] as const;

export type LayerKey = (typeof LAYERS)[number]['key'];

/** Which layers are on. */
export type LayerState = Record<LayerKey, boolean>;

/**
 * The layers that are on when the world screen first opens.
 * @returns A fresh state object.
 */
export function defaultLayers(): LayerState {
  return Object.fromEntries(LAYERS.map((l) => [l.key, l.on])) as LayerState;
}
