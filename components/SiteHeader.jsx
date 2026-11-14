'use client';
import Link from 'next/link';
import { useI18n } from '../lib/i18n';
import GoogleAccount from './GoogleAccount';
import LanguageSwitch from './LanguageSwitch';

// Header chung của các trang thường (trang chủ, tài khoản, nhập key...): logo + tên app (bấm về trang chủ), tài khoản, ngôn ngữ.
// children: phần chèn ở giữa (ví dụ ô tìm kiếm ở trang chủ). Các trang học (bài topic, video YouTube) có header riêng gọn hơn.
export default function SiteHeader({ children }) {
  const { t } = useI18n();
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
        <Link href="/" aria-label={t.brand} className="flex shrink-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-400 text-slate-950">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
              <rect x="3" y="14" width="4" height="6" rx="1.5" />
              <rect x="17" y="14" width="4" height="6" rx="1.5" />
            </svg>
          </span>
          <span className="hidden font-display font-semibold tracking-tight text-slate-900 sm:inline">{t.brand}</span>
        </Link>

        {children}

        <div className={`flex shrink-0 items-center gap-3 ${children ? 'sm:ml-auto' : 'ml-auto'}`}>
          <GoogleAccount />
          <LanguageSwitch tone="light" />
        </div>
      </div>
    </header>
  );
}
