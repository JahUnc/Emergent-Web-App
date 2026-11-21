<script setup lang="ts">
/**
 * The "near another entity" screen: a recorded meeting of two founders, then each part of what happened
 * (bonding, the conception checks, family rules, birth) with the systems and code behind it.
 */
import { useTemplateRef } from 'vue';
import MeetingStage from '../components/MeetingStage.vue';
import { useAsyncData } from '../composables/useAsyncData';
import { app } from '../state/app';
import type { MeetingData } from '../types/data';
import BirthPanel from './meeting/BirthPanel.vue';
import BondPanel from './meeting/BondPanel.vue';
import ConceptionPanel from './meeting/ConceptionPanel.vue';
import FamilyPanel from './meeting/FamilyPanel.vue';

const meeting = useAsyncData<MeetingData>(() => import('../data/meeting.json'));
const tabs = ['Bond', 'Can they have a child?', 'Family rules', 'Pregnancy and birth'];
const tabButtons = useTemplateRef<HTMLButtonElement[]>('tab-el');

/** Arrow keys move between tabs, as in any tab list. */
function onKey(e: KeyboardEvent) {
  const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
  if (!step) return;
  e.preventDefault();
  app.meetPanel = (app.meetPanel + step + tabs.length) % tabs.length;
  tabButtons.value?.[app.meetPanel]?.focus();
}
</script>

<template>
  <section class="view stack" aria-labelledby="meet-title">
    <div class="intro-split">
      <div class="title-block">
        <span class="eyebrow">Recorded encounter // seed {{ meeting?.seed ?? '...' }}</span>
        <h1 id="meet-title" class="page-title">When two entities are near each other</h1>
      </div>
      <p v-if="meeting" class="lede">
        Two founders, a female aged {{ meeting.frames[0]!.entities[0]!.age }} and a male aged
        {{ meeting.frames[0]!.entities[1]!.age }}, start two cells apart on a small patch of land. Play the recording to
        watch them bond, try for a child, and raise one. Below it, each part of what happened is broken out with the
        systems behind it.
      </p>
    </div>

    <MeetingStage v-if="meeting" :meeting="meeting" />
    <div v-else class="stage skeleton" aria-busy="true">Loading the recording</div>

    <div class="stack parts">
      <!-- The four parts happen in this order in the recording, so they are numbered. -->
      <div class="tabs" role="tablist" aria-label="Parts of the scene" @keydown="onKey">
        <button
          v-for="(t, i) in tabs"
          :key="t"
          ref="tab-el"
          type="button"
          role="tab"
          :aria-selected="i === app.meetPanel"
          :tabindex="i === app.meetPanel ? 0 : -1"
          @click="app.meetPanel = i"
        ><span class="n">0{{ i + 1 }}</span>{{ t }}</button>
      </div>
      <Transition name="panel" mode="out-in">
        <BondPanel v-if="app.meetPanel === 0" :meeting="meeting" role="tabpanel" />
        <ConceptionPanel v-else-if="app.meetPanel === 1" role="tabpanel" />
        <FamilyPanel v-else-if="app.meetPanel === 2" role="tabpanel" />
        <BirthPanel v-else :meeting="meeting" role="tabpanel" />
      </Transition>
    </div>
  </section>
</template>

<style scoped>
.view { padding: clamp(40px, 6vw, 80px) 0 0; gap: 32px; }
.skeleton { aspect-ratio: 2 / 1; display: grid; place-items: center; color: var(--hud); font-family: var(--mono); font-size: 0.78rem; letter-spacing: 0.2em; text-transform: uppercase; }
.parts { margin-top: 40px; gap: 28px; }
.tabs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.tabs button { --bk-c: transparent; --bk: 10px; position: relative; display: flex; align-items: center; gap: 12px; text-align: left; background: var(--brackets), var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 12px 14px; cursor: pointer; color: var(--muted); font-weight: 600; font-size: 0.78rem; letter-spacing: 0.12em; text-transform: uppercase; line-height: 1.3; transition: color 0.2s, border-color 0.2s, box-shadow 0.2s; }
.tabs button:hover { color: var(--text); border-color: var(--line-hi); }
.tabs button[aria-selected='true'] { --bk-c: var(--select); color: var(--select); border-color: rgba(255, 197, 61, 0.45); box-shadow: 0 0 24px rgba(255, 197, 61, 0.15); text-shadow: 0 0 10px rgba(255, 197, 61, 0.45); }
.n { display: grid; place-items: center; flex: none; width: 30px; height: 30px; border: 1px solid var(--line-hi); font-family: var(--mono); font-size: 0.78rem; letter-spacing: 0; transition: background 0.25s, border-color 0.25s, color 0.25s; }
.tabs button[aria-selected='true'] .n { background: rgba(255, 197, 61, 0.16); border-color: var(--select); color: var(--select); }
@media (max-width: 760px) { .tabs { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.panel-enter-active, .panel-leave-active { transition: opacity 0.25s, transform 0.3s var(--ease), filter 0.25s; }
.panel-enter-from { opacity: 0; transform: translateY(8px); filter: blur(3px); }
.panel-leave-to { opacity: 0; filter: blur(3px); }
</style>
