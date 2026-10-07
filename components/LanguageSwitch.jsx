'use client';
import { LANGS, useI18n } from '../lib/i18n';

const LABELS = { vi: 'VI', en: 'EN' };

// tone="dark" cho nền tối (header trang chủ), "light" cho nền sáng (trang học)
export default function LanguageSwitch({ tone = 'dark' }) {
  const { lang, setLang, t } = useI18n();
  const wrap = tone === 'dark' ? 'bg-white/10 border-white/15' : 'bg-slate-100 border-slate-200';
  const idle = tone === 'dark' ? 'text-slate-300 hover:text-white' : 'text-slate-500 hover:text-slate-900';
  const on = tone === 'dark' ? 'bg-emerald-400 text-slate-950' : 'bg-slate-900 text-white';

  return (
    <div role="group" aria-label={t.switchLang} className={`inline-flex items-center rounded-full border p-0.5 ${wrap}`}>
      {LANGS.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLang(code)}
          aria-pressed={lang === code}
          lang={code}
          className={`h-7 min-w-9 rounded-full px-2.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-emerald-400 ${
            lang === code ? on : idle
          }`}
        >
          {LABELS[code]}
        </button>
      ))}
    </div>
  );
}
