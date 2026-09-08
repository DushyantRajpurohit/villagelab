import Image from 'next/image';
import type { Resource } from '@/lib/game/types';
import { unitSpriteUrl, type Village } from '@/lib/sprites';
import { fmtDuration } from '@/lib/format';
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

export function HeroRoster({ heroes, hall, village = 'home', hallShort = 'TH' }: {
  heroes: HeroCardData[];
  /** The hall level these heroes are measured against. */
  hall: number;
  village?: Village;
  /** "TH" or "BH", for the rushed hero's explanation. */
  hallShort?: string;
}) {
  if (!heroes.length) return null;

  return (
    <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 xl:grid-cols-5">
      {heroes.map((h, i) => (
        <HeroCard key={h.id} hero={h} village={village} hall={hall} hallShort={hallShort} index={i} />
      ))}
    </div>
  );
}

function HeroCard({ hero: h, village, hall, hallShort, index }: {
  hero: HeroCardData; village: Village; hall: number; hallShort: string; index: number;
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
    </div>
  );
}
