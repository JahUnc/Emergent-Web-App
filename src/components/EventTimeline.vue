<script setup lang="ts">
/**
 * The scrubber under the world map, with every birth and death marked above it.
 *
 * Each tick where something happened gets a small stacked marker, one colored segment per kind of event,
 * taller when more happened. Clicking a marker jumps to that tick. The previous and next buttons step
 * between events, and the key below the track turns each kind on or off, which also changes what the
 * previous and next buttons stop at.
 *
 * The markers line up with the slider's thumb because both use the same inset: the thumb is THUMB pixels
 * wide, so the track's usable length starts and ends THUMB / 2 in from each edge.
 */
import { computed, reactive } from 'vue';
import type { WorldData } from '../types/data';
import { describeEvents, EVENT_KINDS, EVENT_STYLE, worldStats, type EventKind, type TickEvents } from '../lib/worldStats';

const props = defineProps<{ world: WorldData }>();
const emit = defineEmits<{ scrub: [] }>();

/** The frame on screen. */
const frame = defineModel<number>({ required: true });

/** Thumb width in pixels. Must match the thumb size in the styles below. */
const THUMB = 14;
/** The tallest a marker gets, in pixels, however much happened on its tick. */
const MAX_HEIGHT = 26;

const stats = computed(() => worldStats(props.world));
const last = computed(() => props.world.frames.length - 1);
const shownKinds = reactive<Record<EventKind, boolean>>({ birth: true, starved: true, cold: true, killed: true, oldAge: true });

/** Events of the kinds that are switched on, with each marker's segments worked out. */
const markers = computed(() =>
  stats.value.events
    .map((e) => {
      const kinds = EVENT_KINDS.filter((k) => shownKinds[k] && e.counts[k] > 0);
      const total = kinds.reduce((n, k) => n + e.counts[k], 0);
      return { e, kinds, total };
    })
    .filter((m) => m.total > 0),
);
const tallest = computed(() => Math.max(1, ...markers.value.map((m) => m.total)));

/**
 * A marker's height in pixels, growing with the square root of the count so one huge tick does not
 * flatten every other marker.
 * @param total Events on the tick.
 * @returns The height.
 */
function heightOf(total: number): number {
  return 6 + (MAX_HEIGHT - 6) * Math.sqrt(total / tallest.value);
}

/**
 * Where a frame sits along the track, as a CSS length.
 * @param f The frame.
 * @returns A calc() expression.
 */
function leftOf(f: number): string {
  return `calc(${THUMB / 2}px + (100% - ${THUMB}px) * ${f / Math.max(1, last.value)})`;
}

function jump(to: number) {
  emit('scrub');
  frame.value = to;
}

const previous = computed<TickEvents | undefined>(() => [...markers.value].reverse().find((m) => m.e.frame < frame.value)?.e);
const next = computed<TickEvents | undefined>(() => markers.value.find((m) => m.e.frame > frame.value)?.e);
const progress = computed(() => `${(frame.value / Math.max(1, last.value)) * 100}%`);
</script>

<template>
  <div class="timeline">
    <div class="track-row">
      <button type="button" class="step" :disabled="!previous" :aria-label="previous ? `Previous event, ${describeEvents(previous)}` : 'No earlier event'" @click="previous && jump(previous.frame)">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" /></svg>
      </button>
      <div class="track">
        <div class="markers" role="group" aria-label="Births and deaths on the timeline">
          <button
            v-for="m in markers"
            :key="m.e.frame"
            type="button"
            class="marker"
            :class="{ here: m.e.frame === frame }"
            :style="{ left: leftOf(m.e.frame), height: `${heightOf(m.total)}px` }"
            :title="describeEvents(m.e)"
            :aria-label="describeEvents(m.e)"
            @click="jump(m.e.frame)"
          >
            <span v-for="k in m.kinds" :key="k" :style="{ flexGrow: m.e.counts[k], background: EVENT_STYLE[k].color }" />
          </button>
        </div>
        <input
          v-model.number="frame"
          type="range"
          min="0"
          :max="last"
          aria-label="Tick"
          :style="{ '--p': progress }"
          @input="emit('scrub')"
        />
      </div>
      <button type="button" class="step" :disabled="!next" :aria-label="next ? `Next event, ${describeEvents(next)}` : 'No later event'" @click="next && jump(next.frame)">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" /></svg>
      </button>
    </div>
    <div class="key" role="group" aria-label="Show events">
      <button
        v-for="k in EVENT_KINDS"
        :key="k"
        type="button"
        :aria-pressed="shownKinds[k]"
        @click="shownKinds[k] = !shownKinds[k]"
      >
        <i :style="{ background: EVENT_STYLE[k].color, color: EVENT_STYLE[k].color }" />{{ EVENT_STYLE[k].plural }}
        <b>{{ stats.totals[k] }}</b>
      </button>
    </div>
  </div>
