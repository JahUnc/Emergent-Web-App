<script setup lang="ts">
/**
 * The systems map itself: an SVG with every system on both sides and shared state in the middle.
 * Hovering traces one thing; clicking keeps it selected (stored in app.mapFocus so other screens can
 * open the map on a given system, state or loop).
 *
 * Highlighting is computed as two sets (lit edges and lit nodes) whenever the focus changes, and each
 * edge is memoized on whether it is lit, so a hover only re-renders the edges whose state changed.
 */
import { computed, ref } from 'vue';
import { MAP, SYSTEM } from '../lib/catalog';
import { layoutMap, LEFT_X, RIGHT_X, STATE_WIDTH, VIEW_WIDTH } from '../lib/mapLayout';
import { app, type MapFocus } from '../state/app';

const layout = layoutMap(MAP);
const hover = ref<MapFocus | null>(null);
const focus = computed(() => hover.value ?? app.mapFocus);

interface Lit { edges: Set<number>; nodes: Set<string>; focusNode: string | null; flow: boolean }

/** Node ids are "L:key", "R:key" for systems and "M:key" for state. */
const lit = computed<Lit>(() => {
  const f = focus.value;
  const edges = new Set<number>();
  const nodes = new Set<string>();
  const each = (test: (e: (typeof layout.edges)[number]) => boolean) => layout.edges.forEach((e, i) => test(e) && edges.add(i));

  if (f.kind === 'state') {
    each((e) => e.from === f.key || e.to === f.key);
    nodes.add(`M:${f.key}`);
    for (const i of edges) { const e = layout.edges[i]!; nodes.add(e.kind === 'writes' ? `L:${e.from}` : `R:${e.to}`); }
    return { edges, nodes, focusNode: `M:${f.key}`, flow: false };
  }
  if (f.kind === 'system') {
    const states = new Set<string>();
    if (f.side === 'L') {
      layout.edges.forEach((e) => e.kind === 'writes' && e.from === f.key && states.add(e.to));
      each((e) => (e.kind === 'writes' && e.from === f.key) || (e.kind === 'reads' && states.has(e.from)));
    } else {
      layout.edges.forEach((e) => e.kind === 'reads' && e.to === f.key && states.add(e.from));
      each((e) => (e.kind === 'reads' && e.to === f.key) || (e.kind === 'writes' && states.has(e.to)));
    }
    for (const i of edges) {
      const e = layout.edges[i]!;
      nodes.add(e.kind === 'writes' ? `L:${e.from}` : `R:${e.to}`);
      nodes.add(`M:${e.kind === 'writes' ? e.to : e.from}`);
    }
    nodes.add(`${f.side}:${f.key}`);
    return { edges, nodes, focusNode: `${f.side}:${f.key}`, flow: false };
  }
  const loop = MAP.loops[f.index]!;
  const hops = new Set(loop.hops.map(([a, b]) => `${a}>${b}`));
  each((e) => hops.has(`${e.from}>${e.to}`));
  for (const [a, b] of loop.hops) {
    if (SYSTEM.has(a) && SYSTEM.has(b)) { nodes.add(`L:${a}`); nodes.add(`R:${b}`); }
    else if (SYSTEM.has(a)) { nodes.add(`L:${a}`); nodes.add(`M:${b}`); }
    else { nodes.add(`M:${a}`); nodes.add(`R:${b}`); }
  }
  return { edges, nodes, focusNode: null, flow: true };
});

function select(next: MapFocus) {
  app.mapFocus = next;
  hover.value = null;
}

const stateLeft = 500 - STATE_WIDTH / 2;
</script>

