'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import ShadowingPlayer from '../../../../components/ShadowingPlayer';
import { lessonLabel, useI18n } from '../../../../lib/i18n';
import { markTopicLessonOpened, topicLessonKey } from '../../../../lib/topicProgress';
import { decodeParam, useTopic, useTopicLesson } from '../../../../lib/useTopic';

export default function LessonClient() {
  const { t } = useI18n();
  const params = useParams();
  const name = decodeParam(params.topic);
  const { loading: topicLoading, topic } = useTopic(name);
  const { loading: lessonLoading, lesson } = useTopicLesson(name, params.part);

  const lessons = topic?.lessons ?? [];
  const idx = lessons.findIndex((l) => String(l.lesson_index) === params.part);

  // Mở bài (kể cả qua nút bài trước/sau) thì đánh dấu đã học
  useEffect(() => {
    if (idx >= 0) markTopicLessonOpened(topicLessonKey(name, params.part));
  }, [idx, name, params.part]);

  if (topicLoading || lessonLoading) return <Message>{t.loadingLesson}</Message>;
  if (idx < 0 || !lesson) {
    return (
      <Message>
        {t.lessonNotFound}{' '}
        <Link href="/" className="text-emerald-600 underline">
          {t.backToList}
        </Link>
      </Message>
    );
  }

  const base = `/topic/${encodeURIComponent(name)}`;
  const href = (l) => `${base}/${l.lesson_index}`;

  return (
    <ShadowingPlayer
      key={`${name}/${params.part}`}
      bookLabel={topic.title}
      heading={`${topic.title} · ${lessonLabel(lesson.title)}`}
      backHref={base}
      lesson={lesson}
      prevHref={idx > 0 ? href(lessons[idx - 1]) : null}
      nextHref={idx < lessons.length - 1 ? href(lessons[idx + 1]) : null}
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
