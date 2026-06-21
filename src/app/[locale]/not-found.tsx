import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export default function NotFound() {
  const t = useTranslations('Common');
  return (
    <div className="py-20 text-center">
      <h1 className="text-3xl font-bold">404</h1>
      <p className="mt-4">
        <Link href="/" className="text-pitch-600 underline">
          {t('appName')}
        </Link>
      </p>
    </div>
  );
}
