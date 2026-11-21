<script setup lang="ts">
/**
 * Plays back the recorded meeting of two founders, tick by tick, with a scrubber and a running log of
 * what happened. Between ticks, positions and food slide smoothly so movement is easy to follow.
 */
import { computed, ref, useTemplateRef, watch } from 'vue';
import type { MeetingData, MeetingEntity, MeetingFrame } from '../types/data';
import { useAnimationLoop } from '../composables/useAnimationLoop';
import { useCanvas } from '../composables/useCanvas';
import { useReducedMotion } from '../composables/useReducedMotion';
import { S } from '../lib/catalog';
import { drawGlow, easeInOut, foodColor, lerp, PALETTE, spreadInCells } from '../lib/render';
import { frameLabel, percent } from '../lib/text';

const props = defineProps<{ meeting: MeetingData }>();
const STEP_MS = 900;
const canvas = useTemplateRef<HTMLCanvasElement>('canvas-el');
const host = useTemplateRef<HTMLElement>('host-el');
const logBox = useTemplateRef<HTMLElement>('log-el');
const reduceMotion = useReducedMotion();
const { context, size } = useCanvas(canvas, () => loop.drawOnce());

const frames = props.meeting.frames;
const last = frames.length - 1;
const at = ref(0);
const playing = ref(false);
let stepStart = 0;
let tween = 0;

const byId = (f: MeetingFrame, id: number) => f.entities.find((e) => e.id === id);

/**
 * Describes what changed between one frame and the one before it. This only reads the recording.
 * @param i The frame index.
 * @returns The events, or "moved and ate" when nothing else happened.
 */
function eventsAt(i: number): { text: string; notable: boolean } {
  const f = frames[i]!;
  if (i === 0) return { text: `Start: both at ${f.entities[0]!.energy} of 10 energy, not related, never had a child.`, notable: true };
  const p = frames[i - 1]!;
  const out: string[] = [];
  const d = f.relationship - p.relationship;
  if (Math.abs(d) > 1e-6) out.push(`relationship ${d > 0 ? 'rose' : 'fell'} to ${f.relationship.toFixed(3)}`);
  for (const e of f.entities) {
    const before = byId(p, e.id);
    if (!before) out.push(`a ${e.sex.toLowerCase()} child (#${e.id}) is born with ${e.energy} energy`);
    else if (e.pregnant && !before.pregnant) out.push(`#${e.id} is pregnant, due tick ${e.dueTick}; both paid ${S.ReproductionCost} energy`);
  }
  if (props.meeting.missedAt === f.tick) out.push(`side by side and both able to mate, but the ${percent(S.ConceptionChance!)} percent roll missed`);
  const notable = out.some((t) => !t.startsWith('relationship'));
  return { text: out.length ? out.join('; ') : 'moved and ate', notable };
}
const log = frames.map((f, i) => ({ label: frameLabel(f.tick), ...eventsAt(i) }));
const frame = computed(() => frames[at.value]!);

function draw(now: number) {
  const ctx = context.value;
  const { width: W, height: H, dpr } = size.value;
  if (!ctx || !W) return;

  if (playing.value) {
    const k = Math.min(1, (now - stepStart) / STEP_MS);
    tween = reduceMotion.value ? 0 : easeInOut(k);
    if (k >= 1) {
      at.value++;
      stepStart = now;
      tween = 0;
      if (at.value >= last) { at.value = last; playing.value = false; }
    }
  }

  const { width: gw, height: gh, capacity } = props.meeting;
  const cell = Math.min(W / gw, (H - 20 * dpr) / gh);
  const ox = (W - cell * gw) / 2;
  const oy = (H - cell * gh) / 2 + 8 * dpr;
  const f = frames[at.value]!;
  const n = frames[Math.min(last, at.value + 1)]!;
  ctx.clearRect(0, 0, W, H);

  ctx.textAlign = 'right';
  ctx.font = `${Math.round(cell * 0.12)}px "JetBrains Mono", monospace`;
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const i = y * gw + x;
      const food = lerp(f.food[i]!, n.food[i]!, tween);
      ctx.fillStyle = foodColor(food);
      ctx.fillRect(ox + x * cell + 2 * dpr, oy + y * cell + 2 * dpr, cell - 4 * dpr, cell - 4 * dpr);
      ctx.fillStyle = 'rgba(221,228,243,0.35)';
      ctx.fillText(`${food.toFixed(1)}/${capacity[i]}`, ox + (x + 1) * cell - 8 * dpr, oy + (y + 1) * cell - 8 * dpr);
    }
  }

  const offsetsNow = spreadInCells(f.entities, (e) => [e.x, e.y]);
  const offsetsNext = spreadInCells(n.entities, (e) => [e.x, e.y]);
  const place = (e: MeetingEntity) => {
    const [ax, ay] = offsetsNow.get(e)!;
    let x = e.x + 0.5 + ax * 1.3;
    let y = e.y + 0.5 + ay * 1.3;
    const m = byId(n, e.id);
    if (m && tween > 0) {
      const [bx, by] = offsetsNext.get(m)!;
      x = lerp(x, m.x + 0.5 + bx * 1.3, tween);
      y = lerp(y, m.y + 0.5 + by * 1.3, tween);
    }
    return { e, x: ox + x * cell, y: oy + y * cell };
  };
  const placed = f.entities.map(place);

  const a = placed.find((p) => p.e.id === 1);
  const b = placed.find((p) => p.e.id === 2);
  if (a && b && f.relationship > 0) {
    ctx.strokeStyle = `rgba(255,255,255,${0.15 + f.relationship * 0.7})`;
    ctx.lineWidth = (1 + f.relationship * 6) * dpr;
    ctx.setLineDash([3 * dpr, 5 * dpr]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.textAlign = 'center';
  for (const { e, x, y } of placed) {
    const child = e.age < S.MaturityAge!;
    const r = cell * (child ? 0.1 : 0.16);
    drawGlow(ctx, x, y, r, e.sex === 'Female' ? PALETTE.female : PALETTE.male);
    if (e.pregnant) {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x, y, r * 0.42, 0, Math.PI * 2);
      ctx.fill();
    }
    const bw = cell * 0.42;
    const by = y + r + 8 * dpr;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x - bw / 2, by, bw, 5 * dpr);
    ctx.fillStyle = e.energy < S.HungerThreshold! * 10 ? PALETTE.warn : PALETTE.ok;
    ctx.fillRect(x - bw / 2, by, bw * Math.min(1, e.energy / 10), 5 * dpr);
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(`#${e.id} ${e.energy.toFixed(1)}`, x, by + 18 * dpr);
  }
}

