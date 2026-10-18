'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { normalizeTag } from '@/lib/coc/tags';

/**
 * The one input the site takes.
 *
 * A single ruled box holding the field and its button, the way a form is set
 * in print: one frame, one line to write on, one thing to press. `size` picks
 * between the cover's version, big enough to be the page's obvious next move,
 * and the compact one every tool page carries in its header.
 */
export function TagSearch({ initial = '', basePath, size = 'sm' }: {
  initial?: string; basePath: string; size?: 'sm' | 'lg';
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [pending, setPending] = useState(false);
  const lg = size === 'lg';

  function submit(e: FormEvent) {
    e.preventDefault();
    const tag = normalizeTag(value);
    if (tag.length < 4) return;
    setPending(true);
    router.push(`${basePath}/${encodeURIComponent(tag.slice(1))}`);
  }

  return (
    <form
      onSubmit={submit}
      className={`flex items-stretch border-2 border-ink bg-white text-ink focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-kit ${
        lg ? 'w-full max-w-[460px]' : ''
      }`}
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="#2PP0JCVL9"
        spellCheck={false}
        aria-label="Player tag"
        className={`num min-w-0 flex-1 bg-transparent font-semibold tracking-wide text-ink outline-none placeholder:font-normal placeholder:text-[#5b6a60] ${
          lg ? 'px-4 py-3 text-[17px]' : 'w-[150px] px-3 py-1.5 text-[13px]'
        }`}
      />
      <button
        type="submit"
        disabled={pending}
        className={`btn btn-gold raised border-0 border-l-2 ${lg ? 'px-6 text-[16px]' : 'px-3.5 text-[13px]'}`}
      >
        {pending ? 'Loading…' : 'Look up'}
      </button>
    </form>
  );
}
