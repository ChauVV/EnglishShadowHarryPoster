import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { CONTENT_ROOT, BOOK_DIR_PATTERN, CHAPTER_DIR_PATTERN } from '../../../../../../lib/chapters';
import { driveConfigured, driveList, driveMedia, driveResolveFolder } from '../../../../../../lib/drive';

const FILE_PATTERN = /^lesson_\d+\.mp3$/;

// Chuyển tiếp audio từ Drive, giữ Range để tua được
async function streamFromDrive(request, book, folder, file) {
  try {
    const folderId = await driveResolveFolder([book, folder]);
    const item = folderId && (await driveList(folderId)).find((f) => !f.isFolder && f.name === file);
    if (!item) return new Response('Not found', { status: 404 });

    const upstream = await driveMedia(item.id, request.headers.get('range'));
    const headers = new Headers({ 'Content-Type': 'audio/mpeg', 'Accept-Ranges': 'bytes' });
    for (const name of ['content-length', 'content-range']) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (err) {
    return new Response(err.message, { status: 502 });
  }
}

export async function GET(request, { params }) {
  const { book, folder, file } = await params;
  if (!BOOK_DIR_PATTERN.test(book) || !CHAPTER_DIR_PATTERN.test(folder) || !FILE_PATTERN.test(file)) {
    return new Response('Not found', { status: 404 });
  }

  if (driveConfigured()) return streamFromDrive(request, book, folder, file);

  const filePath = path.join(CONTENT_ROOT, book, folder, file);
  let size;
  try {
    size = (await fsp.stat(filePath)).size;
  } catch {
    return new Response('Not found', { status: 404 });
  }

  // Hỗ trợ Range để trình duyệt tua (seek) được audio
  const range = request.headers.get('range');
  const match = range && /^bytes=(\d*)-(\d*)$/.exec(range);
  if (match) {
    const start = match[1] ? parseInt(match[1], 10) : size - parseInt(match[2], 10);
    const end = Math.min(match[1] && match[2] ? parseInt(match[2], 10) : size - 1, size - 1);
    if (!(start >= 0 && start <= end)) {
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    }
    return new Response(Readable.toWeb(fs.createReadStream(filePath, { start, end })), {
      status: 206,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Content-Length': String(end - start + 1),
      },
    });
  }

  return new Response(Readable.toWeb(fs.createReadStream(filePath)), {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Accept-Ranges': 'bytes',
      'Content-Length': String(size),
    },
  });
}
