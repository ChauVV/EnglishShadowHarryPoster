# AI Workflow - Làm bài shadowing và đưa lên Drive

> **Dành cho AI.** Người dùng sẽ bảo bạn "đọc file này". Hãy làm theo đúng file này, không hỏi lại những gì đã ghi ở đây.
> **Đây là nơi duy nhất ghi nhớ tiến độ.** Thư mục `generated/` có thể bị xoá bất cứ lúc nào, tuyệt đối không dựa vào nó để biết đã làm tới đâu.

## Nhiệm vụ mỗi lần chạy
1. Đọc mục **PROGRESS** bên dưới -> biết bài tiếp theo (`NEXT`).
2. Làm **6 lesson liên tiếp** bắt đầu từ `NEXT` (nếu hết topic thì sang topic kế, vẫn đủ 6 bài), theo danh sách trong [CONTENT_PLAN.md](CONTENT_PLAN.md).
3. Với mỗi lesson: viết kịch bản -> tạo audio -> kiểm tra thời lượng (xem "Làm một lesson").
4. Sau khi cả 6 bài xong: **upload lên Drive** (xem "Upload lên Drive") và kiểm tra.
5. Cập nhật file này: thêm 6 dòng vào bảng **LOG**, cập nhật **NEXT**. Chỉ ghi "đã lên Drive" khi lệnh upload đã báo thành công.
6. **Commit và push code** lên git (kịch bản `scripts/dialogues/*.json`, file này, và mọi thay đổi code đi kèm; không commit `generated/` hay `.english-shadowing/`). Người dùng đã yêu cầu luôn push sau mỗi lần làm xong lesson.
7. Báo người dùng: đã làm bài nào, thời lượng thật, đã lên Drive chưa, NEXT là gì.

**Ảnh bìa:** mỗi topic có 5 ảnh SVG đơn giản trong `public/topic-covers/<slug>/1..5.svg`, tạo bằng `python scripts/make_topic_covers.py`. L01-L05 dùng ảnh 1-5, các bài sau `lib/topicCovers.js` chọn ngẫu nhiên (cố định theo bài) trong 5 ảnh. **Khi bắt đầu một topic mới** (chưa có thư mục ảnh), thêm 5 cảnh vào `SCENES` trong script đó, chạy lại, rồi commit cùng các lesson. Topic chưa có ảnh vẫn chạy bình thường (web dùng ô gradient).

Script upload đã tự thử lại khi Google trả lỗi 5xx tạm thời; nếu vẫn dừng giữa chừng, **chạy lại đúng lệnh** (ghi đè an toàn, không tạo bài trùng). Nếu upload thất bại (chưa đăng nhập, mất mạng...): vẫn ghi bài vào LOG với cột Drive = `chưa`, và `NEXT` vẫn tiến lên. Lần sau, **trước khi làm bài mới**, chạy `python scripts/drive_upload.py list` để xem Drive đang có bài nào, so với LOG; bài nào ở LOG là `chưa` mà `generated/` không còn thì phải **làm lại bài đó** (kịch bản vẫn còn trong `scripts/dialogues/`, chạy lại `make_dialogue.py` là ra audio giống hệt, rồi upload).

## PROGRESS

**NEXT: `T04-L05`** (Topic 04 Shopping & Clothes - Finding the Fitting Room, mục tiêu 2:40). Topic 01, 02, 15 đã xong đủ 20 bài; Topic 03 đã có ảnh bìa. Tiếp tục theo thứ tự topic còn dang dở, không cần hỏi lại. Lưu ý: T15-L04..L09 đã được đổi sang hướng tài chính cho vay (xem CONTENT_PLAN). Người dùng làm trong ngành tài chính cho vay (non-bank), nên các topic liên quan tiền bạc/nhà ở nên ưu tiên góc nhìn vay, tiết kiệm, thế chấp.

