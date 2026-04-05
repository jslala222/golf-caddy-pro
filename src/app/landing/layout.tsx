/**
 * landing, subscribe, dealer-login 페이지는 전체 폭 레이아웃 사용
 * RootLayout의 max-w-[480px] 컨테이너를 우회하기 위해 별도 layout 생성
 */
export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
