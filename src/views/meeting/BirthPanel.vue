<script setup lang="ts">
/**
 * Pregnancy and birth: where the child is placed, what it inherits from its mother, and how its traits
 * were fixed at conception. Uses the recorded pair for the timeline.
 */
import { computed, ref } from 'vue';
import CaseGrid from '../../components/CaseGrid.vue';
import CodeDrawer from '../../components/CodeDrawer.vue';
import ConnectionStrip from '../../components/ConnectionStrip.vue';
import SettingChips from '../../components/SettingChips.vue';
import VerdictCard from '../../components/VerdictCard.vue';
import { S } from '../../lib/catalog';
import type { MeetingData } from '../../types/data';

const props = defineProps<{ meeting: MeetingData | null }>();

const facts = [
  { key: 'birthRoom', title: 'Born where there is room', body: `During upkeep, once the due tick arrives, the child goes in a random cell with room among the mother's cell and the 8 around it (at most ${S.MaxEntitiesPerCell} living per cell). If every one is full, the child does not survive.` },
  { key: 'childTag', title: "Joins the mother's group", body: `The newborn takes its mother's group tag and already knows every shelter she knows. It starts with ${S.ChildEnergy} energy, which both parents paid for at conception.` },
  { key: 'inheritTraits', title: 'Traits are fixed at conception', body: "Max energy, lifespan and impulsiveness are the parents' average, impulsiveness gets a small random nudge, and strength is inherited on its own random stream so it never shifts the other draws." },
] as const;
const selected = ref<string>('birthRoom');
const fact = computed(() => facts.find((f) => f.key === selected.value)!);

const story = computed(() => {
  const m = props.meeting;
  if (!m) return null;
  const born = m.frames.find((f) => f.tick === m.bornAt)!;
  const child = born.entities.find((e) => !m.frames[0]!.entities.some((s) => s.id === e.id))!;
  return { conceived: m.conceivedAt - 1, born: m.bornAt - 1, child };
});
</script>

<template>
  <div class="grid-2">
    <div class="stack">
      <h2>{{ S.GestationTicks }} ticks from conception to birth</h2>
      <p v-if="story" class="lede">
        In the recording, the pair conceived on tick {{ story.conceived }} and the child (#{{ story.child.id }},
        {{ story.child.sex.toLowerCase() }}) was born on tick {{ story.born }} with {{ story.child.energy }} energy. While
        pregnant, the mother pays a little extra each tick ({{ S.GestationMetabolism }} upkeep and {{ S.GestationMoveCost }}
        per move), and she counts as one entity in her cell.
      </p>
      <CaseGrid v-model="selected" :items="facts" label="Birth rules" v-slot="{ item }">{{ item.title }}</CaseGrid>
      <VerdictCard :title="fact.title" tone="neutral"><p>{{ fact.body }}</p></VerdictCard>
      <SettingChips :names="['GestationTicks', 'ChildEnergy', 'ReproductionCost', 'GestationMetabolism', 'GestationMoveCost', 'MaxEntitiesPerCell']" />
    </div>
    <div class="stack">
      <ConnectionStrip :systems="['birth']" />
      <CodeDrawer :methods="['deliver', 'deliverIfDue', 'inherit']" :anchor="selected" :tests="['GestationTests.cs', 'CellLimitTests.cs']" />
    </div>
  </div>
</template>
