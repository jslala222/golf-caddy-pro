# 솔라피 카카오톡 템플릿 등록 가이드

> 최종 작성: 2026년 4월 8일  
> 솔라피 공식 콘솔: https://console.solapi.com

---

## 📋 목차
1. [카카오톡 알림톡 개임](#카카오톡-알림톡-개요)
2. [사전 준비물](#사전-준비물)
3. [5가지 템플릿 상세 등록](#5가지-템플릿-상세-등록)
4. [API 코드 구현](#api-코드-구현)
5. [테스트 및 배포](#테스트-및-배포)

---

## 🎯 카카오톡 알림톡 개요

### SMS vs 카카오톡 차이

| 항목 | SMS | 카카오톡 알림톡 |
|------|-----|-------------|
| 수신 | 01X-XXXX-XXXX | 카카오톡 채팅 |
| 광고성 제한 | 자유로움 | 비광고성만 (가입/주문/배송 등) |
| 클릭링크 | 일반 링크 | 카카오톡 내 웹뷰 지원 |
| 이미지 | 불가 | 가능 |
| 비용 | 더 저렴 | 약간 더 비쌈 |
| 차단율 | 높음 | 매우 낮음 |

### 솔라피 카카오톡 알림톡 특징
- **"발신 프로필" 필요** — 브랜드/비즈니스명 (예: "캐디 매니저 Pro")
- **"템플릿" 사전 승인 필요** — 등록 후 1~2시간 내 솔라피 승인
- **"변수" 지원** — 동적 내용 삽입 가능 (예: `#{이용권코드}`, `#{만료일}`)
- **"버튼" 최대 5개** — 링크/전화/카카오톡플러스 버튼 등

---

## 🔧 사전 준비물

### 1단계: 솔라피 콘솔 접속
```
https://console.solapi.com
로그인 → Dashboard
```

### 2단계: 비즈니스 채널 인증 (필수)
1. 좌측 메뉴 → **발신프로필/템플릿** → **발신 프로필 관리**
2. **[+ 신규 추가]** 클릭
3. 프로필명: `캐디 매니저 Pro`
4. 프로필 종류: **비즈니스형** 선택
5. 카카오 비즈니스 계정 연동 (없으면 생성)
6. **저장** → 인증 완료 (1~2일 소요)

### 3단계: API Key 확인
1. Dashboard → **API 키** (이미 `SOLAPI_API_KEY`, `SOLAPI_API_SECRET` 보유)
2. 환경변수 확인:
   ```env
   SOLAPI_API_KEY=NCSIYJUZJOSIQQ94
   SOLAPI_API_SECRET=PQYWGKXJFLJSDPIXSSCK8FTK12H8WTO0
   SOLAPI_SENDER=01027377229         # SMS 발신번호
   SOLAPI_KAKAO_PROFILE=캐디 매니저 Pro  # 카카오톡 프로필명
   ```

---

## 📝 5가지 템플릿 상세 등록

### 템플릿 1: 가입 완료 (환영 메시지)

**목적**: 고객 이용권 첫 발급 시 환영 알림톡

**템플릿명** (콘솔에 정확히 입력)
```
CaddyManagerPro_Welcome
```

**템플릿 내용** (추천 텍스트)
```
[캐디 매니저 Pro]

안녕하세요! 
가입을 축하드립니다. 🎉

🎫 이용권 정보
- 이용권코드: #{licenseCode}
- 플랜: #{tier}
- 만료일: #{expiresAt}

📲 앱 접속
http://you.caddy-pink.vercel.app

성공적인 라운드를 응원합니다! ⛳
```

**버튼 설정** (최대 5개)
1. **버튼명**: 앱 접속 | **타입**: 웹링크 | **링크**: `https://caddy-pink.vercel.app`
2. **버튼명**: 고객센터 | **타입**: 전화 | **번호**: `01027377229`

**변수 리스트**
```
#{licenseCode}   — 이용권 코드 (예: SM-YK3-PZC)
#{tier}          — 플랜 (예: 스탠다드)
#{expiresAt}     — 만료일 (예: 2026-05-18)
```

**승인 기준**
- ✅ 비광고성
- ✅ 그래프/기호 제한적 사용

---

### 템플릿 2: 이용권 연장 (만료 예정)

**템플릿명** (콘솔에 정확히 입력)
```
CaddyManagerPro_Extend
```

**템플릿 내용**
```
[캐디 매니저 Pro]

이용권 연장 완료! 

📅 새로운 이용기한
만료일: #{newExpiresAt}

플랜: #{tier}
시작일: #{startDate}

계속해서 이용 가능합니다. ⛳
```

**버튼 설정**
1. **버튼명**: 앱 접속 | **타입**: 웹링크 | **링크**: `https://caddy-pink.vercel.app`

**변수 리스트**
```
#{newExpiresAt}  — 새 만료일 (예: 2026-06-18)
#{tier}          — 플랜명
#{startDate}     — 연장 시작일
```

---

### 템플릿 3: 만료 알림 (7일전 예상)

**템플릿명**
```
CaddyManagerPro_ExpireSoon
```

**템플릿 내용**
```
[캐디 매니저 Pro]

이용권 만료 예정 안내 ⏰

만료일: #{expiresAt}
남은 기간: #{daysLeft}일

현장에서 이용하실 수 없으니
미리 연장 부탁드립니다.

📲 연장하기
```

**버튼 설정**
1. **버튼명**: 이용권 연장 | **타입**: 웹링크 | **링크**: `https://caddy-pink.vercel.app/subscribe`
2. **버튼명**: 문의 | **타입**: 전화 | **번호**: `01027377229`

**변수 리스트**
```
#{expiresAt}     — 만료일
#{daysLeft}      — 남은 일수
```

---

### 템플릿 4: 일정/라운드 알림

**템플릿명**
```
CaddyManagerPro_Schedule
```

**템플릿 내용**
```
[캐디 매니저 Pro]

곧 라운드입니다! ⛳

🏌️ 라운드 정보
날짜: #{scheduleDate}
시간: #{scheduleTime}
현장: #{courseName}

캐디명: #{caddyName}
차량: #{carNumber}

📲 상세보기
```

**버튼 설정**
1. **버튼명**: 상세보기 | **타입**: 웹링크 | **링크**: `https://caddy-pink.vercel.app/schedule`
2. **버튼명**: 연락처 | **타입**: 전화 | **번호**: `#{caddyPhone}`

**변수 리스트**
```
#{scheduleDate}  — 라운드 날짜 (예: 2026-04-10)
#{scheduleTime}  — 라운드 시간 (예: 14:00)
#{courseName}    — 골프장명 (예: 종로GC)
#{caddyName}     — 캐디명
#{carNumber}     — 차량번호
#{caddyPhone}    — 캐디 연락처
```

---

### 템플릿 5: 개인 이벤트 (프로모션)

**템플릿명**
```
CaddyManagerPro_PersonalEvent
```

**템플릿 내용**
```
[캐디 매니저 Pro]

스페셜 이벤트! 🎁

#{eventTitle}

구간: #{eventPeriod}
할인: #{discount}

#{eventDescription}

이 기회를 놓치지 마세요! 💯
```

**버튼 설정**
1. **버튼명**: 자세히 보기 | **타입**: 웹링크 | **링크**: `https://caddy-pink.vercel.app/events`

**변수 리스트**
```
#{eventTitle}        — 이벤트명 (예: "春 프로모션")
#{eventPeriod}       — 이벤트 기간 (예: "4/10~4/20")
#{discount}          — 할인율/내용 (예: "20% 할인")
#{eventDescription}  — 상세 설명 (최대 100자)
```

---

## 💻 API 코드 구현

### 1단계: aligo.ts 카카오톡 함수 추가

```typescript
// src/lib/aligo.ts

/**
 * 카카오톡 알림톡 발송
 * @param params.receiver 수신자 폰번호
 * @param params.templateId 템플릿ID (콘솔에서 확인 가능)
 * @param params.variables 템플릿 변수 객체 { licentseCode: "...", tier: "..." }
 */
export async function sendKakaoTalk(params: {
  receiver: string;
  templateId: string;
  variables?: Record<string, string>;
}): Promise<{ ok: boolean; message?: string }> {
  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  const kakaoProfile = process.env.SOLAPI_KAKAO_PROFILE;

  if (!apiKey || !apiSecret || !kakaoProfile) {
    console.error('[solapi-kakao] 환경변수 미설정');
    return { ok: false, message: '카카오톡 환경변수 미설정' };
  }

  const receiver = params.receiver.replace(/\D/g, '');

  try {
    const service = new SolapiMessageService(apiKey, apiSecret);
    await service.sendOne({
      to: receiver,
      kakaoOptions: {
        pfId: kakaoProfile,
        templateId: params.templateId,
        variables: params.variables,
      },
    });
    return { ok: true };
  } catch (e: unknown) {
    const err = e as { message?: string };
    console.error('[solapi-kakao] 발송 실패:', err);
    return { ok: false, message: err?.message ?? '카카오톡 발송 실패' };
  }
}

/**
 * SMS → Kakao 자동 폴백
 * (카카오톡 실패 시 SMS로 자동 발송)
 */
export async function sendSMSOrKakao(params: {
  receiver: string;
  msg: string;
  msg_type?: 'SMS' | 'LMS';
  title?: string;
  templateId?: string;
  variables?: Record<string, string>;
}): Promise<{ ok: boolean; channel: 'SMS' | 'KakaoTalk'; message?: string }> {
  // 카카오톡 시도
  if (params.templateId) {
    const kakaoResult = await sendKakaoTalk({
      receiver: params.receiver,
      templateId: params.templateId,
      variables: params.variables,
    });
    if (kakaoResult.ok) {
      return { ok: true, channel: 'KakaoTalk' };
    }
    console.warn('[solapi] 카카오톡 실패, SMS로 폴백:', kakaoResult.message);
  }

  // SMS 폴백
  const smsResult = await sendSMS({
    receiver: params.receiver,
    msg: params.msg,
    msg_type: params.msg_type ?? 'SMS',
    title: params.title,
  });

  return {
    ok: smsResult.ok,
    channel: 'SMS',
    message: smsResult.message,
  };
}
```

### 2단계: licenseUtils.ts에 카카오톡 발송 추가

```typescript
// src/lib/licenseUtils.ts 내 issueVoucher 함수 수정

if (userPhone) {
    try {
        const res = await fetch('/api/notify/welcome/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone: userPhone,
                licenseCode: code,
                tier,
                expiresAt: expiresAt.toISOString(),
                // 카카오톡 옵션 (선택)
                useKakao: true,
                templateId: 'CaddyManagerPro_Welcome',
            }),
        });
        const data = await res.json().catch(() => ({ ok: false, message: 'JSON parse 실패' }));
        if (!data.ok) {
            return { success: true, code, smsOk: false, smsMessage: data.message ?? '발송 실패' };
        }
        return { success: true, code, smsOk: true };
    } catch (e) {
        return { success: true, code, smsOk: false, smsMessage: String(e) };
    }
}
```

### 3단계: API 라우트 핸들러 수정

```typescript
// src/app/api/notify/welcome/route.ts

export async function POST(request: NextRequest) {
  const { phone, licenseCode, tier, expiresAt, useKakao, templateId } = await request.json();

  if (!phone || !licenseCode || !expiresAt) {
    return NextResponse.json({ ok: false, message: '필수 파라미터 없음' }, { status: 400 });
  }

  const msg = buildWelcomeMsg({ licenseCode, tier: tier ?? 'standard', expiresAt });

  // 카카오톡 우선 시도
  if (useKakao && templateId) {
    const kakaoResult = await sendKakaoTalk({
      receiver: phone,
      templateId,
      variables: {
        licenseCode,
        tier: tier === 'premium' ? '프리미엄' : '스탠다드',
        expiresAt: expiresAt.slice(0, 10),
      },
    });
    if (kakaoResult.ok) {
      return NextResponse.json({ ok: true, channel: 'KakaoTalk' });
    }
  }

  // SMS 폴백
  const result = await sendSMS({
    receiver: phone,
    msg,
    msg_type: 'LMS',
    title: '캐디 매니저 Pro 가입 완료',
  });

  return NextResponse.json({
    ok: result.ok,
    channel: result.ok ? 'SMS' : 'SMS_FAILED',
    message: result.message,
  });
}
```

---

## ✅ 테스트 및 배포

### 로컬 테스트 (npm run dev)

```typescript
// 환경변수 확인
console.log('SOLAPI_KAKAO_PROFILE:', process.env.SOLAPI_KAKAO_PROFILE);

// 수동 테스트
const res = await fetch('http://localhost:4455/api/notify/welcome/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    phone: '010-xxxx-xxxx',
    licenseCode: 'TEST-001',
    tier: 'standard',
    expiresAt: new Date(Date.now() + 30*24*60*60*1000).toISOString(),
    useKakao: true,
    templateId: 'CaddyManagerPro_Welcome',
  }),
});
console.log(await res.json());
```

### Vercel 배포

```bash
# 환경변수 추가
vercel env add SOLAPI_KAKAO_PROFILE "캐디 매니저 Pro"

# 배포
git add .
git commit -m "feat: 솔라피 카카오톡 템플릿 추가"
git push new_origin master
vercel --prod
```

### 체크리스트

- [ ] 솔라피 콘솔에서 5개 템플릿 모두 **"승인됨"** 상태 확인
- [ ] `.env.local`에 환경변수 추가: `SOLAPI_KAKAO_PROFILE=캐디 매니저 Pro`
- [ ] `aligo.ts`에 `sendKakaoTalk()`, `sendSMSOrKakao()` 함수 추가
- [ ] API 라우트 수정 (카카오톡 우선 + SMS 폴백)
- [ ] 관리자에서 코드 발급 → 카카오톡 수신 테스트
- [ ] 딜러 대시보드에서 코드 발급 → 카카오톡 수신 테스트
- [ ] 실제 고객 상황 테스트 (여러 통신사 단말)

---

## 📞 문제 해결

### Q: 카카오톡이 안 왔어요
**A**: 
1. 솔라피 콘솔 → 템플릿 상태 **"승인됨"** 확인
2. Vercel 로그에서 오류 메시지 확인 (`vercel logs`)
3. SMS 폴백으로 대체 (SMS는 반드시 옴)

### Q: 카카오톡 프로필이 안 보여요
**A**: 
1. 카카오 비즈니스 채널 인증이 필수
2. 솔라피 콘솔 → "발신프로필 관리" → 인증 진행상태 확인 (1~2일 소요)

### Q: 변수가 제대로 표시 안 돼요
**A**:
1. 템플릿 변수명이 정확해야 함 (예: `#{licenseCode}` vs `#{license_code}`)
2. 값이 빈 문자열 아닌지 확인
3. 콘솔 로그에서 실제 전송되는 변수 확인

---

## 📚 참고 자료
- 솔라피 공식: https://solapi.com
- 솔라피 콘솔: https://console.solapi.com
- 카카오톡 비즈니스: https://business.kakao.com

---

## ✅ 검수 반려 대응 재등록본 (2026-04-09)

### 공통 검수 포인트 (반려 사유 반영)
- "일정 알림" 같은 광범위 문구 금지 → 발송 목적을 고정값으로 명확히 기재
- 수신자 액션(구매/결제/연장 요청/예약 확정)을 반드시 고정값으로 포함
- 변수는 3~6개 수준으로 제한하고, 고정 안내 문장을 충분히 배치
- 버튼 링크는 **외부 브라우저 열기 체크 ON** 권장 (카카오 인앱 브라우저 이슈 회피)

### 1) 가입완료_환영_v2 (반려 대응)

**템플릿명**
```
가입완료_환영_v2
```

**내용 (붙여넣기용)**
```
[캐디 매니저 Pro 이용권 결제 가입 완료 안내]

고객님이 결제하신 캐디 매니저 Pro 골프 캐디 업무 관리 앱 이용권의 결제가 정상 완료되어 가입 처리가 완료되었습니다.

■ 이용권 코드: #{이용권코드}
■ 이용 플랜: #{플랜명}
■ 이용 시작일: #{시작일}
■ 이용 만료일: #{만료일}

아래 버튼을 눌러 앱에 접속 후 발급된 이용권 코드를 등록하시면 서비스 이용이 가능합니다.
```

**변수**
```
#{이용권코드}
#{플랜명}
#{시작일}
#{만료일}
```

**버튼**
- 버튼명: 앱 접속하기
- 타입: 웹링크
- 모바일링크: https://caddy-pink.vercel.app
- PC링크: https://caddy-pink.vercel.app
- 외부 브라우저로 링크 열기: ON

**대체발송 문자 (붙여넣기용)**
```
[캐디매니저Pro] 이용권 결제 가입완료
코드:#{이용권코드} 플랜:#{플랜명}
시작:#{시작일} 만료:#{만료일}
앱접속: https://caddy-pink.vercel.app
```

---

### 2) 이용권_연장완료_v2 (반려 대응)

**템플릿명**
```
이용권_연장완료_v2
```

**내용 (붙여넣기용)**
```
[캐디 매니저 Pro 이용권 연장 결제 완료 안내]

고객님이 결제하신 캐디 매니저 Pro 골프 캐디 업무 관리 앱 이용권 연장 결제가 정상 완료되었습니다.

■ 이용권 코드: #{이용권코드}
■ 연장 플랜: #{플랜명}
■ 연장 적용일: #{적용일}
■ 변경 만료일: #{만료일}

기존 이용권 코드는 동일하게 계속 사용하실 수 있습니다.
```

**변수**
```
#{이용권코드}
#{플랜명}
#{적용일}
#{만료일}
```

**버튼**
- 버튼명: 앱 접속하기
- 타입: 웹링크
- 모바일링크: https://caddy-pink.vercel.app
- PC링크: https://caddy-pink.vercel.app
- 외부 브라우저로 링크 열기: ON

**대체발송 문자 (붙여넣기용)**
```
[캐디매니저Pro] 이용권 연장 결제완료
코드:#{이용권코드} 플랜:#{플랜명}
적용:#{적용일} 만료:#{만료일}
앱접속: https://caddy-pink.vercel.app
```

---

### 3) 만료예정_알림_v2 (반려 대응)

**템플릿명**
```
만료예정_알림_v2
```

**내용 (붙여넣기용)**
```
[캐디 매니저 Pro 결제 이용권 만료 예정 안내]

고객님이 결제하여 이용 중인 캐디 매니저 Pro 골프 캐디 업무 관리 앱 유료 이용권의 만료 예정일을 안내드립니다.

■ 이용권 코드: #{이용권코드}
■ 만료 예정일: #{만료일}
■ 남은 기간: #{남은일수}일

결제하신 이용권의 만료 후에는 서비스 이용이 중단되므로, 만료 전에 아래 버튼을 통해 연장 결제를 진행해 주세요.
```

**변수**
```
#{이용권코드}
#{만료일}
#{남은일수}
```

**버튼**
- 버튼명: 이용권 연장
- 타입: 웹링크
- 모바일링크: https://caddy-pink.vercel.app/subscribe
- PC링크: https://caddy-pink.vercel.app/subscribe
- 외부 브라우저로 링크 열기: ON

**대체발송 문자 (붙여넣기용)**
```
[캐디매니저Pro] 이용권 만료 예정 안내
코드:#{이용권코드} 만료:#{만료일} (#{남은일수}일 남음)
연장결제: https://caddy-pink.vercel.app/subscribe
```

---

### 4) 오늘일정_오전브리핑_v2 (목적 고정)

**템플릿명**
```
오늘일정_오전브리핑_v2
```

**내용 (붙여넣기용)**
```
[캐디 매니저 Pro 골프 캐디 당일 근무 배정 안내]

캐디 매니저 Pro 앱에 사전 등록하신 #{기준일} 근무 배정 내역을 아래와 같이 안내드립니다.

▶ 확정된 근무 배정 일정
#{일정요약}

본 메시지는 캐디 매니저 Pro 앱에 등록된 골프 캐디의 당일 근무 배정 확인을 위한 정보성 알림입니다.
```

**변수**
```
#{기준일}
#{일정요약}
```

**버튼**
- 버튼명: 일정 확인
- 타입: 웹링크
- 모바일링크: https://caddy-pink.vercel.app/schedule
- PC링크: https://caddy-pink.vercel.app/schedule
- 외부 브라우저로 링크 열기: ON

**대체발송 문자 (붙여넣기용)**
```
[캐디매니저Pro] #{기준일} 근무배정 안내
#{일정요약}
일정확인: https://caddy-pink.vercel.app/schedule
```

---

### 5) 개인일정_사전알림_v2 (목적 고정)

**템플릿명**
```
개인일정_사전알림_v2
```

**내용 (붙여넣기용)**
```
[캐디 매니저 Pro 개인 일정 시작 시간 임박 알림]

고객님이 캐디 매니저 Pro 앱에 직접 등록하신 아래 개인 일정의 시작 시간이 #{사전분}분 후입니다.

■ 일정명: #{일정명}
■ 일정일시: #{일정일시}

본 메시지는 캐디 매니저 Pro 앱에 고객님이 직접 등록하신 개인 일정 시작 전 확인 목적으로 발송되는 정보성 알림입니다.
```

**변수**
```
#{사전분}
#{일정명}
#{일정일시}
```

**버튼**
- 버튼명: 일정 확인
- 타입: 웹링크
- 모바일링크: https://caddy-pink.vercel.app/schedule
- PC링크: https://caddy-pink.vercel.app/schedule
- 외부 브라우저로 링크 열기: ON

**대체발송 문자 (붙여넣기용)**
```
[캐디매니저Pro] 개인일정 #{사전분}분 전 알림
#{일정명} #{일정일시}
일정확인: https://caddy-pink.vercel.app/schedule
```

---

### 재등록 팁 (실무)
- 기존 반려 템플릿명 재사용보다 `_v2` 신규명으로 등록하는 편이 빠릅니다.
- 한 템플릿에서 목적을 섞지 말고, 목적별로 분리 유지하세요.
- "등록/예약/결제/연장 요청" 같은 수신자 액션 고정 문구를 항상 첫 문단에 배치하세요.
