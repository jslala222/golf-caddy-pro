# PWA 설치 배너 + 카카오톡 인앱브라우저 감지 패턴

> 작성일: 2026-04-05  
> 적용 프로젝트: Caddy Manager Pro (16회차)  
> 재사용 목적: 동일 패턴이 필요한 다른 Next.js / React 프로젝트에 복붙하여 활용

---

## 문제 정의

카카오톡 링크 공유로 앱에 접속하는 사용자가 많은 경우:
1. **카톡 인앱브라우저**는 `beforeinstallprompt` 이벤트 미지원 → PWA 설치 불가
2. **카메라, 알림, 공유** 등 일부 Web API가 제한됨
3. iOS Safari에서도 PWA 설치 안내가 없으면 사용자가 방법을 모름

---

## 구현 전략

| 상황 | 처리 방식 |
|------|----------|
| 카톡 / LINE 인앱브라우저 | 외부 브라우저 전환 안내 배너 (초록) |
| Android Chrome (미설치) | `beforeinstallprompt` 캡처 → [설치하기] 버튼 배너 (핑크) |
| iOS Safari (미설치) | 공유 아이콘 안내 배너 (핑크) |
| 이미 설치됨 (`standalone`) | 배너 미표시 |
| 닫기 클릭 | `localStorage` 에 날짜 저장 → 하루 억제 |

---

## 핵심 코드 스니펫

### 1. UserAgent 감지 로직

```typescript
const ua = navigator.userAgent;

// 카카오톡 / LINE 인앱브라우저
const isKakao = /kakaotalk/i.test(ua);
const isLine = /line\//i.test(ua);            // "Line/" 포함 (대소문자 무관)
const isInApp = isKakao || isLine;

// iOS 기기
const isIOS = /iphone|ipad|ipod/i.test(ua);

// iOS Safari만 (Chrome iOS, Firefox iOS 제외)
const isSafariIOS =
    isIOS &&
    /safari/i.test(ua) &&
    !/crios|fxios|opios|mercury/i.test(ua);

// 이미 PWA로 설치된 상태
const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true;
```

### 2. beforeinstallprompt 캡처 (Android Chrome만 발화)

```typescript
const deferredPrompt = useRef<Event & {
    prompt: () => void;
    userChoice: Promise<{ outcome: string }>;
} | null>(null);

useEffect(() => {
    const handleInstallPrompt = (e: Event) => {
        e.preventDefault();  // 브라우저 기본 배너 억제
        deferredPrompt.current = e as typeof deferredPrompt.current;
        if (!localStorage.getItem('pwa_install_dismissed')) {
            setShowInstallBanner(true);
        }
    };
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
}, []);

const handleAndroidInstall = async () => {
    if (!deferredPrompt.current) return;
    deferredPrompt.current.prompt();
    const { outcome } = await deferredPrompt.current.userChoice;
    deferredPrompt.current = null;
    if (outcome === 'accepted') {
        setShowInstallBanner(false);
        localStorage.setItem('pwa_install_dismissed', new Date().toDateString());
    }
};

const dismissInstallBanner = () => {
    setShowInstallBanner(false);
    localStorage.setItem('pwa_install_dismissed', new Date().toDateString());
};
```

### 3. iOS Safari 안내 배너 조건

```typescript
// 처음 로딩 시 한 번만 확인
const dismissed = localStorage.getItem('pwa_install_dismissed');
if (!isStandalone && !isInApp && !dismissed && isSafariIOS) {
    setShowInstallBanner(true);
    setShowIOSGuide(true);  // iOS용 텍스트 분기
}
```

### 4. JSX — 배너 컴포넌트

```tsx
{/* 카톡 / LINE 인앱브라우저 경고 */}
{isInApp && showInAppBanner && (
    <div className="sticky top-0 z-[10001] bg-emerald-600 text-white px-4 py-3">
        <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
                <p className="font-bold text-sm mb-1">⚠️ 카카오톡 브라우저 안내</p>
                <p className="text-xs leading-relaxed">
                    카카오톡 안에서는 앱 설치·카메라 등 일부 기능이 제한됩니다.<br />
                    {isIOS
                        ? <><strong>우측 상단 [···]</strong> → <strong>Safari로 열기</strong></>
                        : <><strong>우측 상단 [⋮]</strong> → <strong>다른 브라우저로 열기</strong></>
                    }
                </p>
            </div>
            <button onClick={() => setShowInAppBanner(false)}>✕</button>
        </div>
    </div>
)}

{/* PWA 설치 배너 (Android prompt / iOS 안내) */}
{!isInApp && showInstallBanner && (
    <div className="sticky top-0 z-[10001] bg-pink-600 text-white px-4 py-3">
        <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
                <p className="font-bold text-sm mb-1">📲 홈화면에 추가하면 앱처럼 쓸 수 있어요!</p>
                {showIOSGuide ? (
                    <p className="text-xs">
                        하단 <strong>[공유 🔗]</strong> → <strong>[홈 화면에 추가]</strong> 탭하세요.
                    </p>
                ) : (
                    <button
                        onClick={handleAndroidInstall}
                        className="text-xs bg-white text-pink-600 font-bold px-3 py-1 rounded-full mt-1"
                    >
                        설치하기
                    </button>
                )}
            </div>
            <button onClick={dismissInstallBanner}>✕</button>
        </div>
    </div>
)}
```

