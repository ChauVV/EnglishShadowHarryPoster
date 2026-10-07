'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import ShadowingPlayer from '../../../../../components/ShadowingPlayer';
import { BOOKS } from '../../../../../lib/books';
import { useI18n } from '../../../../../lib/i18n';

export default function LearnClient() {
  const { t } = useI18n();
  const { book, chapter, part } = useParams();
  const [data, setData] = useState({ key: null, chapter: null, failed: false });
  const key = `${book}/${chapter}`;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/lessons?book=${book}&chapter=${chapter}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('not found'))))
      .then((json) => !cancelled && setData({ key, chapter: json.chapter, failed: false }))
      .catch(() => !cancelled && setData({ key, chapter: null, failed: true }));
    return () => {
      cancelled = true;
    };
  }, [book, chapter, key]);

  const loaded = data.key === key;
  const lessons = loaded ? data.chapter?.lessons : null;
  const lessonIdx = lessons?.findIndex((l) => String(l.lesson_index) === part) ?? -1;

  if (!loaded) {
    return <Message>{t.loadingLesson}</Message>;
  }
  if (data.failed || lessonIdx < 0) {
    return (
      <Message>
        {t.lessonNotFound}{' '}
        <Link href="/" className="text-emerald-600 underline">
          {t.backToList}
        </Link>
      </Message>
    );
  }

  const href = (l) => `/learn/${book}/${chapter}/${l.lesson_index}`;
  const bookInfo = BOOKS.find((b) => String(b.id) === book);

  return (
    <ShadowingPlayer
      key={`${key}/${part}`}
      bookId={book}
      bookLabel={`Book ${book}${bookInfo ? ` - ${bookInfo.title}` : ''}`}
      chapter={data.chapter}
      lesson={lessons[lessonIdx]}
      prevHref={lessonIdx > 0 ? href(lessons[lessonIdx - 1]) : null}
      nextHref={lessonIdx < lessons.length - 1 ? href(lessons[lessonIdx + 1]) : null}
    />
  );
}

function Message({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm">
      <p>{children}</p>
    </div>
  );
}
