'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import LessonSkeleton from '../../../../components/LessonSkeleton';
import ShadowingPlayer from '../../../../components/ShadowingPlayer';
import { lessonLabel, useI18n } from '../../../../lib/i18n';
import { topicCoverSrc } from '../../../../lib/topicCovers';
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

  if (topicLoading || lessonLoading) return <LessonSkeleton />;
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
  // Các bài cùng chủ đề (có ảnh bìa và số bài) hiện ở khoảng trống dưới nút điều khiển
  const shelf = {
    heading: t.lessonsInTopic,
    currentId: lesson.lesson_index,
    items: lessons.map((l) => ({
      id: l.lesson_index,
      href: href(l),
      title: lessonLabel(l.title),
      image: topicCoverSrc(name, l.lesson_index),
      badge: l.lesson_index,
    })),
  };

  return (
    <ShadowingPlayer
      key={`${name}/${params.part}`}
      coverUrl={topicCoverSrc(name, lesson.lesson_index)}
      bookLabel={topic.title}
      heading={`${topic.title} · ${lessonLabel(lesson.title)}`}
      lesson={lesson}
      prevHref={idx > 0 ? href(lessons[idx - 1]) : null}
      nextHref={idx < lessons.length - 1 ? href(lessons[idx + 1]) : null}
      shelf={shelf}
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
