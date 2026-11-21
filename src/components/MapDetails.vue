<script setup lang="ts">
/**
 * The side panel of the systems map. It explains whatever is selected: a system (what it changes, what it
 * uses, who depends on it), a piece of shared state (who changes it, who uses it), or a feedback loop
 * (each step, with the line of code that makes it). Every name is clickable to move around the map.
 */
import { computed } from 'vue';
import { labelOf, MAP, STATE, SYSTEM } from '../lib/catalog';
import { useRouter } from '../composables/useRouter';
import { app, type MapFocus } from '../state/app';
import type { Evidence, MapEdge } from '../types/data';
import TestList from './TestList.vue';

const { navigate } = useRouter();
const SCENES: Record<string, number> = { relationships: 0, mating: 1, birth: 3, relationshipsState: 0, lineage: 2, pregnancy: 3 };
const writes = MAP.edges.filter((e) => e.kind === 'writes');
const reads = MAP.edges.filter((e) => e.kind === 'reads');
const guides = MAP.edges.filter((e) => e.kind === 'guides');

const focus = computed(() => app.mapFocus);
const evidence = (e: { evidence: Evidence[] } | undefined) => {
  const first = e?.evidence[0];
  return first ? `${first.file}:${first.line}   ${first.text}` : '';
};

const system = computed(() => {
  const f = focus.value;
  if (f.kind !== 'system') return null;
  const s = SYSTEM.get(f.key)!;
  const changes = writes.filter((e) => e.from === f.key);
  const uses = reads.filter((e) => e.to === f.key);
  return {
    s,
    changes,
    uses,
    checksWith: guides.filter((e) => e.to === f.key),
    checkedBy: guides.filter((e) => e.from === f.key).map((e) => e.to),
    affects: [...new Set(reads.filter((e) => changes.some((w) => w.to === e.from) && e.to !== f.key).map((e) => e.to))],
    dependsOn: [...new Set(writes.filter((e) => uses.some((u) => u.from === e.to) && e.from !== f.key).map((e) => e.from))],
  };
});

const state = computed(() => {
  const f = focus.value;
  if (f.kind !== 'state') return null;
  return { s: STATE.get(f.key)!, changedBy: writes.filter((e) => e.to === f.key), usedBy: reads.filter((e) => e.from === f.key) };
});

const loop = computed(() => {
  const f = focus.value;
  if (f.kind !== 'loop') return null;
  const l = MAP.loops[f.index]!;
  return {
    l,
    index: f.index,
    steps: l.hops.map(([a, b]) => {
      const e = MAP.edges.find((x) => x.from === a && x.to === b)!;
      const verb = e.kind === 'writes' ? 'changes' : e.kind === 'reads' ? 'is used by' : 'guides';
      return { a, b, verb, e };
    }),
  };
});

function go(key: string) {
  app.mapFocus = (SYSTEM.has(key) ? { kind: 'system', key, side: 'L' } : { kind: 'state', key }) as MapFocus;
}
function openScene(key: string) {
  app.meetPanel = SCENES[key]!;
  navigate('near-another');
}
const linkTarget = (e: MapEdge, side: 'from' | 'to') => e[side];
</script>