### LOG
| Bài | Tên lesson | Mục tiêu | Thật | Drive | Ngày |
|---|---|---|---|---|---|
| T01-L01 | Checking in at the Airport Counter | 2:00 | 1:55 | rồi | 2026-10-07 |
| T01-L02 | Going Through Security | 2:10 | 2:10 | rồi | 2026-10-07 |
| T01-L03 | Finding Your Gate | 2:20 | 2:20 | rồi | 2026-10-07 |
| T01-L04 | Buying a Train Ticket | 2:30 | 2:31 | rồi | 2026-10-07 |
| T01-L05 | Asking for a Window Seat | 2:40 | 2:33 | rồi | 2026-10-08 |
| T01-L06 | Boarding the Plane | 2:50 | 2:56 | rồi | 2026-10-08 |
| T01-L07 | Collecting Your Luggage | 3:00 | 2:56 | rồi | 2026-10-08 |
| T01-L08 | Booking a Flight Online | 4:00 | 4:06 | rồi | 2026-10-08 |
| T01-L09 | Lost Luggage at the Airport | 4:05 | 4:11 | rồi | 2026-10-08 |
| T01-L10 | Flight Delayed - What Now? | 4:10 | 4:05 | rồi | 2026-10-08 |
| T01-L11 | Going Through Customs | 4:15 | 4:08 | rồi | 2026-10-08 |
| T01-L12 | Renting a Car Abroad | 4:20 | 4:26 | rồi | 2026-10-08 |
| T01-L13 | Planning a Week in Japan | 4:25 | 4:17 | rồi | 2026-10-08 |
| T01-L14 | Changing Money at the Airport | 4:30 | 4:24 | rồi | 2026-10-08 |
| T01-L15 | Missing a Connecting Flight | 4:35 | 4:30 | rồi | 2026-10-08 |
| T01-L16 | Taking a Taxi From the Airport | 4:40 | 4:42 | rồi | 2026-10-08 |
| T01-L17 | A Long Train Journey | 4:45 | 4:42 | rồi | 2026-10-08 |
| T01-L18 | Buying Travel Insurance | 4:50 | 5:25 | rồi | 2026-10-08 |
| T01-L19 | Packing for a Two-Week Trip | 4:55 | 5:21 | rồi | 2026-10-08 |
| T01-L20 | Airport Announcements | 5:00 | 5:44 | rồi | 2026-10-08 |
| T02-L01 | Checking in at the Front Desk | 2:00 | 2:04 | rồi | 2026-10-08 |
| T02-L02 | Asking for the Wi-Fi Password | 2:10 | 2:02 | rồi | 2026-10-08 |
| T02-L03 | Ordering Room Service | 2:20 | 2:33 | rồi | 2026-10-08 |
| T02-L04 | Asking for Extra Towels | 2:30 | 2:30 | rồi | 2026-10-08 |
| T02-L05 | Checking Out | 2:40 | 2:42 | rồi | 2026-10-08 |
| T02-L06 | Asking About Breakfast Time | 2:50 | 2:50 | rồi | 2026-10-08 |
| T02-L07 | Calling the Reception | 3:00 | 2:58 | rồi | 2026-10-08 |
| T02-L08 | Booking a Room by Phone | 4:00 | 4:24 | rồi | 2026-10-08 |
| T02-L09 | A Noisy Room - Asking to Change | 4:05 | 4:03 | rồi | 2026-10-08 |
| T02-L10 | The Air Conditioner Is Broken | 4:10 | 3:59 | rồi | 2026-10-08 |
| T02-L11 | A Tour of the Hotel Facilities | 4:15 | 4:19 | rồi | 2026-10-08 |
| T02-L12 | Booking Rooms for a Group | 4:20 | 4:26 | rồi | 2026-10-08 |
| T02-L13 | Asking for a Late Check-out | 4:25 | 4:18 | rồi | 2026-10-08 |
| T02-L14 | Comparing Hotels Online | 4:30 | 4:37 | rồi | 2026-10-08 |
| T02-L15 | Lost Room Key | 4:35 | 4:40 | rồi | 2026-10-08 |
| T02-L16 | Booking a Tour at the Hotel Desk | 4:40 | 4:41 | rồi | 2026-10-08 |
| T02-L17 | Staying at a Hostel | 4:45 | 4:50 | rồi | 2026-10-08 |
| T02-L18 | Complaining About a Dirty Room | 4:50 | 4:49 | rồi | 2026-10-08 |
| T02-L19 | Writing a Hotel Review | 4:55 | 4:48 | rồi | 2026-10-08 |
| T02-L20 | A Hotel Welcome Speech | 5:00 | 5:14 | rồi | 2026-10-08 |
| T03-L01 | A Table for Two | 2:00 | 2:01 | rồi | 2026-10-08 |
| T03-L02 | Ordering a Drink | 2:10 | 2:22 | rồi | 2026-10-08 |
| T03-L03 | Asking for the Menu | 2:20 | 2:28 | rồi | 2026-10-08 |
| T03-L04 | Ordering Breakfast | 2:30 | 2:43 | rồi | 2026-10-08 |
| T03-L05 | Asking for the Bill | 2:40 | 2:41 | rồi | 2026-10-08 |
| T03-L06 | Ordering Fast Food | 2:50 | 3:02 | rồi | 2026-10-08 |
| T15-L01 | Opening a Bank Account | 2:00 | 2:05 | rồi | 2026-10-07 |
| T15-L02 | Withdrawing Cash | 2:10 | 2:06 | rồi | 2026-10-07 |
| T15-L03 | Checking Your Balance | 2:20 | 2:20 | rồi | 2026-10-07 |
| T15-L04 | Banks and Non-Bank Lenders | 2:30 | 2:35 | rồi | 2026-10-07 |
| T15-L05 | Choosing a Savings Account | 2:40 | 2:47 | rồi | 2026-10-07 |
| T15-L06 | Applying for a Personal Loan | 2:50 | 2:50 | rồi | 2026-10-07 |
| T15-L07 | Applying for a Home Loan | 3:00 | 2:55 | rồi | 2026-10-07 |
| T15-L08 | Borrowing for an Investment Property | 4:00 | 3:57 | rồi | 2026-10-07 |
| T15-L09 | A Short-Term Loan from a Non-Bank Lender | 4:05 | 4:00 | rồi | 2026-10-07 |
| T15-L10 | Saving for a Trip | 4:10 | 4:18 | rồi | 2026-10-07 |
| T15-L11 | Making a Monthly Budget | 4:15 | 4:12 | rồi | 2026-10-07 |
| T15-L12 | Sending Money Abroad | 4:20 | 4:29 | rồi | 2026-10-07 |
| T15-L13 | Paying Bills Online | 4:25 | 4:26 | rồi | 2026-10-07 |
| T15-L14 | Talking About Taxes | 4:30 | 4:24 | rồi | 2026-10-07 |
| T15-L15 | Buying Things on Installments | 4:35 | 4:32 | rồi | 2026-10-07 |
| T15-L16 | Investing for Beginners | 4:40 | 4:36 | rồi | 2026-10-07 |
| T15-L17 | A Bank Loan Meeting | 4:45 | 4:39 | rồi | 2026-10-07 |
| T15-L18 | Spotting a Scam | 4:50 | 4:50 | rồi | 2026-10-07 |
| T15-L19 | Money Habits | 4:55 | 4:53 | rồi | 2026-10-07 |
| T15-L20 | Simple Saving Tips | 5:00 | 4:59 | rồi | 2026-10-07 |
| T03-L07 | Asking About Today's Special | 3:00 | 3:11 | rồi | 2026-10-08 |
| T03-L08 | Making a Reservation by Phone | 4:00 | 4:07 | rồi | 2026-10-08 |
| T03-L09 | Ordering a Full Dinner | 4:05 | 4:20 | rồi | 2026-10-08 |
| T03-L10 | Food Allergies and Special Requests | 4:10 | 4:18 | rồi | 2026-10-08 |
| T03-L11 | The Wrong Order | 4:15 | 4:20 | rồi | 2026-10-08 |
| T03-L12 | Splitting the Bill | 4:20 | 4:36 | rồi | 2026-10-08 |
| T03-L13 | A Birthday Dinner | 4:25 | 4:18 | rồi | 2026-10-08 |
| T03-L14 | Trying Local Food With a Friend | 4:30 | 4:16 | rồi | 2026-10-08 |
| T03-L15 | Ordering Takeaway by Phone | 4:35 | 4:46 | rồi | 2026-10-08 |
| T03-L16 | Choosing a Wine | 4:40 | 4:39 | rồi | 2026-10-08 |
| T03-L17 | A Business Lunch | 4:45 | 4:37 | rồi | 2026-10-08 |
| T03-L18 | At a Street Food Market | 4:50 | 4:53 | rồi | 2026-10-08 |
| T03-L19 | Recommending a Restaurant | 4:55 | 4:43 | rồi | 2026-10-08 |
| T03-L20 | Reviewing a Restaurant | 5:00 | 5:07 | rồi | 2026-10-08 |
| T04-L01 | Asking for the Price | 2:00 | 2:00 | rồi | 2026-10-08 |
| T04-L02 | Looking for a Size | 2:10 | 2:10 | rồi | 2026-10-08 |
| T04-L03 | Trying on a Shirt | 2:20 | 2:31 | rồi | 2026-10-08 |
| T04-L04 | Paying at the Cash Register | 2:30 | 2:36 | rồi | 2026-10-08 |

