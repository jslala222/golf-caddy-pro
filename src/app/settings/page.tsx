
'use client';

import Link from 'next/link';
import { useRef, useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { Settings, Download, Upload, Trash2, AlertTriangle, FileJson, Save, Cloud, Key, Copy, Check, Database, RefreshCw, X, Bell } from 'lucide-react';
import { migrateLocalDataToSupabase } from '@/lib/supabaseDB';
import { formatNumber, todayKST } from '@/lib/utils';
import { InstallPWA } from '@/components/InstallPWA';

export default function SettingsPage() {
    const { exportData, importData, resetData, feeSettings, updateFeeSettings } = useAppStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 이용권 정보
    const [licenseCode, setLicenseCode] = useState<string | null>(null);
    const [licenseExpiresAt, setLicenseExpiresAt] = useState<string | null>(null);
    const [codeCopied, setCodeCopied] = useState(false);
    const [policyModal, setPolicyModal] = useState<null | 'tos' | 'privacy' | 'refund'>(null);

    // 알람 설정
    const ALARM_OPTIONS = [
        { label: '알람 없음', value: 0 },
        { label: '30분 전', value: 30 },
        { label: '1시간 전', value: 60 },
        { label: '2시간 전', value: 120 },
        { label: '3시간 전', value: 180 },
    ];
    // 분 수를 사람이 읽기 좋은 문자열로 변환 (60 → 1시간, 90 → 1시간 30분)
    const formatAlarmLabel = (minutes: number): string => {
        if (minutes <= 0) return '';
        if (minutes < 60) return `${minutes}분 전`;
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        if (m === 0) return `${h}시간 전`;
        return `${h}시간 ${m}분 전`;
    };
    const [alarmMinutes, setAlarmMinutes] = useState<number>(() => {
        if (typeof window === 'undefined') return 60;
        return parseInt(localStorage.getItem('caddy_alarm_minutes') ?? '60', 10);
    });
    const [customAlarm, setCustomAlarm] = useState('');
    const [alarmUnit, setAlarmUnit] = useState<'분' | '시간'>('분');
    const [kakaoLinked, setKakaoLinked] = useState(() => {
        if (typeof window === 'undefined') return false;
        return localStorage.getItem('caddy_kakao_linked') === '1';
    });
    const [kakaoHour, setKakaoHour] = useState(6);
    const [kakaoHourSaving, setKakaoHourSaving] = useState(false);

    useEffect(() => {
        // URL 파라미터로 카카오 연동 결과 처리
        const params = new URLSearchParams(window.location.search);
        if (params.get('kakao') === 'success') {
            setKakaoLinked(true);
            localStorage.setItem('caddy_kakao_linked', '1');
            window.history.replaceState({}, '', '/settings');
        } else if (params.get('kakao') === 'error') {
            alert('카카오 연동에 실패했습니다. 다시 시도해주세요.');
            window.history.replaceState({}, '', '/settings');
        } else {
            setKakaoLinked(localStorage.getItem('caddy_kakao_linked') === '1');
        }
        setKakaoHour(parseInt(localStorage.getItem('caddy_kakao_hour') ?? '6', 10));
    }, []);

    const handleKakaoHourChange = async (hour: number) => {
        setKakaoHour(hour);
        localStorage.setItem('caddy_kakao_hour', String(hour));
        const licenseCode = localStorage.getItem('caddy_license_key');
        if (!licenseCode) return;
        setKakaoHourSaving(true);
        await fetch('/api/auth/kakao/notification-hour', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ licenseCode, hour }),
        });
        setKakaoHourSaving(false);
    };

    const handleKakaoConnect = () => {
        const licenseCode = localStorage.getItem('caddy_license_key') ?? '';
        const restApiKey = process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY;
        const redirectUri = encodeURIComponent(`${window.location.origin}/api/auth/kakao/callback`);
        const state = encodeURIComponent(licenseCode);
        window.location.href = `https://kauth.kakao.com/oauth/authorize?client_id=${restApiKey}&redirect_uri=${redirectUri}&response_type=code&state=${state}&scope=talk_message`;
    };

    const handleKakaoDisconnect = () => {
        localStorage.removeItem('caddy_kakao_linked');
        setKakaoLinked(false);
    };

    const handleSaveAlarm = (minutes: number) => {
        setAlarmMinutes(minutes);
        localStorage.setItem('caddy_alarm_minutes', String(minutes));
    };

    useEffect(() => {
        setLicenseCode(localStorage.getItem('caddy_license_key'));
        setLicenseExpiresAt(localStorage.getItem('caddy_expires_at'));
    }, []);

    // 클라우드 백업 상태
    const [cloudStatus, setCloudStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
    const [cloudMsg, setCloudMsg] = useState('');

    // Supabase 마이그레이션 상태
    const [migrateStatus, setMigrateStatus] = useState<'idle' | 'migrating' | 'done' | 'error'>('idle');
    const [migrateMsg, setMigrateMsg] = useState('');

    const handleMigrate = async () => {
        // localStorage의 caddy-manager-storage에서 직접 읽기 (배포 전 마이그레이션용)
        const raw = localStorage.getItem('caddy-manager-storage');
        let migrateData: any = null;
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                // zustand persist 구조: { state: { schedules, ... } } or 직접 { schedules, ... }
                migrateData = parsed.state ?? parsed;
            } catch { /* 파싱 실패 시 store에서 가져오기 */ }
        }
        if (!migrateData || (!migrateData.schedules?.length && !migrateData.clients?.length && !migrateData.transactions?.length)) {
            // localStorage에 없으면 현재 store에서 가져오기
            const state = useAppStore.getState();
            migrateData = { schedules: state.schedules, transactions: state.transactions, clients: state.clients, feeSettings: state.feeSettings };
        }
        setMigrateStatus('migrating');
        setMigrateMsg('');
        const result = await migrateLocalDataToSupabase(migrateData);
        if (result.ok) {
            setMigrateStatus('done');
            setMigrateMsg(result.message);
        } else {
            setMigrateStatus('error');
            setMigrateMsg(result.message);
        }
        setTimeout(() => setMigrateStatus('idle'), 8000);
    };

    // Local state for fee settings
    const [localSettings, setLocalSettings] = useState<{
        shift1: number;
        shift2: number;
        shift3: number;
        useShift3: boolean;
    }>({
        shift1: 150000,
        shift2: 150000,
        shift3: 160000,
        useShift3: true
    });

    // Sync local state with store on mount or update
    useEffect(() => {
        if (feeSettings) {
            setLocalSettings(feeSettings);
        }
    }, [feeSettings]);

    const handleSaveFees = () => {
        updateFeeSettings(localSettings);
        alert('기본 캐디피 설정이 저장되었습니다!');
    };

    // ── R2 클라우드 업로드 (내부 공통 함수) ────────────────
    const uploadToR2 = async (raw: string): Promise<boolean> => {
        const licenseCode = localStorage.getItem('caddy_license_key');
        if (!licenseCode) return false;
        try {
            const res = await fetch('/api/backup/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ licenseCode, data: JSON.parse(raw) }),
            });
            const result = await res.json();
            if (result.success) {
                localStorage.setItem('caddy_last_auto_backup', new Date().toISOString().slice(0, 10));
            }
            return result.success ?? false;
        } catch {
            return false;
        }
    };

    // ── 수동 백업: 파일 저장 + R2 동시 전송 ─────────────
    const handleCloudUpload = async () => {
        const licenseCode = localStorage.getItem('caddy_license_key');
        if (!licenseCode) {
            setCloudMsg('이용권 코드가 없습니다. 먼저 로그인해주세요.');
            setCloudStatus('error');
            return;
        }
        const raw = exportData();
        setCloudStatus('uploading');
        setCloudMsg('');

        // 1) 파일 다운로드 (스마트폰 저장)
        const blob = new Blob([raw], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const date = todayKST();
        const shortCode = licenseCode.replace(/[^A-Z0-9-]/gi, '').toUpperCase();
        link.href = url;
        link.download = `caddy-backup-${shortCode}-${date}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // 2) R2 업로드 동시 실행
        const ok = await uploadToR2(raw);
        if (ok) {
            setCloudStatus('done');
            setCloudMsg('파일 저장 + 클라우드 백업 완료!');
        } else {
            setCloudStatus('error');
            setCloudMsg('파일은 저장되었으나 클라우드 업로드에 실패했습니다.');
        }
        setTimeout(() => setCloudStatus('idle'), 4000);
    };

    const handleExport = () => {
        // 파일만 저장 (기존 파일 내보내기 버튼 유지)
        const jsonString = exportData();
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const date = todayKST();
        const licenseCode = localStorage.getItem('caddy_license_key') ?? 'unknown';
        const shortCode = licenseCode.replace(/[^A-Z0-9-]/gi, '').toUpperCase();
        link.href = url;
        link.download = `caddy-backup-${shortCode}-${date}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            if (content) {
                // 이용코드 검증 — 다른 사람 백업 복구 차단
                try {
                    const parsed = JSON.parse(content);
                    const backupCode = parsed?.licenseCode as string | undefined;
                    const currentCode = localStorage.getItem('caddy_license_key')?.trim().toUpperCase();
                    if (backupCode && currentCode && backupCode !== currentCode) {
                        alert(`본인의 백업 파일이 아닙니다.\n현재 이용코드: ${currentCode}\n백업 이용코드: ${backupCode}`);
                        return;
                    }
                } catch {
                    // JSON 파싱 실패는 importData가 처리
                }
                const success = importData(content);
                if (success) {
                    alert('데이터 복구가 완료되었습니다!');
                } else {
                    alert('데이터 형식이 올바르지 않습니다.');
                }
            }
        };
        reader.readAsText(file);
        // Reset input
        e.target.value = '';
    };

    const handleReset = () => {
        if (confirm('정말로 모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
            resetData();
            alert('초기화되었습니다.');
        }
    };

    return (
        <>
        <div className="p-6 space-y-8">
            <h1 className="text-2xl font-bold text-stone-900 flex items-center">
                <Settings className="mr-2 text-stone-600" /> 설정
            </h1>

            {/* PWA Install Section */}
            <InstallPWA />

            <hr className="border-stone-200" />

            {/* 회원 이용권 정보 */}
            {licenseCode && (() => {
                const now = new Date();
                const exp = licenseExpiresAt ? new Date(licenseExpiresAt) : null;
                const daysLeft = exp ? Math.ceil((exp.getTime() - now.getTime()) / 86_400_000) : null;
                const isExpired = exp ? now > exp : false;
                const expStr = exp ? `${exp.getFullYear()}/${exp.getMonth()+1}/${exp.getDate()}` : '미활성';
                return (
                    <section className="space-y-3">
                        <h2 className="text-lg font-bold text-stone-800 flex items-center">
                            <Key size={18} className="mr-2 text-emerald-600" /> 이용권 정보
                        </h2>
                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-stone-500 font-bold">코드</span>
                                <div className="flex items-center gap-2">
                                    <span className="font-mono font-black text-stone-800 text-base tracking-widest">{licenseCode}</span>
                                    <button
                                        onClick={() => { navigator.clipboard.writeText(licenseCode); setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000); }}
                                        className="p-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 transition text-emerald-700"
                                    >
                                        {codeCopied ? <Check size={14} /> : <Copy size={14} />}
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-center justify-between border-t border-emerald-100 pt-3">
                                <span className="text-sm text-stone-500 font-bold">만료일</span>
                                <span className={`font-bold text-sm ${isExpired ? 'text-red-500' : 'text-emerald-700'}`}>{expStr}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-stone-500 font-bold">상태</span>
                                <span className={`text-sm font-black ${
                                    isExpired ? 'text-red-500' :
                                    daysLeft !== null && daysLeft <= 7 ? 'text-amber-500' : 'text-emerald-600'
                                }`}>
                                    {isExpired ? '❌ 만료됨' :
                                     daysLeft !== null ? `✅ 이용 중 (D-${daysLeft})` : '✅ 활성화됨'}
                                </span>
                            </div>
                        </div>
                    </section>
                );
            })()}

            {/* 알림 설정 섹션 */}
            <section className="space-y-4">
                <h2 className="text-lg font-bold text-stone-800 flex items-center">
                    <div className="w-1 h-6 bg-orange-500 rounded-full mr-2"></div> 약속 알림 설정
                </h2>
                <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-4">
                    {/* 카카오톡 알림 */}
                    <div className="space-y-3">
                        <p className="text-xs font-bold text-stone-500">카카오톡으로 매일 아침 일정 알림</p>
                        {kakaoLinked ? (
                            <>
                                <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm bg-emerald-50 rounded-xl px-3 py-2">
                                    <Check size={16} /> 카카오톡 연동 완료
                                </div>
                                {/* 알림 시각 선택 */}
                                <div className="space-y-2">
                                    <p className="text-xs font-bold text-stone-500">매일 카톡 발송 시각</p>
                                    <div className="grid grid-cols-5 gap-1.5">
                                        {[5, 6, 7, 8, 9].map(h => (
                                            <button
                                                key={h}
                                                onClick={() => handleKakaoHourChange(h)}
                                                className={`py-2 rounded-xl text-xs font-bold border transition ${kakaoHour === h ? 'bg-[#FEE500] border-yellow-400 text-[#3C1E1E]' : 'bg-stone-50 border-stone-200 text-stone-600'}`}
                                            >
                                                {h}시
                                            </button>
                                        ))}
                                    </div>
                                    {kakaoHourSaving
                                        ? <p className="text-xs text-stone-400">저장 중...</p>
                                        : <p className="text-xs text-emerald-600 font-semibold">매일 오전 <strong>{kakaoHour}시</strong>에 오늘 일정을 카카오톡으로 보내드립니다</p>
                                    }
                                </div>
                                <button
                                    onClick={handleKakaoDisconnect}
                                    className="w-full py-2 border border-stone-200 text-stone-400 font-bold rounded-2xl text-xs active:scale-[.98] transition"
                                >
                                    연동 해제
                                </button>
                            </>
                        ) : (
                            <>
                                <div className="bg-yellow-50 rounded-2xl p-4 space-y-1">
                                    <p className="text-sm font-bold text-stone-800">💬 카카오톡으로 일정 알림 받기</p>
                                    <p className="text-xs text-stone-500">카카오 로그인 1회 후, 매일 아침 오늘 일정을 카카오톡으로 자동 발송합니다.</p>
                                </div>
                                <button
                                    onClick={handleKakaoConnect}
                                    className="w-full py-3 bg-[#FEE500] text-[#3C1E1E] font-bold rounded-2xl text-sm flex items-center justify-center gap-2 active:scale-[.98] transition"
                                >
                                    💬 카카오 로그인으로 연동하기
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </section>

            {/* Fee Settings Section */}
            <section className="space-y-4">
                <h2 className="text-lg font-bold text-stone-800 flex items-center">
                    <div className="w-1 h-6 bg-emerald-500 rounded-full mr-2"></div> 기본 캐디피 설정
                </h2>
                <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-sm space-y-4">
                    <p className="text-sm text-stone-500 mb-2">
                        근무 등록 시 자동으로 입력될 <strong>기본 캐디피</strong>를 설정하세요.
                    </p>
                    {['1', '2', '3'].map((shift) => (
                        <div key={shift} className="flex flex-col gap-2 border-b border-stone-100 last:border-0 pb-3 last:pb-0">
                            <div className="flex items-center justify-between">
                                <label className="font-bold text-stone-700 flex items-center">
                                    <span className={`w-2 h-2 rounded-full mr-2 ${shift === '1' ? 'bg-red-500' : shift === '2' ? 'bg-blue-500' : 'bg-emerald-500'}`}></span>
                                    {shift}부
                                </label>
                                {shift === '3' && (
                                    <div className="flex items-center">
                                        <input
                                            type="checkbox"
                                            id="useShift3"
                                            checked={localSettings.useShift3}
                                            onChange={(e) => setLocalSettings(prev => ({ ...prev, useShift3: e.target.checked }))}
                                            className="mr-2 w-4 h-4 accent-emerald-600"
                                        />
                                        <label htmlFor="useShift3" className="text-xs text-stone-500">사용함</label>
                                    </div>
                                )}
                            </div>

                            {(shift !== '3' || localSettings.useShift3) && (
                                <div className="flex items-center justify-end">
                                    <input
                                        type="text"
                                        value={formatNumber(localSettings[`shift${shift}` as keyof typeof localSettings] as number)}
                                        onChange={(e) => {
                                            const rawValue = Number(e.target.value.replace(/[^0-9]/g, ''));
                                            setLocalSettings(prev => ({
                                                ...prev,
                                                [`shift${shift}`]: rawValue
                                            }));
                                        }}
                                        className="w-full text-right p-3 bg-stone-50 border border-stone-200 rounded-xl font-mono font-bold text-stone-800 text-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none transition"
                                    />
                                    <span className="ml-2 text-stone-500 font-bold">원</span>
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Help/Notice Box */}
                    <div className="bg-stone-50 p-5 rounded-xl border border-stone-100 space-y-4">
                        <div className="flex items-start gap-3">
                            <span className="text-xl text-emerald-600 mt-0.5">⛳️</span>
                            <p className="text-sm text-stone-600 leading-relaxed">
                                <strong>기본 캐디피:</strong> <br />근무 등록 시마다 자동으로 채워지는 금액입니다.
                            </p>
                        </div>
                        <div className="flex items-start gap-3">
                            <span className="text-xl text-emerald-600 mt-0.5">🏌️‍♂️</span>
                            <p className="text-sm text-stone-600 leading-relaxed">
                                <strong>9홀 골프장:</strong> <br />9홀x2=18홀 기본값으로 처리됩니다. 9홀만 따로 정산하려면 <strong>[일정 추가]</strong>에서 직접 입력해 주세요.
                            </p>
                        </div>
                        <div className="flex items-start gap-3">
                            <span className="text-xl text-blue-500 mt-0.5">☔️</span>
                            <p className="text-sm text-stone-600 leading-relaxed">
                                <strong>우천 시:</strong> <br />당일/과거 일정은 <strong>홀별 캐디피를 직접 입력</strong>해서 수정할 수 있습니다.
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={handleSaveFees}
                        className="w-full mt-4 py-3 bg-emerald-600 text-white font-bold rounded-xl shadow-md hover:bg-emerald-700 transition flex items-center justify-center"
                    >
                        <Save size={20} className="mr-2" /> 설정 저장하기
                    </button>
                </div>
            </section>

            <hr className="border-stone-200" />

            {/* Data Management Section */}
            <section className="space-y-4">
                <h2 className="text-lg font-bold text-stone-800 flex items-center">
                    <FileJson className="mr-2 text-emerald-600" /> 데이터 백업 & 복구
                </h2>

                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 text-sm text-emerald-800">
                    <p className="font-bold mb-1">📢 백업 안내</p>
                    <p className="leading-relaxed">
                        앱을 열 때 <strong>자동으로 클라우드에 저장</strong>됩니다.<br />
                        <span className="text-emerald-700">• 스탠다드 이용권: 7일마다 자동 백업</span><br />
                        <span className="text-emerald-700">• 프리미엄 이용권: 매일 자동 백업</span><br />
                        아래 버튼으로 내 폰에도 따로 저장할 수 있습니다.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-3">

                    {/* R2 클라우드 직접 저장 버튼 */}
                    <button
                        onClick={handleCloudUpload}
                        disabled={cloudStatus === 'uploading'}
                        className={`flex items-center justify-center w-full py-4 rounded-xl font-bold transition shadow-sm ${
                            cloudStatus === 'uploading' ? 'bg-sky-300 text-white cursor-wait' :
                            cloudStatus === 'done'      ? 'bg-sky-600 text-white' :
                            cloudStatus === 'error'     ? 'bg-red-500 text-white' :
                            'bg-sky-500 text-white hover:bg-sky-400'
                        }`}
                    >
                        <Cloud className="mr-2" size={20} />
                        {cloudStatus === 'uploading' ? '저장 중…' :
                         cloudStatus === 'done'      ? '✅ 저장 완료!' :
                         cloudStatus === 'error'     ? '❌ 실패 — 다시 시도' :
                         'R2 클라우드에 지금 저장'}
                    </button>
                    {cloudMsg && (
                        <p className={`text-xs text-center font-bold px-2 ${cloudStatus === 'error' ? 'text-red-500' : 'text-sky-600'}`}>
                            {cloudMsg}
                        </p>
                    )}

                    <button
                        onClick={handleExport}
                        className="flex items-center justify-center w-full py-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-500 transition shadow-sm"
                    >
                        <Download className="mr-2" size={20} /> 내 폰에 저장 (파일 내보내기)
                    </button>

                    <div className="border-t border-stone-200 pt-3">
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center justify-center w-full py-4 bg-stone-100 text-stone-600 rounded-xl font-bold hover:bg-stone-200 transition"
                        >
                            <Upload className="mr-2" /> 백업 파일 불러오기 (복구)
                        </button>
                    </div>
                    <input
                        type="file"
                        accept=".json"
                        ref={fileInputRef}
                        onChange={handleImport}
                        className="hidden"
                    />
                </div>
            </section>

            <div className="text-center text-xs text-stone-400 mt-10 space-y-2">
                <div className="flex items-center justify-center gap-2">
                    <Link href="/admin" className="inline-block py-2 px-6 bg-stone-100 rounded-full text-stone-500 font-bold hover:bg-stone-200 transition-colors border border-stone-200">
                        관리자 도구 (v1.0)
                    </Link>
                    <Link href="/dealer-login" className="inline-block py-2 px-4 bg-blue-50 rounded-full text-blue-500 font-bold hover:bg-blue-100 transition-colors border border-blue-200 text-[11px]">
                        딜러 로그인
                    </Link>
                </div>
            </div>

            {/* 사업자 정보 + 약관 */}
            <div className="mt-5 pb-10 px-1">
                <p className="text-center text-[11px] text-stone-400 mb-3">
                    🔒 모든 데이터는 귀하의 기기 내에서만 처리됩니다.
                </p>
                <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 text-[11px] text-stone-500 leading-relaxed space-y-0.5">
                    <p className="font-bold text-stone-700 text-xs">에이원PRO</p>
                    <p>대표자: 김정식 | 사업자등록번호: 544-19-02359</p>
                    <p>주소: 경기도 화성시 만세구 향남읍 하길로 9, 1102동 1002호</p>
                    <p>통신판매업: 제 2026 - 화성만세 - 0114 호</p>
                    <p>고객센터: 010-2737-7229 | jslala222@gmail.com</p>
                    <div className="flex gap-4 mt-3 pt-2 border-t border-stone-200">
                        <button onClick={() => setPolicyModal('tos')} className="text-emerald-600 font-bold hover:underline">이용약관</button>
                        <button onClick={() => setPolicyModal('privacy')} className="text-emerald-600 font-bold hover:underline">개인정보처리방침</button>
                        <button onClick={() => setPolicyModal('refund')} className="text-red-500 font-bold hover:underline">환불 정책</button>
                    </div>
                </div>
            </div>
        </div>


        {/* PolicyModal */}
        {policyModal && (() => {
            const titles: Record<string, string> = { tos: '이용약관', privacy: '개인정보처리방침', refund: '환불 정책' };
            const contents: Record<string, string> = {
                tos: `제 1 조 (목적)\n본 약관은 에이원PRO(이하 "회사"라 함)가 제공하는 캐디 매니저 프로 서비스(이하 "서비스"라 함)를 이용함에 있어 회사와 이용자의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.\n\n제 2 조 (서비스 이용)\n1. 서비스는 골프 캐디의 일정 관리, 수입 정산 및 고객 관리를 위한 모바일 앱 서비스입니다.\n2. 이용자는 본 약관에 동의하고 이용권을 구매한 후 서비스를 이용할 수 있습니다.\n\n제 3 조 (딜러 제도)\n1. 회사는 딜러를 통한 이용권 판매를 허용합니다.\n2. 딜러는 본 약관 및 딜러 운영 정책에 따라 이용권을 판매하여야 합니다.\n3. 딜러가 고객에게 이용권을 재판매하는 경우, 딜러-고객 간 거래에 대한 책임은 딜러에게 있습니다.\n\n제 4 조 (결제 및 환불)\n1. 이용권 구매 및 환불에 관한 상세 사항은 별도의 '환불 정책'에 따릅니다.\n2. 이용자는 전자상거래 등에서의 소비자보호에 관한 법률에 따라 결제일로부터 7일 이내에 청약철회를 요청할 수 있습니다. 단, 이용권 코드를 접속 사용한 경우는 제외됩니다.\n\n제 5 조 (서비스 변경 및 중단)\n회사는 서비스 운영상 상당한 이유가 있는 경우 서비스의 전부 또는 일부를 변경하거나 중단할 수 있으며, 사전 고지합니다.\n\n제 6 조 (준거법 및 분쟁 해결)\n본 약관은 대한민국 법률에 따라 규율되며, 분쟁 발생 시 관할 법원은 회사 소재지 법원으로 합니다.\n\n시행일: 2026년 4월 1일`,
                privacy: `에이원PRO(이하 "회사")는 개인정보보호법 등 관련 법령에 따라 이용자의 개인정보를 보호합니다.\n\n1. 수집하는 개인정보 항목\n• 필수: 이름, 전화번호, 결제 기록\n• 자동 수집: 기기 정보, 서비스 이용 기록\n\n2. 개인정보의 이용 목적\n• 유료 서비스 제공 및 본인 확인\n• 이용권 발급 및 관리\n• 고객 상담 및 불만 처리\n\n3. 개인정보의 보유 및 이용기간\n원칙적으로 수집 목적 달성 시 지체 없이 파기합니다.\n• 결제 및 계약 기록: 5년 (전자상거래법)\n• 소비자 불만 처리 기록: 3년\n\n4. 개인정보 처리 위탁\n원활한 결제 서비스를 위해 아래와 같이 위탁합니다.\n• 수탁업체: KG이니시스 | 업무: 결제 처리\n\n5. 개인정보 보호책임자\n• 성명: 김정식\n• 이메일: jslala222@gmail.com\n• 전화: 010-2737-7229\n\n시행일: 2026년 4월 1일`,
                refund: `에이원PRO는 전자상거래 등에서의 소비자보호에 관한 법률을 준수합니다.\n\n1. 크레딧(이용권) 구매 환불\n결제일로부터 7일 이내, 고객에게 발급한 이용권 코드에 실제 데이터(일정·고객 정보 등) 입력 이력이 없는 경우 전액 환불이 가능합니다.\n\n2. 실사용 기준\n단순 로그인·접속은 사용으로 간주하지 않습니다.\n아래 중 하나 이상 해당하는 경우 실사용으로 간주하여 환불이 제한됩니다.\n• 일정(근무 기록) 1건 이상 등록\n• 고객 정보 1건 이상 등록\n• 수입 정산 데이터 1건 이상 입력\n\n3. 딜러-고객 간 환불 처리\n• 딜러가 고객에게 판매한 이용권의 환불은 딜러와 고객 간 합의에 따릅니다.\n• 미실사용 이용권에 한해 본사에 코드 비활성화 및 딜러 크레딧 복구를 요청할 수 있습니다.\n• 실사용 이력이 확인된 이용권은 환불 대상에서 제외됩니다.\n\n4. 환불 절차 및 처리 기간\n• 신청: 고객센터(010-2737-7229) 또는 이메일(jslala222@gmail.com)\n• 처리 기간: 영업일 기준 3~5일 이내\n• 환불 수단: 결제 시 사용한 동일 수단\n\n5. 카드결제 환불 시 유의사항\n카드결제는 PG사 정책에 따라 환불 처리까지 최대 15일이 소요될 수 있습니다.\n\n시행일: 2026년 4월 1일`
            };
            return (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={() => setPolicyModal(null)}>
                    <div className="bg-white rounded-t-3xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center px-6 py-4 border-b border-stone-100">
                            <h2 className="font-bold text-stone-800 text-base">{titles[policyModal]}</h2>
                            <button onClick={() => setPolicyModal(null)} className="text-stone-400 hover:text-stone-600 transition"><X size={20} /></button>
                        </div>
                        <div className="overflow-y-auto px-6 py-4 text-sm text-stone-600 leading-relaxed whitespace-pre-wrap flex-1">
                            {contents[policyModal]}
                        </div>
                        <div className="px-6 py-4 border-t border-stone-100">
                            <button onClick={() => setPolicyModal(null)} className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition">확인</button>
                        </div>
                    </div>
                </div>
            );
        })()}
        </>
    );
}
