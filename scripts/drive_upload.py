"""Upload lesson lên Google Drive + cập nhật catalog.json (mục lục nhẹ mà web đọc).

Lệnh:
  python scripts/drive_upload.py auth                 # đăng nhập Google 1 lần (mở trình duyệt)
  python scripts/drive_upload.py upload <thư mục lesson> [<thư mục lesson> ...]
  python scripts/drive_upload.py upload --all generated   # upload mọi lesson trong generated/
  python scripts/drive_upload.py list                 # liệt kê các lesson đang có trên Drive (đọc catalog.json)

<thư mục lesson> = thư mục có audio.mp3 + metadata.json, ví dụ
  generated/Topic_01_Travel_and_Airports/Lesson_01_Checking_in_at_the_Airport_Counter

Thiết lập 1 lần (xem docs/AI_WORKFLOW.md):
  - File OAuth client (loại Desktop app) lưu ở .english-shadowing/client.json (trong dự án, đã .gitignore)
    hoặc ~/.english-shadowing/client.json
  - Chạy `auth` -> token lưu cùng thư mục với client.json (không bị commit)
  - DRIVE_ROOT_FOLDER_ID và GOOGLE_API_KEY đọc từ .env.local
"""
import http.server
import json
import os
import re
import sys
import threading
import urllib.parse
import webbrowser

import time

import requests

sys.stderr.reconfigure(encoding="utf-8")
sys.stdout.reconfigure(encoding="utf-8")  # console Windows mặc định cp1252, in tiếng Việt bị lỗi

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# client.json (OAuth client) và token.json nằm cùng một thư mục: ưu tiên .english-shadowing/ trong dự án (đã .gitignore),
# nếu không có thì dùng ~/.english-shadowing/
_DIRS = [os.path.join(ROOT_DIR, ".english-shadowing"), os.path.join(os.path.expanduser("~"), ".english-shadowing")]
CONFIG_DIR = next((d for d in _DIRS if os.path.exists(os.path.join(d, "client.json"))), _DIRS[0])
CLIENT_FILE = os.path.join(CONFIG_DIR, "client.json")
TOKEN_FILE = os.path.join(CONFIG_DIR, "token.json")
SCOPE = "https://www.googleapis.com/auth/drive"
API = "https://www.googleapis.com/drive/v3"
UPLOAD = "https://www.googleapis.com/upload/drive/v3"
FOLDER_MIME = "application/vnd.google-apps.folder"
CATALOG_NAME = "catalog.json"


# ---------- cấu hình ----------
def read_env():
    env = {}
    path = os.path.join(ROOT_DIR, ".env.local")
    if os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            m = re.match(r"\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$", line)
            if m:
                env[m.group(1)] = m.group(2).strip("\"'")
    return env


def root_folder_id():
    raw = read_env().get("DRIVE_ROOT_FOLDER_ID", "")
    m = re.search(r"[\w-]{15,}(?=[/?#]|$)", raw)
    if not m:
        sys.exit("Thiếu DRIVE_ROOT_FOLDER_ID trong .env.local")
    return m.group(0)


def load_client():
    if not os.path.exists(CLIENT_FILE):
        sys.exit(f"Chưa có {CLIENT_FILE}. Xem hướng dẫn tạo OAuth client trong docs/AI_WORKFLOW.md (mục 'Thiết lập Drive').")
    data = json.load(open(CLIENT_FILE, encoding="utf-8"))
    return data.get("installed") or data["web"]


# ---------- OAuth ----------
def cmd_auth():
    client = load_client()
    result = {}

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            result["code"] = query.get("code", [None])[0]
            result["error"] = query.get("error", [None])[0]
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            msg = "Đăng nhập xong, bạn có thể đóng tab này." if result["code"] else f"Lỗi: {result['error']}"
            self.wfile.write(f"<h2>{msg}</h2>".encode("utf-8"))

        def log_message(self, *a):
            pass

    server = http.server.HTTPServer(("127.0.0.1", 0), Handler)
    redirect = f"http://127.0.0.1:{server.server_port}/"
    url = client["auth_uri"] + "?" + urllib.parse.urlencode({
        "client_id": client["client_id"], "redirect_uri": redirect, "response_type": "code",
        "scope": SCOPE, "access_type": "offline", "prompt": "consent",
    })
    print("Mở trình duyệt để đăng nhập Google... (nếu không tự mở, dán link này vào trình duyệt):\n" + url)
    webbrowser.open(url)
    t = threading.Thread(target=server.handle_request)
    t.start()
    t.join(timeout=300)
    if not result.get("code"):
        sys.exit(f"Không nhận được mã đăng nhập ({result.get('error') or 'hết thời gian'}).")
    r = requests.post(client["token_uri"], data={
        "code": result["code"], "client_id": client["client_id"], "client_secret": client["client_secret"],
        "redirect_uri": redirect, "grant_type": "authorization_code",
    })
    r.raise_for_status()
    token = r.json()
    if "refresh_token" not in token:
        sys.exit("Google không trả refresh_token. Vào https://myaccount.google.com/permissions gỡ quyền app rồi chạy lại auth.")
    os.makedirs(CONFIG_DIR, exist_ok=True)
    json.dump({"refresh_token": token["refresh_token"]}, open(TOKEN_FILE, "w"))
    print(f"OK. Đã lưu token vào {TOKEN_FILE}")


