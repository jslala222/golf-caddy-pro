import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/layout/BottomNav";
import { ClientLayout } from "@/components/layout/ClientLayout";

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
});

export const metadata: Metadata = {
  title: "Caddy Manager Pro",
  description: "골프 캐디를 위한 독립형 모바일 비서",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-512.png",
    apple: "/icon-512.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, padding: 0, backgroundColor: '#f5f5f4', color: '#1c1917', fontFamily: 'sans-serif' }}>
        {/* 비상용 스타일 블록: CSS 파일이 안 불려와도 레이아웃을 지킵니다. */}
        <style dangerouslySetInnerHTML={{
          __html: `
          .emergency-container { display: flex; flex-direction: column; align-items: center; min-height: 100vh; background-color: #f5f5f4; }
          .emergency-phone { width: 100%; max-width: 480px; background-color: white; position: relative; display: flex; flex-direction: column; min-height: 100vh; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25); }
          .emergency-main { flex: 1; padding-bottom: 80px; }
        `}} />

        <div className="emergency-container">
          <div className="emergency-phone">
            <main className="emergency-main">
              <ClientLayout>
                {children}
              </ClientLayout>
            </main>
            <BottomNav />
          </div>
        </div>
      </body>
    </html>
  );
}
