import { useTranslations } from 'next-intl';

export function SiteFooter() {
  const t = useTranslations('Common');
  return (
    <footer className="border-t border-black/10 px-4 py-6 text-xs text-black/55 dark:text-white/45">
      <p className="mx-auto max-w-screen-md">{t('attribution')}</p>
    </footer>
  );
}
