'use client';
import Link from 'next/link';
import { useI18n } from '../lib/i18n';
import AppLogo from './AppLogo';
import GoogleAccount from './GoogleAccount';
import LanguageSwitch from './LanguageSwitch';

// Header chung của các trang thường (trang chủ, tài khoản, nhập key...): logo + tên app (bấm về trang chủ), tài khoản, ngôn ngữ.
// children: phần chèn ở giữa (ví dụ ô tìm kiếm ở trang chủ). Các trang học (bài topic, video YouTube) có header riêng gọn hơn.
export default function SiteHeader({ children }) {
  const { t } = useI18n();
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1800px] items-center gap-3 px-4 sm:px-6">
        <Link href="/" aria-label={t.brand} className="flex shrink-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500">
          <AppLogo className="h-8 w-8" />
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
