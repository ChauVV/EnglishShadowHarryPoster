import crypto from 'node:crypto';

// Phiên admin: cookie "<hết hạn>.<chữ ký HMAC>", không tin giá trị cookie nếu thiếu chữ ký.
// Cấu hình trong .env.local / Vercel: ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_SESSION_SECRET
export const ADMIN_COOKIE = 'admin_token';
export const SESSION_SECONDS = 24 * 60 * 60;

const sign = (payload) => crypto.createHmac('sha256', process.env.ADMIN_SESSION_SECRET).update(payload).digest('hex');
const digest = (value) => crypto.createHash('sha256').update(String(value)).digest();

export const authConfigured = () =>
  Boolean(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD && process.env.ADMIN_SESSION_SECRET);

export function checkCredentials(username, password) {
  if (!authConfigured()) return false;
  // So sánh trên hash để thời gian xử lý không phụ thuộc độ dài / vị trí ký tự sai
  const userOk = crypto.timingSafeEqual(digest(username), digest(process.env.ADMIN_USERNAME));
  const passOk = crypto.timingSafeEqual(digest(password), digest(process.env.ADMIN_PASSWORD));
  return userOk && passOk;
}

export function createSessionToken() {
  const expires = String(Date.now() + SESSION_SECONDS * 1000);
  return `${expires}.${sign(expires)}`;
}

export function isAdminRequest(request) {
  if (!authConfigured()) return false;
  const token = request.cookies.get(ADMIN_COOKIE)?.value;
  const [expires, signature] = token?.split('.') ?? [];
  if (!expires || !signature || Number(expires) < Date.now()) return false;
  const expected = Buffer.from(sign(expires));
  const given = Buffer.from(signature);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}
