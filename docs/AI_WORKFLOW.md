# AI Workflow - Làm bài shadowing và đưa lên Drive

> **Dành cho AI.** Người dùng sẽ bảo bạn "đọc file này". Hãy làm theo đúng file này, không hỏi lại những gì đã ghi ở đây.
> **Đây là nơi duy nhất ghi nhớ tiến độ.** Thư mục `generated/` có thể bị xoá bất cứ lúc nào, tuyệt đối không dựa vào nó để biết đã làm tới đâu.

## Nhiệm vụ mỗi lần chạy
1. Đọc mục **PROGRESS** bên dưới -> biết bài tiếp theo (`NEXT`).
2. Làm **3 lesson liên tiếp** bắt đầu từ `NEXT` (nếu hết topic thì sang topic kế, vẫn đủ 3 bài), theo danh sách trong [CONTENT_PLAN.md](CONTENT_PLAN.md).
3. Với mỗi lesson: viết kịch bản -> tạo audio -> kiểm tra thời lượng (xem "Làm một lesson").
4. Sau khi cả 3 bài xong: **upload lên Drive** (xem "Upload lên Drive") và kiểm tra.
5. Cập nhật file này: thêm 3 dòng vào bảng **LOG**, cập nhật **NEXT**. Chỉ ghi "đã lên Drive" khi lệnh upload đã báo thành công.
6. Báo người dùng: đã làm bài nào, thời lượng thật, đã lên Drive chưa, NEXT là gì.

Nếu upload thất bại (chưa đăng nhập, mất mạng...): vẫn ghi bài vào LOG với cột Drive = `chưa`, và `NEXT` vẫn tiến lên. Lần sau, **trước khi làm bài mới**, chạy `python scripts/drive_upload.py list` để xem Drive đang có bài nào, so với LOG; bài nào ở LOG là `chưa` mà `generated/` không còn thì phải **làm lại bài đó** (kịch bản vẫn còn trong `scripts/dialogues/`, chạy lại `make_dialogue.py` là ra audio giống hệt, rồi upload).

## PROGRESS

**NEXT: `T01-L02`** (Topic 01 Travel & Airports - Going Through Security, mục tiêu 2:10)

### LOG
| Bài | Tên lesson | Mục tiêu | Thật | Drive | Ngày |
|---|---|---|---|---|---|
| T01-L01 | Checking in at the Airport Counter | 2:00 | 1:55 | rồi | 2026-10-07 |

(Cột Drive: `rồi` = đã upload và kiểm tra, `chưa` = chưa upload.)

## Làm một lesson

Nguồn bài: [CONTENT_PLAN.md](CONTENT_PLAN.md) (danh sách 30 topic x 20 lesson, độ dài mục tiêu, kiểu D/M, quy tắc độ dài và độ khó).

1. **Kịch bản** -> `scripts/dialogues/T<NN>_L<MM>.json`, theo đúng mẫu `scripts/dialogues/T01_L01.json`:
   - `topic_number`, `topic_title`, `topic_title_vi`, `lesson_number`, `lesson_title`: đúng như trong CONTENT_PLAN (tên topic và tên lesson phải khớp từng chữ).
   - `speakers`: tên -> giọng Kokoro. Đa dạng giọng theo số lesson M: `M % 3 == 1`: Emma `af_heart` + Jack `am_michael`; `== 2`: Sarah `af_sarah` + Adam `am_adam`; `== 0`: Bella `af_bella` + Michael `am_michael`. Hội thoại (D) = 2 người 1 nam 1 nữ; độc thoại (M) = 1 người. Giọng nào lỗi thì đổi `af_heart`/`am_michael`.
   - `lines`: `[người nói, câu tiếng Anh, bản dịch tiếng Việt]`. Mỗi dòng 1 lượt nói (1-3 câu ngắn).
   - Nội dung: tiếng Anh tự nhiên, đúng tình huống tên bài, không trùng ý các bài khác cùng topic, không nhân vật hay thương hiệu có bản quyền, dịch Việt tự nhiên. Độ khó tăng dần theo số lesson (xem CONTENT_PLAN).
