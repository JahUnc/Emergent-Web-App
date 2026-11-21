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
.verdict { --bk-c: var(--hud); --bk: 10px; border-radius: var(--radius); padding: 16px 18px; border: 1px solid var(--line-hi); background: var(--brackets), var(--panel); display: flex; flex-direction: column; gap: 6px; }
.big { font-family: var(--display); font-size: 1.02rem; text-transform: uppercase; letter-spacing: 0.04em; line-height: 1.3; color: var(--hud); text-shadow: var(--hud-glow); }
.yes { --bk-c: var(--good); border-color: rgba(61, 255, 180, 0.4); background: var(--brackets), linear-gradient(90deg, rgba(61, 255, 180, 0.08), transparent 70%), var(--panel); }
.yes .big { color: var(--good); text-shadow: 0 0 12px rgba(61, 255, 180, 0.6); }
.no { --bk-c: var(--bad); border-color: rgba(255, 59, 79, 0.45); background: var(--brackets), linear-gradient(90deg, rgba(255, 59, 79, 0.1), transparent 70%), var(--panel); }
.no .big { color: var(--bad); text-shadow: 0 0 12px rgba(255, 59, 79, 0.6); }
.half { --bk-c: var(--select); border-color: rgba(255, 197, 61, 0.45); background: var(--brackets), linear-gradient(90deg, rgba(255, 197, 61, 0.08), transparent 70%), var(--panel); }
.half .big { color: var(--select); text-shadow: 0 0 12px rgba(255, 197, 61, 0.6); }
:slotted(p) { color: var(--muted); font-size: 0.95rem; }
:slotted(.raw) { font-family: var(--mono); font-size: 0.7rem; color: var(--faint); }
</style>