---

## manifest.json 필수 설정

```json
{
  "name": "앱 이름 (풀네임)",
  "short_name": "짧은 이름",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#FFFFFF",
  "theme_color": "#메인컬러",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

> `purpose: "any maskable"` — Android 적응형 아이콘 지원  
> `theme_color` — 상단 상태바 색상 (설치 후 앱 느낌)

---

## 아이콘 생성 방법 (PowerShell .NET — 외부 라이브러리 불필요)

```powershell
Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Bitmap]::new("원본이미지.png")
$W = $src.Width; $H = $src.Height

# 비흰색 픽셀 범위 탐색 (배경이 흰색인 경우)
$minX = $W; $maxX = 0; $minY = $H; $maxY = 0
for ($y = 0; $y -lt $H; $y++) {
  for ($x = 0; $x -lt $W; $x++) {
    $px = $src.GetPixel($x, $y)
    if ($px.R -lt 250 -or $px.G -lt 250 -or $px.B -lt 250) {
      if ($x -lt $minX) { $minX = $x }
      if ($x -gt $maxX) { $maxX = $x }
      if ($y -lt $minY) { $minY = $y }
      if ($y -gt $maxY) { $maxY = $y }
    }
  }
}

$margin = 4
$side = [Math]::Max($maxX - $minX + 1, $maxY - $minY + 1) + $margin * 2
$cx = [int](($minX + $maxX) / 2)
$cy = [int](($minY + $maxY) / 2)
$x0 = [Math]::Max(0, $cx - $side / 2)
$y0 = [Math]::Max(0, $cy - $side / 2)

$cropped = [System.Drawing.Bitmap]::new($side, $side)
$g = [System.Drawing.Graphics]::FromImage($cropped)
$g.Clear([System.Drawing.Color]::White)
$g.DrawImage($src, [System.Drawing.Rectangle]::new(0,0,$side,$side),
             [System.Drawing.Rectangle]::new([int]$x0,[int]$y0,$side,$side),
             [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose()

# 리사이즈 저장
foreach ($size in @(192, 512)) {
    $out = [System.Drawing.Bitmap]::new($size, $size)
    $g2 = [System.Drawing.Graphics]::FromImage($out)
    $g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g2.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g2.DrawImage($cropped, 0, 0, $size, $size)
    $g2.Dispose()
    $out.Save("public/icon-$size.png", [System.Drawing.Imaging.ImageFormat]::Png)
    $out.Dispose()
}
$cropped.Dispose(); $src.Dispose()
Write-Host "완료!"
```

> **배경이 투명(A=0)인 경우**: `$px.R -lt 250` 대신 `$px.A -gt 10` 조건 사용

---

## localStorage 키 관리

| 키 | 값 예시 | 용도 |
|----|--------|------|
| `pwa_install_dismissed` | `"Sun Apr 05 2026"` | 설치 배너 하루 억제 |

> `new Date().toDateString()` 값 저장 → 같은 날이면 억제

---

## 체크리스트 (적용 시 확인 사항)

- [ ] `public/manifest.json` — `display: "standalone"` 확인
- [ ] `public/sw.js` — 서비스 워커 존재 여부 (최소 빈 파일이라도)
- [ ] `layout.tsx` — `<link rel="manifest" href="/manifest.json" />` 확인
- [ ] `https` 환경 필수 (localhost 제외) — `beforeinstallprompt`는 http에서 미발화
- [ ] Vercel 배포 후 Lighthouse PWA 탭에서 설치 가능 여부 확인

---

## 주의 사항

1. **`beforeinstallprompt`는 Android Chrome만 발화** — iOS는 별도 처리 필수
2. **카톡 인앱브라우저에서는 `beforeinstallprompt` 절대 발화 안 됨** — 외부 브라우저 유도가 유일한 해법
3. **LINE 브라우저**: UA에 `Line/` 포함 (대문자 L, 슬래시 필수)
4. **iOS Chrome/Firefox**: `crios`, `fxios` UA를 포함하므로 Safari 판별 시 제외 필요
5. **`navigator.standalone`**: iOS Safari PWA 설치 감지용 (표준 아님 — 타입 단언 필요)
