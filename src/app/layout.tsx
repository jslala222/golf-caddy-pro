
import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/layout/BottomNav";
import { ClientLayout } from "@/components/layout/ClientLayout";

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["100", "300", "400", "500", "700", "900"],
  variable: "--font-noto-sans-kr",
});

export const metadata: Metadata = {
  title: "Caddy Manager Pro v1.1",
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
      <body className={`${notoSansKr.variable} font-sans bg-stone-100 text-stone-900`}>
        <div className="flex justify-center min-h-screen">
          <div className="w-full max-w-[480px] bg-white relative flex flex-col min-h-screen shadow-2xl">
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
