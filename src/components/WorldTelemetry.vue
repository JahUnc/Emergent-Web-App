<script setup lang="ts">
/**
 * Live readouts beside the world map, updating as the recording plays.
 *
 * A radial gauge shows how many entities are alive against the most this world ever held. Below it are
 * running totals, the deaths so far split by cause, and a chart of population and food across the whole
 * run with a playhead at the current tick. Clicking the chart jumps playback to that tick.
 *
 * Every number is read from the recorded frames through {@link worldStats}; nothing is estimated.
 */
import { computed } from 'vue';
import type { WorldData } from '../types/data';
import { EVENT_STYLE, worldStats, type EventKind } from '../lib/worldStats';

const props = defineProps<{ world: WorldData }>();
const emit = defineEmits<{ scrub: [] }>();

/** The frame on screen. */
const frame = defineModel<number>({ required: true });

/** Gauge geometry, in SVG units. */
const R = 54;
const RING = 2 * Math.PI * R;
/** Chart size, in SVG units. */
const CW = 260;
const CH = 64;

const stats = computed(() => worldStats(props.world));
const last = computed(() => props.world.frames.length - 1);
const f = computed(() => props.world.frames[Math.min(frame.value, last.value)]!);
const alive = computed(() => f.value.entities.length);
const died = computed(() => f.value.died.starved + f.value.died.cold + f.value.died.killed + f.value.died.oldAge);
const food = computed(() => Math.round(stats.value.food[frame.value]! * 100));
const fill = computed(() => RING * (1 - alive.value / stats.value.peak));
const trend = computed(() => {
  const before = stats.value.alive[Math.max(0, frame.value - 5)]!;
  return alive.value - before;
});

/** Deaths so far by cause, for the split bar. */
const causes = computed(() => {
  const d = f.value.died;
  const rows: { kind: EventKind; n: number }[] = [
    { kind: 'starved', n: d.starved },
    { kind: 'cold', n: d.cold },
    { kind: 'killed', n: d.killed },
    { kind: 'oldAge', n: d.oldAge },
  ];
  return rows;
});
const causesLabel = computed(() => causes.value.map((c) => `${c.n} ${EVENT_STYLE[c.kind].plural}`).join(', '));

/**
 * Builds an SVG path through a series, scaled to the chart.
 * @param values One value per frame.
 * @param max The value that reaches the top of the chart.
 * @returns The line path and a closed area path under it.
 */
function series(values: number[], max: number) {
  const x = (i: number) => (i / Math.max(1, values.length - 1)) * CW;
  const y = (v: number) => CH - 2 - (v / max) * (CH - 6);
  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  return { line, area: `${line} L${CW} ${CH} L0 ${CH} Z` };
}
const population = computed(() => series(stats.value.alive, stats.value.peak));
const foodLine = computed(() => series(stats.value.food, 1));
const playhead = computed(() => (frame.value / Math.max(1, last.value)) * CW);

/** Jumps to the tick under the pointer on the chart. */
function seek(event: MouseEvent) {
  const rect = (event.currentTarget as SVGElement).getBoundingClientRect();
  const k = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  emit('scrub');
  frame.value = Math.round(k * last.value);
}

/** Arrow keys on the chart step one tick, so it works without a pointer too. */
function onKey(event: KeyboardEvent) {
  const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
  if (!step) return;
  event.preventDefault();
  emit('scrub');
  frame.value = Math.max(0, Math.min(last.value, frame.value + step));
}
</script>

<template>
  <aside class="telemetry" aria-label="Telemetry for this world">
    <div class="head">
      <span class="eyebrow">Telemetry</span>
      <span class="tick">T+{{ String(f.tick).padStart(3, '0') }}</span>
    </div>

    <div class="gauge">
      <svg viewBox="0 0 140 140" role="img" :aria-label="`${alive} alive, peak ${stats.peak}`">
        <circle cx="70" cy="70" r="66" class="ticks" />
        <circle cx="70" cy="70" :r="R" class="track" />
        <circle cx="70" cy="70" :r="R" class="value" :stroke-dasharray="RING" :stroke-dashoffset="fill" />
        <circle cx="70" cy="70" r="40" class="inner" />
      </svg>
      <div class="center">
        <b>{{ alive }}</b>
        <span>alive</span>
        <em :class="{ up: trend > 0, down: trend < 0 }">{{ trend > 0 ? '+' : '' }}{{ trend }} in 5 ticks</em>
      </div>
      <span class="peak">peak {{ stats.peak }}</span>
    </div>

    <dl class="readouts">
      <div><dt>Born</dt><dd class="born">{{ f.born }}</dd></div>
      <div><dt>Died</dt><dd class="died">{{ died }}</dd></div>
      <div><dt>Food level</dt><dd>{{ food }}<small>%</small></dd></div>
      <div><dt>Shelter cells</dt><dd>{{ f.shelterCells.length }}</dd></div>
    </dl>

    <div class="causes">
      <span class="label">Deaths by cause</span>
      <div class="split" role="img" :aria-label="causesLabel">
        <span v-for="c in causes" :key="c.kind" :style="{ flexGrow: c.n, background: EVENT_STYLE[c.kind].color }" />
        <span v-if="died === 0" class="none" />
      </div>
      <ul>
        <li v-for="c in causes" :key="c.kind"><i :style="{ background: EVENT_STYLE[c.kind].color }" />{{ EVENT_STYLE[c.kind].plural }}<b>{{ c.n }}</b></li>
      </ul>
    </div>

    <div class="chart">
      <span class="label">Population and food, whole run</span>
      <svg
        :viewBox="`0 0 ${CW} ${CH}`"
        preserveAspectRatio="none"
        tabindex="0"
        role="slider"
        aria-label="Jump to a tick"
        :aria-valuemin="0"
        :aria-valuemax="last"
        :aria-valuenow="frame"
        @click="seek"
        @keydown="onKey"
      >
        <path :d="foodLine.line" class="food" />
        <path :d="population.area" class="pop-area" />
        <path :d="population.line" class="pop" />
        <line :x1="playhead" :x2="playhead" y1="0" :y2="CH" class="head-line" />
      </svg>
      <div class="chart-key"><span><i class="k-pop" />alive</span><span><i class="k-food" />food</span></div>
    </div>
  </aside>
