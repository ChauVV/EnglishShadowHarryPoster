// Video YouTube gợi ý hiện cho mọi người ở hàng YouTube trên trang chủ.
// Chỉ lưu id/tiêu đề/thời lượng để hiện thumbnail: KHÔNG lưu phụ đề hay bản dịch của các video này.
// Bấm vào thì app tạo bài học như với mọi link khác (bằng key và lượt dịch của chính người dùng, lưu trong Drive của họ).
// Giấy phép (kiểm tra trên YouTube ngày 2026-11-14): cả 9 video là "Standard YouTube License".
// ready: true khi đã có bài dịch sẵn public/featured-lessons/<id>.json (mở ngay, không cần đăng nhập, không tốn lượt)
export const FEATURED_VIDEOS = [
  { id: 'VH9b5eec93o', title: 'Daniel Radcliffe, Bobby Moynihan Interview | The Fall and Rise of Reggie Dinkins', channel: "We're Watching What", seconds: 504, ready: true },
  { id: 'h-WrtgutiPw', title: 'Modern Costumes Make Thomasin McKenzie Uncomfortable | Fackham Hall Interview', channel: 'Nerd Reactor', seconds: 512, ready: true },
  { id: 'TkiOe9IRm88', title: 'Harry Potter and the Cursed Child Actors on National Tour & Pressures of Wizarding World | Interview', channel: 'Nerd Reactor', seconds: 2131, ready: true },
  { id: 'OPN6gxyNXB0', title: 'DANIEL RADCLIFFE is lovable, says STEVE BUSCEMI', channel: 'Really Famous with Kara Mayer Robinson', seconds: 712, ready: true },
  { id: 'BHXdz1j0Xwc', title: 'Tom Felton asks the Cast of Harry Potter Random Questions! Whats on your mind?', channel: 'Harry Potter Stuff', seconds: 403, ready: true },
  { id: 'LqyZfFubnBA', title: 'Harry Potter and the Prisoner of Azkaban Interview', channel: 'Natalia Ławresz', seconds: 440, ready: true },
  { id: 'RVzIGNFyvYU', title: 'Learn English Vlog - What I Eat In a Day (Real Daily English)', channel: 'Smashing English!', seconds: 780, ready: true },
  { id: '2IW0eN9jmDU', title: "Learn English Vlog - Visit Shakespeare's Hometown!", channel: 'Smashing English!', seconds: 816, ready: true },
  { id: '0BEIvmQKID8', title: 'Learn English Phrasal Verbs You NEED For Everyday Life in 15 Minutes!', channel: 'Smashing English!', seconds: 941, ready: true },
];

export const readyFeatured = (id) => FEATURED_VIDEOS.some((v) => v.id === id && v.ready);
