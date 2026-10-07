import { Be_Vietnam_Pro } from "next/font/google";
import { I18nProvider } from "../lib/i18n";
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
    <html lang="vi" className={`${beVietnamPro.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