(Cột Drive: `rồi` = đã upload và kiểm tra, `chưa` = chưa upload.)

## Làm một lesson

Nguồn bài: [CONTENT_PLAN.md](CONTENT_PLAN.md) (danh sách 30 topic x 20 lesson, độ dài mục tiêu, kiểu D/M, quy tắc độ dài và độ khó).

1. **Kịch bản** -> `scripts/dialogues/T<NN>_L<MM>.json`, theo đúng mẫu `scripts/dialogues/T01_L01.json`:
   - `topic_number`, `topic_title`, `topic_title_vi`, `lesson_number`, `lesson_title`: đúng như trong CONTENT_PLAN (tên topic và tên lesson phải khớp từng chữ).
   - `speakers`: tên -> giọng Kokoro. Đa dạng giọng theo số lesson M: `M % 3 == 1`: Emma `af_heart` + Jack `am_michael`; `== 2`: Sarah `af_sarah` + Adam `am_adam`; `== 0`: Bella `af_bella` + Michael `am_michael`. Hội thoại (D) = 2 người 1 nam 1 nữ; độc thoại (M) = 1 người. Giọng nào lỗi thì đổi `af_heart`/`am_michael`.
   - `lines`: `[người nói, câu tiếng Anh, bản dịch tiếng Việt]`. Mỗi dòng 1 lượt nói (1-3 câu ngắn).
   - Nội dung: tiếng Anh tự nhiên, đúng tình huống tên bài, không trùng ý các bài khác cùng topic, không nhân vật hay thương hiệu có bản quyền, dịch Việt tự nhiên. Độ khó tăng dần theo số lesson (xem CONTENT_PLAN).
