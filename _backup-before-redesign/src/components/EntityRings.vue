<script setup lang="ts">
/**
 * One entity and what it can perceive: the cells it weighs for food, friends and partners (its reach)
 * and the wider square in which it spots shelters and trees (its sight). Distances are counted like a
 * king in chess, so both areas are squares.
 */
import { useTemplateRef, watch } from 'vue';
import { useAnimationLoop } from '../composables/useAnimationLoop';
import { useCanvas } from '../composables/useCanvas';
import { useReducedMotion } from '../composables/useReducedMotion';
import { S } from '../lib/catalog';
import { drawGlow, PALETTE } from '../lib/render';

const props = defineProps<{ sex: 'Female' | 'Male' }>();
const canvas = useTemplateRef<HTMLCanvasElement>('canvas-el');
const host = useTemplateRef<HTMLElement>('host-el');
const reduceMotion = useReducedMotion();
const { context, size } = useCanvas(canvas, () => loop.drawOnce());
const sight = S.SightRange!;
const reach = S.ForagingRange!;

function draw(now: number) {
  const ctx = context.value;
  const { width: W, height: H, dpr } = size.value;
  if (!ctx || !W) return;
  const n = sight * 2 + 1;
  const cell = Math.min(W, H) / (n + 1.4);
  const cx = W / 2;
  const cy = H / 2 + cell * 0.2;
  const color = props.sex === 'Female' ? PALETTE.female : PALETTE.male;
  ctx.clearRect(0, 0, W, H);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const dx = i - sight;
      const dy = j - sight;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      const wave = reduceMotion.value ? 0 : 0.05 * Math.sin(now / 700 - d * 0.9);
      ctx.fillStyle = d <= reach ? `rgba(45,122,104,${0.42 + wave})` : `rgba(45,122,104,${0.12 + wave * 0.6})`;
      ctx.fillRect(cx + (dx - 0.5) * cell + 2 * dpr, cy + (dy - 0.5) * cell + 2 * dpr, cell - 4 * dpr, cell - 4 * dpr);
    }
  }

  ctx.lineWidth = 2 * dpr;
  ctx.setLineDash([8 * dpr, 7 * dpr]);
  ctx.strokeStyle = 'rgba(217,178,106,0.8)';
  ctx.strokeRect(cx - (sight + 0.5) * cell, cy - (sight + 0.5) * cell, n * cell, n * cell);
  ctx.setLineDash([]);
  ctx.strokeStyle = color;
  ctx.strokeRect(cx - (reach + 0.5) * cell, cy - (reach + 0.5) * cell, (2 * reach + 1) * cell, (2 * reach + 1) * cell);

  const pulse = reduceMotion.value ? 0 : Math.sin(now / 600) * 0.03;
  drawGlow(ctx, cx, cy, cell * (0.26 + pulse), color);

  ctx.font = `${Math.round(cell * 0.2)}px "IBM Plex Sans", sans-serif`;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(`reach ${reach}: food, friends, partners`, cx - (reach + 0.5) * cell, cy - (reach + 0.5) * cell - 8 * dpr);
  ctx.fillStyle = PALETTE.shelter;
  ctx.fillText(`sight ${sight}: shelters, trees`, cx - (sight + 0.5) * cell, cy - (sight + 0.5) * cell - 8 * dpr);
}

const loop = useAnimationLoop(host, draw);
watch(() => props.sex, () => loop.drawOnce());
</script>

<template>
  <div ref="host-el" class="stage rings">
    <canvas ref="canvas-el" role="img" :aria-label="`One ${sex.toLowerCase()} entity. It weighs food, friends and partners within ${reach} cell and spots shelters and trees within ${sight} cells.`" />
  </div>
</template>

<style scoped>
.rings { view-transition-name: entity-stage; }
canvas { aspect-ratio: 9 / 6.6; }
</style>
