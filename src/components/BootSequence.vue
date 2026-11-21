<script setup lang="ts">
/**
 * A short start-up sequence the first time the site opens in a browser tab: the reactor rings spin up,
 * a few real readouts from the recorded data type themselves in, and the overlay dissolves into the page.
 *
 * It runs once per tab session, never blocks input (any click or key skips it), and is skipped entirely
 * when the visitor prefers reduced motion. Every line it prints comes from the generated data, so even
 * the flourish tells the visitor something true about the simulation.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { BUILD, MAP, TESTS } from '../lib/catalog';
import { SEEDS } from '../lib/seeds';

const KEY = 'es-booted';
const LINE_MS = 170;
const HOLD_MS = 420;

const passed = TESTS.filter((t) => t.passed).length;
const lines = [
  'Linking to Emergent Society core',
  `${MAP.systems.length} systems mapped, ${MAP.state.length} pieces of shared state`,
  `${MAP.loops.length} feedback loops verified against source`,
  `${SEEDS.length} recorded worlds indexed`,
  `${passed} of ${TESTS.length} tests passed${BUILD.commit ? `, commit ${BUILD.commit.hash}` : ''}`,
];

/** Whether the overlay should run at all this visit. */
function shouldRun(): boolean {
  try {
    if (sessionStorage.getItem(KEY)) return false;
    sessionStorage.setItem(KEY, '1');
  } catch {
    // Storage can be unavailable (private modes, sandboxed frames). Showing the sequence again is harmless.
  }
  return !matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const visible = ref(shouldRun());
const shown = ref(0);
const leaving = ref(false);
const timers: number[] = [];

function finish() {
  if (!visible.value || leaving.value) return;
  leaving.value = true;
  timers.push(window.setTimeout(() => (visible.value = false), 650));
}

onMounted(() => {
  if (!visible.value) return;
  lines.forEach((_, i) => timers.push(window.setTimeout(() => (shown.value = i + 1), 380 + i * LINE_MS)));
  timers.push(window.setTimeout(finish, 380 + lines.length * LINE_MS + HOLD_MS));
  window.addEventListener('keydown', finish, { once: true });
  window.addEventListener('pointerdown', finish, { once: true });
});

onBeforeUnmount(() => {
  timers.forEach(clearTimeout);
  window.removeEventListener('keydown', finish);
  window.removeEventListener('pointerdown', finish);
});
</script>

<template>
  <div v-if="visible" class="boot" :class="{ leaving }" aria-hidden="true">
    <div class="core">
      <svg viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="92" class="r1" />
        <circle cx="100" cy="100" r="76" class="r2" />
        <circle cx="100" cy="100" r="58" class="r3" />
        <circle cx="100" cy="100" r="22" class="r4" />
      </svg>
      <ol>
        <li v-for="(line, i) in lines" :key="line" :class="{ on: i < shown }">
          <span>{{ i < shown ? 'ok' : '..' }}</span>{{ line }}
        </li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.boot { position: fixed; inset: 0; z-index: 90; display: grid; place-items: center; background: radial-gradient(60% 60% at 50% 45%, #052033, #01060b 70%); transition: opacity 0.6s var(--ease), filter 0.6s var(--ease); pointer-events: none; }
.boot.leaving { opacity: 0; filter: blur(8px) brightness(1.6); }
.core { display: flex; flex-direction: column; align-items: center; gap: 28px; padding: 24px; }
svg { width: min(220px, 46vw); height: auto; filter: drop-shadow(0 0 14px rgba(79, 216, 255, 0.7)); }
circle { fill: none; stroke: var(--hud); transform-origin: center; }
.r1 { stroke-width: 1; stroke-dasharray: 2 6; opacity: 0.7; animation: spin 6s linear infinite, grow 0.7s var(--ease) both; }
.r2 { stroke-width: 3; stroke-dasharray: 40 10; animation: spin 2.4s linear infinite reverse, grow 0.7s 0.08s var(--ease) both; }
.r3 { stroke-width: 1.2; stroke-dasharray: 120 30; animation: spin 3.6s linear infinite, grow 0.7s 0.16s var(--ease) both; }
.r4 { fill: #dcf5ff; stroke: none; animation: pulse 1.2s ease-in-out infinite, grow 0.6s 0.24s var(--ease) both; }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes grow { from { transform: scale(0.2); opacity: 0; } }
@keyframes pulse { 50% { opacity: 0.6; } }
ol { list-style: none; margin: 0; padding: 0; font-family: var(--mono); font-size: 0.74rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--faint); min-width: min(420px, 86vw); }
li { display: flex; gap: 12px; padding: 2px 0; opacity: 0.25; transition: opacity 0.2s, color 0.2s; }
li span { width: 2.4ch; color: var(--faint); }
li.on { opacity: 1; color: var(--text); }
li.on span { color: var(--good); text-shadow: 0 0 8px var(--good); }
</style>
