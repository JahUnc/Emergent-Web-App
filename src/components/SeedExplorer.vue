<script setup lang="ts">
/**
 * Lets visitors roll new worlds. Each recorded seed plays its first ticks from the start; at the end a
 * summary shows how that world turned out. The next random seed is fetched while the current one plays,
 * so rolling is instant.
 */
import { computed, onMounted, reactive, ref, shallowRef, watch } from 'vue';
import EventTimeline from './EventTimeline.vue';
import WorldCanvas from './WorldCanvas.vue';
import WorldTelemetry from './WorldTelemetry.vue';
import { defaultLayers, LAYERS, type LayerKey } from '../lib/layers';
import { linkedSeed, showSeedInAddress } from '../composables/useRouter';
import { loadSeed, randomSeed, SEEDS } from '../lib/seeds';
import type { WorldData } from '../types/data';

const emit = defineEmits<{ follow: [female: boolean] }>();

const SPEEDS = [1, 2, 4] as const;
const world = shallowRef<WorldData | null>(null);
const frame = ref(0);
const playing = ref(true);
const speed = ref<number>(1);
const loading = ref(false);
const error = ref('');
const typed = ref('');
/** Which map layers are on. Kept when rolling a new world, so a visitor's view stays the same. */
const layers = reactive(defaultLayers());
/** The swatch drawn on each layer's toggle, matching how the layer looks on the map. */
const SWATCH: Record<LayerKey, string> = {
  food: 'linear-gradient(90deg, #08324a, #1880a0)',
  entities: 'radial-gradient(circle, #fff 0 22%, #ff4f9a 24% 60%, transparent 62%)',
  trails: 'linear-gradient(135deg, transparent 40%, #3f8cff 42% 58%, transparent 60%)',
  crowding: 'linear-gradient(90deg, rgba(255, 180, 60, 0.5), rgba(255, 50, 40, 0.9))',
  deaths: 'conic-gradient(#ff9d3d 0 25%, #bfefff 0 50%, #ff3b4f 0 75%, #84aabd 0)',
  shelters: 'linear-gradient(#ffc53d, #ffc53d) center / 100% 100% no-repeat',
  trees: 'radial-gradient(circle, transparent 0 42%, #3dffb4 46% 60%, transparent 64%)',
};
let next = randomSeed(1);

const last = computed(() => (world.value ? world.value.frames.length - 1 : 0));
const ended = computed(() => !!world.value && frame.value >= last.value && !playing.value);
const summary = computed(() => {
  const w = world.value;
  if (!w) return null;
  const s = w.stats;
  return { ...s, died: s.starved + s.cold + s.killed + s.oldAge };
});

/**
 * Shows a seed from its first tick.
 * @param seed The seed number.
 */
async function show(seed: number) {
  if (!SEEDS.includes(seed)) {
    error.value = `Pick a seed from ${SEEDS[0]} to ${SEEDS.at(-1)}.`;
    return;
  }
  error.value = '';
  loading.value = true;
  try {
    world.value = await loadSeed(seed);
    frame.value = 0;
    playing.value = true;
    typed.value = '';
    showSeedInAddress(seed);
    next = randomSeed(seed);
    void loadSeed(next);
  } finally {
    loading.value = false;
  }
}

function roll() {
  void show(next);
}

function goTo() {
  const n = Number(typed.value);
  if (Number.isInteger(n)) void show(n);
  else error.value = 'Type a whole number.';
}

function togglePlay() {
  if (!playing.value && frame.value >= last.value) frame.value = 0;
  playing.value = !playing.value;
}

watch(linkedSeed, (seed) => { if (seed !== null && seed !== world.value?.seed) void show(seed); });
onMounted(() => void show(linkedSeed.value ?? SEEDS[0]!));
</script>

