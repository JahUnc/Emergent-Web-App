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
      ctx.fillStyle = d <= reach ? `rgba(79,216,255,${0.42 + wave})` : `rgba(79,216,255,${0.1 + wave * 0.6})`;
      ctx.beginPath();
      ctx.rect(cx + (dx - 0.5) * cell + 3 * dpr, cy + (dy - 0.5) * cell + 3 * dpr, cell - 6 * dpr, cell - 6 * dpr);
      ctx.fill();
    }
  }

  ctx.lineWidth = 2 * dpr;
  ctx.setLineDash([8 * dpr, 7 * dpr]);
  ctx.strokeStyle = 'rgba(255,197,61,0.85)';
  ctx.strokeRect(cx - (sight + 0.5) * cell, cy - (sight + 0.5) * cell, n * cell, n * cell);
  ctx.setLineDash([]);
  ctx.strokeStyle = color;
  ctx.strokeRect(cx - (reach + 0.5) * cell, cy - (reach + 0.5) * cell, (2 * reach + 1) * cell, (2 * reach + 1) * cell);

  const pulse = reduceMotion.value ? 0 : Math.sin(now / 600) * 0.03;
  // A radar sweep turning around the entity, the way it "looks" at the cells around it each tick.
  if (!reduceMotion.value) {
    const angle = (now / 1400) % (Math.PI * 2);
    const sweep = cell * (sight + 0.5);
    const cone = ctx.createConicGradient(angle - 0.9, cx, cy);
    cone.addColorStop(0, 'rgba(79,216,255,0)');
    cone.addColorStop(0.14, 'rgba(79,216,255,0.16)');
    cone.addColorStop(0.145, 'rgba(79,216,255,0)');
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - sweep, cy - sweep, sweep * 2, sweep * 2);
    ctx.clip();
    ctx.fillStyle = cone;
    ctx.fillRect(cx - sweep, cy - sweep, sweep * 2, sweep * 2);
    ctx.restore();
  }
  for (const [ring, alpha] of [[0.55, 0.5], [0.85, 0.25]] as const) {
    ctx.strokeStyle = `rgba(79,216,255,${alpha})`;
    ctx.lineWidth = 1 * dpr;
    ctx.beginPath();
    ctx.arc(cx, cy, cell * ring, 0, Math.PI * 2);
    ctx.stroke();
  }
  drawGlow(ctx, cx, cy, cell * (0.24 + pulse), color);

  ctx.font = `500 ${Math.round(cell * 0.17)}px "JetBrains Mono", monospace`;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(`REACH ${reach} // FOOD, FRIENDS, PARTNERS`, cx - (reach + 0.5) * cell, cy - (reach + 0.5) * cell - 8 * dpr);
  ctx.fillStyle = PALETTE.shelter;
  ctx.fillText(`SIGHT ${sight} // SHELTERS, TREES`, cx - (sight + 0.5) * cell, cy - (sight + 0.5) * cell - 8 * dpr);
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
