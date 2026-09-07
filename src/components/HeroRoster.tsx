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
  /** Home village costs can be interpolated; Builder Base ones never are. */
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
      {heroes.map((h) => (
        <HeroCard key={h.id} hero={h} village={village} hall={hall} hallShort={hallShort} />
      ))}
    </div>
  );
}

function HeroCard({ hero: h, village, hall, hallShort }: {
  hero: HeroCardData; village: Village; hall: number; hallShort: string;
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
        className="hero-alcove grid h-[132px] place-items-end justify-center pb-1"
        data-locked={!h.found}
        title={status}
      >
        {url ? (
          <Image
            src={url}
            alt=""
            width={128}
            height={128}
            className="hero-figure relative z-[1] h-[116px] w-auto object-contain drop-shadow-[0_6px_8px_rgba(0,0,0,.45)]"
          />
        ) : (
          <span aria-hidden className="h-[116px] w-[84px] rounded bg-panel-3" />
        )}
      </div>

      {/* The badge straddles the alcove's floor line, so pull it up over the
          seam rather than letting it start a new row. */}
      <div className="-mt-5 flex justify-center">
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
          ? <Res amount={h.remainingCost} kind={h.resource} est={h.est} />
          : <span className="text-ok">maxed</span>}
        <span className="num text-faint">
          {h.remainingHours > 0 ? fmtDuration(h.remainingHours) : ''}
        </span>
      </div>
    </div>
  );
}
