'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import LanguageSwitch from '../../../components/LanguageSwitch';
import { lessonLabel, useI18n } from '../../../lib/i18n';
import { markTopicLessonOpened, topicLessonKey, useTopicProgress } from '../../../lib/topicProgress';
import { decodeParam, useTopic } from '../../../lib/useTopic';

// Bài dưới 3:30 là bài ngắn (2-3 phút), còn lại là bài dài (4-5 phút)
const SHORT_MAX_SECONDS = 210;
const minutes = (seconds) => Math.max(1, Math.round(seconds / 60));

export default function TopicClient() {
  const { t } = useI18n();
  const name = decodeParam(useParams().topic);
  const { loading, topic, failed } = useTopic(name);
  const visited = useTopicProgress();

  if (loading) {
    return <Message>{t.loadingLesson}</Message>;
  }
  if (failed || !topic) {
    return (
      <Message>
        {t.topicNotFound}{' '}
        <Link href="/" className="text-emerald-600 underline">
          {t.backToList}
        </Link>
      </Message>
    );
  }

  const total = topic.lessons.length;
  const done = topic.lessons.filter((l) => visited.has(topicLessonKey(name, l.lesson_index))).length;
  const totalMin = Math.round(topic.lessons.reduce((sum, l) => sum + l.duration_seconds, 0) / 60);
  const percent = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/" aria-label={t.backToList} className="p-2 -ml-2 rounded-full hover:bg-slate-100">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M19 12H5m7-7-7 7 7 7" />
            </svg>
          </Link>
          <h1 className="min-w-0 flex-1 font-bold truncate">{topic.title}</h1>
          <LanguageSwitch tone="light" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">{t.topicsEyebrow}</p>
        <h2 className="font-display mt-1 text-3xl font-semibold tracking-tight">{topic.title}</h2>
        {topic.title_vi && <p className="text-slate-500">{topic.title_vi}</p>}
        <p className="mt-1 text-sm text-slate-500">{t.topicSummary(total, totalMin)}</p>
        <div className="mt-4 max-w-sm">
          <div className="flex justify-between text-xs text-slate-500 mb-1.5">
            <span>{t.progress}</span>
            <span>{t.topicLessons(done, total)}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${percent}%` }} />
          </div>
        </div>

        {[
          [t.shortLessons, topic.lessons.filter((l) => l.duration_seconds < SHORT_MAX_SECONDS)],
          [t.longLessons, topic.lessons.filter((l) => l.duration_seconds >= SHORT_MAX_SECONDS)],
        ]
          .filter(([, group]) => group.length > 0)
          .map(([label, group]) => (
            <section key={label} className="mt-8">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</h3>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {group.map((lesson) => {
                  const key = topicLessonKey(name, lesson.lesson_index);
                  const isDone = visited.has(key);
                  return (
                    <li key={lesson.lesson_index}>
                      <Link
                        href={`/topic/${encodeURIComponent(name)}/${lesson.lesson_index}`}
                        onClick={() => markTopicLessonOpened(key)}
                        className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 transition hover:border-emerald-400 hover:bg-emerald-50/60 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
                      >
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition ${
                            isDone ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-700 group-hover:bg-slate-900 group-hover:text-white'
                          }`}
                        >
                          {isDone ? '✓' : lesson.lesson_index}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold truncate">{lessonLabel(lesson.title)}</span>
                          <span className="block text-xs text-slate-500">
                            {t.minutesShort(minutes(lesson.duration_seconds))}
                            {isDone && <span className="ml-1 text-emerald-600 font-medium">· {t.studied}</span>}
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
      </main>
    </div>
  );
}

function Message({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm">
      <p>{children}</p>
    </div>
  );
}
