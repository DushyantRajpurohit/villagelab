'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { normalizeTag } from '@/lib/coc/tags';

/** The only client component on the player page — everything else is SSR'd. */
export function TagSearch({ initial = '', basePath }: { initial?: string; basePath: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [pending, setPending] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    const tag = normalizeTag(value);
    if (tag.length < 4) return;
    setPending(true);
    router.push(`${basePath}/${encodeURIComponent(tag.slice(1))}`);
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="#2PP0JCVL9"
        spellCheck={false}
        aria-label="Player tag"
        className="num w-[180px] rounded-md border border-line bg-panel-2 px-3 py-1.5 tracking-wide outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/15"
      />
      <button
        type="submit"
        disabled={pending}
        className="raised rounded-[10px] border border-gold-2 bg-gold px-3.5 py-1.5 font-bold text-ink hover:brightness-105 disabled:opacity-50"
      >
        {pending ? 'Loading…' : 'Look up'}
      </button>
    </form>
  );
}
