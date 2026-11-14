'use client';
import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import { YT } from './i18nYoutube';

export const LANGS = ['vi', 'en'];
const LANG_KEY = 'hp-shadowing-lang';
const DEFAULT_LANG = 'vi';

const DICT = {
  vi: {
    yt: YT.vi, // tính năng học từ YouTube (lib/i18nYoutube.js)
    brand: 'English Shadowing',
    tagline: 'Luyện nghe · nói',
    heroTitle: 'Biến video yêu thích thành bài học.',
    linkLabel: 'Link YouTube',
    linkPlaceholder: 'Dán link YouTube có phụ đề tiếng Anh...',
    generate: 'Generate',
    youtubeSentences: (n) => `${n} câu`,
    youtubeSuggested: 'Gợi ý',
    youtubeReadyHint: 'Đã dịch sẵn: mở học ngay, không cần đăng nhập và không tốn lượt dịch.',
    youtubeCostHint: 'Tạo bài từ video này tốn 1 lượt dịch link video YouTube. Mở lại bài đã tạo thì không tốn thêm.',
    heroDesc:
      'Nghe giọng đọc chuẩn, lặp lại từng câu và nói theo ngay. Mỗi bài chỉ vài phút để giữ thói quen luyện tập mỗi ngày.',
    browseLibrary: 'Xem thư viện',
    loading: 'Đang tải...',
    loadError: 'Không tải được danh sách bài học. Vui lòng tải lại trang.',
    library: 'Thư viện',
    topicsEyebrow: 'Miễn phí',
    topicsTitle: 'Chọn một chủ đề để luyện',
    topicsCount: (n) => `${n} chủ đề`,
    topicSummary: (l, m) => `${l} bài · khoảng ${m} phút`,
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
    replaySentence: 'Lặp lại câu này',
    pauseKey: 'Dừng (Space)',
    playKey: 'Phát (Space)',
    nextSentence: 'Câu sau (→)',
    loopLabel: 'Lặp lại cả bài',
    loopShort: 'Lặp bài',
    toggleSubs: 'Ẩn/hiện phụ đề',
    hideSubs: 'Ẩn phụ đề',
    showSubs: 'Hiện phụ đề',
    hideTranslation: 'Ẩn bản dịch',
    showTranslation: 'Hiện bản dịch',
    speed: 'Tốc độ',
    subtitles: 'Phụ đề',
    sentenceCount: (n) => `${n} câu`,
    lessonsInTopic: 'Các bài trong chủ đề này',
    nowPlaying: 'Đang xem',
    noTimestamps:
      'Bài này chưa có timestamp từng câu nên thời gian chỉ là ước lượng. Xử lý lại chapter bằng app mới để chính xác.',
  },
  en: {
    yt: YT.en,
    brand: 'English Shadowing',
    tagline: 'Listen · Speak',
    heroTitle: 'Turn your favorite videos into lessons.',
    linkLabel: 'YouTube link',
    linkPlaceholder: 'Paste a YouTube link with English subtitles...',
    generate: 'Generate',
    youtubeSentences: (n) => `${n} ${n === 1 ? 'sentence' : 'sentences'}`,
    youtubeSuggested: 'Suggested',
    youtubeReadyHint: 'Already translated: opens right away, no sign-in needed and no translation used.',
    youtubeCostHint: 'Creating a lesson from this video uses 1 YouTube video translation. Reopening a lesson you already made is free.',
    heroDesc:
      'Listen to a clear narrator, repeat each sentence and speak right along. Every lesson takes just a few minutes, so daily practice stays easy.',
    browseLibrary: 'Browse library',
    loading: 'Loading...',
    loadError: 'Could not load the lessons. Please reload the page.',
    library: 'Library',
    topicsEyebrow: 'Free',
    topicsTitle: 'Pick a topic to practice',
    topicsCount: (n) => `${n} ${n === 1 ? 'topic' : 'topics'}`,
    topicSummary: (l, m) => `${l} lessons · about ${m} min`,
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
    replaySentence: 'Repeat this sentence',
    pauseKey: 'Pause (Space)',
    playKey: 'Play (Space)',
    nextSentence: 'Next sentence (→)',
    loopLabel: 'Loop whole lesson',
    loopShort: 'Loop',
    toggleSubs: 'Show/hide subtitles',
    hideSubs: 'Hide subtitles',
    showSubs: 'Show subtitles',
    hideTranslation: 'Hide translation',
    showTranslation: 'Show translation',
    speed: 'Speed',
    subtitles: 'Subtitles',
    sentenceCount: (n) => `${n} ${n === 1 ? 'sentence' : 'sentences'}`,
    lessonsInTopic: 'Lessons in this topic',
    nowPlaying: 'Now playing',
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
