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
button { --bk-c: transparent; --bk: 8px; text-align: left; background: var(--brackets), var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 10px 13px; cursor: pointer; font-size: 0.9rem; font-weight: 500; transition: border-color 0.2s, box-shadow 0.2s; }
button:hover { --bk-c: var(--hud); border-color: var(--line-hi); }
button[aria-checked='true'] { --bk-c: var(--select); border-color: rgba(255, 197, 61, 0.5); background: var(--brackets), rgba(255, 197, 61, 0.1); box-shadow: 0 0 18px rgba(255, 197, 61, 0.15); color: #fff; }
:slotted(small) { display: block; color: var(--muted); font-family: var(--mono); font-size: 0.68rem; font-weight: 400; margin-top: 2px; }
</style>