</template>

<style scoped>
.telemetry { --bk-c: var(--hud); --bk: 12px; display: flex; flex-direction: column; gap: 16px; padding: 16px 18px 18px; border: 1px solid var(--line-hi); border-radius: var(--radius); background: var(--brackets), linear-gradient(180deg, rgba(79, 216, 255, 0.07), transparent 30%), rgba(1, 8, 14, 0.85); box-shadow: inset 0 0 40px rgba(79, 216, 255, 0.05); }
.head { display: flex; justify-content: space-between; align-items: center; }
.tick { font-family: var(--mono); font-size: 0.76rem; color: var(--select); letter-spacing: 0.1em; text-shadow: 0 0 8px rgba(255, 197, 61, 0.5); }
.gauge { position: relative; width: 168px; margin: 0 auto; }
.gauge svg { width: 100%; height: auto; display: block; transform: rotate(-90deg); }
.ticks { fill: none; stroke: rgba(79, 216, 255, 0.35); stroke-width: 4; stroke-dasharray: 1 5.9; }
.track { fill: none; stroke: rgba(79, 216, 255, 0.12); stroke-width: 7; }
.value { fill: none; stroke: var(--hud); stroke-width: 7; stroke-linecap: butt; filter: drop-shadow(0 0 5px var(--hud)); transition: stroke-dashoffset 0.4s var(--ease); }
.inner { fill: none; stroke: rgba(79, 216, 255, 0.2); stroke-width: 1; stroke-dasharray: 3 3; }
.center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1.05; }
.center b { font-family: var(--mono); font-weight: 500; font-size: 2.3rem; color: var(--text); text-shadow: 0 0 16px rgba(79, 216, 255, 0.6); font-variant-numeric: tabular-nums; }
.center span { font-family: var(--mono); font-size: 0.62rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--hud); }
.center em { font-style: normal; font-family: var(--mono); font-size: 0.62rem; color: var(--faint); margin-top: 6px; }
.center em.up { color: var(--good); }
.center em.down { color: var(--bad); }
.peak { position: absolute; right: -6px; bottom: 6px; font-family: var(--mono); font-size: 0.6rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--faint); }
.readouts { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; margin: 0; background: var(--line); border: 1px solid var(--line); }
.readouts div { background: rgba(1, 8, 14, 0.96); padding: 8px 10px; }
dt { font-family: var(--mono); font-size: 0.6rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); }
dd { margin: 2px 0 0; font-family: var(--mono); font-size: 1.25rem; color: var(--hud); text-shadow: var(--hud-glow); font-variant-numeric: tabular-nums; }
dd small { font-size: 0.7em; margin-left: 1px; }
dd.born { color: var(--good); text-shadow: 0 0 10px rgba(61, 255, 180, 0.5); }
dd.died { color: var(--bad); text-shadow: 0 0 10px rgba(255, 59, 79, 0.5); }
.label { display: block; font-family: var(--mono); font-size: 0.6rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; }
.split { display: flex; height: 6px; gap: 2px; background: rgba(79, 216, 255, 0.08); }
.split span { min-width: 0; transition: flex-grow 0.4s var(--ease); box-shadow: 0 0 6px currentColor; }
.split .none { flex-grow: 1; background: transparent; box-shadow: none; }
.causes ul { list-style: none; margin: 8px 0 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 3px 12px; }
.causes li { display: flex; align-items: center; gap: 6px; font-family: var(--mono); font-size: 0.64rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.causes li i { width: 7px; height: 7px; flex: none; }
.causes li b { margin-left: auto; color: var(--text); font-weight: 500; }
.chart svg { display: block; width: 100%; height: 70px; cursor: crosshair; border-bottom: 1px solid var(--line-hi); background: repeating-linear-gradient(90deg, rgba(79, 216, 255, 0.06) 0 1px, transparent 1px 26px); }
.chart svg:focus-visible { outline: 1.5px solid var(--select); outline-offset: 2px; }
.pop { fill: none; stroke: var(--hud); stroke-width: 1.6; vector-effect: non-scaling-stroke; filter: drop-shadow(0 0 3px var(--hud)); }
.pop-area { fill: rgba(79, 216, 255, 0.12); }
.food { fill: none; stroke: var(--good); stroke-width: 1.2; stroke-dasharray: 3 3; vector-effect: non-scaling-stroke; opacity: 0.8; }
.head-line { stroke: var(--select); stroke-width: 1.5; vector-effect: non-scaling-stroke; filter: drop-shadow(0 0 4px var(--select)); }
.chart-key { display: flex; gap: 14px; margin-top: 6px; font-family: var(--mono); font-size: 0.6rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
.chart-key span { display: inline-flex; align-items: center; gap: 6px; }
.chart-key i { width: 14px; height: 2px; }
.k-pop { background: var(--hud); }
.k-food { background: repeating-linear-gradient(90deg, var(--good) 0 3px, transparent 3px 6px); }
</style>