2. **VIẾT ĐỦ DÀI NGAY TỪ ĐẦU, chỉ tạo audio 1 lần** (người dùng yêu cầu: tạo audio -> thấy ngắn -> thêm câu -> tạo lại tốn gấp đôi thời gian).
   - Số từ cần viết = `(mục tiêu giây + 5) x hệ số`. Hệ số đo thực tế (T01-L05..L20, T02-L01..L02):
     - Bài dài L08-L20, Sarah/Adam (`M % 3 == 2`): **2.55 từ/giây** (đọc nhanh nhất)
     - Bài dài, Emma/Jack (`M % 3 == 1`): **2.35 từ/giây**
     - Bài dài, Bella/Michael (`M % 3 == 0`): **2.25 từ/giây** (đọc chậm nhất)
     - Bài ngắn L01-L07 (lượt nói ngắn, A2): Sarah/Adam **2.5**, Emma/Jack **2.35**, Bella/Michael **2.25** từ/giây (T02-L03..L07 dùng các hệ số này, sai lệch chỉ -2..+13 giây).
     - Độc thoại (M): **~2.45 từ/giây** nếu câu dài nhiều dấu phẩy (T01-L20: 835 từ = 5:44); T15-L20 câu gọn thì 2.75.
     - Lượt nói càng dài, càng nhiều dấu phẩy thì đọc càng chậm (có nghỉ). Ví dụ: 4:50 Bella/Michael -> 295 x 2.25 ≈ 665 từ (T01-L18 viết 730 từ ra 5:25, lố 35 giây).
   - **Đếm số từ TRƯỚC khi tạo audio** (đoạn python ngắn đếm `len(câu.split())`, kiểm tra luôn: không 2 lượt liền cùng người nói, không 2 lượt liền mở bằng cùng một từ, tên khớp `speakers`). Thiếu thì viết thêm ngay, chưa chạy audio.
   - Ưu tiên kéo dài lượt nói (câu dài, có chi tiết) hơn là thêm nhiều lượt ngắn.
3. **Audio**: `python scripts/make_dialogue.py scripts/dialogues/T01_L02.json generated` (~2 phút/bài, chạy nền). Mẹo tiết kiệm thời gian: viết xong 3 bài là cho chạy audio nền ngay (một hàng đợi chạy lần lượt từng bài), trong lúc đó viết 3 bài tiếp theo. Không chạy 2 tiến trình Kokoro song song.
   - Lưu ý: giọng Bella/Michael dao động nhiều (2.25-2.5 từ/giây giữa các bài), nên viết dư theo mức 2.45 để không bị ngắn.
   - Script in thời lượng thật. **Chấp nhận từ -10 giây trở lên**: dài hơn mục tiêu là được, KHÔNG tạo lại (người dùng chấp nhận bài dài hơn để không phải chạy audio 2 lần). Chỉ tạo lại khi ngắn hơn quá 10 giây.
   - Lần chạy đầu Kokoro tải model nên hơi chậm. Cần sẵn: `pip install kokoro soundfile` và ffmpeg (đã có trên máy này).
4. Kết quả: `generated/Topic_<NN>_<Tên>/Lesson_<MM>_<Tên>/{audio.mp3, metadata.json}`.

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
- Giọng đọc: Kokoro (Apache 2.0, miễn phí, dùng thương mại được).
