'use client';
import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';

export const LANGS = ['vi', 'en'];
const LANG_KEY = 'hp-shadowing-lang';
const DEFAULT_LANG = 'vi';

const DICT = {
  vi: {
    brand: 'English Shadowing',
    tagline: 'Luyện nghe · nói',
    eyebrow: 'Phương pháp shadowing',
    heroLine1: 'Nói tiếng Anh tự nhiên',
    heroDesc:
      'Nghe giọng đọc chuẩn, lặp lại từng câu và nói theo ngay. Mỗi bài chỉ vài phút để giữ thói quen luyện tập mỗi ngày.',
    startLearning: 'Bắt đầu học',
    nextLesson: 'Học bài tiếp theo',
    browseLibrary: 'Xem thư viện',
    loading: 'Đang tải...',
    noLessons: 'Chưa có bài học',
    statBooks: 'Tập sách',
    statLessons: 'Bài học',
    statMinutes: 'Phút luyện',
    loadError: 'Không tải được danh sách bài học. Vui lòng tải lại trang.',
    lastStudied: 'Học gần nhất',
    progress: 'Tiến độ',
    lessonsDone: (done, total) => `${done}/${total} bài`,
    review: 'Học lại',
    nextShort: 'Bài tiếp',
    library: 'Thư viện',
    pickBook: 'Chọn một tập để bắt đầu',
    booksAvailable: (n, total) => `${n}/${total} tập đã có nội dung`,
    topicsEyebrow: 'Miễn phí',
    topicsTitle: 'Chọn một chủ đề để luyện',
    topicsCount: (n) => `${n} chủ đề`,
    topicSummary: (l, m) => `${l} bài · khoảng ${m} phút`,
    topicLessons: (done, total) => `${done}/${total} bài đã học`,
    topicNotFound: 'Không tìm thấy chủ đề này.',
    searchLabel: 'Tìm kiếm',
    searchPlaceholder: 'Tìm chủ đề hoặc bài học...',
    clearSearch: 'Xóa tìm kiếm',
    allTopics: 'Tất cả',
    topicTags: 'Lọc theo chủ đề',
    noResults: 'Không tìm thấy kết quả',
    noResultsDesc: 'Thử từ khóa khác hoặc bỏ bộ lọc chủ đề.',
    clearFilters: 'Xóa bộ lọc',
    freeTopicsTitle: 'Các chủ đề miễn phí sắp ra mắt',
    freeTopicsDesc: 'Chúng tôi đang chuẩn bị các bài luyện shadowing miễn phí. Hãy quay lại sớm nhé!',
    comingSoon: 'Sắp ra mắt',
    noContent: 'Chưa có nội dung',
    chaptersLessons: (c, l) => `${c} chapter · ${l} bài`,
    bookSummary: (c, l, m) => `${c} chapter · ${l} bài · khoảng ${m} phút`,
    bookContentLabel: (id) => `Nội dung Book ${id}`,
    comingSoonTitle: 'Tập này sắp ra mắt',
    comingSoonDesc: 'Nội dung đang được chuẩn bị. Hãy bắt đầu với các tập đã có bài học.',
    lessonsStudied: (done, total) => `${done}/${total} bài đã học`,
    studied: 'Đã học',
    minutesShort: (n) => `${n} phút`,
    footer: 'English Shadowing · Công cụ luyện nghe nói tiếng Anh theo phương pháp shadowing.',
    switchLang: 'Ngôn ngữ giao diện',
    // learn page
    loadingLesson: 'Đang tải bài học...',
    lessonNotFound: 'Không tìm thấy bài học này.',
    backToList: 'Về danh sách',
    home: 'Trang chủ',
    // player
    prevLessonLink: '← Lesson trước',
    nextLessonLink: 'Lesson sau →',
    pause: 'Dừng',
    play: 'Phát',
    seek: 'Tua audio',
    prevSentence: 'Câu trước (←)',
    replaySentence: 'Nghe lại câu này',
    pauseKey: 'Dừng (Space)',
    playKey: 'Phát (Space)',
    nextSentence: 'Câu sau (→)',
    loopLabel: 'Lặp lại câu',
    loopShort: 'Lặp câu',
    toggleSubs: 'Ẩn/hiện phụ đề',
    hideSubs: 'Ẩn phụ đề',
    showSubs: 'Hiện phụ đề',
    hideTranslation: 'Ẩn bản dịch',
    showTranslation: 'Hiện bản dịch',
    speed: 'Tốc độ',
    subtitles: 'Phụ đề',
    sentenceCount: (n) => `${n} câu`,
    noTimestamps:
      'Bài này chưa có timestamp từng câu nên thời gian chỉ là ước lượng. Xử lý lại chapter bằng app mới để chính xác.',
  },
  en: {
    brand: 'English Shadowing',
    tagline: 'Listen · Speak',
    eyebrow: 'Shadowing method',
    heroLine1: 'Speak natural English',
    heroDesc:
      'Listen to a clear narrator, repeat each sentence and speak right along. Every lesson takes just a few minutes, so daily practice stays easy.',
    startLearning: 'Start learning',
    nextLesson: 'Continue with next lesson',
    browseLibrary: 'Browse library',
    loading: 'Loading...',
    noLessons: 'No lessons yet',
    statBooks: 'Books',
    statLessons: 'Lessons',
    statMinutes: 'Minutes',
    loadError: 'Could not load the lessons. Please reload the page.',
    lastStudied: 'Last studied',
    progress: 'Progress',
    lessonsDone: (done, total) => `${done}/${total} lessons`,
    review: 'Review',
    nextShort: 'Next',
    library: 'Library',
    pickBook: 'Pick a book to begin',
    booksAvailable: (n, total) => `${n}/${total} books available`,
    topicsEyebrow: 'Free',
    topicsTitle: 'Pick a topic to practice',
    topicsCount: (n) => `${n} ${n === 1 ? 'topic' : 'topics'}`,
    topicSummary: (l, m) => `${l} lessons · about ${m} min`,
    topicLessons: (done, total) => `${done}/${total} lessons studied`,
    topicNotFound: 'This topic was not found.',
    searchLabel: 'Search',
    searchPlaceholder: 'Search topics or lessons...',
    clearSearch: 'Clear search',
    allTopics: 'All',
    topicTags: 'Filter by topic',
    noResults: 'No results found',
    noResultsDesc: 'Try a different keyword or remove the topic filter.',
    clearFilters: 'Clear filters',
    freeTopicsTitle: 'Free topics are coming soon',
    freeTopicsDesc: 'We are preparing free shadowing lessons. Please check back soon!',
    comingSoon: 'Coming soon',
    noContent: 'No content yet',
    chaptersLessons: (c, l) => `${c} ${c === 1 ? 'chapter' : 'chapters'} · ${l} ${l === 1 ? 'lesson' : 'lessons'}`,
    bookSummary: (c, l, m) =>
      `${c} ${c === 1 ? 'chapter' : 'chapters'} · ${l} ${l === 1 ? 'lesson' : 'lessons'} · about ${m} min`,
    bookContentLabel: (id) => `Book ${id} contents`,
    comingSoonTitle: 'This book is coming soon',
    comingSoonDesc: 'The content is being prepared. Start with the books that already have lessons.',
    lessonsStudied: (done, total) => `${done}/${total} lessons studied`,
    studied: 'Studied',
    minutesShort: (n) => `${n} min`,
    footer: 'English Shadowing · An English listening and speaking trainer using the shadowing method.',
    switchLang: 'Interface language',
    loadingLesson: 'Loading lesson...',
    lessonNotFound: 'This lesson could not be found.',
    backToList: 'Back to library',
    home: 'Home',
    prevLessonLink: '← Previous lesson',
    nextLessonLink: 'Next lesson →',
    pause: 'Pause',
    play: 'Play',
    seek: 'Seek audio',
    prevSentence: 'Previous sentence (←)',
    replaySentence: 'Replay this sentence',
    pauseKey: 'Pause (Space)',
    playKey: 'Play (Space)',
    nextSentence: 'Next sentence (→)',
    loopLabel: 'Loop sentence',
    loopShort: 'Loop',
    toggleSubs: 'Show/hide subtitles',
    hideSubs: 'Hide subtitles',
    showSubs: 'Show subtitles',
    hideTranslation: 'Hide translation',
    showTranslation: 'Show translation',
    speed: 'Speed',
    subtitles: 'Subtitles',
    sentenceCount: (n) => `${n} ${n === 1 ? 'sentence' : 'sentences'}`,
    noTimestamps:
      'This lesson has no per-sentence timestamps, so timings are estimated. Reprocess the chapter with the new app for accuracy.',
  },
};

// ---- store ngôn ngữ trên localStorage, đồng bộ giữa các tab và trong cùng tab ----
const listeners = new Set();
function subscribe(callback) {
  listeners.add(callback);
  window.addEventListener('storage', callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener('storage', callback);
  };
}
function readLang() {
  try {
    const stored = window.localStorage.getItem(LANG_KEY);
    if (LANGS.includes(stored)) return stored;
    return DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}
function writeLang(lang) {
  try {
    window.localStorage.setItem(LANG_KEY, lang);
  } catch {
    // bị chặn storage -> chỉ mất tính năng nhớ ngôn ngữ
  }
  listeners.forEach((l) => l());
}

const I18nContext = createContext({ lang: DEFAULT_LANG, t: DICT[DEFAULT_LANG], setLang: () => {} });

export function I18nProvider({ children }) {
  const lang = useSyncExternalStore(subscribe, readLang, () => DEFAULT_LANG);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo(() => ({ lang, t: DICT[lang], setLang: writeLang }), [lang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);

// Metadata cũ đặt tên bài là "Part N"; hiển thị thống nhất là "Lesson N"
export const lessonLabel = (title) => String(title ?? '').replace(/^Part(?=\s|\d|$)/i, 'Lesson');
