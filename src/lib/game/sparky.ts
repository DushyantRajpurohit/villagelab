import { superchargeBill } from './buildings';
import { CRAFTED_DEFENSES, craftedAtTH, craftedCostToMax } from './crafted';
import type { CraftedDefense } from './types';
import data from './crafted-defenses.json';

/**
 * Sparky Stones — what the game pays you for temporary upgrades.
 *
 * The app's only *yield*. Everything else in `src/lib/game/` answers "what does
 * this cost"; this answers "what does it pay". That is not a stylistic
 * distinction — it is why Sparky Stones are not a `Resource` and never appear
 * in a `Record<Resource, number>` total. No structure is built with them, no
 * storage banks them, and nothing in either village is priced in them. They buy
 * cosmetics in the Fancy Shop and nothing else.
 *
 * Two things pay them, and both are upgrades the game intends to take away
 * again:
 *
 *  - **Crafted Defense module levels**, 8 each. The set is replaced when the
 *    Crafting Phase ends.
 *  - **Supercharge charge levels**, 10 each. The game removes a charge when a
 *    real level is added to the structure.
 *
 * That is the actual through-line: Sparky Stones are compensation for spending
 * gold on something impermanent, which is why they are counted from exactly the
 * two tracks this app already keeps out of its cost-to-max totals.
 *
 * The figures here are a cross-check on the Crafted Defense transcription
 * rather than a second source: the Crafting Station page states 216 stones for
 * one maxed defense and 648 for all three, and those fall out of the module
 * tables only if the tables have the right number of purchasable levels.
 *
 * @see crafted-defenses.json `sparky` for the rates and the page they came from.
 */

const RAW = (data as unknown as {
  sparky: { perModuleLevel: number; perChargeLevel: number; cap: number; page: string };
}).sparky;

/** 8 Sparky Stones for every Crafted Defense module level bought. */
export const PER_MODULE_LEVEL = RAW.perModuleLevel;

/** 10 for every Supercharge charge level bought. */
export const PER_CHARGE_LEVEL = RAW.perChargeLevel;

/**
 * The most that can be held at once.
 *
 * A cap rather than a storage, which is the other reason Sparky Stones are not
 * a `Resource`: there is no building to draw for an amount on hand.
 */
export const SPARKY_CAP = RAW.cap;

/** The page the rates were read from, for provenance. */
export const SPARKY_SOURCE = RAW.page;

/** What taking one Crafted Defense to its ceiling here pays out. */
export const sparkyFromDefense = (d: CraftedDefense, th: number): number =>
  craftedCostToMax(d, th).levels * PER_MODULE_LEVEL;

/** What maxing all of this phase's defenses pays out — 648 at Town Hall 18. */
export const sparkyFromPhase = (th: number): number =>
  craftedAtTH(th).reduce((a, d) => a + sparkyFromDefense(d, th), 0);

/**
 * What supercharging everything this hall allows pays out.
 *
 * Zero below the top hall. Supercharging is a Town Hall 18 mechanic and no
 * earlier hall has a charge to buy, so no earlier hall earns a stone this way —
 * a structure's count being non-zero at Town Hall 12 says it exists there, not
 * that it can be charged there.
 *
 * Above that it is counted per copy the hall allows, times the structure's
 * charge levels: a charge is bought for each Cannon, so seven Cannons are seven
 * bills and seven payouts.
 */
export const sparkyFromSupercharges = (th: number): number =>
  superchargeBill(th).charges * PER_CHARGE_LEVEL;

export interface SparkyYield {
  crafted: number;
  supercharge: number;
  total: number;
}

/**
 * Everything a hall could earn, by source.
 *
 * Kept split rather than summed to one number because the two are earned on
 * very different terms: the Crafted Defense half expires with the phase, and
 * the supercharge half is available only at the top hall.
 */
export function sparkyAtTH(th: number): SparkyYield {
  const crafted = sparkyFromPhase(th);
  const supercharge = sparkyFromSupercharges(th);
  return { crafted, supercharge, total: crafted + supercharge };
}

/** Every defense in the phase, whether or not this hall can craft one. */
export const ALL_CRAFTED = CRAFTED_DEFENSES;