_access = {}


def access_token():
    if "t" in _access:
        return _access["t"]
    if not os.path.exists(TOKEN_FILE):
        sys.exit("Chưa đăng nhập Google. Chạy: python scripts/drive_upload.py auth")
    client = load_client()
    r = requests.post(client["token_uri"], data={
        "client_id": client["client_id"], "client_secret": client["client_secret"],
        "refresh_token": json.load(open(TOKEN_FILE))["refresh_token"], "grant_type": "refresh_token",
    })
    if r.status_code != 200:
        sys.exit(f"Làm mới token thất bại ({r.status_code}): {r.text}\nChạy lại: python scripts/drive_upload.py auth")
    _access["t"] = r.json()["access_token"]
    return _access["t"]


def with_retry(send):
    """Google thỉnh thoảng trả 5xx tạm thời (thao tác thường vẫn thành công) -> thử lại tối đa 4 lần."""
    for attempt in range(4):
        r = send()
        if r.status_code < 500 or attempt == 3:
            return r
        time.sleep(2 * (attempt + 1))


def api(method, path, **kw):
    headers = {"Authorization": f"Bearer {access_token()}", **kw.pop("headers", {})}
    r = with_retry(lambda: requests.request(method, path if path.startswith("http") else API + path, headers=headers, timeout=120, **kw))
    if r.status_code >= 400:
        sys.exit(f"Drive API lỗi {r.status_code} ({method} {path}): {r.text[:300]}")
    return r


# ---------- thao tác Drive ----------
def find_child(parent, name, folder=None):
    q = f"'{parent}' in parents and name = '{name.replace(chr(39), chr(92) + chr(39))}' and trashed = false"
    if folder is True:
        q += f" and mimeType = '{FOLDER_MIME}'"
    files = api("GET", "/files", params={"q": q, "fields": "files(id,name,mimeType)", "pageSize": 10}).json()["files"]
    return files[0]["id"] if files else None


def ensure_folder(parent, name):
    found = find_child(parent, name, folder=True)
    if found:
        return found
    return api("POST", "/files", params={"fields": "id"}, json={"name": name, "mimeType": FOLDER_MIME, "parents": [parent]}).json()["id"]


def put_file(parent, name, data: bytes, mime):
    """Tạo mới hoặc ghi đè file cùng tên trong thư mục `parent` (resumable upload). Trả về ID file."""
    existing = find_child(parent, name)
    if existing:
        init = api("PATCH", f"{UPLOAD}/files/{existing}", params={"uploadType": "resumable", "fields": "id"},
                   json={}, headers={"X-Upload-Content-Type": mime})
    else:
        init = api("POST", f"{UPLOAD}/files", params={"uploadType": "resumable", "fields": "id"},
                   json={"name": name, "parents": [parent]}, headers={"X-Upload-Content-Type": mime})
    r = with_retry(lambda: requests.put(init.headers["Location"], data=data, headers={"Content-Type": mime}, timeout=600))
    if r.status_code >= 400:
        sys.exit(f"Upload {name} lỗi {r.status_code}: {r.text[:300]}")
    return r.json()["id"]


def slugify(title):
    return re.sub(r"[^a-z0-9]+", "-", title.lower().replace("&", "and").replace("'", "")).strip("-")


def read_catalog(root):
    cid = find_child(root, CATALOG_NAME)
    if not cid:
        return {"topics": []}
    return api("GET", f"/files/{cid}", params={"alt": "media"}).json()


