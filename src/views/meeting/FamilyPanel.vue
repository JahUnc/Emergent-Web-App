<script setup lang="ts">
/**
 * Who counts as family. A small family tree was built in a real LineageRegistry; picking one of Ada's male
 * relatives shows what the registry answered and what that does to the chance of a child.
 */
import { computed, ref } from 'vue';
import CodeDrawer from '../../components/CodeDrawer.vue';
import ConnectionStrip from '../../components/ConnectionStrip.vue';
import SettingChips from '../../components/SettingChips.vue';
import VerdictCard from '../../components/VerdictCard.vue';
import { RULES, S } from '../../lib/catalog';
import { percent } from '../../lib/text';

const BOX_W = 120;
const BOX_H = 44;
const nodes = [
  { key: 'grandma', label: 'Grandma', x: 170, y: 20 }, { key: 'grandpa', label: 'Grandpa', x: 330, y: 20 },
  { key: 'dad', label: 'Dad', x: 20, y: 120 }, { key: 'mom', label: 'Mom', x: 170, y: 120 },
  { key: 'uncle', label: 'Uncle', x: 330, y: 120 }, { key: 'aunt', label: "Uncle's partner", x: 480, y: 120 },
  { key: 'halfBrother', label: 'Half brother', x: 20, y: 240 }, { key: 'ada', label: 'Ada (her)', x: 170, y: 240 },
  { key: 'brother', label: 'Brother', x: 310, y: 240 }, { key: 'cousin', label: 'Cousin', x: 470, y: 240 },
  { key: 'stranger', label: 'Stranger', x: 470, y: 340 },
] as const;
type NodeKey = (typeof nodes)[number]['key'];
const at = Object.fromEntries(nodes.map((n) => [n.key, n])) as Record<NodeKey, (typeof nodes)[number]>;
const kin = new Map(RULES.kinship.map((k) => [k.key, k]));
const names: Record<string, string> = { dad: 'her dad', grandpa: 'her grandpa', brother: 'her brother', halfBrother: 'her half brother', uncle: 'her uncle', cousin: 'her cousin', stranger: 'a stranger' };

const couple = (a: NodeKey, b: NodeKey) => ({ x: (at[a].x + at[b].x + BOX_W) / 2, y: at[a].y + BOX_H / 2 });
const lines = [
  ...([['grandma', 'grandpa'], ['dad', 'mom'], ['uncle', 'aunt']] as const).map(([a, b]) => `M${at[a].x + BOX_W} ${at[a].y + BOX_H / 2} H${at[b].x}`),
  ...([[couple('grandma', 'grandpa'), ['mom', 'uncle']], [couple('dad', 'mom'), ['ada', 'brother']], [couple('uncle', 'aunt'), ['cousin']]] as const)
    .flatMap(([p, kids]) => kids.map((k) => `M${p.x} ${p.y} V${at[k].y - 14} H${at[k].x + BOX_W / 2} V${at[k].y}`)),
];
const halfLine = `M${at.mom.x + 25} ${at.mom.y + BOX_H} V${at.halfBrother.y - 30} H${at.halfBrother.x + BOX_W / 2} V${at.halfBrother.y}`;

const selected = ref('uncle');
const row = computed(() => kin.get(selected.value)!);
const verdict = computed(() => {
  const r = row.value;
  const chance = percent(S.ConceptionChance!);
  if (r.closeKin) return { tone: 'no' as const, title: 'Never a partner', anchor: 'kinClose', body: `Ada and ${names[r.key]} are close kin, so he is left out of her partner list before any roll. Close kin are parent and child, grandparent and grandchild, and full or half siblings.` };
  if (r.distantKin) {
    const m = r.key === 'uncle' ? RULES.chances.uncleNiece : RULES.chances.cousins;
    return { tone: 'half' as const, title: 'Allowed, at half the chance', anchor: 'kinDistant', body: `${r.key === 'uncle' ? 'An uncle and his niece' : 'Cousins'} count as distant kin, so the ${chance} percent chance is multiplied by ${S.CousinConceptionFactor}. Measured over ${m.trials.toLocaleString()} real tries: ${percent(m.share, 2)} percent conceived.` };
  }
  const m = RULES.chances.unrelated;
  return { tone: 'yes' as const, title: 'Full chance', anchor: 'kinNone', body: `No shared parent or grandparent within two generations, so they are unrelated as far as the simulation knows. Measured over ${m.trials.toLocaleString()} real tries: ${percent(m.share, 2)} percent conceived.` };
});
const subtitle = (key: string) => {
  const r = kin.get(key);
  if (r) return r.closeKin ? 'close kin' : r.distantKin ? 'distant kin' : 'unrelated';
  return key === 'ada' ? 'female, age 25' : '';
};
</script>

