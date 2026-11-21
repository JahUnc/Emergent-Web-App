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
      ctx.beginPath();
      ctx.rect(ox + x * cell + 3 * dpr, oy + y * cell + 3 * dpr, cell - 6 * dpr, cell - 6 * dpr);
      ctx.fill();
      ctx.fillStyle = 'rgba(220,245,255,0.45)';
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
    ctx.strokeStyle = `rgba(255,197,61,${0.2 + f.relationship * 0.7})`;
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
      ctx.fillStyle = PALETTE.pregnant;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.42, 0, Math.PI * 2);
      ctx.fill();
    }
    const bw = cell * 0.42;
    const by = y + r + 8 * dpr;
    ctx.fillStyle = 'rgba(220,245,255,0.14)';
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
        <button type="button" class="play" :aria-label="playing ? 'Pause' : at >= last ? 'Replay' : 'Play'" @click="toggle">
          <svg v-if="playing" viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="3" width="3" height="10" rx="1" /><rect x="9" y="3" width="3" height="10" rx="1" /></svg>
          <svg v-else viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.2v9.6a.6.6 0 0 0 .9.5l7.6-4.8a.6.6 0 0 0 0-1L5.9 2.7a.6.6 0 0 0-.9.5Z" /></svg>
        </button>
        <button type="button" class="btn" :disabled="at >= last" @click="go(at + 1)">Next tick</button>
        <input type="range" min="0" :max="last" :value="at" aria-label="Tick" @input="go(+($event.target as HTMLInputElement).value)" />
        <span class="tick">{{ frameLabel(frame.tick) }}</span>
      </div>
    </div>
    <div class="card stack logcard">
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
.play { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; border: 1.5px solid var(--hud); background: rgba(79, 216, 255, 0.12); color: var(--hud); cursor: pointer; flex: none; box-shadow: 0 0 14px rgba(79, 216, 255, 0.35), inset 0 0 10px rgba(79, 216, 255, 0.25); transition: box-shadow 0.2s, background 0.2s; }
.play:hover { background: rgba(79, 216, 255, 0.25); box-shadow: 0 0 24px rgba(79, 216, 255, 0.6); }
.play svg { width: 15px; height: 15px; fill: currentColor; }
.tick { min-width: 7ch; }
.logcard h3 { font-family: var(--mono); font-size: 0.74rem; letter-spacing: 0.16em; color: var(--hud); }
.log { display: flex; flex-direction: column; gap: 2px; max-height: 330px; overflow: auto; font-size: 0.88rem; }
.log button { all: unset; cursor: pointer; display: grid; grid-template-columns: 6ch 1fr; gap: 12px; padding: 6px 10px; color: var(--faint); transition: background 0.2s; border-left: 2px solid transparent; }
.log button:hover { background: rgba(79, 216, 255, 0.06); }
.log button.ev { color: var(--text); }
.log button.on { background: linear-gradient(90deg, rgba(79, 216, 255, 0.16), transparent); color: var(--text); border-left-color: var(--hud); }
.log button:focus-visible { outline: 1.5px solid var(--select); }
.log b { font-family: var(--mono); font-weight: 400; font-size: 0.74rem; color: var(--muted); padding-top: 2px; text-transform: uppercase; }
.log button.on b { color: var(--hud); text-shadow: var(--hud-glow); }
</style>
