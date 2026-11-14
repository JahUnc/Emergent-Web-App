<script setup lang="ts">
/**
 * Lets visitors roll new worlds. Each recorded seed plays its first ticks from the start; at the end a
 * summary shows how that world turned out. The next random seed is fetched while the current one plays,
 * so rolling is instant.
 */
import { computed, onMounted, ref, shallowRef, watch } from 'vue';
import WorldCanvas from './WorldCanvas.vue';
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
      <button type="button" class="roll" :disabled="loading" @click="roll">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="8" cy="8" r="1.6" /><circle cx="16" cy="16" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="16" cy="8" r="1.6" /><circle cx="8" cy="16" r="1.6" /></svg>
        Roll a new world
      </button>
      <form class="goto" @submit.prevent="goTo">
        <label for="seed-input" class="eyebrow">Go to</label>
        <input id="seed-input" v-model="typed" inputmode="numeric" :placeholder="`${SEEDS[0]}–${SEEDS.at(-1)}`" aria-describedby="seed-help" />
        <button type="submit">Go</button>
      </form>
      <span id="seed-help" class="small">{{ error || `${SEEDS.length} worlds recorded` }}</span>
    </div>

    <div class="stage">
      <WorldCanvas
        v-if="world"
        :key="world.seed"
        v-model:frame="frame"
        v-model:playing="playing"
        :world="world"
        :speed="speed"
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
            <button type="button" class="ghost" @click="frame = 0; playing = true">Watch again</button>
          </div>
        </div>
      </Transition>

      <div v-if="world" class="transport">
        <button type="button" :aria-label="playing ? 'Pause' : 'Play'" @click="togglePlay">{{ playing ? 'Pause' : ended ? 'Replay' : 'Play' }}</button>
        <input v-model.number="frame" type="range" min="0" :max="last" aria-label="Tick" @input="playing = false" />
        <span class="tick">{{ frame }} / {{ last }}</span>
        <div class="speeds" role="radiogroup" aria-label="Speed">
          <button v-for="s in SPEEDS" :key="s" type="button" role="radio" :aria-checked="speed === s" @click="speed = s">{{ s }}×</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.explorer { display: flex; flex-direction: column; gap: 10px; view-transition-name: world-stage; }
.bar { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; }
.seed { display: flex; align-items: baseline; gap: 8px; }
output { font-family: var(--mono); font-size: 1.6rem; font-weight: 600; color: var(--text); min-width: 3ch; }
.roll { display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(135deg, rgba(255, 111, 174, 0.18), rgba(90, 169, 255, 0.18)); border: 1px solid var(--line-hi); border-radius: 999px; padding: 7px 16px; cursor: pointer; font-family: var(--display); font-weight: 600; transition: transform 0.15s, border-color 0.2s; }
.roll:hover { border-color: var(--select); }
.roll:active svg { transform: rotate(90deg); }
.roll:disabled { opacity: 0.6; cursor: progress; }
.roll svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.6; transition: transform 0.25s; }
.roll svg circle { fill: currentColor; stroke: none; }
.goto { display: flex; align-items: center; gap: 6px; }
.goto input { width: 9ch; background: var(--ink-raised); border: 1px solid var(--line); border-radius: 8px; padding: 5px 8px; color: var(--text); font: inherit; font-family: var(--mono); font-size: 0.85rem; }
.goto button, .transport button, .ghost { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 4px 12px; cursor: pointer; }
.goto button:hover, .transport button:hover, .ghost:hover { border-color: var(--line-hi); }
.skeleton { aspect-ratio: 2 / 1; display: grid; place-items: center; color: var(--muted); font-family: var(--mono); font-size: 0.8rem; }
.transport { display: flex; gap: 10px; align-items: center; padding: 10px 14px; border-top: 1px solid var(--line); background: rgba(10, 15, 29, 0.9); flex-wrap: wrap; }
.transport input[type='range'] { flex: 1; min-width: 160px; accent-color: var(--female); }
.tick { font-family: var(--mono); font-size: 0.8rem; min-width: 9ch; }
.speeds { display: inline-flex; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; }
.speeds button { border: 0; border-radius: 0; background: transparent; color: var(--muted); font-family: var(--mono); font-size: 0.78rem; padding: 4px 10px; }
.speeds button[aria-checked='true'] { background: var(--panel-hi); color: var(--text); }
.summary { position: absolute; left: 50%; top: 46%; transform: translate(-50%, -50%); width: min(520px, calc(100% - 32px)); background: rgba(12, 18, 34, 0.94); border: 1px solid var(--line-hi); border-radius: 14px; padding: 18px 20px; display: flex; flex-direction: column; gap: 10px; box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px); }
.big { font-family: var(--display); font-weight: 600; font-size: 1.5rem; }
.facts { display: flex; flex-wrap: wrap; gap: 6px 14px; color: var(--muted); font-size: 0.9rem; }
.facts b { color: var(--text); font-family: var(--mono); }
.summary-enter-active, .summary-leave-active { transition: opacity 0.3s, transform 0.3s; }
.summary-enter-from, .summary-leave-to { opacity: 0; transform: translate(-50%, -44%); }
</style>
