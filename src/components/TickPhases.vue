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
  <div class="stack">
    <div class="phases" role="tablist" aria-label="Tick phases">
      <button
        v-for="(p, i) in phases"
        :key="p.anchor"
        type="button"
        role="tab"
        :aria-selected="i === selected"
        @click="selected = i"
      >
        <span class="n">{{ String(i + 1).padStart(2, '0') }}</span>
        <span class="t">{{ p.title }}</span>
        <span class="n">{{ p.sub }}</span>
      </button>
    </div>
    <div class="grid-2">
      <div class="card stack" role="tabpanel">
        <span class="eyebrow">Phase {{ selected + 1 }} of 6 · {{ phase.sub }}</span>
        <h3>{{ phase.title }}</h3>
        <p class="lede">{{ phase.body }}</p>
      </div>
      <CodeDrawer :methods="['step']" :anchor="phase.anchor" />
    </div>
  </div>
</template>

<style scoped>
.phases { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; }
@media (max-width: 760px) { .phases { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
button { text-align: left; background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; cursor: pointer; display: flex; flex-direction: column; gap: 2px; position: relative; overflow: hidden; }
button[aria-selected='true'] { border-color: var(--male); background: var(--panel-hi); }
button[aria-selected='true']::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 2px; background: linear-gradient(90deg, var(--female), var(--male)); }
.n { font-family: var(--mono); font-size: 0.72rem; color: var(--muted); }
.t { font-family: var(--display); font-weight: 600; font-size: 0.95rem; }
</style>
