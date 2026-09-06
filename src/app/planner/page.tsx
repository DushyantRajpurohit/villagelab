import type { Metadata } from 'next';
import { PlannerApp } from '@/components/planner/PlannerApp';

export const metadata: Metadata = {
  title: 'Upgrade planner',
  description:
    'Record your village levels, queue upgrades, and get a real completion date across builders, laboratory and hero altars.',
  alternates: { canonical: '/planner' },
};

export default function PlannerPage() {
  return (
    <main className="mx-auto w-full max-w-[1400px] p-5">
      <div className="mb-5">
        <h1 className="display text-[22px]">Upgrade planner</h1>
        <p className="mt-1 max-w-[70ch] text-[13px] text-muted">
          The API does not expose building levels, so record what your village actually looks like
          once and every cost below follows from it. Queue what you want next and the scheduler
          models your builders, laboratory and hero altars as separate lanes.
        </p>
      </div>
      <PlannerApp />
    </main>
  );
}
