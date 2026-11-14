<script setup lang="ts" generic="T extends { key: string }">
/**
 * A grid of selectable cases (one per scenario a scene can show). Generic over the item type so each
 * scene keeps its own typed items; the slot decides how a case is labeled.
 */
defineProps<{ items: readonly T[]; label: string }>();

/** The selected case's key. */
const selected = defineModel<string>({ required: true });

defineSlots<{ default(props: { item: T }): unknown }>();
</script>

<template>
  <div class="cases" role="radiogroup" :aria-label="label">
    <button
      v-for="item in items"
      :key="item.key"
      type="button"
      role="radio"
      :aria-checked="item.key === selected"
      @click="selected = item.key"
    >
      <slot :item="item" />
    </button>
  </div>
</template>

<style scoped>
.cases { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px; }
button { text-align: left; background: var(--ink-raised); border: 1px solid var(--line); border-radius: 10px; padding: 9px 11px; cursor: pointer; font-size: 0.86rem; transition: border-color 0.15s, transform 0.15s; }
button:hover { border-color: var(--line-hi); transform: translateY(-1px); }
button[aria-checked='true'] { border-color: var(--female); background: #1a1428; }
:slotted(small) { display: block; color: var(--muted); font-size: 0.75rem; }
</style>