# ---------- lệnh ----------
def cmd_upload(dirs):
    root = root_folder_id()
    catalog = read_catalog(root)
    for d in dirs:
        d = os.path.normpath(d)
        meta_path, audio_path = os.path.join(d, "metadata.json"), os.path.join(d, "audio.mp3")
        if not (os.path.exists(meta_path) and os.path.exists(audio_path)):
            sys.exit(f"{d}: thiếu audio.mp3 hoặc metadata.json")
        raw_meta = open(meta_path, "rb").read()
        meta = json.loads(raw_meta.decode("utf-8"))
        lesson_dir, topic_dir = os.path.basename(d), os.path.basename(os.path.dirname(d))

        topic_id = ensure_folder(root, topic_dir)
        lesson_id = ensure_folder(topic_id, lesson_dir)
        audio_id = put_file(lesson_id, "audio.mp3", open(audio_path, "rb").read(), "audio/mpeg")
        meta_id = put_file(lesson_id, "metadata.json", raw_meta, "application/json")

        topics = catalog.setdefault("topics", [])
        topic = next((t for t in topics if t["number"] == meta["topic_number"]), None)
        if not topic:
            topic = {"number": meta["topic_number"], "lessons": []}
            topics.append(topic)
        topic.update({"slug": slugify(meta["topic_title"]), "title": meta["topic_title"],
                      "title_vi": meta.get("topic_title_vi", topic.get("title_vi", "")), "folder": topic_dir})
        entry = {"lesson_index": meta["lesson_number"], "title": meta["lesson_title"],
                 "duration_seconds": meta["duration_seconds"], "folder": lesson_dir,
                 "audio_id": audio_id, "metadata_id": meta_id}
        topic["lessons"] = sorted([l for l in topic["lessons"] if l["lesson_index"] != entry["lesson_index"]] + [entry],
                                  key=lambda l: l["lesson_index"])
        print(f"uploaded: {topic_dir}/{lesson_dir} ({meta['duration_seconds']}s)")

    catalog["topics"].sort(key=lambda t: t["number"])
    put_file(root, CATALOG_NAME, json.dumps(catalog, ensure_ascii=False, indent=1).encode("utf-8"), "application/json")
    print(f"catalog.json cập nhật: {sum(len(t['lessons']) for t in catalog['topics'])} lesson, {len(catalog['topics'])} topic")
    verify_public(root)


def verify_public(root):
    """Kiểm tra người chưa đăng nhập (dùng API key) đọc được catalog.json -> web hiển thị được."""
    key = read_env().get("GOOGLE_API_KEY")
    if not key:
        return print("(bỏ qua kiểm tra công khai: thiếu GOOGLE_API_KEY)")
    r = requests.get(f"{API}/files", params={"q": f"'{root}' in parents and name = '{CATALOG_NAME}' and trashed = false",
                                              "fields": "files(id)", "key": key})
    files = r.json().get("files", []) if r.ok else []
    print("kiểm tra công khai:", "OK, web đọc được catalog.json" if files else f"CHƯA đọc được ({r.status_code}). Kiểm tra thư mục gốc đã share 'Anyone with the link'")


def cmd_list():
    """Đọc catalog.json như người dùng web (chỉ cần API key, không cần đăng nhập)."""
    root, key = root_folder_id(), read_env().get("GOOGLE_API_KEY")
    r = requests.get(f"{API}/files", params={"q": f"'{root}' in parents and name = '{CATALOG_NAME}' and trashed = false",
                                              "fields": "files(id)", "key": key})
    r.raise_for_status()
    files = r.json().get("files", [])
    catalog = {"topics": []}
    if files:
        m = requests.get(f"{API}/files/{files[0]['id']}", params={"alt": "media", "key": key})
        m.raise_for_status()
        catalog = json.loads(m.content.decode("utf-8"))
    for t in catalog.get("topics", []):
        print(f"Topic {t['number']:02d} {t['title']}: " + ", ".join(f"L{l['lesson_index']:02d}({l['duration_seconds']}s)" for l in t["lessons"]))
    if not catalog.get("topics"):
        print("(Drive chưa có lesson nào)")


def main():
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    cmd, rest = args[0], args[1:]
    if cmd == "auth":
        cmd_auth()
    elif cmd == "list":
        cmd_list()
    elif cmd == "upload":
        if rest and rest[0] == "--all":
            base = rest[1] if len(rest) > 1 else "generated"
            rest = sorted(os.path.join(dp) for dp, _, fs in os.walk(base) if "audio.mp3" in fs and "metadata.json" in fs)
        if not rest:
            sys.exit("Không có thư mục lesson nào để upload.")
        cmd_upload(rest)
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