<template>
  <div class="scroll">
    <svg class="map" :viewBox="`0 0 ${VIEW_WIDTH} ${layout.height}`" role="group" aria-label="Systems map: what each system changes and what it uses">
      <text :x="LEFT_X" y="34" class="col" text-anchor="end">changes</text>
      <text x="500" y="34" class="col" text-anchor="middle">shared state</text>
      <text :x="RIGHT_X" y="34" class="col">uses</text>
      <template v-for="h in layout.phaseHeadings" :key="h.text">
        <text :x="LEFT_X" :y="h.y" class="grp" text-anchor="end">{{ h.text }}</text>
        <text :x="RIGHT_X" :y="h.y" class="grp">{{ h.text }}</text>
      </template>
      <text v-for="h in layout.groupHeadings" :key="h.text" x="500" :y="h.y" class="grp" text-anchor="middle">{{ h.text }}</text>

      <g class="edges">
        <path
          v-for="(d, i) in layout.paths"
          :key="i"
          v-memo="[lit.edges.has(i), lit.flow]"
          :d="d"
          class="e"
          :class="[layout.edges[i]!.kind === 'writes' ? 'w' : 'r', lit.edges.has(i) ? 'on' : 'off', { flow: lit.flow && lit.edges.has(i) }]"
          :style="{ '--i': i }"
        />
      </g>

      <g
        v-for="s in MAP.systems"
        :key="'L' + s.key"
        class="n sys"
        :class="{ dim: !lit.nodes.has('L:' + s.key), focus: lit.focusNode === 'L:' + s.key }"
        tabindex="0"
        role="button"
        :aria-label="`${s.label}: what it changes`"
        @mouseenter="hover = { kind: 'system', key: s.key, side: 'L' }"
        @mouseleave="hover = null"
        @click="select({ kind: 'system', key: s.key, side: 'L' })"
        @keydown.enter.space.prevent="select({ kind: 'system', key: s.key, side: 'L' })"
      >
        <circle :cx="LEFT_X" :cy="layout.systemY[s.key]" r="5.5" class="pin w" />
        <text :x="LEFT_X - 14" :y="layout.systemY[s.key]! + 4.5" text-anchor="end">{{ s.label }}</text>
      </g>
      <g
        v-for="s in MAP.systems"
        :key="'R' + s.key"
        class="n sys"
        :class="{ dim: !lit.nodes.has('R:' + s.key), focus: lit.focusNode === 'R:' + s.key }"
        tabindex="0"
        role="button"
        :aria-label="`${s.label}: what it uses`"
        @mouseenter="hover = { kind: 'system', key: s.key, side: 'R' }"
        @mouseleave="hover = null"
        @click="select({ kind: 'system', key: s.key, side: 'R' })"
        @keydown.enter.space.prevent="select({ kind: 'system', key: s.key, side: 'R' })"
      >
        <circle :cx="RIGHT_X" :cy="layout.systemY[s.key]" r="5.5" class="pin r" />
        <text :x="RIGHT_X + 14" :y="layout.systemY[s.key]! + 4.5">{{ s.label }}</text>
      </g>
      <g
        v-for="s in MAP.state"
        :key="'M' + s.key"
        class="n st"
        :class="{ dim: !lit.nodes.has('M:' + s.key), focus: lit.focusNode === 'M:' + s.key }"
        tabindex="0"
        role="button"
        :aria-label="s.label"
        @mouseenter="hover = { kind: 'state', key: s.key }"
        @mouseleave="hover = null"
        @click="select({ kind: 'state', key: s.key })"
        @keydown.enter.space.prevent="select({ kind: 'state', key: s.key })"
      >
        <rect :x="stateLeft" :y="layout.stateY[s.key]! - 12" :width="STATE_WIDTH" height="24" rx="12" />
        <text x="500" :y="layout.stateY[s.key]! + 4.5" text-anchor="middle">{{ s.label }}</text>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.scroll { overflow-x: auto; border: 1px solid var(--line); border-radius: 14px; background: radial-gradient(120% 100% at 50% 0%, #111a31 0%, var(--ink) 75%); view-transition-name: systems-map; }
.map { display: block; width: 100%; min-width: 760px; height: auto; }
.col { fill: var(--muted); font-family: var(--mono); font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; }
.grp { fill: var(--faint); font-family: var(--mono); font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase; }
.e { fill: none; stroke-width: 1.2; transition: opacity 0.25s, stroke-width 0.25s; animation: fade-in 0.6s ease backwards; animation-delay: calc(var(--i) * 4ms); }
.e.w { stroke: var(--female); }
.e.r { stroke: var(--male); }
.e.on { opacity: 0.95; stroke-width: 2.4; }
.e.off { opacity: 0.05; }
.e.flow { stroke-dasharray: 6 6; animation: flow 0.9s linear infinite; }
@keyframes flow { to { stroke-dashoffset: -12; } }
@keyframes fade-in { from { opacity: 0; } }
.n { cursor: pointer; transition: opacity 0.25s; outline: none; }
.n text { fill: var(--text); font-family: var(--body); font-size: 13.5px; }
.n.dim { opacity: 0.22; }
.n:focus-visible text { text-decoration: underline; }
.pin { fill: #0e1527; stroke-width: 2; }
.pin.w { stroke: var(--female); }
.pin.r { stroke: var(--male); }
.n.focus .pin { fill: currentColor; }
.n.focus.sys .pin.w { fill: var(--female); }
.n.focus.sys .pin.r { fill: var(--male); }
.st rect { fill: #0e1527; stroke: #2c3858; transition: stroke 0.2s; }
.st text { font-size: 13px; }
.st.focus rect { stroke: var(--select); stroke-width: 2; }
</style>
