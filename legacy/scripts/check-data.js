/**
 * Internal-consistency checks for the curated game data.
 * These do not verify values against the wiki — they catch the mistakes that
 * are easy to make while editing: a max level that goes backwards, a unit
 * unlocked before its building exists, a count that drops at a higher TH.
 *
 *   npm run check
 */
import { TOWN_HALLS, MAX_TH } from '../data/town-halls.js';
import { BUILDINGS, BUILDINGS_BY_ID } from '../data/buildings.js';
import { ALL_UNITS } from '../data/army.js';

const errors = [];
const warnings = [];

const fail = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

// --- town halls -------------------------------------------------------------
for (let th = 2; th <= MAX_TH; th++) {
  const a = TOWN_HALLS[th - 1];
  const b = TOWN_HALLS[th];
  if (b.cost <= a.cost) fail(`TH${th} cost (${b.cost}) is not above TH${th - 1} (${a.cost})`);
  if (b.hours < a.hours) fail(`TH${th} build time goes backwards`);
}

// --- buildings --------------------------------------------------------------
const monotonic = (arr, label) => {
  for (let th = 2; th <= MAX_TH; th++) {
    if (arr[th] < arr[th - 1]) fail(`${label} drops from TH${th - 1} (${arr[th - 1]}) to TH${th} (${arr[th]})`);
  }
};

for (const b of BUILDINGS) {
  monotonic(b.count, `${b.name} count`);
  monotonic(b.max, `${b.name} max level`);

  if (b.maxLevel !== Math.max(...b.max)) fail(`${b.name}: maxLevel out of sync`);
  if (b.levels.length !== b.maxLevel + 1) fail(`${b.name}: levels array wrong length`);

  for (let l = 2; l <= b.maxLevel; l++) {
    if (b.levels[l].cost < b.levels[l - 1].cost) {
      fail(`${b.name} lvl${l} costs less than lvl${l - 1}`);
    }
  }

  // a building can't have levels available before it can be placed
  const firstMax = b.max.findIndex((v) => v > 0);
  if (b.unlockTH > 0 && firstMax > 0 && firstMax !== b.unlockTH) {
    warn(`${b.name}: placeable at TH${b.unlockTH} but max level defined from TH${firstMax}`);
  }
}

// --- units ------------------------------------------------------------------
const requires = {
  troop: 'barracks', spell: 'spell_factory', siege: 'workshop', pet: 'pet_house',
};

for (const u of ALL_UNITS) {
  monotonic(u.max, `${u.name} max level`);
  if (u.levels.length !== u.maxLevel + 1) fail(`${u.name}: levels array wrong length`);
  for (let l = 2; l <= u.maxLevel; l++) {
    if (u.levels[l].cost < u.levels[l - 1].cost) fail(`${u.name} lvl${l} costs less than lvl${l - 1}`);
  }

  const dep = u.kind === 'troop' && u.resource === 'dark' ? 'dark_barracks'
    : u.kind === 'spell' && u.resource === 'dark' ? 'dark_spell_factory'
    : requires[u.kind];
  if (dep) {
    const host = BUILDINGS_BY_ID[dep];
    if (host && u.unlockTH < host.unlockTH) {
      fail(`${u.name} unlocks at TH${u.unlockTH} but ${host.name} only exists from TH${host.unlockTH}`);
    }
  }
}

// --- coverage report --------------------------------------------------------
const totalLevels = [...BUILDINGS, ...ALL_UNITS].reduce((n, x) => n + x.maxLevel, 0);
const estLevels = [...BUILDINGS, ...ALL_UNITS].reduce(
  (n, x) => n + x.levels.filter((l) => l && l.est).length, 0);

console.log(`Town Halls:  ${MAX_TH}`);
console.log(`Buildings:   ${BUILDINGS.length}`);
console.log(`Units:       ${ALL_UNITS.length}`);
console.log(`Levels:      ${totalLevels} (${totalLevels - estLevels} anchored, ${estLevels} interpolated — ${Math.round((estLevels / totalLevels) * 100)}%)`);

if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  for (const w of warnings) console.log('  ! ' + w);
}
if (errors.length) {
  console.log(`\n${errors.length} error(s):`);
  for (const e of errors) console.log('  x ' + e);
  process.exit(1);
}
console.log('\nAll consistency checks passed.');