const loop = useAnimationLoop(host, draw);

function go(i: number) {
  playing.value = false;
  tween = 0;
  at.value = Math.max(0, Math.min(last, i));
  loop.drawOnce();
}
function toggle() {
  if (playing.value) { playing.value = false; tween = 0; loop.drawOnce(); return; }
  if (at.value >= last) at.value = 0;
  stepStart = performance.now();
  playing.value = true;
}

watch(at, () => {
  const box = logBox.value;
  const row = box?.children[at.value] as HTMLElement | undefined;
  if (box && row) box.scrollTop = Math.max(0, row.offsetTop - box.offsetTop - box.clientHeight / 2);
}, { flush: 'post' });
</script>

<template>
  <div class="grid-2">
    <div ref="host-el" class="stage">
      <canvas ref="canvas-el" role="img" :aria-label="`Recorded meeting at ${frameLabel(frame.tick)}: ${log[at]!.text}`" />
      <div class="hud"><span>seed <b>{{ meeting.seed }}</b></span><span>relationship <b>{{ frame.relationship.toFixed(3) }}</b></span></div>
      <div class="transport">
        <button type="button" @click="toggle">{{ playing ? 'Pause' : at >= last ? 'Replay' : 'Play' }}</button>
        <button type="button" :disabled="at >= last" @click="go(at + 1)">Next tick</button>
        <input type="range" min="0" :max="last" :value="at" aria-label="Tick" @input="go(+($event.target as HTMLInputElement).value)" />
        <span class="tick">{{ frameLabel(frame.tick) }}</span>
      </div>
    </div>
    <div class="card stack">
      <h3>What happened, tick by tick</h3>
      <div ref="log-el" class="log">
        <button v-for="(row, i) in log" :key="i" type="button" :class="{ on: i === at, ev: row.notable }" @click="go(i)">
          <b>{{ row.label }}</b><span>{{ row.text }}</span>
        </button>
      </div>
      <p class="small">Energy is shown under each dot. A white dot means pregnant. Every value was recorded from the real <code>Simulation</code>.</p>
    </div>
  </div>
</template>

<style scoped>
canvas { aspect-ratio: 980 / 600; }
.transport { display: flex; gap: 10px; align-items: center; padding: 10px 14px; border-top: 1px solid var(--line); background: rgba(10, 15, 29, 0.9); flex-wrap: wrap; }
.transport button { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 4px 12px; cursor: pointer; }
.transport button:disabled { opacity: 0.4; cursor: default; }
input[type='range'] { flex: 1; min-width: 160px; accent-color: var(--female); }
.tick { font-family: var(--mono); font-size: 0.8rem; min-width: 7ch; }
.log { display: flex; flex-direction: column; gap: 2px; max-height: 300px; overflow: auto; font-size: 0.86rem; }
.log button { all: unset; cursor: pointer; display: grid; grid-template-columns: 6ch 1fr; gap: 10px; padding: 4px 8px; border-radius: 6px; color: var(--muted); }
.log button.ev { color: var(--text); }
.log button.on { background: var(--panel-hi); color: var(--text); }
.log button:focus-visible { outline: 2px solid var(--male); }
.log b { font-family: var(--mono); font-weight: 600; font-size: 0.76rem; color: var(--muted); }
</style>
