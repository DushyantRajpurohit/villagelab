import { describe, expect, it } from 'vitest';
import { packUnits, unpackUnits } from '../units';
import { mockPlayer } from '../mock';
import { analyseEquipment } from '../../game/progress';

describe('the players.units column', () => {
  it('round-trips hero equipment, so an ingested player keeps what they own', () => {
    const p = mockPlayer('#2PP0JCVL9');
    const stored = { ...p, ...unpackUnits(packUnits(p)) };

    expect(stored.heroEquipment).toEqual(p.heroEquipment);
    expect(analyseEquipment(stored)).toEqual(analyseEquipment(p));
  });

  it('round-trips every level list', () => {
    const p = mockPlayer('#9LQ2GRUV');
    const u = unpackUnits(packUnits(p));
    expect(u.troops).toEqual(p.troops);
    expect(u.spells).toEqual(p.spells);
    expect(u.heroes).toEqual(p.heroes);
  });

  it('reads a row written before equipment was stored', () => {
    const legacy = JSON.stringify({ troops: [], spells: [], heroes: [{ name: 'Barbarian King', level: 40 }] });
    const u = unpackUnits(legacy);
    expect(u.heroes).toHaveLength(1);
    expect(u.heroEquipment).toBeUndefined();
  });
});
