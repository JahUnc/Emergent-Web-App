<script setup lang="ts">
/**
 * Every condition a pair must meet to conceive. Each case changes one thing from a ready pair and shows
 * what the real ReproductionSystem did with it, plus the line of code that decided it.
 */
import { computed, ref } from 'vue';
import CaseGrid from '../../components/CaseGrid.vue';
import CodeDrawer from '../../components/CodeDrawer.vue';
import ConnectionStrip from '../../components/ConnectionStrip.vue';
import SettingChips from '../../components/SettingChips.vue';
import VerdictCard from '../../components/VerdictCard.vue';
import { RULES, S } from '../../lib/catalog';
import { percent } from '../../lib/text';

const copy: Record<string, { label: string; sub: string; why: string }> = {
  ready: { label: 'Ready pair', sub: 'both 25, energy 8, side by side', why: `Pregnant. Each paid ${S.ReproductionCost} energy (8 to {e}) and the child is due on tick {due}, ${S.GestationTicks} ticks later.` },
  young: { label: 'She is 17', sub: `maturity is ${S.MaturityAge}`, why: `No pregnancy. An entity has to be at least ${S.MaturityAge} to be available, so she is never offered as a partner.` },
  justMature: { label: 'She just turned 18', sub: 'the edge case', why: `Pregnant. The check is “at least ${S.MaturityAge}”, so the birthday tick counts.` },
  lowEnergy: { label: 'Her energy is 4.9', sub: `threshold is ${S.ReproductionThreshold}`, why: `No pregnancy. Energy must be at least ${S.ReproductionThreshold} at the social phase, after eating.` },
  recovering: { label: 'Conceived 5 ticks ago', sub: `cooldown is ${S.ReproductionCooldown}`, why: `No pregnancy. Both parents wait ${S.ReproductionCooldown} ticks from conception before trying again.` },
  recovered: { label: 'Conceived 10 ticks ago', sub: 'the edge case', why: `Pregnant. Exactly ${S.ReproductionCooldown} ticks is enough.` },
  pregnant: { label: 'Already pregnant', sub: "with someone else's child", why: 'No new pregnancy. A pregnant female is not available, so she cannot conceive a second child.' },
  tooFar: { label: '2 cells apart', sub: 'partners must be within 1', why: "No pregnancy. Partners are only looked for in the entity's own cell and the 8 around it." },
  sameCell: { label: 'In the same cell', sub: 'counts as near', why: "Pregnant. The search includes the entity's own cell." },
  sameSex: { label: 'Both female', sub: 'opposite sexes only', why: 'No pregnancy. Only opposite sexes are offered as partners.' },
  siblings: { label: 'They are siblings', sub: 'same mother', why: 'No pregnancy. Close kin are filtered out of the partner list before any roll happens.' },
  populationFull: { label: 'World at its limit', sub: `population ${S.MaxPopulation}`, why: `No pregnancy. Conception stops right away once the population reaches ${S.MaxPopulation}. This is a safety cap, not a balance rule.` },
};

const cases = RULES.checks;
const selected = ref(cases[0]!.key);
const current = computed(() => cases.find((c) => c.key === selected.value)!);
const why = computed(() => copy[current.value.key]!.why.replace('{e}', String(current.value.femaleEnergyAfter)).replace('{due}', String(current.value.dueTick)));
</script>

<template>
  <div class="grid-2">
    <div class="stack">
      <h2>Every condition has to pass</h2>
      <p class="lede">
        Once per tick, in the shuffled turn order, each entity looks for a partner. Both must be alive, at least
        {{ S.MaturityAge }}, at {{ S.ReproductionThreshold }} energy or more, {{ S.ReproductionCooldown }} ticks past their
        last conception, not pregnant, and not already tried this tick. They must be opposite sexes within 1 cell and not
        close kin. If several qualify, one is picked at random, and the pair rolls the conception chance of
        {{ percent(S.ConceptionChance!) }} percent. A failed roll costs nothing, but both have used their try.
      </p>
      <p class="lede">
        Each case changes one thing from a ready pair and calls the real ReproductionSystem once. The chance is set to
        100 percent for these calls, so the only thing that can stop a pregnancy is the rule being shown.
      </p>
      <CaseGrid v-model="selected" :items="cases" label="Conception cases" v-slot="{ item }">
        {{ copy[item.key]!.label }}<small>{{ copy[item.key]!.sub }}</small>
      </CaseGrid>
    </div>
    <div class="stack">
      <VerdictCard :title="current.conceived ? 'A child is conceived' : 'No child'" :tone="current.conceived ? 'yes' : 'no'">
        <p>{{ why }}</p>
        <span class="raw">ReproductionSystem.TryConceive returned: conceived = {{ current.conceived }}, energy after = {{ current.femaleEnergyAfter }} and {{ current.partnerEnergyAfter }}</span>
      </VerdictCard>
      <CodeDrawer
        :methods="['tryConceive', 'isAvailable', 'wants', 'recovered', 'findPartners']"
        :anchor="current.key"
        :tone="current.conceived ? 'pass' : 'fail'"
        :tests="['ConceptionTests.cs', 'MaturityTests.cs']"
      />
      <ConnectionStrip :systems="['mating']" />
      <SettingChips :names="['MaturityAge', 'ReproductionThreshold', 'ReproductionCooldown', 'ConceptionChance', 'ReproductionCost', 'MaxPopulation']" />
    </div>
  </div>
</template>
