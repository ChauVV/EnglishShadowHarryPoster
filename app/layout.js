import { Be_Vietnam_Pro } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { I18nProvider } from "../lib/i18n";
import { ThemeSync } from "../lib/theme";
import { THEME_INIT_SCRIPT } from "../lib/themeConfig";
import "./globals.css";

// Be Vietnam Pro được thiết kế riêng cho tiếng Việt: dấu thanh chuẩn, không rơi về font hệ thống
const beVietnamPro = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata = {
  title: "English Shadowing",
  description: "Luyện nghe nói tiếng Anh theo phương pháp shadowing qua các bài học ngắn mỗi ngày.",
};

export default function RootLayout({ children }) {
  return (
    // suppressHydrationWarning: script bên dưới có thể thêm class "dark" vào <html> trước khi React hydrate
    <html lang="vi" className={`${beVietnamPro.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeSync />
        <I18nProvider>{children}</I18nProvider>
        <Analytics />
      </body>
    </html>
  );
}
