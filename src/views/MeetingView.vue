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
const tabs = ['1 · Bond', '2 · Can they have a child?', '3 · Family rules', '4 · Pregnancy and birth'];
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
    <div class="stack intro">
      <span class="eyebrow">Social phase · Relationships, Mating, Birth</span>
      <h1 id="meet-title" class="page-title">When two entities are near each other</h1>
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
        >{{ t }}</button>
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
.view { padding: 28px 0 0; gap: 18px; }
.intro { gap: 8px; }
.page-title { view-transition-name: page-title; }
.skeleton { aspect-ratio: 2 / 1; display: grid; place-items: center; color: var(--muted); font-family: var(--mono); font-size: 0.8rem; }
.parts { margin-top: 14px; }
.tabs { display: flex; gap: 8px; flex-wrap: wrap; border-bottom: 1px solid var(--line); padding-bottom: 12px; }
.tabs button { background: transparent; border: 1px solid var(--line); border-radius: 999px; padding: 6px 14px; cursor: pointer; color: var(--muted); font-family: var(--display); font-weight: 600; transition: color 0.2s, border-color 0.2s; }
.tabs button:hover { color: var(--text); }
.tabs button[aria-selected='true'] { color: var(--text); border-color: var(--female); background: #1d1530; }
.panel-enter-active, .panel-leave-active { transition: opacity 0.2s, transform 0.2s; }
.panel-enter-from { opacity: 0; transform: translateY(8px); }
.panel-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
