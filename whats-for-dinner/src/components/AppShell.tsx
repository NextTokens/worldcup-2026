import Link from 'next/link';
import { NavLink } from './NavLink';
import { SubmitButton } from './SubmitButton';
import { logoutAction } from '@/lib/actions/auth';
import { passwordRequired } from '@/lib/auth';
import { aiConfigured } from '@/lib/ai/client';

const TABS = [
  { href: '/', label: 'Tonight', icon: '🍽️' },
  { href: '/week', label: 'Week', icon: '🗓️' },
  { href: '/pantry', label: 'Pantry', icon: '🧺' },
  { href: '/shopping', label: 'Shopping', icon: '🛒' },
  { href: '/dishes', label: 'Dishes', icon: '📖' },
  { href: '/family', label: 'Family', icon: '👪' },
];

export function AppShell({ householdName, children }: { householdName: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-crust/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
            <span aria-hidden className="text-xl">
              🍲
            </span>
            <span>What&rsquo;s for Dinner</span>
          </Link>
          <span className="ml-auto truncate text-xs text-ink-soft">{householdName}</span>
          {passwordRequired() ? (
            <form action={logoutAction}>
              <SubmitButton className="btn-quiet">Sign out</SubmitButton>
            </form>
          ) : null}
        </div>

        <nav className="mx-auto hidden w-full max-w-3xl gap-1 px-2 pb-2 sm:flex">
          {TABS.map((t) => (
            <NavLink key={t.href} {...t} />
          ))}
        </nav>
      </header>

      {!aiConfigured() ? (
        <p className="mx-auto max-w-3xl px-4 pt-3 text-xs text-ink-soft">
          Running without an OpenAI key — suggestions come from the built-in ranking of your own dishes.
        </p>
      ) : null}

      <main className="page">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-surface/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
        {TABS.map((t) => (
          <NavLink key={t.href} {...t} />
        ))}
      </nav>
    </div>
  );
}