<template>
  <div class="explorer">
    <div class="bar">
      <div class="seed">
        <span class="eyebrow">Seed</span>
        <output aria-live="polite">{{ world?.seed ?? '…' }}</output>
      </div>
      <button type="button" class="cta roll" :disabled="loading" @click="roll">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="8" cy="8" r="1.6" /><circle cx="16" cy="16" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="16" cy="8" r="1.6" /><circle cx="8" cy="16" r="1.6" /></svg>
        Roll a new world
      </button>
      <form class="goto" @submit.prevent="goTo">
        <label for="seed-input" class="eyebrow">Go to</label>
        <input id="seed-input" v-model="typed" inputmode="numeric" :placeholder="`${SEEDS[0]}–${SEEDS.at(-1)}`" aria-describedby="seed-help" />
        <button type="submit" class="btn">Go</button>
      </form>
      <span id="seed-help" class="small">{{ error || `${SEEDS.length} worlds recorded` }}</span>
    </div>

    <div class="layers" role="group" aria-label="Map layers">
      <span class="eyebrow">Layers</span>
      <button
        v-for="l in LAYERS"
        :key="l.key"
        type="button"
        :aria-pressed="layers[l.key]"
        :title="l.hint"
        @click="layers[l.key] = !layers[l.key]"
      ><i :class="['sw', l.key]" :style="{ background: SWATCH[l.key] }" />{{ l.label }}</button>
    </div>

    <div class="deck">
      <div class="stage">
        <WorldCanvas
          v-if="world"
          :key="world.seed"
          v-model:frame="frame"
          v-model:playing="playing"
          :world="world"
          :speed="speed"
          :layers="layers"
          @follow="emit('follow', $event)"
        />
        <div v-else class="skeleton" aria-busy="true">Loading a world</div>

        <Transition name="summary">
          <div v-if="ended && summary" class="summary" role="status">
            <span class="eyebrow">Seed {{ world!.seed }} after {{ last }} ticks</span>
            <div class="big">{{ summary.alive }} alive<template v-if="summary.alive === 0">, the world died out</template></div>
            <div class="facts">
              <span><b>{{ summary.births }}</b> born</span>
              <span><b>{{ summary.died }}</b> died</span>
              <span><b>{{ summary.starved }}</b> starved</span>
              <span><b>{{ summary.cold }}</b> froze</span>
              <span><b>{{ summary.killed }}</b> killed</span>
              <span><b>{{ summary.oldAge }}</b> old age</span>
              <span><b>{{ summary.cellsBuilt }}</b> shelter {{ summary.cellsBuilt === 1 ? 'cell' : 'cells' }} built</span>
              <span><b>{{ summary.groups }}</b> {{ summary.groups === 1 ? 'group' : 'groups' }}</span>
            </div>
            <div class="row">
              <button type="button" class="cta" @click="roll">Roll another</button>
              <button type="button" class="btn" @click="frame = 0; playing = true">Watch again</button>
            </div>
          </div>
        </Transition>

        <div v-if="world" class="transport">
          <button type="button" class="play" :aria-label="playing ? 'Pause' : ended ? 'Replay' : 'Play'" @click="togglePlay">
            <svg v-if="playing" viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="3" width="3" height="10" rx="1" /><rect x="9" y="3" width="3" height="10" rx="1" /></svg>
            <svg v-else viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.2v9.6a.6.6 0 0 0 .9.5l7.6-4.8a.6.6 0 0 0 0-1L5.9 2.7a.6.6 0 0 0-.9.5Z" /></svg>
          </button>
          <EventTimeline v-model="frame" :world="world" @scrub="playing = false" />
          <div class="side">
            <span class="tick">{{ frame }} / {{ last }}</span>
            <div class="speeds" role="radiogroup" aria-label="Speed">
              <button v-for="s in SPEEDS" :key="s" type="button" role="radio" :aria-checked="speed === s" @click="speed = s">{{ s }}×</button>
            </div>
          </div>
        </div>
      </div>
      <WorldTelemetry v-if="world" v-model="frame" :world="world" @scrub="playing = false" />
    </div>
  </div>
</template>

