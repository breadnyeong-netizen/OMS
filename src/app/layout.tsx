import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "OMS 업무 관리", template: "%s | OMS" },
  description: "2인용 통합 업무 관리 시스템",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className="font-sans">{children}</body>
    </html>
  );
}
