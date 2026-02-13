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
      <body className={`${notoSansKr.className} bg-stone-100 text-stone-900`}>
        <div className="flex justify-center min-h-screen bg-stone-100">
          <div className="w-full max-w-[480px] bg-white relative flex flex-col min-h-screen shadow-2xl overflow-x-hidden">
            <main className="flex-1 pb-20">
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
