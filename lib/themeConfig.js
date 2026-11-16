// Hằng số của giao diện sáng/tối. Để riêng, KHÔNG đặt trong lib/theme.js ('use client'): layout (server) cần đọc chuỗi script này,
// mà giá trị export từ file 'use client' phía server chỉ là một tham chiếu, không phải chuỗi.
export const THEME_KEY = 'theme';
export const THEMES = ['light', 'dark'];
export const DEFAULT_THEME = 'light';

// Script chạy sớm trong <head>: thêm class "dark" vào <html> trước khi trang hiện ra nên không bị nháy sáng
export const THEME_INIT_SCRIPT = `try{if(localStorage.getItem('${THEME_KEY}')==='dark')document.documentElement.classList.add('dark')}catch(e){}`;
