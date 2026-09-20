'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { normalizeTag } from '@/lib/coc/tags';

/**
 * The one input the storefront takes.
 *
 * Shaped like the store's own search: a single sunk capsule holding the field
 * and its button, rather than two controls sitting beside each other. `size`
 * picks between the banner's version — big enough to be the page's obvious
 * next move — and the compact one every tool page carries in its header.
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
      className={`flex items-center gap-2 rounded-full border border-line bg-panel-2 shadow-[inset_0_2px_4px_rgba(0,0,0,.25)] focus-within:border-gold/50 ${
        lg ? 'w-full max-w-[420px] p-1.5 pl-5' : 'p-1 pl-3.5'
      }`}
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="#2PP0JCVL9"
        spellCheck={false}
        aria-label="Player tag"
        className={`num min-w-0 flex-1 bg-transparent tracking-wide text-text outline-none placeholder:text-faint ${
          lg ? 'text-[15px]' : 'w-[150px] text-[13px]'
        }`}
      />
      <button
        type="submit"
        disabled={pending}
        className={`btn btn-gold raised rounded-full ${lg ? 'px-6 py-2.5 text-[15px]' : 'px-4 py-1.5 text-[13px]'}`}
      >
        {pending ? 'Loading…' : 'Look up'}
      </button>
    </form>
  );
}
