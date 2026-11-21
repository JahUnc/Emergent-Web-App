<script setup lang="ts">
/**
 * The six phases of one tick, in order, each linked to the line in Simulation.Step that runs it.
 */
import { computed, ref } from 'vue';
import CodeDrawer from './CodeDrawer.vue';

const phases = [
  { anchor: 'phaseShuffle', title: 'Shuffle', sub: 'Turn order', body: 'The tick starts by shuffling who goes first, using a seeded random stream. Nobody has a standing advantage at contested food, and the same seed always gives the same run.' },
  { anchor: 'phaseNeeds', title: 'Basic needs', sub: 'Move, work, eat', body: 'Every entity moves, one at a time. A chilled entity looks for shelter first, a free one may go for wood. Then gatherers cut or build, farmers farm, desperate entities may attack, and everyone else eats. Nobody eats until everyone has moved, so a choice can fail when others reach the same food first.' },
  { anchor: 'phaseSocial', title: 'Social', sub: 'Bond and mate', body: 'Relationships update from how the meals went, grudges sour rival groups and fade, group tags follow relationships, and willing pairs try to conceive.' },
  { anchor: 'phaseUpkeep', title: 'Upkeep', sub: 'Birth, aging, warmth', body: 'Due mothers give birth, everyone pays their metabolism and ages a tick, warmth drops in the cold or recovers in shelter, and anyone standing in a shelter remembers it.' },
  { anchor: 'phaseOwnership', title: 'Ownership', sub: 'Who holds shelters', body: 'Each shelter tallies which groups have been standing in it. A group with enough of the presence takes ownership, and loses it when it fades or another group takes over.' },
  { anchor: 'phaseCleanup', title: 'Cleanup', sub: 'Deaths and regrowth', body: 'The dead are removed and counted as killed, cold, starved or old age, in that order. Then farmland wears down, food and trees regrow, and built shelter cells that are worn out go back to growing food.' },
] as const;

const selected = ref(2);
const phase = computed(() => phases[selected.value]!);
</script>

<template>
  <div class="stack ticks">
    <!-- The phases sit on one thread, because they really are a sequence: each finishes before the next starts. -->
    <div class="phases" role="tablist" aria-label="Tick phases" :style="{ '--at': selected }">
      <span class="thread" aria-hidden="true"><span class="done" /></span>
      <button
        v-for="(p, i) in phases"
        :key="p.anchor"
        type="button"
        role="tab"
        :aria-selected="i === selected"
        :class="{ past: i < selected }"
        @click="selected = i"
      >
        <span class="knot">{{ i + 1 }}</span>
        <span class="t">{{ p.title }}</span>
        <span class="s">{{ p.sub }}</span>
      </button>
    </div>
    <div class="grid-2">
      <div class="card stack panel" role="tabpanel">
        <span class="eyebrow">Phase {{ selected + 1 }} of 6</span>
        <h3>{{ phase.title }}: {{ phase.sub.toLowerCase() }}</h3>
        <p class="lede">{{ phase.body }}</p>
      </div>
      <CodeDrawer :methods="['step']" :anchor="phase.anchor" />
    </div>
  </div>
</template>

<style scoped>
.ticks { gap: 24px; }
.phases { position: relative; display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; }
.thread { position: absolute; left: calc(100% / 12); right: calc(100% / 12); top: 21px; height: 1px; background: var(--line-hi); }
.done { position: absolute; inset: 0 auto 0 0; width: calc(var(--at) / 5 * 100%); background: var(--hud); box-shadow: var(--hud-glow); transition: width 0.6s var(--ease); }
button { position: relative; background: transparent; border: 0; padding: 0 4px; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; color: var(--muted); }
.knot { position: relative; display: grid; place-items: center; width: 44px; height: 44px; border-radius: 50%; background: var(--ink); border: 1px solid var(--line-hi); font-family: var(--mono); font-size: 0.86rem; color: var(--muted); transition: border-color 0.3s, background 0.3s, color 0.3s, box-shadow 0.3s; margin-bottom: 8px; }
/* The selected phase gets a dashed outer ring that turns, like a lock-on. */
.knot::before { content: ''; position: absolute; inset: -7px; border-radius: 50%; border: 1.5px dashed var(--select); opacity: 0; transform: scale(0.7); transition: opacity 0.3s, transform 0.4s var(--ease); }
button.past .knot { border-color: var(--hud); color: var(--hud); }
button[aria-selected='true'] .knot { background: rgba(255, 197, 61, 0.15); border-color: var(--select); color: var(--select); box-shadow: 0 0 22px rgba(255, 197, 61, 0.45), inset 0 0 12px rgba(255, 197, 61, 0.3); }
button[aria-selected='true'] .knot::before { opacity: 1; transform: scale(1); animation: spin 8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
button:hover .knot { border-color: var(--hud); box-shadow: 0 0 14px rgba(79, 216, 255, 0.35); }
.t { font-family: var(--body); font-weight: 600; font-size: 0.82rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--text); }
.s { font-size: 0.8rem; line-height: 1.3; }
button[aria-selected='true'] .t { color: var(--select); text-shadow: 0 0 10px rgba(255, 197, 61, 0.5); }
.panel h3 { font-size: 1.1rem; }
@media (max-width: 760px) {
  .phases { grid-template-columns: repeat(3, minmax(0, 1fr)); row-gap: 18px; }
  .thread { display: none; }
}
</style>