<template>
  <div class="grid-2">
    <div class="stack">
      <h2>Who counts as family</h2>
      <p class="lede">
        LineageRegistry keeps a record of every entity that ever lived, so family ties still count after a parent dies.
        It traces two generations back and no further. Pick one of Ada's male relatives to see what the registry says
        about the pair.
      </p>
      <VerdictCard :title="verdict.title" :tone="verdict.tone">
        <p>{{ verdict.body }}</p>
        <span class="raw">AreCloseKin = {{ row.closeKin }}, AreCousins = {{ row.cousins }}, AreAuntOrUncle = {{ row.auntOrUncle }}, AreDistantKin = {{ row.distantKin }}</span>
      </VerdictCard>
      <CodeDrawer :methods="['findPartners', 'chanceFor', 'closeKin', 'distantKin']" :anchor="verdict.anchor" :tone="verdict.tone === 'no' ? 'fail' : 'pass'" :tests="['KinshipTests.cs', 'LineageTests.cs']" />
      <SettingChips :names="['ConceptionChance', 'CousinConceptionFactor']" />
    </div>
    <div class="stack">
      <div class="card tree">
        <svg viewBox="0 0 620 400" role="group" aria-label="Ada's family. Pick a male relative.">
          <path v-for="d in lines" :key="d" :d="d" />
          <path :d="halfLine" stroke-dasharray="4 4" />
          <text :x="at.halfBrother.x" :y="at.halfBrother.y + BOX_H + 16" class="note">same mom, other dad</text>
          <g
            v-for="n in nodes"
            :key="n.key"
            class="node"
            :class="{ pick: kin.has(n.key), me: n.key === 'ada', sel: n.key === selected }"
            :tabindex="kin.has(n.key) ? 0 : undefined"
            :role="kin.has(n.key) ? 'button' : undefined"
            :aria-pressed="kin.has(n.key) ? n.key === selected : undefined"
            @click="kin.has(n.key) && (selected = n.key)"
            @keydown.enter.space.prevent="kin.has(n.key) && (selected = n.key)"
          >
            <rect :x="n.x" :y="n.y" :width="BOX_W" :height="BOX_H" rx="2" />
            <text :x="n.x + 10" :y="n.y + 19">{{ n.label }}</text>
            <text v-if="subtitle(n.key)" class="sub" :x="n.x + 10" :y="n.y + 35">{{ subtitle(n.key) }}</text>
          </g>
        </svg>
      </div>
      <p class="small">Every label in this tree, and every answer, came from asking a real LineageRegistry about this exact family.</p>
      <ConnectionStrip :systems="['mating', 'birth']" />
    </div>
  </div>
</template>

<style scoped>
.tree svg { width: 100%; height: auto; display: block; }
path { stroke: var(--line-hi); fill: none; stroke-width: 1.4; }
.note { fill: var(--muted); font: 600 11px var(--body); }
.node rect { fill: rgba(2, 12, 20, 0.92); stroke: var(--line-hi); transition: stroke 0.2s, fill 0.2s; }
.node text { fill: var(--text); font: 600 13px var(--body); }
.node .sub { fill: var(--muted); font: 400 9.5px var(--mono); letter-spacing: 0.06em; text-transform: uppercase; }
.node.pick { cursor: pointer; outline: none; }
.node.pick rect { stroke: rgba(63, 140, 255, 0.4); }
.node.pick:hover rect, .node.pick:focus-visible rect { stroke: var(--hud); }
.node.sel rect { stroke: var(--select); stroke-width: 1.8; fill: rgba(255, 197, 61, 0.14); filter: drop-shadow(0 0 6px rgba(255, 197, 61, 0.6)); }
.node.me rect { stroke: var(--female); stroke-width: 1.8; filter: drop-shadow(0 0 6px rgba(255, 79, 154, 0.6)); }
</style>
