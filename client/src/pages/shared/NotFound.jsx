import { Link } from 'react-router-dom';
import { useTranslation } from '../../i18n';

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-primary)] px-4 text-center">
      <h1 className="text-6xl font-bold text-[var(--accent)] mb-2">404</h1>
      <p className="text-lg text-[var(--text-primary)] mb-1">{t('page_not_found')}</p>
      <p className="text-sm text-[var(--text-secondary)] mb-6">
        {t('page_not_found_desc')}
      </p>
      <Link
        to="/"
        className="px-6 py-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium transition-colors"
      >
        {t('go_home')}
      </Link>
    </div>
  );
}