</template>

<style scoped>
.timeline { flex: 1; min-width: 220px; display: flex; flex-direction: column; gap: 6px; }
.track-row { display: flex; align-items: flex-end; gap: 8px; }
.track { position: relative; flex: 1; padding-top: 30px; }
.markers { position: absolute; left: 0; right: 0; top: 0; height: 28px; }
.marker { position: absolute; bottom: 0; width: 5px; margin-left: -2.5px; padding: 0; border: 0; background: transparent; cursor: pointer; display: flex; flex-direction: column-reverse; gap: 1px; opacity: 0.8; transition: opacity 0.15s, transform 0.15s; transform-origin: bottom; }
.marker span { display: block; min-height: 2px; box-shadow: 0 0 6px currentColor; }
.marker:hover, .marker:focus-visible, .marker.here { opacity: 1; transform: scaleX(1.6); }
.marker.here::after { content: ''; position: absolute; left: 50%; bottom: -5px; width: 1px; height: 4px; background: var(--select); }
input[type='range'] { -webkit-appearance: none; appearance: none; width: 100%; height: 14px; margin: 0; background: transparent; cursor: pointer; display: block; }
input[type='range']::-webkit-slider-runnable-track { height: 2px; background: linear-gradient(90deg, var(--hud) var(--p), rgba(79, 216, 255, 0.2) var(--p)); box-shadow: 0 0 8px rgba(79, 216, 255, 0.4); }
input[type='range']::-moz-range-track { height: 2px; background: linear-gradient(90deg, var(--hud) var(--p), rgba(79, 216, 255, 0.2) var(--p)); }
input[type='range']::-webkit-slider-thumb { -webkit-appearance: none; width: 14px; height: 14px; margin-top: -6px; border-radius: 50%; background: #01070d; border: 2px solid var(--hud); box-shadow: 0 0 10px var(--hud); }
input[type='range']::-moz-range-thumb { width: 10px; height: 10px; border-radius: 50%; background: #01070d; border: 2px solid var(--hud); box-shadow: 0 0 10px var(--hud); }
input[type='range']:focus-visible { outline: none; }
input[type='range']:focus-visible::-webkit-slider-thumb { border-color: var(--select); box-shadow: 0 0 12px var(--select); }
.step { flex: none; display: grid; place-items: center; width: 26px; height: 26px; margin-bottom: -6px; background: transparent; border: 1px solid var(--line-hi); border-radius: var(--radius-sm); color: var(--hud); cursor: pointer; }
.step svg { width: 13px; height: 13px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.step:hover:not(:disabled) { border-color: var(--hud); box-shadow: 0 0 10px rgba(79, 216, 255, 0.35); }
.step:disabled { opacity: 0.3; cursor: default; }
.key { display: flex; flex-wrap: wrap; gap: 4px 14px; padding: 4px 34px 0; }
.key button { display: inline-flex; align-items: center; gap: 6px; background: transparent; border: 0; padding: 2px 0; cursor: pointer; font-family: var(--mono); font-size: 0.66rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); transition: opacity 0.2s; }
.key button[aria-pressed='false'] { opacity: 0.35; text-decoration: line-through; }
.key i { width: 8px; height: 8px; box-shadow: 0 0 6px currentColor; }
.key b { color: var(--text); font-weight: 500; }
@media (max-width: 600px) { .key { padding: 4px 0 0; } }
</style>