<style scoped>
.explorer { display: flex; flex-direction: column; gap: 14px; view-transition-name: world-stage; }
.deck { display: grid; grid-template-columns: minmax(0, 1fr) 290px; gap: 14px; align-items: start; }
@media (max-width: 1100px) { .deck { grid-template-columns: 1fr; } }
.layers { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.layers .eyebrow { margin-right: 6px; }
.layers button { display: inline-flex; align-items: center; gap: 7px; background: transparent; border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 4px 10px; cursor: pointer; font-size: 0.72rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: var(--faint); transition: color 0.2s, border-color 0.2s, background 0.2s, box-shadow 0.2s; }
.layers button:hover { color: var(--text); border-color: var(--line-hi); }
.layers button[aria-pressed='true'] { color: var(--hud); border-color: var(--hud); background: rgba(79, 216, 255, 0.1); box-shadow: 0 0 12px rgba(79, 216, 255, 0.2); }
.sw { width: 12px; height: 12px; flex: none; opacity: 0.35; transition: opacity 0.2s; }
.sw.shelters { background: transparent !important; border: 1.5px solid #ffc53d; }
.sw.deaths { transform: rotate(45deg) scale(0.8); }
.layers button[aria-pressed='true'] .sw { opacity: 1; }
.transport { align-items: flex-end; }
.side { display: flex; align-items: center; gap: 12px; }
/* The telemetry panel shows the same counts on wide screens, so the overlay on the map steps aside. */
@media (min-width: 1101px) { .stage :deep(.hud) { display: none; } }
/* On phones the timeline takes the whole first row, with play and speed underneath. */
@media (max-width: 600px) {
  .transport :deep(.timeline) { flex-basis: 100%; order: -1; }
  .side { margin-left: auto; }
}
.bar { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 22px; }
.seed { display: flex; align-items: baseline; gap: 10px; }
output { font-family: var(--mono); font-size: 2rem; line-height: 1; font-weight: 500; color: var(--select); min-width: 3ch; text-shadow: 0 0 16px rgba(255, 197, 61, 0.6); font-variant-numeric: tabular-nums; }
.roll svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 1.8; transition: transform 0.4s var(--ease); }
.roll svg circle { fill: currentColor; stroke: none; }
.roll:active svg { transform: rotate(90deg); }
.roll:disabled { opacity: 0.6; cursor: progress; }
.goto { display: flex; align-items: center; gap: 8px; }
.goto input { width: 8ch; background: rgba(1, 7, 13, 0.8); border: 1px solid var(--line-hi); border-radius: var(--radius-sm); padding: 5px 10px; color: var(--hud); font: inherit; font-family: var(--mono); font-size: 0.82rem; }
.goto input:focus { border-color: var(--hud); box-shadow: 0 0 12px rgba(79, 216, 255, 0.35); outline: none; }
#seed-help { margin-left: auto; font-family: var(--mono); font-size: 0.72rem; letter-spacing: 0.1em; text-transform: uppercase; }
.skeleton { aspect-ratio: 2 / 1; display: grid; place-items: center; color: var(--hud); font-family: var(--mono); font-size: 0.78rem; letter-spacing: 0.2em; text-transform: uppercase; }
.play { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; border: 1.5px solid var(--hud); background: rgba(79, 216, 255, 0.12); color: var(--hud); cursor: pointer; flex: none; box-shadow: 0 0 14px rgba(79, 216, 255, 0.35), inset 0 0 10px rgba(79, 216, 255, 0.25); transition: box-shadow 0.2s, background 0.2s; }
.play:hover { background: rgba(79, 216, 255, 0.25); box-shadow: 0 0 24px rgba(79, 216, 255, 0.6); }
.play svg { width: 15px; height: 15px; fill: currentColor; }
.speeds { display: inline-flex; border: 1px solid var(--line-hi); border-radius: var(--radius-sm); }
.speeds button { border: 0; background: transparent; color: var(--muted); font-family: var(--mono); font-size: 0.76rem; padding: 4px 11px; cursor: pointer; }
.speeds button + button { border-left: 1px solid var(--line); }
.speeds button[aria-checked='true'] { background: rgba(79, 216, 255, 0.16); color: var(--hud); text-shadow: var(--hud-glow); }
.summary { --bk-c: var(--select); position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(580px, calc(100% - 32px)); background: var(--brackets), rgba(1, 8, 14, 0.92); border: 1px solid rgba(255, 197, 61, 0.35); border-radius: var(--radius); padding: 24px 26px; display: flex; flex-direction: column; gap: 14px; box-shadow: 0 0 60px rgba(255, 197, 61, 0.15), 0 30px 80px rgba(0, 0, 0, 0.7); backdrop-filter: blur(8px); }
.summary .eyebrow { color: var(--select); }
.summary .eyebrow::before { background: var(--select); box-shadow: 0 0 10px var(--select); }
.big { font-family: var(--display); text-transform: uppercase; font-size: clamp(1.2rem, 2.6vw, 1.7rem); line-height: 1.15; text-shadow: 0 0 18px rgba(79, 216, 255, 0.4); }
.facts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px 14px; color: var(--muted); font-family: var(--mono); font-size: 0.66rem; letter-spacing: 0.1em; text-transform: uppercase; }
.facts span { display: flex; flex-direction: column; gap: 2px; padding-left: 10px; border-left: 1px solid var(--line-hi); }
.facts b { color: var(--hud); font-size: 1.35rem; font-weight: 500; line-height: 1.1; letter-spacing: 0; text-shadow: var(--hud-glow); }
@media (max-width: 600px) { .facts { grid-template-columns: repeat(2, minmax(0, 1fr)); } .summary { position: static; transform: none; width: auto; margin: 12px; } }
.summary-enter-active, .summary-leave-active { transition: opacity 0.35s, transform 0.45s var(--ease), filter 0.35s; }
.summary-enter-from, .summary-leave-to { opacity: 0; transform: translate(-50%, -50%) scale(0.94); filter: blur(4px); }
</style>
