'use client';

import { useState } from 'react';
import { BUILDINGS } from '@/lib/game/buildings';
import { ALL_UNITS } from '@/lib/game/army';
import { MAX_TH } from '@/lib/game/town-halls';
import { BUILDER_BUILDINGS, BUILDER_UNITS, MAX_BH } from '@/lib/game/builder-base';
import type { VillageId } from '@/lib/store';
import { VillageTabs } from '@/components/VillageTabs';
import { VillagePlanner, type PlannerConfig } from './VillagePlanner';

/**
 * One planner, two villages.
 *
 * The switch is in place rather than a route because this is a tool rather than
 * a document: you flip to the other village to compare a queue, and a page load
 * would lose the scroll position and the filter you had set. The two villages
 * still share nothing — separate state slices, separate currencies, separate
 * queues — so nothing carries across the switch except the fact you flipped it.
 */

const HOME: PlannerConfig = {
  village: 'home',
  sprites: 'home',
  hallName: 'Town Hall',
  hallShort: 'TH',
  maxHall: MAX_TH,
  maxBuilders: 6,
  buildersLabel: 'Builders',
  labName: 'Laboratory',
  buildings: BUILDINGS,
  units: ALL_UNITS,
  resources: ['gold', 'elixir', 'dark'],
  resourceLabel: { gold: 'Gold', elixir: 'Elixir', dark: 'Dark elixir' },
  storageId: { gold: 'gold_storage', elixir: 'elixir_storage', dark: 'dark_storage' },
  categories: ['all', 'defense', 'trap', 'resource', 'army', 'wall', 'hero', 'troop', 'spell', 'siege', 'pet'],
  categoryLabel: {
    all: 'Everything', defense: 'Defenses', trap: 'Traps', resource: 'Resources',
    army: 'Army buildings', wall: 'Walls', hero: 'Heroes', troop: 'Troops',
    spell: 'Spells', siege: 'Sieges', pet: 'Pets',
  },
  heroKinds: ['hero', 'pet'],
};

const BUILDER: PlannerConfig = {
  village: 'builder',
  sprites: 'builder',
  hallName: 'Builder Hall',
  hallShort: 'BH',
  maxHall: MAX_BH,
  // The Master Builder, and O.T.T.O once the B.O.B Control is finished at BH9.
  maxBuilders: 2,
  buildersLabel: 'Builders',
  labName: 'Star Laboratory',
  buildings: BUILDER_BUILDINGS,
  units: BUILDER_UNITS,
  // Builder Gold and Builder Elixir. There is no dark elixir in this village.
  resources: ['gold', 'elixir'],
  resourceLabel: { gold: 'Builder gold', elixir: 'Builder elixir' },
  storageId: { gold: 'gold_storage', elixir: 'elixir_storage' },
  categories: ['all', 'defense', 'trap', 'resource', 'army', 'wall', 'troop', 'hero'],
  categoryLabel: {
    all: 'Everything', defense: 'Defenses', trap: 'Traps', resource: 'Resources',
    army: 'Army buildings', wall: 'Walls', troop: 'Troops', hero: 'Heroes',
  },
  heroKinds: ['hero'],
  note: 'Every cost and time in both villages is a published value, read from that '
    + 'structure’s or unit’s own table. Nothing here is interpolated.',
};

const CONFIG: Record<VillageId, PlannerConfig> = { home: HOME, builder: BUILDER };

export function PlannerApp() {
  const [village, setVillage] = useState<VillageId>('home');

  return (
    <div className="grid gap-4">
      <VillageTabs
        active={village}
        onSelect={setVillage}
        tabs={[{ id: 'home' }, { id: 'builder' }]}
      />
      {/* Keyed so switching villages remounts rather than carrying the other
          village's category filter across. */}
      <VillagePlanner key={village} config={CONFIG[village]} />
    </div>
  );
}
