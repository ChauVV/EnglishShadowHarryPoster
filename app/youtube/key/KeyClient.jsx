'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { extractVideoId } from '../../../lib/youtube';
import { GET_KEY_URL, isValidKeyFormat, saveKey } from '../../../lib/ytClient';

const STEPS = [
  'Bấm nút "Mở trang tạo key" bên dưới (trang mở ở tab mới).',
  'Đăng nhập bằng tài khoản Google.',
  'Bấm "Create API key". Gói miễn phí cho 10 lượt dịch mỗi ngày.',
  'Sao chép key (bắt đầu bằng yta_). Trang chỉ hiện key đầy đủ một lần.',
  'Quay lại đây, dán key vào ô bên dưới rồi bấm "Lưu key và tiếp tục".',
];

export default function KeyClient() {
  const router = useRouter();
  const params = useSearchParams();
  const videoId = extractVideoId(params.get('v'));
  const invalid = params.get('reason') === 'invalid';
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (!isValidKeyFormat(value)) {
      setError('Key không đúng định dạng. Key hợp lệ bắt đầu bằng "yta_". Hãy sao chép lại đầy đủ.');
      return;
    }
    if (!saveKey(value)) {
      setError('Trình duyệt đang chặn lưu dữ liệu nên không lưu được key. Hãy tắt chế độ ẩn danh hoặc cho phép lưu trữ.');
      return;
    }
    router.replace(videoId ? `/youtube/watch?v=${videoId}` : '/youtube');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center">
          <Link href="/youtube" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            ← Quay lại
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">Bước 1 trên 2</p>
        <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight">Tạo key để lấy phụ đề</h1>
        <p className="mt-2 text-slate-600">
          Phụ đề được lấy qua dịch vụ youtube-transcript.ai. Mỗi người dùng dùng key miễn phí của chính mình, nên bạn không phải trả phí cho chúng tôi.
        </p>

        {invalid && (
          <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Key đã lưu không còn hợp lệ (nhập sai hoặc đã được thay bằng key mới). Hãy tạo hoặc dán lại key.
          </p>
        )}

        {videoId && (
          <div className="mt-6 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2 pr-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`} alt="" className="aspect-video w-28 shrink-0 rounded-lg bg-slate-200 object-cover" />
            <p className="min-w-0 text-sm text-slate-600">
              Video bạn muốn học: <span className="font-mono text-slate-900">{videoId}</span>. Sau khi lưu key, ứng dụng sẽ tạo phụ đề và bản dịch cho video này.
            </p>
          </div>
        )}

        <ol className="mt-6 space-y-3">
          {STEPS.map((step, i) => (
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
          Mở trang tạo key ↗
        </a>

        <form onSubmit={submit} className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <label htmlFor="yt-key" className="text-sm font-medium">
            Dán key của bạn
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
              {error}
            </p>
          )}
          <button
            type="submit"
            className="mt-3 h-11 w-full rounded-xl bg-emerald-500 text-sm font-semibold text-white hover:bg-emerald-600 transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
          >
            Lưu key và tiếp tục
          </button>
          <p className="mt-3 text-xs text-slate-500">
            Key chỉ lưu trong trình duyệt của bạn và chỉ dùng để lấy phụ đề, không lưu trên máy chủ của chúng tôi.
          </p>
        </form>
      </main>
    </div>
  );
}
