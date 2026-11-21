<script setup lang="ts">
/**
 * The entity screen: what an entity is, what it can perceive, what it can end up doing (each linked to
 * its system), and everything it keeps track of.
 */
import { computed } from 'vue';
import EntityRings from '../components/EntityRings.vue';
import { CODE, S, SYSTEM } from '../lib/catalog';
import { useRouter } from '../composables/useRouter';
import { app } from '../state/app';

const { navigate } = useRouter();

const actions = [
  { title: 'Near another entity', desc: 'Bond over shared meals, check whether a pair can have a child, and keep close family apart.', systems: ['relationships', 'mating', 'birth'], scene: true },
  { title: 'Choose where to move', desc: 'Score the 8 neighbors by food, friends and rivals, and pay to move.', systems: ['movement'] },
  { title: 'Eat', desc: 'Start eating below the hunger line and keep going until full.', systems: ['feeding'] },
  { title: 'Fight when desperate', desc: 'Attack only after starving for a while with no food in reach.', systems: ['conflict', 'grudges'] },
  { title: 'Get warm', desc: 'Head for a shelter it can see or remembers when the cold bites.', systems: ['warmth', 'shelterSeeking'] },
  { title: 'Gather and build', desc: 'Cut a full tree and carry the wood to a shelter its group owns.', systems: ['gathering'] },
  { title: 'Farm', desc: 'Work the ground to raise what a cell can grow.', systems: ['farming'] },
];

/**
 * The source files behind some systems, for the footnote on each card.
 * @param keys System keys.
 * @returns Such as "MovementSystem.cs".
 */
function filesFor(keys: readonly string[]): string {
  return [...new Set(keys.flatMap((k) => SYSTEM.get(k)?.files ?? []))].join(' · ');
}

function open(action: (typeof actions)[number]) {
  if (action.scene) {
    app.meetPanel = 0;
    navigate('near-another');
  } else {
    app.mapFocus = { kind: 'system', key: action.systems[0]!, side: 'L' };
    navigate('systems');
  }
}

const groups: [string, string[]][] = [
  ['Body', ['Energy', 'MaxEnergy', 'Age', 'MaxAge', 'Warmth', 'IsAlive']],
  ['Inherited', ['Traits', 'Sex']],
  ['Family', ['LastBirthTick', 'Pregnancy', 'IsPregnant']],
  ['Belonging', ['GroupTag']],
  ['Memory and work', ['KnownShelters', 'CarriedWood', 'WoodForShelter']],
  ['Hunger and fights', ['IsRefilling', 'IsWarming', 'TicksDesperate', 'WeakenedUntilTick', 'IsKilled']],
  ['Place', ['Id', 'X', 'Y']],
];
const members = new Map(CODE.entity.map((m) => [m.name, m]));
const stateGroups = computed(() => {
  const used = new Set(groups.flatMap(([, names]) => names));
  const list = groups.map(([title, names]) => ({ title, items: names.flatMap((n) => members.get(n) ?? []) }));
  const rest = CODE.entity.filter((m) => !used.has(m.name));
  if (rest.length) list.push({ title: 'Other', items: rest });
  return list;
});
</script>

