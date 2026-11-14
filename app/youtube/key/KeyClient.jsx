'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useI18n } from '../../../lib/i18n';
import { extractVideoId } from '../../../lib/youtube';
import { GET_KEY_URL, isValidKeyFormat, saveKey } from '../../../lib/ytClient';

export default function KeyClient() {
  const router = useRouter();
  const { t } = useI18n();
  const y = t.yt;
  const params = useSearchParams();
  const videoId = extractVideoId(params.get('v'));
  const invalid = params.get('reason') === 'invalid';
  const [value, setValue] = useState('');
  const [error, setError] = useState(''); // khóa trong từ điển (y[error]) để đổi ngôn ngữ thì chữ đổi theo

  const submit = (e) => {
    e.preventDefault();
    if (!isValidKeyFormat(value)) {
      setError('keyBadFormat');
      return;
    }
    if (!saveKey(value)) {
      setError('keyStorageBlockedLong');
      return;
    }
    router.replace(videoId ? `/youtube/watch?v=${videoId}` : '/youtube');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center">
          <Link href="/youtube" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            {y.backArrow}
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">{y.step1of2}</p>
        <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight">{y.keyTitle}</h1>
        <p className="mt-2 text-slate-600">
          {y.keyIntro}
        </p>

        {invalid && (
          <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {y.keyInvalidNotice}
          </p>
        )}

        {videoId && (
          <div className="mt-6 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2 pr-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`} alt="" className="aspect-video w-28 shrink-0 rounded-lg bg-slate-200 object-cover" />
            <p className="min-w-0 text-sm text-slate-600">
              {y.videoPrefix}<span className="font-mono text-slate-900">{videoId}</span>{y.videoSuffix}
            </p>
          </div>
        )}

        <ol className="mt-6 space-y-3">
          {y.keySteps.map((step, i) => (
            <li key={step} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-800">{i + 1}</span>
              <span className="pt-0.5 text-sm">{step}</span>
            </li>
          ))}
        </ol>

        <a
          href={GET_KEY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex h-11 items-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold hover:bg-slate-100 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
        >
          {y.openKeyPage}
        </a>

        <form onSubmit={submit} className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <label htmlFor="yt-key" className="text-sm font-medium">
            {y.pasteKey}
          </label>
          <input
            id="yt-key"
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="yta_..."
            autoComplete="off"
            spellCheck={false}
            className="mt-2 h-11 w-full rounded-xl border border-slate-300 px-3 font-mono text-sm focus:border-emerald-500 focus:outline-2 focus:outline-emerald-400/30"
          />
          {error && (
            <p role="alert" className="mt-2 text-sm text-red-600">
              {y[error]}
            </p>
          )}
          <button
            type="submit"
            className="mt-3 h-11 w-full rounded-xl bg-emerald-500 text-sm font-semibold text-white hover:bg-emerald-600 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
          >
            {y.saveContinue}
          </button>
          <p className="mt-3 text-xs text-slate-500">
            {y.keyPrivacy}
          </p>
        </form>
      </main>
    </div>
  );
}
