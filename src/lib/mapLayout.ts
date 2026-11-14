/**
 * Lays out the systems map: systems in two columns (what they change on the left, what they use on the
 * right) grouped by tick phase, and shared state in the middle grouped by kind.
 *
 * State is ordered inside each group by the average height of the systems it connects to (a barycenter
 * ordering), which straightens the curves and cuts down on crossings without a graph layout library.
 */
import type { MapEdge, SystemsData } from '../types/data';

export const VIEW_WIDTH = 1000;
export const LEFT_X = 250;
export const RIGHT_X = 750;
export const STATE_WIDTH = 200;
const ROW = 33;
const STATE_ROW = 30;
const TOP = 70;

export interface Heading { text: string; y: number }

export interface MapLayout {
  height: number;
  systemY: Record<string, number>;
  stateY: Record<string, number>;
  phaseHeadings: Heading[];
  groupHeadings: Heading[];
  /** One path per writes or reads edge, in the same order as {@link MapLayout.edges}. */
  paths: string[];
  edges: MapEdge[];
}

/**
 * Computes the whole layout once. The map never changes at runtime, so this runs a single time.
 * @param map The systems map data.
 * @returns Node positions, headings and edge paths.
 */
export function layoutMap(map: SystemsData): MapLayout {
  const systemY: Record<string, number> = {};
  const phaseHeadings: Heading[] = [];
  let y = TOP;
  map.phases.forEach((phase, i) => {
    const members = map.systems.filter((s) => s.phase === i);
    if (!members.length) return;
    phaseHeadings.push({ text: phase, y });
    y += 22;
    for (const s of members) { systemY[s.key] = y; y += ROW; }
    y += 10;
  });
  const systemsBottom = y;

  const barycenter = (key: string) => {
    const ys = map.edges
      .filter((e) => e.kind !== 'guides' && (e.from === key || e.to === key))
      .map((e) => systemY[e.from === key ? e.to : e.from])
      .filter((v): v is number => v !== undefined);
    return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : 0;
  };
  const groups = [...new Set(map.state.map((s) => s.group))].map((group) => {
    const items = map.state.filter((s) => s.group === group).sort((a, b) => barycenter(a.key) - barycenter(b.key));
    return { group, items, center: items.reduce((t, s) => t + barycenter(s.key), 0) / items.length };
  }).sort((a, b) => a.center - b.center);

  const stateY: Record<string, number> = {};
  const groupHeadings: Heading[] = [];
  const stateHeight = map.state.length * STATE_ROW + groups.length * 30;
  y = TOP + Math.max(0, (systemsBottom - TOP - stateHeight) / 2);
  for (const { group, items } of groups) {
    groupHeadings.push({ text: group, y });
    y += 22;
    for (const s of items) { stateY[s.key] = y; y += STATE_ROW; }
    y += 8;
  }

  const left = 500 - STATE_WIDTH / 2;
  const right = 500 + STATE_WIDTH / 2;
  const edges = map.edges.filter((e) => e.kind !== 'guides');
  const paths = edges.map((e) => {
    if (e.kind === 'writes') {
      const y1 = systemY[e.from]!;
      const y2 = stateY[e.to]!;
      return `M${LEFT_X + 8} ${y1} C${LEFT_X + 90} ${y1}, ${left - 90} ${y2}, ${left} ${y2}`;
    }
    const y1 = stateY[e.from]!;
    const y2 = systemY[e.to]!;
    return `M${right} ${y1} C${right + 90} ${y1}, ${RIGHT_X - 90} ${y2}, ${RIGHT_X - 8} ${y2}`;
  });

  return { height: Math.max(systemsBottom, y) + 20, systemY, stateY, phaseHeadings, groupHeadings, paths, edges };
}
