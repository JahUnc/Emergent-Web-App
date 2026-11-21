<script setup lang="ts">
/**
 * The systems map screen: the map, its detail panel, and the feedback loops that run through it.
 */
import SystemsMap from '../components/SystemsMap.vue';
import MapDetails from '../components/MapDetails.vue';
import { MAP } from '../lib/catalog';
import { app } from '../state/app';

/** After picking a loop at the bottom of the page, bring the map back into view so the trace is visible. */
function scrollToMap() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelector('.systems-map-anchor')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}
</script>

<template>
  <section class="view stack" aria-labelledby="systems-title">
    <div class="intro-split">
      <div class="title-block">
        <span class="eyebrow">Systems map // read from source</span>
        <h1 id="systems-title" class="page-title">How the systems connect</h1>
      </div>
      <div class="stack intro-copy">
        <p class="lede">
          Most systems never talk to each other directly. They share state. One system changes something, like an
          entity's energy or who its friends are, and other systems react to it later in the same tick or the next one.
          A few ask another system a quick question, like “is this entity hungry?”, and those show up in each system's
          details.
        </p>
        <p class="lede">
          <strong>Read the map from left to right: a system on the left changes the state in the middle, and the systems
          on the right use it.</strong> Most systems appear on both sides because most of them do both.
        </p>
      </div>
    </div>

    <div class="layout">
      <div class="stack">
        <SystemsMap />
        <div class="key">
          <span><i class="w" />changes it</span>
          <span><i class="r" />uses it</span>
          <span class="hint">Hover anything to trace it. Click to keep it selected. Press <kbd>/</kbd> to search.</span>
        </div>
      </div>
      <MapDetails />
    </div>

    <div class="loops-section">
      <div class="intro-split loops-intro">
        <div class="title-block">
          <span class="eyebrow">{{ MAP.loops.length }} verified loops</span>
          <h2>Feedback loops</h2>
        </div>
        <p class="lede">
          These are the chains that make behavior emerge. Each one is checked against the code when the data is built,
          so a loop shown here is a loop the simulation really has. Pick one to trace it on the map.
        </p>
      </div>
      <ol class="loops">
        <li v-for="(l, i) in MAP.loops" :key="l.title">
          <button
            type="button"
            :aria-pressed="app.mapFocus.kind === 'loop' && app.mapFocus.index === i"
            @click="app.mapFocus = { kind: 'loop', index: i }; scrollToMap()"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 7a7 7 0 1 0 2 5" /><path d="m19 4 0 4-4 0" /></svg>
            <span class="t">{{ l.title }}</span>
            <span class="d">{{ l.story.split('. ')[0] }}.</span>
          </button>
        </li>
      </ol>
    </div>
  </section>
</template>

<style scoped>
.view { padding: clamp(40px, 6vw, 80px) 0 0; gap: 34px; }
.intro-copy { gap: 12px; }
.layout { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(300px, 1fr); gap: 24px; align-items: start; }
@media (max-width: 1000px) { .layout { grid-template-columns: 1fr; } }
.key { display: flex; gap: 10px 22px; flex-wrap: wrap; font-family: var(--mono); font-size: 0.7rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
.key span { display: inline-flex; gap: 8px; align-items: center; }
.key i { width: 28px; height: 2px; display: inline-block; }
.key i.w { background: var(--female); box-shadow: 0 0 8px var(--female); }
.key i.r { background: var(--male); box-shadow: 0 0 8px var(--male); }
.hint { margin-left: auto; text-transform: none; letter-spacing: 0.02em; font-family: var(--body); font-size: 0.84rem; }
.loops-section { display: flex; flex-direction: column; gap: 26px; margin-top: 64px; }
.loops-intro { align-items: end; }
.loops { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 10px; }
.loops button { --bk-c: transparent; --bk: 10px; width: 100%; height: 100%; text-align: left; background: var(--brackets), var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 18px; cursor: pointer; display: grid; grid-template-columns: 30px 1fr; gap: 4px 12px; color: var(--text); transition: border-color 0.25s, box-shadow 0.25s, background 0.25s; }
.loops button:hover { --bk-c: var(--hud); border-color: var(--line-hi); box-shadow: 0 0 22px rgba(79, 216, 255, 0.15); }
.loops button[aria-pressed='true'] { --bk-c: var(--select); border-color: rgba(255, 197, 61, 0.45); box-shadow: 0 0 26px rgba(255, 197, 61, 0.18); }
.loops svg { grid-row: span 2; width: 22px; height: 22px; fill: none; stroke: var(--hud); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; margin-top: 1px; transition: stroke 0.2s, transform 0.6s var(--ease); }
.loops button[aria-pressed='true'] svg { stroke: var(--select); transform: rotate(-200deg); filter: drop-shadow(0 0 4px var(--select)); }
.loops button[aria-pressed='true'] .t { color: var(--select); }
.t { font-weight: 600; font-size: 0.84rem; letter-spacing: 0.12em; text-transform: uppercase; }
.d { color: var(--muted); font-size: 0.9rem; }
</style>
