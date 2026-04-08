/**
 * SMS 발송 유틸 (솔라피 기반)
 * https://solapi.com
 */
import SolapiMessageService from 'solapi';

export interface AligoSendParams {
  receiver: string;
  msg: string;
  msg_type?: 'SMS' | 'LMS';
  title?: string;
}

export async function sendSMS(params: AligoSendParams): Promise<{ ok: boolean; message?: string }> {
  const apiKey = process.env.SOLAPI_API_KEY;
  const apiSecret = process.env.SOLAPI_API_SECRET;
  const sender = process.env.SOLAPI_SENDER ?? process.env.ALIGO_SENDER;

  if (!apiKey || !apiSecret || !sender) {
    console.error('[solapi] 환경변수 미설정');
    return { ok: false, message: '솔라피 환경변수 미설정' };
  }

  const receiver = params.receiver.replace(/\D/g, '');
  const msgType = params.msg_type ?? (Buffer.byteLength(params.msg, 'utf8') > 90 ? 'LMS' : 'SMS');

  try {
    const service = new SolapiMessageService(apiKey, apiSecret);
    await service.sendOne({
      to: receiver,
      from: sender,
      text: params.msg,
      type: msgType,
      ...(msgType === 'LMS' && params.title ? { subject: params.title } : {}),
    });
    return { ok: true };
  } catch (e: unknown) {
    const err = e as { message?: string };
    console.error('[solapi] 발송 실패:', err);
    return { ok: false, message: err?.message ?? '발송 실패' };
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
 * 개인일정 1시간 전 알림 메시지 생성
 */
export function buildPersonalEvent1hMsg(params: {
  title: string;
  time: string; // 'HH:MM'
  date: string;
  remindLabel?: string; // e.g. '30분', '1시간', '2시간'
}): string {
  const label = params.remindLabel ?? '1시간';
  return `[캐디 매니저] 개인일정 ${label} 전 알림\n\n${params.date} ${params.time} 일정이 ${label} 후 시작됩니다.\n일정: ${params.title}\n\n미리 준비해 주세요.`;
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
