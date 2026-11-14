import { AI_COVERS } from './aiCovers';

// Mỗi topic có 5 ảnh bìa: public/topic-covers/<slug>/1.svg .. 5.svg (tạo bằng scripts/make_topic_covers.py).
// Bài 1-5 dùng ảnh 1-5; các bài sau lấy "ngẫu nhiên" trong 5 ảnh đó. Ngẫu nhiên nhưng cố định theo (topic, bài)
// để mỗi lần hiển thị đều ra cùng một ảnh, và không trùng ảnh của bài ngay trước.
export const COVERS_PER_TOPIC = 5;

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function topicCoverNumber(slug, lessonIndex) {
  let prev = 0;
  for (let n = 1; n <= lessonIndex; n++) {
    let cover = n <= COVERS_PER_TOPIC ? n : (hash(`${slug}:${n}`) % COVERS_PER_TOPIC) + 1;
    if (cover === prev) cover = (cover % COVERS_PER_TOPIC) + 1;
    prev = cover;
  }
  return prev;
}

// Bài đã có ảnh riêng do AI tạo (lib/aiCovers.js) thì dùng ảnh đó; chưa có thì dùng ảnh SVG chung của topic
// Bản lớn (1280x720) cho khung ở trang bài học; ảnh SVG chung thì dùng chung một file vì là ảnh vector
export const topicCoverSrc = (slug, lessonIndex, size = 'thumb') =>
  AI_COVERS[slug]?.includes(lessonIndex)
    ? `/topic-covers/${encodeURIComponent(slug)}/lesson-${String(lessonIndex).padStart(2, '0')}${size === 'full' ? '-full' : ''}.webp`
    : `/topic-covers/${encodeURIComponent(slug)}/${topicCoverNumber(slug, lessonIndex)}.svg`;