<template>
  <aside class="details card" aria-live="polite">
    <template v-if="system">
      <span class="eyebrow">System · {{ MAP.phases[system.s.phase] }} phase · {{ system.s.files.join(', ') }}</span>
      <h2>{{ system.s.label }}</h2>
      <p class="lede">{{ system.s.desc }}</p>
      <button v-if="system.s.key in SCENES" type="button" class="btn" @click="openScene(system.s.key)">Open its scene</button>

      <section>
        <span class="eyebrow">Changes ({{ system.changes.length }})</span>
        <div v-for="e in system.changes" :key="e.to" class="link w">
          <button type="button" @click="go(linkTarget(e, 'to'))">{{ labelOf(e.to) }}</button>
          <code>{{ evidence(e) }}</code>
        </div>
        <p v-if="!system.changes.length" class="small">Nothing. It only decides; other systems act on its answer.</p>
      </section>
      <section>
        <span class="eyebrow">Uses ({{ system.uses.length }})</span>
        <div v-for="e in system.uses" :key="e.from" class="link r">
          <button type="button" @click="go(linkTarget(e, 'from'))">{{ labelOf(e.from) }}</button>
          <code>{{ evidence(e) }}</code>
        </div>
      </section>
      <section v-if="system.checksWith.length">
        <span class="eyebrow">Checks with</span>
        <div v-for="e in system.checksWith" :key="e.from" class="link g">
          <button type="button" @click="go(e.from)">{{ labelOf(e.from) }}</button>
          <code>{{ evidence(e) }}</code>
        </div>
      </section>
      <section v-if="system.checkedBy.length">
        <span class="eyebrow">Other systems check with it</span>
        <div class="chips"><button v-for="k in system.checkedBy" :key="k" type="button" @click="go(k)">{{ labelOf(k) }}</button></div>
      </section>
      <section>
        <span class="eyebrow">What it changes is used by</span>
        <div v-if="system.affects.length" class="chips"><button v-for="k in system.affects" :key="k" type="button" @click="go(k)">{{ labelOf(k) }}</button></div>
        <p v-else class="small">No other system reads what it changes.</p>
      </section>
      <section>
        <span class="eyebrow">It depends on</span>
        <div v-if="system.dependsOn.length" class="chips"><button v-for="k in system.dependsOn" :key="k" type="button" @click="go(k)">{{ labelOf(k) }}</button></div>
        <p v-else class="small">Nothing. It only reads state no other system changes.</p>
      </section>
      <TestList :files="system.s.tests" />
    </template>

    <template v-else-if="state">
      <span class="eyebrow">Shared state · {{ state.s.group }}</span>
      <h2>{{ state.s.label }}</h2>
      <p class="lede">{{ state.s.desc }}</p>
      <button v-if="state.s.key in SCENES" type="button" class="btn" @click="openScene(state.s.key)">Open its scene</button>
      <section>
        <span class="eyebrow">Changed by ({{ state.changedBy.length }})</span>
        <div v-for="e in state.changedBy" :key="e.from" class="link w">
          <button type="button" @click="go(e.from)">{{ labelOf(e.from) }}</button>
          <code>{{ evidence(e) }}</code>
        </div>
        <p v-if="!state.changedBy.length" class="small">No system changes it. It is an input to the simulation.</p>
      </section>
      <section>
        <span class="eyebrow">Used by ({{ state.usedBy.length }})</span>
        <div v-for="e in state.usedBy" :key="e.to" class="link r">
          <button type="button" @click="go(e.to)">{{ labelOf(e.to) }}</button>
          <code>{{ evidence(e) }}</code>
        </div>
      </section>
    </template>

    <template v-else-if="loop">
      <span class="eyebrow">Feedback loop {{ loop.index + 1 }} of {{ MAP.loops.length }}</span>
      <h2>{{ loop.l.title }}</h2>
      <p class="lede">{{ loop.l.story }}</p>
      <section>
        <span class="eyebrow">Step by step</span>
        <ol class="chain">
          <li v-for="(step, i) in loop.steps" :key="i" :style="{ '--i': i }">
            <span><button type="button" @click="go(step.a)">{{ labelOf(step.a) }}</button> {{ step.verb }} <button type="button" @click="go(step.b)">{{ labelOf(step.b) }}</button></span>
            <code>{{ evidence(step.e) }}</code>
          </li>
        </ol>
      </section>
    </template>
  </aside>
</template>

<style scoped>
.details { position: sticky; top: 84px; display: flex; flex-direction: column; gap: 16px; max-height: calc(100vh - 104px); overflow: auto; }
h2 { font-size: 1.15rem; }
section { display: flex; flex-direction: column; gap: 6px; padding-top: 14px; border-top: 1px dashed var(--line-hi); }
.link { display: flex; flex-direction: column; gap: 3px; padding: 9px 12px 9px 14px; border-radius: var(--radius-sm); background: var(--code-bg); border: 1px solid var(--line); position: relative; overflow: hidden; }
.link::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 2px; }
.link.w::before { background: var(--female); box-shadow: 0 0 8px var(--female); }
.link.r::before { background: var(--male); box-shadow: 0 0 8px var(--male); }
.link.g::before { background: var(--select); box-shadow: 0 0 8px var(--select); }
.link button, .chain button { all: unset; cursor: pointer; font-weight: 600; color: var(--text); }
.link button:hover, .chain button:hover, .link button:focus-visible, .chain button:focus-visible { color: var(--hud); text-shadow: var(--hud-glow); }
code { font-size: 0.72rem; color: var(--muted); white-space: pre-wrap; word-break: break-word; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chips button { background: transparent; border: 1px solid var(--line-hi); border-radius: var(--radius-sm); padding: 3px 10px; font-size: 0.82rem; cursor: pointer; }
.chips button:hover, .chips button:focus-visible { border-color: var(--hud); color: var(--hud); }
.chain { list-style: none; margin: 0; padding: 0; counter-reset: step; display: flex; flex-direction: column; position: relative; }
.chain li { counter-increment: step; display: grid; grid-template-columns: 30px 1fr; gap: 2px 10px; padding: 8px 0; position: relative; animation: rise 0.4s var(--ease) backwards; animation-delay: calc(var(--i) * 70ms); }
.chain li::before { content: counter(step, decimal-leading-zero); grid-row: span 2; display: grid; place-items: center; width: 26px; height: 26px; border: 1px solid var(--select); font-family: var(--mono); font-size: 0.66rem; color: var(--select); background: rgba(1, 7, 13, 0.9); box-shadow: 0 0 10px rgba(255, 197, 61, 0.35); position: relative; z-index: 1; }
.chain li:not(:last-child)::after { content: ''; position: absolute; left: 12.5px; top: 36px; bottom: -8px; width: 1px; background: linear-gradient(var(--select), transparent); opacity: 0.6; }
.chain li > span { font-size: 0.94rem; }
@keyframes rise { from { opacity: 0; transform: translateX(-6px); } }
@media (max-width: 1000px) { .details { position: static; max-height: none; } }
</style>
