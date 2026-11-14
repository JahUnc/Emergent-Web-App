<script setup lang="ts">
/**
 * The systems map screen: the map, its detail panel, and the feedback loops that run through it.
 */
import SystemsMap from '../components/SystemsMap.vue';
import MapDetails from '../components/MapDetails.vue';
import { MAP } from '../lib/catalog';
import { app } from '../state/app';
</script>

<template>
  <section class="view stack" aria-labelledby="systems-title">
    <div class="stack intro">
      <span class="eyebrow">Every system, what it changes, and who uses it</span>
      <h1 id="systems-title" class="page-title">How the systems connect</h1>
      <p class="lede">
        Most systems never talk to each other directly. They share state. One system changes something, like an
        entity's energy or who its friends are, and other systems react to it later in the same tick or the next one.
        A few ask another system a quick question, like “is this entity hungry?”, and those show up in each system's
        details. <strong>Read the map from left to right: a system on the left changes the state in the middle, and the
        systems on the right use it.</strong> The same system appears on both sides because most of them do both.
      </p>
    </div>

    <div class="layout">
      <div class="stack">
        <SystemsMap />
        <div class="key">
          <span><i style="background: var(--female)" />changes it</span>
          <span><i style="background: var(--male)" />uses it</span>
          <span>Hover anything to trace it. Click to keep it selected. Press <kbd>/</kbd> to search.</span>
        </div>
      </div>
      <MapDetails />
    </div>

    <div class="stack loops-section">
      <h2>Feedback loops</h2>
      <p class="lede">
        These are the chains that make behavior emerge. Each one is checked against the code when the data is built,
        so a loop shown here is a loop the simulation really has.
      </p>
      <div class="loops">
        <button
          v-for="(l, i) in MAP.loops"
          :key="l.title"
          type="button"
          :aria-pressed="app.mapFocus.kind === 'loop' && app.mapFocus.index === i"
          @click="app.mapFocus = { kind: 'loop', index: i }"
        >
          <span class="t">{{ l.title }}</span>
          <span class="d">{{ l.story.split('. ')[0] }}.</span>
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.view { padding: 28px 0 0; gap: 18px; }
.intro { gap: 8px; }
.page-title { view-transition-name: page-title; }
.layout { display: grid; grid-template-columns: minmax(0, 1.65fr) minmax(300px, 1fr); gap: 22px; align-items: start; }
@media (max-width: 1000px) { .layout { grid-template-columns: 1fr; } }
.key { display: flex; gap: 18px; flex-wrap: wrap; font-size: 0.84rem; color: var(--muted); }
.key span { display: inline-flex; gap: 8px; align-items: center; }
.key i { width: 26px; height: 3px; border-radius: 2px; display: inline-block; }
kbd { font-family: var(--mono); font-size: 0.72rem; border: 1px solid var(--line); border-radius: 5px; padding: 0 5px; }
.loops-section { margin-top: 10px; }
.loops { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; }
.loops button { text-align: left; background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 12px 14px; cursor: pointer; display: flex; flex-direction: column; gap: 4px; transition: border-color 0.2s, transform 0.2s; }
.loops button:hover { transform: translateY(-2px); border-color: var(--line-hi); }
.loops button[aria-pressed='true'] { border-color: var(--select); background: #1a1a22; }
.t { font-family: var(--display); font-weight: 600; }
.d { color: var(--muted); font-size: 0.84rem; }
</style>
