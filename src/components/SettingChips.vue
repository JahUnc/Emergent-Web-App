<script setup lang="ts">
/**
 * The settings a rule reads, with their baseline values. Each chip opens to show the setting's doc comment,
 * and notes when the Scenario baseline overrides the class default.
 */
import { CODE, RULES } from '../lib/catalog';

defineProps<{ names: string[] }>();

/**
 * Describes a setting for its chip.
 * @param name The setting name.
 * @returns The value to show and the note to open.
 */
function describe(name: string) {
  const value = RULES.settings[name];
  const doc = CODE.settings[name];
  const shown = String(value);
  let note = doc?.doc ?? '';
  if (doc?.classDefault) {
    const fallback = doc.classDefault.replace(/f$/, '');
    const differs = typeof value === 'boolean' ? String(value) !== fallback : Math.abs(Number(fallback) - Number(value)) > 1e-9;
    if (differs) note += ` Scenario sets ${shown}; the class default is ${fallback}.`;
  }
  return { shown, note };
}
</script>

<template>
  <div class="settings">
    <span class="eyebrow">Settings it reads</span>
    <div class="chips">
      <details v-for="name in names" :key="name" class="chip">
        <summary><code>{{ name }}</code><span class="v">{{ describe(name).shown }}</span></summary>
        <p>{{ describe(name).note }}</p>
      </details>
    </div>
  </div>
</template>

<style scoped>
.settings { display: flex; flex-direction: column; gap: 10px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; align-items: flex-start; }
.chip { border: 1px solid var(--line); background: rgba(1, 7, 13, 0.6); border-radius: var(--radius-sm); padding: 5px 10px; font-size: 0.8rem; max-width: 100%; transition: border-color 0.2s, box-shadow 0.2s; }
.chip:hover { border-color: var(--line-hi); }
.chip[open] { border-color: var(--hud); box-shadow: 0 0 14px rgba(79, 216, 255, 0.2); }
summary { cursor: pointer; list-style: none; }
summary::-webkit-details-marker { display: none; }
summary code { color: var(--muted); }
.v { font-family: var(--mono); color: var(--select); margin-left: 8px; text-shadow: 0 0 8px rgba(255, 197, 61, 0.5); }
p { color: var(--muted); font-size: 0.84rem; margin-top: 6px; max-width: 46ch; }
</style>
