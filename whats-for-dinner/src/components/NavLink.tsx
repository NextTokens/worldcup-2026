'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  const pathname = usePathname();
  const active = href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[11px] font-semibold transition-colors sm:flex-none sm:flex-row sm:gap-2 sm:text-sm ${
        active ? 'bg-brand-soft text-brand' : 'text-ink-soft hover:text-ink'
      }`}
    >
      <span aria-hidden className="text-lg leading-none sm:text-base">
        {icon}
      </span>
      {label}
    </Link>
  );
}
