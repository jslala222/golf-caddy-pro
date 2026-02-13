import type { Metadata, Viewport } from "next";
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </head>
      <body className={notoSansKr.className} style={{ margin: 0, padding: 0, backgroundColor: '#f5f5f4', color: '#1c1917' }}>
        <div style={{ display: 'flex', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#f5f5f4' }}>
          <div style={{ width: '100%', maxWidth: '480px', backgroundColor: 'white', position: 'relative', display: 'flex', flexDirection: 'column', minHeight: '100vh', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflowX: 'hidden' }}>
            <main style={{ flex: 1, paddingBottom: '80px' }}>
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
