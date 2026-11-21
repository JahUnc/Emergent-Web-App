<script setup lang="ts">
/**
 * The sticky header: the site mark and name, the four screens, a live status readout, and the search
 * button that opens the command palette.
 *
 * The mark is an arc-reactor style ring that turns slowly while the page is open. The status readout is
 * real: it reports how many of the simulation's test methods passed when the site's data was generated.
 */
import { ROUTES, useRouter } from '../composables/useRouter';
import { TESTS } from '../lib/catalog';
import { palette } from '../state/app';

const { route } = useRouter();
const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
const passed = TESTS.filter((t) => t.passed).length;
const allPassed = passed === TESTS.length;
</script>

<template>
  <header class="top">
    <div class="wrap bar">
      <a class="brand" href="#overview">
        <svg class="reactor" viewBox="0 0 40 40" aria-hidden="true">
          <circle cx="20" cy="20" r="17" class="outer" />
          <circle cx="20" cy="20" r="11.5" class="mid" />
          <circle cx="20" cy="20" r="5" class="core" />
        </svg>
        <span class="name">Emergent<br />Society</span>
      </a>
      <nav aria-label="Screens">
        <a
          v-for="(r, i) in ROUTES"
          :key="r.name"
          :href="`#${r.name}`"
          :aria-current="route === r.name ? 'page' : undefined"
        ><span class="idx" aria-hidden="true">0{{ i + 1 }}</span>{{ r.label }}</a>
      </nav>
      <div class="right">
        <span class="status" :class="{ warn: !allPassed }" :title="`${passed} of ${TESTS.length} test methods passed`">
          <i aria-hidden="true" />Core {{ allPassed ? 'nominal' : 'faults' }} <b>{{ passed }}/{{ TESTS.length }}</b>
        </span>
        <button class="search" type="button" aria-haspopup="dialog" @click="palette.open = true">
          <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m13 13 4 4" /></svg>
          Search <kbd>{{ isMac ? '⌘' : 'Ctrl' }} K</kbd>
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
.top { position: sticky; top: 0; z-index: 10; background: linear-gradient(180deg, rgba(2, 7, 13, 0.95), rgba(2, 7, 13, 0.78)); backdrop-filter: blur(12px); border-bottom: 1px solid var(--line); view-transition-name: site-header; }
/* A thin lit seam along the bottom edge, brightest in the middle. */
.top::after { content: ''; position: absolute; left: 0; right: 0; bottom: -1px; height: 1px; background: linear-gradient(90deg, transparent, var(--hud) 50%, transparent); opacity: 0.7; }
.bar { display: flex; align-items: center; gap: 12px 32px; min-height: 66px; flex-wrap: wrap; }
.brand { display: inline-flex; align-items: center; gap: 12px; color: var(--text); text-decoration: none; }
.name { font-family: var(--display); font-size: 0.66rem; line-height: 1.25; letter-spacing: 0.18em; text-transform: uppercase; }
.reactor { width: 36px; height: 36px; filter: drop-shadow(0 0 6px rgba(79, 216, 255, 0.8)); }
.reactor circle { fill: none; stroke: var(--hud); }
.reactor .outer { stroke-width: 1.4; stroke-dasharray: 6 3; transform-origin: center; animation: spin 18s linear infinite; }
.reactor .mid { stroke-width: 2.2; stroke-dasharray: 14 4; transform-origin: center; animation: spin 9s linear infinite reverse; }
.reactor .core { fill: #dcf5ff; stroke: none; }
@keyframes spin { to { transform: rotate(360deg); } }
nav { display: flex; gap: 2px 26px; flex-wrap: wrap; }
nav a { position: relative; display: inline-flex; align-items: baseline; gap: 7px; text-decoration: none; color: var(--muted); font-size: 0.78rem; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; padding: 8px 0; transition: color 0.2s, text-shadow 0.2s; }
.idx { font-family: var(--mono); font-size: 0.62rem; font-weight: 400; color: var(--faint); letter-spacing: 0.04em; }
nav a:hover { color: var(--text); }
nav a::after { content: ''; position: absolute; left: 0; right: 0; bottom: -12px; height: 2px; background: var(--hud); box-shadow: var(--hud-glow); transform: scaleX(0); transition: transform 0.35s var(--ease); }
nav a[aria-current='page'] { color: var(--hud); text-shadow: var(--hud-glow); }
nav a[aria-current='page'] .idx { color: var(--hud); }
nav a[aria-current='page']::after { transform: scaleX(1); }
.right { margin-left: auto; display: flex; align-items: center; gap: 14px; }
.status { display: inline-flex; align-items: center; gap: 8px; font-family: var(--mono); font-size: 0.68rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }
.status i { width: 7px; height: 7px; border-radius: 50%; background: var(--good); box-shadow: 0 0 8px var(--good); animation: blink 2.4s ease-in-out infinite; }
.status b { color: var(--good); font-weight: 500; }
.status.warn i { background: var(--bad); box-shadow: 0 0 8px var(--bad); }
.status.warn b { color: var(--bad); }
@keyframes blink { 50% { opacity: 0.35; } }
.search { display: inline-flex; gap: 8px; align-items: center; background: rgba(79, 216, 255, 0.04); border: 1px solid var(--line-hi); border-radius: var(--radius-sm); padding: 4px 5px 4px 12px; color: var(--muted); font-size: 0.74rem; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; transition: border-color 0.2s, color 0.2s, box-shadow 0.2s; }
.search svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; }
.search:hover { color: var(--hud); border-color: var(--hud); box-shadow: 0 0 14px rgba(79, 216, 255, 0.3); }
@media (max-width: 1100px) { .status { display: none; } }
@media (max-width: 860px) {
  .bar { padding-top: 10px; padding-bottom: 10px; }
  nav { order: 3; width: 100%; gap: 2px 18px; }
  nav a::after { bottom: 0; }
}
</style>
