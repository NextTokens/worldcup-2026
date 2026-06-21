import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { LocaleSwitcher } from './LocaleSwitcher';

export function SiteHeader() {
  const t = useTranslations('Nav');
  const tc = useTranslations('Common');

  const items = [
    { href: '/', label: t('home') },
    { href: '/schedule', label: t('schedule') },
    { href: '/groups', label: t('groups') },
    { href: '/teams', label: t('teams') },
    { href: '/bracket', label: t('bracket') },
  ] as const;

  return (
    <header className="sticky top-0 z-20 border-b border-black/10 bg-pitch-600 text-white">
      <div className="mx-auto flex max-w-screen-md items-center gap-3 px-4 py-3">
        <Link href="/" className="shrink-0 font-bold tracking-tight">
          {tc('appName')}
        </Link>
        <nav className="ms-auto flex min-w-0 items-center gap-3 overflow-x-auto text-sm">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className="shrink-0 opacity-90 transition-opacity hover:opacity-100"
            >
              {it.label}
            </Link>
          ))}
          <LocaleSwitcher />
        </nav>
      </div>
    </header>
  );
}
