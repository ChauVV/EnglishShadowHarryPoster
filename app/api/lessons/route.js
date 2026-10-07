import { NextResponse } from 'next/server';
import { loadLibrary, loadChapter } from '../../../lib/chapters';

// GET /api/lessons                       -> mục lục Book > Chapter > Part
// GET /api/lessons?book=1&chapter=1      -> 1 chapter đầy đủ (text, segments, audio_url)
export async function GET(request) {
  const params = request.nextUrl.searchParams;
  const book = params.get('book');
  const chapter = params.get('chapter');

  if (book === null && chapter === null) {
    try {
      return NextResponse.json({ books: await loadLibrary() });
    } catch (err) {
      return NextResponse.json({ message: err.message }, { status: 502 });
    }
  }

  const bookNumber = Number(book);
  const chapterNumber = Number(chapter);
  if (!Number.isInteger(bookNumber) || !Number.isInteger(chapterNumber) || bookNumber < 1 || chapterNumber < 1) {
    return NextResponse.json({ message: 'book/chapter không hợp lệ' }, { status: 400 });
  }

  const data = await loadChapter(bookNumber, chapterNumber);
  if (!data) return NextResponse.json({ message: 'Không tìm thấy chapter' }, { status: 404 });
  return NextResponse.json({ chapter: data });
}