<template>
  <section class="view stack" aria-labelledby="entity-title">
    <div class="hero">
      <div class="stack copy">
        <div class="title-block">
          <span class="eyebrow">{{ app.followedFromMap ? `Target acquired // ${app.sex.toLowerCase()} from the world map` : 'Unit profile // one entity' }}</span>
          <h1 id="entity-title" class="page-title">An entity</h1>
        </div>
        <div class="stack intro-copy">
          <p class="lede">
            An entity is one person in the world. Nothing in it says what it is for. Parent, friend, rival and group
            member are all relationships it ends up in, never types it is born as.
          </p>
          <p class="lede">
            Each tick it only reacts to what is close. It weighs food, friends and partners within
            <strong>{{ S.ForagingRange }} cell</strong> and spots shelters and trees within <strong>{{ S.SightRange }} cells</strong>.
            “Within 1” means its own cell and the 8 around it.
          </p>
        </div>
        <div class="row">
          <span class="eyebrow">Show as</span>
          <div class="toggle" role="radiogroup" aria-label="Sex shown">
            <button type="button" role="radio" class="f" :aria-checked="app.sex === 'Female'" @click="app.sex = 'Female'">female</button>
            <button type="button" role="radio" class="m" :aria-checked="app.sex === 'Male'" @click="app.sex = 'Male'">male</button>
          </div>
        </div>
      </div>
      <EntityRings :sex="app.sex" />
    </div>

    <div class="section">
      <div class="intro-split head">
        <div class="title-block">
          <span class="eyebrow">Behaviors // {{ actions.length }} systems</span>
          <h2>What happens to it next</h2>
        </div>
        <p class="lede">Each part of its life and the systems behind it. The first one has a full recorded scene; the rest open on the systems map.</p>
      </div>
      <div class="actions">
        <button v-for="a in actions" :key="a.title" type="button" class="action" :class="{ live: a.scene }" @click="open(a)">
          <span class="t">{{ a.title }}</span>
          <span class="d">{{ a.desc }}</span>
          <span class="files">{{ filesFor(a.systems) }}</span>
          <span class="go">{{ a.scene ? 'Watch the scene' : 'Open on the map' }}</span>
        </button>
      </div>
    </div>

    <div class="section">
      <div class="intro-split head">
        <div class="title-block">
          <span class="eyebrow">State // read from Entities.cs</span>
          <h2>What it keeps track of</h2>
        </div>
        <p class="lede">Everything an entity knows about itself, read from the properties and doc comments in <code>Entities.cs</code>.</p>
      </div>
      <div class="state">
        <div v-for="g in stateGroups" :key="g.title" class="g">
          <h3>{{ g.title }}</h3>
          <dl>
            <div v-for="m in g.items" :key="m.name" class="p">
              <dt><code>{{ m.name }}</code></dt>
              <dd>{{ m.doc }}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.view { padding: clamp(40px, 6vw, 80px) 0 0; gap: 34px; }
.hero { display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: 44px; align-items: center; }
@media (max-width: 920px) { .hero { grid-template-columns: 1fr; } }
.copy { gap: 20px; }
.intro-copy { gap: 12px; }
.toggle { display: inline-flex; border: 1px solid var(--line-hi); border-radius: var(--radius-sm); }
.toggle button { background: transparent; border: 0; padding: 5px 16px; cursor: pointer; font-size: 0.76rem; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); transition: background 0.25s, color 0.25s, box-shadow 0.25s; }
.toggle button + button { border-left: 1px solid var(--line); }
.toggle button.f[aria-checked='true'] { background: rgba(255, 79, 154, 0.18); color: var(--female); box-shadow: inset 0 0 12px rgba(255, 79, 154, 0.35); }
.toggle button.m[aria-checked='true'] { background: rgba(63, 140, 255, 0.18); color: var(--male); box-shadow: inset 0 0 12px rgba(63, 140, 255, 0.35); }
.section { display: flex; flex-direction: column; gap: 26px; margin-top: 56px; }
.head { align-items: end; }
.actions { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 10px; }
.action { --bk-c: transparent; --bk: 12px; text-align: left; background: var(--brackets), var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 20px; display: flex; flex-direction: column; gap: 8px; cursor: pointer; min-height: 196px; color: var(--text); transition: border-color 0.25s, box-shadow 0.25s; }
.action:hover { --bk-c: var(--hud); border-color: var(--line-hi); box-shadow: 0 0 24px rgba(79, 216, 255, 0.14); }
.action:hover .go { color: var(--hud); text-shadow: var(--hud-glow); }
/* The one card with a full recorded scene is lit gold, so it reads as the way in. */
.action.live { --bk-c: var(--select); border-color: rgba(255, 197, 61, 0.4); background: var(--brackets), linear-gradient(160deg, rgba(255, 197, 61, 0.12), transparent 60%), var(--panel); }
.action.live .go { color: var(--select); }
.t { font-weight: 600; font-size: 0.86rem; letter-spacing: 0.12em; text-transform: uppercase; line-height: 1.3; }
.d { color: var(--muted); font-size: 0.92rem; }
.files { font-family: var(--mono); font-size: 0.68rem; color: var(--faint); margin-top: auto; }
.go { font-size: 0.72rem; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); transition: color 0.2s; }
.state { display: grid; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); gap: 10px; }
.g { --bk-c: rgba(79, 216, 255, 0.5); --bk: 10px; background: var(--brackets), var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 16px 18px; }
.g h3 { font-family: var(--mono); font-size: 0.72rem; letter-spacing: 0.16em; color: var(--hud); padding-bottom: 10px; margin-bottom: 4px; border-bottom: 1px dashed var(--line-hi); }
dl { margin: 0; }
.p { font-size: 0.86rem; padding: 7px 0; }
dt code { color: var(--select); }
dd { margin: 2px 0 0; color: var(--muted); }
</style>
