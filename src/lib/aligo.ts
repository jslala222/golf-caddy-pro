/**
 * 알리고 SMS 발송 유틸
 * https://smartsms.aligo.in/main.html
 */

const ALIGO_API_URL = 'https://apis.aligo.in/send/';

export interface AligoSendParams {
  receiver: string;   // 수신번호 (하이픈 제거, 예: 01027377229)
  msg: string;        // 메시지 내용
  msg_type?: 'SMS' | 'LMS'; // SMS: 90바이트 이하, LMS: 2000바이트 이하
  title?: string;     // LMS 제목 (선택)
}

/**
 * 알리고 SMS/LMS 발송
 * @returns { result_code: '1' } 성공, { result_code: '-1', message: '...' } 실패
 */
export async function sendSMS(params: AligoSendParams): Promise<{ ok: boolean; message?: string }> {
  const apiKey = process.env.ALIGO_API_KEY;
  const userId = process.env.ALIGO_USER_ID;
  const sender = process.env.ALIGO_SENDER;

  if (!apiKey || !userId || !sender) {
    console.error('[aligo] 환경변수 미설정');
    return { ok: false, message: '알리고 환경변수 미설정' };
  }

  // 수신번호 하이픈 제거
  const receiver = params.receiver.replace(/-/g, '');

  // 메시지 길이로 자동 타입 결정
  const msgType = params.msg_type ?? (Buffer.byteLength(params.msg, 'utf8') > 90 ? 'LMS' : 'SMS');

  const body = new URLSearchParams({
    key: apiKey,
    user_id: userId,
    sender,
    receiver,
    msg: params.msg,
    msg_type: msgType,
    ...(msgType === 'LMS' && params.title ? { title: params.title } : {}),
  });

  try {
    const res = await fetch(ALIGO_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const data = await res.json();
    if (data.result_code === '1' || data.result_code === 1) {
      return { ok: true };
    }
    console.error('[aligo] 발송 실패:', JSON.stringify(data));
    return { ok: false, message: data.message ?? '발송 실패' };
  } catch (e) {
    console.error('[aligo] 예외:', e);
    return { ok: false, message: String(e) };
  }
}

/**
 * 가입 환영 메시지 생성
 */
export function buildWelcomeMsg(params: {
  licenseCode: string;
  tier: string;
  expiresAt: string;
}): string {
  const tierLabel = params.tier === 'premium' ? '프리미엄' : '스탠다드';
  const expDate = params.expiresAt.slice(0, 10);
  return `[캐디 매니저 Pro] 가입을 환영합니다!\n\n이용코드: ${params.licenseCode}\n플랜: ${tierLabel}\n이용기한: ${expDate}\n\n앱 접속: https://caddy-pink.vercel.app`;
}

/**
 * 일정 알림 메시지 생성
 */
export function buildScheduleMsg(params: {
  date: string;
  schedules: Array<{ title?: string; shift?: string | number; start_time?: string; type?: string }>;
}): string {
  const lines = params.schedules.map((s) => {
    const time = s.start_time ? s.start_time.slice(0, 5) : '';
    if (s.type === 'personal') {
      return `• ${time ? time + ' ' : ''}[개인] ${s.title ?? '일정'}`;
    }
    const shift = s.shift ? `${s.shift}부` : '';
    return `• ${time ? time + ' ' : ''}${shift ? '[' + shift + '] ' : ''}${s.title ?? ''}`;
  });

  const workCount = params.schedules.filter((s) => s.type === 'work').length;
  const personalCount = params.schedules.filter((s) => s.type === 'personal').length;
  const summary = [
    workCount > 0 ? `근무 ${workCount}건` : '',
    personalCount > 0 ? `개인 ${personalCount}건` : '',
  ].filter(Boolean).join(', ');

  return `[캐디 매니저] 오늘 일정 (${params.date})\n\n${lines.join('\n')}\n\n${summary}`;
}

/**
 * 개인일정 사전 알림 메시지 생성 (템플릿 3)
 */
export function buildPersonalEventMsg(params: {
  title: string;
  time: string; // 'HH:MM'
  date: string;
}): string {
  const timeLabel = params.time && params.time !== '00:00' ? ` ${params.time}` : '';
  return `[캐디 매니저] 개인 일정 알림\n\n오늘${timeLabel} 개인 약속이 있습니다.\n일정: ${params.title}\n날짜: ${params.date}\n\n일정을 확인해 주세요.`;
}

/**
 * 이용권 연장 완료 메시지 생성 (템플릿 5)
 */
export function buildExtendMsg(params: {
  licenseCode: string;
  tier: string;
  newExpiresAt: string;
}): string {
  const tierLabel = params.tier === 'premium' ? '프리미엄' : '스탠다드';
  const expDate = params.newExpiresAt.slice(0, 10);
  return `[캐디 매니저 Pro] 이용권 연장이 완료되었습니다.\n\n이용코드: ${params.licenseCode}\n플랜: ${tierLabel}\n새 유효기간: ${expDate}\n\n계속 이용해 주셔서 감사합니다.\nhttps://caddy-pink.vercel.app`;
}

/**
 * 이용권 만료 알림 메시지 생성
 */
export function buildExpireMsg(params: {
  licenseCode: string;
  tier: string;
  expiresAt: string;
  daysLeft: number;
}): string {
  const tierLabel = params.tier === 'premium' ? '프리미엄' : '스탠다드';
  const expDate = params.expiresAt.slice(0, 10);
  return `[캐디 매니저 Pro] 이용권 만료 안내\n\n이용코드: ${params.licenseCode}\n플랜: ${tierLabel}\n만료일: ${expDate} (${params.daysLeft}일 후)\n\n만료 전 연장하시면 일정 데이터가 유지됩니다.\n연장문의: https://caddy-pink.vercel.app`;
}