2. **Audio**: `python scripts/make_dialogue.py scripts/dialogues/T01_L02.json generated`
   - Script in thời lượng thật. Phải nằm trong **±10 giây** so với mục tiêu; lệch thì thêm/bớt câu rồi chạy lại.
   - Hệ số tham khảo: ~2.1 từ/giây (lượt ngắn ~9 từ) đến ~2.3 từ/giây (lượt dài ~14 từ).
   - Lần chạy đầu Kokoro tải model nên hơi chậm. Cần sẵn: `pip install kokoro soundfile` và ffmpeg (đã có trên máy này).
3. Kết quả: `generated/Topic_<NN>_<Tên>/Lesson_<MM>_<Tên>/{audio.mp3, metadata.json}`.

## Upload lên Drive

```
python scripts/drive_upload.py upload generated/Topic_01_Travel_and_Airports/Lesson_02_Going_Through_Security [thư mục lesson khác...]
python scripts/drive_upload.py upload --all generated      # hoặc upload mọi lesson trong generated/
python scripts/drive_upload.py list                         # xem Drive đang có bài nào
```
Script tự: tạo thư mục topic và lesson nếu chưa có, upload `audio.mp3` + `metadata.json` (ghi đè nếu đã có), cập nhật `catalog.json` ở gốc Drive (web đọc file này), rồi kiểm tra người chưa đăng nhập có đọc được không. Thấy dòng `kiểm tra công khai: OK` là xong.

Web không cần deploy lại khi có bài mới: web đọc `catalog.json` từ Drive (cache khoảng 1 phút).

### Thiết lập Drive (chỉ làm 1 lần, người dùng làm; AI chỉ hướng dẫn)
Upload cần quyền ghi nên không dùng API key được. Cần OAuth client:
1. https://console.cloud.google.com/apis/credentials (đúng project `harryposterenglishshadowing`) -> **Create credentials -> OAuth client ID** -> Application type **Desktop app** -> Create -> **Download JSON**.
2. Lưu file đó thành `.english-shadowing/client.json` trong thư mục dự án (thư mục này nằm trong `.gitignore`, **tuyệt đối không commit** vì chứa client secret). Script cũng chấp nhận `~/.english-shadowing/client.json`.
3. Màn hình **OAuth consent screen**: User type **External**, điền tên app và email, thêm email của bạn vào **Test users**. Nên bấm **Publish app** (In production) để token không hết hạn sau 7 ngày. App chưa verify chỉ có bạn dùng nên chấp nhận cảnh báo "unverified".
4. Chạy `python scripts/drive_upload.py auth` -> trình duyệt mở -> chọn tài khoản chủ thư mục Drive -> Cho phép. Token lưu cùng thư mục với `client.json`.
5. Thư mục gốc Drive phải được chia sẻ **Anyone with the link: Viewer** (file mới upload kế thừa quyền này). `DRIVE_ROOT_FOLDER_ID` và `GOOGLE_API_KEY` nằm trong `.env.local`.

Nếu thấy lỗi "Chưa có client.json" hoặc "Chưa đăng nhập Google": báo người dùng làm bước tương ứng ở trên, đừng cố đi đường vòng.

## Cấu trúc trên Drive (web đang đọc đúng cấu trúc này)
```
<gốc Drive>/
  catalog.json                                  <- mục lục nhẹ, do script tạo, KHÔNG sửa tay
  Topic_01_Travel_and_Airports/
    Lesson_01_Checking_in_at_the_Airport_Counter/
      audio.mp3
      metadata.json
  Book_1/ ...                                   <- Harry Potter cũ (chỉ admin xem), bỏ qua
```
Web: trang chủ liệt kê topic từ `catalog.json`; mở một bài mới tải `metadata.json` (text, từng câu có `start/end/vi/speaker`) và stream `audio.mp3`.

## Ghi chú kỹ thuật
- Mã nguồn liên quan: `lib/topics.js`, `app/api/topics/route.js`, `app/api/topic-audio/[topic]/[lesson]/route.js`, `app/topic/...`.
- Slug URL tạo từ `topic_title` (ví dụ `travel-and-airports`), bài là số thứ tự: `/topic/travel-and-airports/2`.
- Bài ngắn / dài trên web tách theo thời lượng 3:30 (210 giây).
- Giọng đọc: Kokoro (Apache 2.0, miễn phí, dùng thương mại được).
