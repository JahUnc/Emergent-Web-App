<script setup lang="ts">
/**
 * The outcome of the selected case: a big colored line and an explanation underneath.
 */
defineProps<{ title: string; tone: 'yes' | 'no' | 'half' | 'neutral' }>();
</script>

<template>
  <div class="verdict" :class="tone" aria-live="polite">
    <div class="big">{{ title }}</div>
    <slot />
  </div>
</template>

<style scoped>
.verdict { border-radius: 10px; padding: 12px 14px; border: 1px solid var(--line); background: var(--ink-raised); display: flex; flex-direction: column; gap: 4px; }
.big { font-family: var(--display); font-weight: 600; font-size: 1.12rem; }
.yes .big { color: var(--good); }
.no .big { color: var(--bad); }
.half .big { color: var(--select); }
:slotted(p) { color: var(--muted); font-size: 0.9rem; }
:slotted(.raw) { font-family: var(--mono); font-size: 0.72rem; color: var(--faint); }
</style>
