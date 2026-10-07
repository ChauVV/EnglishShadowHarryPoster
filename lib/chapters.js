import fs from 'node:fs/promises';
import path from 'node:path';
import { driveConfigured, driveList, driveReadJson, driveResolveFolder } from './drive';

// Cấu trúc: <Book_N>/<Chapter_M_Output>/{lesson_X.mp3, metadata.json}
// Nguồn dữ liệu: Google Drive nếu đã cấu hình (xem lib/drive.js), ngược lại đọc thư mục trên máy.
export const CONTENT_ROOT = process.cwd();
export const BOOK_DIR_PATTERN = /^Book_\d+$/;
export const CHAPTER_DIR_PATTERN = /^Chapter_\d+_Output$/;

async function readChapterDir(bookDir, chapterDir) {
  try {
    let metadata;
    if (driveConfigured()) {
      const folderId = await driveResolveFolder([bookDir, chapterDir]);
      const meta = folderId && (await driveList(folderId)).find((f) => !f.isFolder && f.name === 'metadata.json');
      if (!meta) return null;
      metadata = await driveReadJson(meta.id);
    } else {
      const raw = await fs.readFile(path.join(CONTENT_ROOT, bookDir, chapterDir, 'metadata.json'), 'utf-8');
      metadata = JSON.parse(raw.replace(/^﻿/, ''));
    }
    // Số chapter lấy theo tên thư mục (Chapter_N_Output) chứ không tin metadata.json,
    // vì metadata có thể bị sai/copy từ chapter khác -> web hiện sai thứ tự.
    return {
      ...metadata,
      chapter_number: Number(chapterDir.match(/\d+/)[0]),
      lessons: metadata.lessons.map((lesson) => ({
        ...lesson,
        audio_url: `/api/audio/${bookDir}/${chapterDir}/${lesson.audio_file_name}`,
      })),
    };
  } catch {
    return null; // Folder không có metadata.json hợp lệ -> bỏ qua
  }
}

// dir: '.' (gốc) hoặc tên thư mục Book_N
async function listDirs(dir, pattern) {
  if (driveConfigured()) {
    // Lỗi gọi Drive (sai key, chưa share...) được ném ra để API báo lỗi thay vì hiện danh sách rỗng
    const folderId = await driveResolveFolder(dir === '.' ? [] : [dir]);
    if (!folderId) return [];
    return (await driveList(folderId)).filter((f) => f.isFolder && pattern.test(f.name)).map((f) => f.name);
  }
  try {
    const entries = await fs.readdir(path.join(CONTENT_ROOT, dir), { withFileTypes: true });
    return entries.filter((e) => e.isDirectory() && pattern.test(e.name)).map((e) => e.name);
  } catch {
    return [];
  }
}

// Mục lục: Book -> Chapter -> Part (không kèm text/audio để nhẹ)
export async function loadLibrary() {
  const bookDirs = await listDirs('.', BOOK_DIR_PATTERN);
  const library = await Promise.all(
    bookDirs.map(async (bookDir) => {
      const chapterDirs = await listDirs(bookDir, CHAPTER_DIR_PATTERN);
      const loaded = await Promise.all(chapterDirs.map((chapterDir) => readChapterDir(bookDir, chapterDir)));
      const chapters = loaded
        .filter(Boolean)
        .map((chapter) => ({
          chapter_number: chapter.chapter_number,
          chapter_title: chapter.chapter_title,
          lessons: chapter.lessons.map(({ lesson_index, title, duration_seconds }) => ({
            lesson_index,
            title,
            duration_seconds,
          })),
        }))
        .sort((a, b) => a.chapter_number - b.chapter_number);
      return { book_number: Number(bookDir.slice('Book_'.length)), chapters };
    }),
  );
  return library.sort((a, b) => a.book_number - b.book_number);
}

export async function loadChapter(bookNumber, chapterNumber) {
  return readChapterDir(`Book_${bookNumber}`, `Chapter_${chapterNumber}_Output`);
}
