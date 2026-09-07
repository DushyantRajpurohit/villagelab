import type { Metadata } from 'next';
import { BaseWorkbench } from '@/components/base/BaseWorkbench';
import { GRID } from '@/lib/base/layout';

export const metadata: Metadata = {
  title: 'Base builder — plan a buildable village layout',
  description:
    `Lay out a ${GRID}×${GRID} Clash of Clans village, Home Village or Builder Base. Placement limits come from your hall level, so anything you draw is actually buildable. Saves locally, no account.`,
  alternates: { canonical: '/base' },
};

export default function BasePage() {
  return (
    <main className="mx-auto w-full max-w-[1400px] p-5">
      <div className="mb-4">
        <h1 className="display text-[22px]">Base builder</h1>
        <p className="mt-1 max-w-[70ch] text-[13px] text-muted">
          A {GRID}×{GRID} village grid for either village. Counts and footprints come from your
          hall level and are enforced as you draw, so a finished layout is always one you could
          actually build. Layouts are saved per village in this browser — nothing is uploaded.
        </p>
      </div>
      <BaseWorkbench />
    </main>
  );
}
