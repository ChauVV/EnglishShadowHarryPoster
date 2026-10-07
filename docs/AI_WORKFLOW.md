# AI Workflow - Làm bài shadowing và đưa lên Drive

> **Dành cho AI.** Người dùng sẽ bảo bạn "đọc file này". Hãy làm theo đúng file này, không hỏi lại những gì đã ghi ở đây.
> **Đây là nơi duy nhất ghi nhớ tiến độ.** Thư mục `generated/` có thể bị xoá bất cứ lúc nào, tuyệt đối không dựa vào nó để biết đã làm tới đâu.

## Nhiệm vụ mỗi lần chạy
1. Đọc mục **PROGRESS** bên dưới -> biết bài tiếp theo (`NEXT`).
2. Làm **3 lesson liên tiếp** bắt đầu từ `NEXT` (nếu hết topic thì sang topic kế, vẫn đủ 3 bài), theo danh sách trong [CONTENT_PLAN.md](CONTENT_PLAN.md).
3. Với mỗi lesson: viết kịch bản -> tạo audio -> kiểm tra thời lượng (xem "Làm một lesson").
4. Sau khi cả 3 bài xong: **upload lên Drive** (xem "Upload lên Drive") và kiểm tra.
5. Cập nhật file này: thêm 3 dòng vào bảng **LOG**, cập nhật **NEXT**. Chỉ ghi "đã lên Drive" khi lệnh upload đã báo thành công.
6. **Commit và push code** lên git (kịch bản `scripts/dialogues/*.json`, file này, và mọi thay đổi code đi kèm; không commit `generated/` hay `.english-shadowing/`). Người dùng đã yêu cầu luôn push sau mỗi lần làm xong lesson.
7. Báo người dùng: đã làm bài nào, thời lượng thật, đã lên Drive chưa, NEXT là gì.

**Ảnh bìa:** mỗi topic có 5 ảnh SVG đơn giản trong `public/topic-covers/<slug>/1..5.svg`, tạo bằng `python scripts/make_topic_covers.py`. L01-L05 dùng ảnh 1-5, các bài sau `lib/topicCovers.js` chọn ngẫu nhiên (cố định theo bài) trong 5 ảnh. **Khi bắt đầu một topic mới** (chưa có thư mục ảnh), thêm 5 cảnh vào `SCENES` trong script đó, chạy lại, rồi commit cùng các lesson. Topic chưa có ảnh vẫn chạy bình thường (web dùng ô gradient).

Script upload đã tự thử lại khi Google trả lỗi 5xx tạm thời; nếu vẫn dừng giữa chừng, **chạy lại đúng lệnh** (ghi đè an toàn, không tạo bài trùng). Nếu upload thất bại (chưa đăng nhập, mất mạng...): vẫn ghi bài vào LOG với cột Drive = `chưa`, và `NEXT` vẫn tiến lên. Lần sau, **trước khi làm bài mới**, chạy `python scripts/drive_upload.py list` để xem Drive đang có bài nào, so với LOG; bài nào ở LOG là `chưa` mà `generated/` không còn thì phải **làm lại bài đó** (kịch bản vẫn còn trong `scripts/dialogues/`, chạy lại `make_dialogue.py` là ra audio giống hệt, rồi upload).

## PROGRESS

**NEXT: `T15-L10`** (Topic 15 Money & Banking - Saving for a Trip, mục tiêu 4:10). Người dùng yêu cầu ưu tiên làm hết topic 15 trước; làm xong T15 thì quay lại **`T01-L05`** (Topic 01 - Asking for a Window Seat, mục tiêu 2:40). Khi đó cứ tiếp tục theo thứ tự topic còn dang dở, không cần hỏi lại. Lưu ý: T15-L04..L09 đã được đổi sang hướng tài chính cho vay (xem CONTENT_PLAN); người dùng muốn các bài T15 sau cũng thiên về non-bank, tiết kiệm, vay, thế chấp, vay bất động sản đầu tư.

### LOG
| Bài | Tên lesson | Mục tiêu | Thật | Drive | Ngày |
|---|---|---|---|---|---|
| T01-L01 | Checking in at the Airport Counter | 2:00 | 1:55 | rồi | 2026-10-07 |
| T01-L02 | Going Through Security | 2:10 | 2:10 | rồi | 2026-10-07 |
| T01-L03 | Finding Your Gate | 2:20 | 2:20 | rồi | 2026-10-07 |
| T01-L04 | Buying a Train Ticket | 2:30 | 2:31 | rồi | 2026-10-07 |
| T15-L01 | Opening a Bank Account | 2:00 | 2:05 | rồi | 2026-10-07 |
| T15-L02 | Withdrawing Cash | 2:10 | 2:06 | rồi | 2026-10-07 |
| T15-L03 | Checking Your Balance | 2:20 | 2:20 | rồi | 2026-10-07 |
| T15-L04 | Banks and Non-Bank Lenders | 2:30 | 2:35 | rồi | 2026-10-07 |
| T15-L05 | Choosing a Savings Account | 2:40 | 2:47 | rồi | 2026-10-07 |
| T15-L06 | Applying for a Personal Loan | 2:50 | 2:50 | rồi | 2026-10-07 |
| T15-L07 | Applying for a Home Loan | 3:00 | 2:55 | rồi | 2026-10-07 |
| T15-L08 | Borrowing for an Investment Property | 4:00 | 3:57 | rồi | 2026-10-07 |
| T15-L09 | A Short-Term Loan from a Non-Bank Lender | 4:05 | 4:00 | rồi | 2026-10-07 |

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
   - Hệ số tham khảo: ~2.1 từ/giây (lượt ngắn ~9 từ) đến ~2.3 từ/giây (lượt dài ~14 từ). Bản nháp đầu thường bị NGẮN hơn mục tiêu 15-30 giây (lần T01-L02..L04 phải thêm ~40-90 từ): hãy viết dư ngay từ đầu, khoảng `mục tiêu(giây) x 2.15` từ, ưu tiên kéo dài lượt nói thay vì thêm quá nhiều lượt ngắn.
   - Kiểm tra kịch bản: không để 2 lượt liên tiếp cùng mở bằng một từ (vd "Good."), tên giọng khớp `speakers`.
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
3. OAuth consent screen: đã thiết lập (External, app `englishshadow`, đã **Publish app** sang In production ngày 2026-10-07, nên token không hết hạn sau 7 ngày). Nếu sau này token vẫn bị từ chối, chạy lại bước 4.
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
