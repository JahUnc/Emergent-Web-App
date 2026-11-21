<script setup lang="ts">
/**
 * How relationships form: the fade every tick, the gain from eating well side by side, and the
 * resentment toward cellmates who ate when you went short. Shows the recorded pair's relationship curve.
 */
import { computed, ref } from 'vue';
import CaseGrid from '../../components/CaseGrid.vue';
import CodeDrawer from '../../components/CodeDrawer.vue';
import ConnectionStrip from '../../components/ConnectionStrip.vue';
import SettingChips from '../../components/SettingChips.vue';
import VerdictCard from '../../components/VerdictCard.vue';
import { S } from '../../lib/catalog';
import { frameLabel, percent } from '../../lib/text';
import type { MeetingData } from '../../types/data';

const props = defineProps<{ meeting: MeetingData | null }>();

const rules = [
  { key: 'decay', title: 'Every tick, first', body: `Every relationship fades ${percent(S.RelationshipDecay!)} percent, and any that drop under ${S.RelationshipFloor} are forgotten. A bond only lasts if it keeps being fed.` },
  { key: 'bondGain', title: 'Both fed, within 1 cell', body: `After everyone eats, each pair that ended its meal at or above the hunger line (${percent(S.HungerThreshold!)} percent of max energy) and stands within 1 cell gains ${S.RelationshipGain}.` },
  { key: 'resentLoss', title: 'Went short while a cellmate ate', body: `An entity whose cell ran out before it got its meal loses ${S.RelationshipLoss} with every cellmate who got a full one.` },
] as const;
const selected = ref<string>('bondGain');
const rule = computed(() => rules.find((r) => r.key === selected.value)!);

/** The recorded relationship as an SVG path, drawn to the panel's own scale. */
const curve = computed(() => {
  const frames = props.meeting?.frames;
  if (!frames) return null;
  const values = frames.map((f) => f.relationship);
  const max = Math.max(...values, 0.1);
  const x = (i: number) => 10 + (i * 580) / (values.length - 1);
  const y = (v: number) => 110 - (v / max) * 96;
  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  return {
    line,
    area: `${line} L${x(values.length - 1)} 110 L10 110 Z`,
    end: { x: x(values.length - 1), y: y(values.at(-1)!), value: values.at(-1)!, label: frameLabel(frames.at(-1)!.tick) },
  };
});
</script>

<template>
  <div class="grid-2">
    <div class="stack">
      <h2>Friendship comes from eating well side by side</h2>
      <p class="lede">
        There is no “make friends” action. Relationships are a side effect of meals: entities that are fed near each
        other drift together, and ones that lose out at a crowded cell hold it against the ones who ate.
      </p>
      <CaseGrid v-model="selected" :items="rules" label="Relationship rules" v-slot="{ item }">{{ item.title }}</CaseGrid>
      <VerdictCard :title="rule.title" tone="neutral"><p>{{ rule.body }}</p></VerdictCard>
      <p class="lede">
        Where this goes next: movement pulls content entities toward friends (friend pull {{ S.FriendPull }}), while hungry
        ones ignore friends and go for food. Mating does not read relationships at all yet.
      </p>
      <SettingChips :names="['RelationshipGain', 'RelationshipLoss', 'RelationshipDecay', 'RelationshipFloor', 'HungerThreshold', 'FriendPull', 'HungerSilencesFriends']" />
    </div>
    <div class="stack">
      <div v-if="curve" class="card stack chart">
        <span class="eyebrow">The pair above, recorded</span>
        <svg viewBox="0 0 600 124" role="img" :aria-label="`Relationship rising to ${curve.end.value.toFixed(2)} by ${curve.end.label}`">
          <defs>
            <linearGradient id="bond-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stop-color="#ff4f9a" stop-opacity="0.32" />
              <stop offset="1" stop-color="#ff4f9a" stop-opacity="0" />
            </linearGradient>
          </defs>
          <line v-for="g in 5" :key="g" x1="0" x2="600" :y1="110 - (g - 1) * 24" :y2="110 - (g - 1) * 24" class="grid" />
          <path :d="curve.area" fill="url(#bond-fill)" />
          <path :d="curve.line" class="line" pathLength="1" />
          <circle :cx="curve.end.x" :cy="curve.end.y" r="4.5" class="end" />
          <text x="12" y="16" class="label">REACHED {{ curve.end.value.toFixed(2) }} BY {{ curve.end.label.toUpperCase() }}</text>
        </svg>
        <p class="small">Each tick: fade {{ percent(S.RelationshipDecay!) }} percent, then add {{ S.RelationshipGain }}. That is why the curve bends instead of climbing in a straight line.</p>
      </div>
      <ConnectionStrip :systems="['relationships']" />
      <CodeDrawer :methods="['relUpdate', 'bond', 'resent']" :anchor="selected" :tests="['RelationshipTests.cs', 'FriendPullTests.cs']" />
    </div>
  </div>
</template>

<style scoped>
.chart { gap: 8px; padding: 18px; }
svg { width: 100%; height: auto; display: block; }
.grid { stroke: var(--line); stroke-dasharray: 2 5; }
.line { fill: none; stroke: var(--female); stroke-width: 2; filter: drop-shadow(0 0 4px var(--female)); stroke-dasharray: 1; stroke-dashoffset: 1; animation: draw 1.4s ease forwards; }
@keyframes draw { to { stroke-dashoffset: 0; } }
.end { fill: var(--female); filter: drop-shadow(0 0 6px var(--female)); }
.label { fill: var(--female); font: 500 11px var(--mono); letter-spacing: 0.08em; }
</style>
