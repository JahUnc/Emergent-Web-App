<script setup lang="ts">
/**
 * What a scene's systems use and what they change, straight from the systems map. Each chip opens that
 * piece of shared state on the map, so it is one click from "this rule" to "everything else it touches".
 */
import { computed } from 'vue';
import { labelOf, SYSTEM } from '../lib/catalog';
import { useRouter } from '../composables/useRouter';
import { app } from '../state/app';

const props = defineProps<{ systems: string[] }>();
const { navigate } = useRouter();

const uses = computed(() => [...new Set(props.systems.flatMap((k) => SYSTEM.get(k)?.reads ?? []))]);
const changes = computed(() => [...new Set(props.systems.flatMap((k) => SYSTEM.get(k)?.writes ?? []))]);

function openState(key: string) {
  app.mapFocus = { kind: 'state', key };
  navigate('systems');
}
function openSystem(key: string) {
  app.mapFocus = { kind: 'system', key, side: 'L' };
  navigate('systems');
}
</script>

<template>
  <div class="strip">
    <div class="who">
      <span class="eyebrow">Systems</span>
      <button v-for="k in systems" :key="k" type="button" class="sys" @click="openSystem(k)">{{ labelOf(k) }}</button>
    </div>
    <div class="side">
      <span class="eyebrow">Uses</span>
      <button v-for="k in uses" :key="k" type="button" class="r" @click="openState(k)">{{ labelOf(k) }}</button>
    </div>
    <div class="side">
      <span class="eyebrow">Changes</span>
      <button v-for="k in changes" :key="k" type="button" class="w" @click="openState(k)">{{ labelOf(k) }}</button>
    </div>
  </div>
</template>

<style scoped>
.strip { display: grid; gap: 8px; padding: 12px 14px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--ink-raised); }
.who, .side { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.eyebrow { width: 6.5em; flex: none; }
button { background: transparent; border: 1px solid var(--line); border-radius: 999px; padding: 2px 10px; font-size: 0.8rem; cursor: pointer; color: var(--text); }
button:hover, button:focus-visible { border-color: var(--select); }
.sys { border-color: var(--line-hi); font-weight: 600; }
.r { box-shadow: inset 2px 0 0 var(--male); }
.w { box-shadow: inset 2px 0 0 var(--female); }
</style>
