import Image from 'next/image';
import type { Resource } from '@/lib/game/types';
import { unitSpriteUrl, type Village } from '@/lib/sprites';
import { fmtDuration } from '@/lib/format';
import { EquipmentIcon } from './GameIcon';
import { Bar, Res, pctTone } from './primitives';

/**
 * Heroes, laid out the way the game's own Hero Hall lays them out.
 *
 * There are five heroes in the home village and two in the Builder Base, and
 * each is a character rather than a data point — a table row reduced them to
 * the least interesting thing about them and gave a 26px portrait to a figure
 * the game draws at full height. So they stand in lit niches, at a size where
 * you recognise the Archer Queen without reading her name, with the level on a
 * badge at their feet where the game puts it.
 *
 * Everything the table showed is still here — level against the ceiling,
 * progress, cost and time to max, rushed and locked — because this is how the
 * same facts are presented, not fewer of them.
 *
 * Under each home-village hero is its gear tray: every piece of equipment the
 * Town Hall allows that hero, at the level the account has it. The Builder Base
 * has no equipment, so its two heroes simply get no tray.
 */

export interface HeroCardData {
  id: string;
  name: string;
  level: number;
  /** The ceiling at this hall. */
  maxHere: number;
  pct: number;
  rushed: boolean;
  /** False when the account has never unlocked this hero. */
  found: boolean;
  remainingCost: number;
  remainingHours: number;
  resource: Resource;
  /** Kept for the "≈"; no hero cost is an estimate in either village today. */
  est?: boolean;
  /** The previous hall's ceiling — what "rushed" is measured against. */
  prevMax?: number;
}

/** One slot in a hero's gear tray. */
export interface HeroGear {
  id: string;
  name: string;
  rarity: 'common' | 'epic';
  level: number;
  maxHere: number;
  /** False when the account has never obtained this item. */
  found: boolean;
}

export function HeroRoster({ heroes, hall, village = 'home', hallShort = 'TH', gear }: {
  heroes: HeroCardData[];
  /** The hall level these heroes are measured against. */
  hall: number;
  village?: Village;
  /** "TH" or "BH", for the rushed hero's explanation. */
  hallShort?: string;
  /** Equipment for each hero, keyed by hero id. Absent in the Builder Base. */
  gear?: Record<string, HeroGear[]>;
}) {
  if (!heroes.length) return null;

  return (
    <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 xl:grid-cols-5">
      {heroes.map((h, i) => (
        <HeroCard
          key={h.id} hero={h} village={village} hall={hall}
          hallShort={hallShort} index={i} gear={gear?.[h.id]}
        />
      ))}
    </div>
  );
}

function HeroCard({ hero: h, village, hall, hallShort, index, gear }: {
  hero: HeroCardData; village: Village; hall: number; hallShort: string;
  index: number; gear?: HeroGear[];
}) {
  const url = unitSpriteUrl(h.id, village);
  const maxed = h.found && h.level >= h.maxHere;
  const tone = !h.found ? 'locked' : h.rushed ? 'bad' : maxed ? 'max' : 'gold';

  const status = !h.found
    ? `Not unlocked — the ${village === 'builder' ? 'altar' : 'hall'} for this hero is not built yet`
    : h.rushed
      ? `Behind the ${hallShort}${hall - 1} ceiling of ${h.prevMax}`
      : undefined;

  return (
    <div className="hero-card flex flex-col gap-2">
      <div
        className="hero-alcove h-[136px] px-3 pt-2 pb-3"
        data-locked={!h.found}
        title={status}
      >
        {url ? (
          /*
           * `fill` with object-bottom, not a fixed height: the portraits are
           * all 128 wide but run from 115 to 180 tall — the Archer Queen is
           * half again the Royal Champion — so a single forced height either
           * letterboxes the tall ones or stretches the short ones. Contained
           * and bottom-aligned, each keeps its own stature and they all stand
           * on the same floor line, which is what the hall actually looks like.
           */
          <div className="hero-stage relative h-full w-full">
            <Image
              src={url}
              alt=""
              fill
              sizes="180px"
              className="hero-figure object-contain object-bottom drop-shadow-[0_6px_8px_rgba(0,0,0,.45)]"
              /* Each hero idles out of phase with its neighbours — in step,
                 five figures breathing together read as one machine. */
              style={{ ['--idle-delay' as string]: `${(index * 0.37).toFixed(2)}s` }}
            />
          </div>
        ) : (
          <span aria-hidden className="block h-full w-full rounded bg-panel-3" />
        )}
      </div>

      {/*
        * The badge straddles the alcove's floor line, so it is pulled up over
        * the seam — and it needs its own stacking context to do that. The
        * alcove is `position: relative`, which paints it above every static
        * sibling regardless of DOM order, so without `relative z-[2]` here the
        * alcove and its floor gradient cover the top of the badge and clip the
        * level number.
        */}
      <div className="relative z-[2] -mt-5 flex justify-center">
        <span
          className="hero-badge min-w-[2.4rem] px-2 py-0.5 text-center text-[15px] leading-[1.35]"
          data-tone={tone}
          title={h.found ? `Level ${h.level} of ${h.maxHere}` : 'Not unlocked'}
        >
          {h.found ? h.level : '—'}
        </span>
      </div>

      <div className="text-center">
        <div className={`display text-[13px] leading-tight ${maxed ? 'text-ok' : 'text-text'}`}>
          {h.name}
        </div>
        <div className="num mt-0.5 text-[11px] text-muted">
          {h.found ? <>{h.level} <span className="text-faint">/ {h.maxHere}</span></> : 'locked'}
          {h.rushed && <span className="ml-1.5 font-bold text-bad">rushed</span>}
        </div>
      </div>

      <Bar pct={h.pct} tone={h.found ? pctTone(h.pct) : 'bad'} />

      <div className="flex items-baseline justify-between gap-1 text-[11px]">
        {h.remainingCost > 0
          ? <Res amount={h.remainingCost} kind={h.resource} est={h.est} village={village} />
          : <span className="text-ok">maxed</span>}
        <span className="num text-faint">
          {h.remainingHours > 0 ? fmtDuration(h.remainingHours) : ''}
        </span>
      </div>

      {gear && gear.length > 0 && <GearTray gear={gear} />}
    </div>
  );
}

/**
 * The hero's equipment, in the order the dataset keeps it: commons first, then
 * epics. Not sorted by level — the tray is a fixed set of slots in the game and
 * reordering it every time a level changes would make it unreadable at a
 * glance across five heroes.
 */
function GearTray({ gear }: { gear: HeroGear[] }) {
  return (
    <div className="flex flex-wrap justify-center gap-x-[7px] gap-y-2 pt-0.5">
      {gear.map((g) => {
        const maxed = g.found && g.level >= g.maxHere;
        return (
          <span
            key={g.id}
            className="gear-slot h-[30px] w-[30px]"
            data-owned={g.found}
            data-rarity={g.rarity}
            title={g.found
              ? `${g.name} — level ${g.level} of ${g.maxHere}`
              : `${g.name} — not obtained (${g.rarity})`}
          >
            <EquipmentIcon id={g.id} size={24} />
            {g.found && (
              <span className="gear-level" data-tone={maxed ? 'max' : undefined}>{g.level}</span>
            )}
          </span>
        );
      })}
    </div>
  );
}
