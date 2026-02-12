
/**
 * 라이선스 유틸리티 (B안 - 개별 키 방식)
 * 기기 식별값과 비공개 솔트(Salt)를 조합하여 복제가 불가능한 키를 생성 및 검증합니다.
 */

import { useAppStore } from './store';

// 라이선스 생성을 위한 비밀 키 (절대 노출 주의 - 실제 배포 시에는 더 복잡하게 관리 권장)
const SECRET_SALT = "CADDY-PRO-SAFETY-2026";

/**
 * 기기 고유 아이디 생성 (또는 기존 아이디 반환)
 * 브라우저의 LocalStorage를 활용하여 한 번 생성된 ID는 유지됩니다.
 */
export const getDeviceId = (): string => {
    if (typeof window === 'undefined') return '';

    let deviceId = localStorage.getItem('caddy_device_id');
    if (!deviceId) {
        // 8자리의 짧고 읽기 쉬운 기기 고유 번호 생성
        deviceId = Math.random().toString(36).substring(2, 6).toUpperCase() + '-' +
            Math.random().toString(36).substring(2, 6).toUpperCase();
        localStorage.setItem('caddy_device_id', deviceId);
    }
    return deviceId;
};

/**
 * 기기 ID를 기반으로 유효한 라이선스 키를 생성하는 로직
 * (대표님만 사용하는 관리자 도구에서 사용될 로직입니다)
 */
export const generateLicenseKey = (deviceId: string): string => {
    if (!deviceId) return '';

    // 기기 ID를 무조건 대문자/공백 제거 처리하여 오차를 없앱니다.
    const normalizedId = deviceId.trim().toUpperCase();
    const combined = normalizedId + SECRET_SALT;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
        const char = combined.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // 32비트 정수로 강제 변환
    }

    // 외우기 쉽도록 4자리-4자리 숫자 형태의 키로 변환
    const keyPart1 = Math.abs(hash % 9000 + 1000);
    const keyPart2 = Math.abs((hash >> 8) % 9000 + 1000);

    return `${keyPart1}-${keyPart2}`;
};

/**
 * 입력받은 키가 현재 기기에 유효한지 검증합니다.
 */
export const verifyLicense = (inputKey: string): boolean => {
    const trimmedKey = inputKey.trim().toUpperCase();

    // 1. 마스터 키 체크 (비상용: 어떤 기기에서든 작동)
    // 보안을 위해 복잡한 문자열로 변경
    if (trimmedKey === 'CADDY-MASTER-SAFE-2026-X77') return true;

    const deviceId = getDeviceId();
    if (!deviceId || !trimmedKey) return false;

    const validKey = generateLicenseKey(deviceId);
    return trimmedKey === validKey;
};
