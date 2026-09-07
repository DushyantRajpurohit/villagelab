'use client';

import { useState } from 'react';
import type { VillageId } from '@/lib/game/types';
import { VillageTabs } from '@/components/VillageTabs';
import { BaseBuilder } from './BaseBuilder';

/**
 * The base builder, for whichever village you are laying out.
 *
 * Layouts, hall level and saved designs are per village, so switching here
 * swaps the whole workbench rather than re-labelling one. Keyed on the village
 * so the board, camera and undo history start clean instead of carrying the
 * other village's tiles across a palette they do not belong to.
 */
export function BaseWorkbench() {
  const [village, setVillage] = useState<VillageId>('home');

  return (
    <div className="grid gap-4">
      <VillageTabs active={village} onSelect={setVillage} tabs={[{ id: 'home' }, { id: 'builder' }]} />
      <BaseBuilder key={village} village={village} />
    </div>
  );
}
