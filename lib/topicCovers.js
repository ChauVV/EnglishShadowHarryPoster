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

export const topicCoverSrc = (slug, lessonIndex) => `/topic-covers/${encodeURIComponent(slug)}/${topicCoverNumber(slug, lessonIndex)}.svg`;
