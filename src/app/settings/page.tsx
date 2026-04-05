
'use client';

import Link from 'next/link';
import { useRef, useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { Settings, Download, Upload, Trash2, AlertTriangle, FileJson, Save, Cloud, Key, Copy, Check, Database, RefreshCw } from 'lucide-react';
import { migrateLocalDataToSupabase } from '@/lib/supabaseDB';
import { formatNumber } from '@/lib/utils';
import { InstallPWA } from '@/components/InstallPWA';

export default function SettingsPage() {
    const { exportData, importData, resetData, feeSettings, updateFeeSettings } = useAppStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 이용권 정보
    const [licenseCode, setLicenseCode] = useState<string | null>(null);
    const [licenseExpiresAt, setLicenseExpiresAt] = useState<string | null>(null);
    const [codeCopied, setCodeCopied] = useState(false);

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
        const { schedules, transactions, clients, feeSettings } = useAppStore.getState();
        setMigrateStatus('migrating');
        setMigrateMsg('');
        const result = await migrateLocalDataToSupabase({ schedules, transactions, clients, feeSettings });
        if (result.ok) {
            setMigrateStatus('done');
            setMigrateMsg(result.message);
        } else {
            setMigrateStatus('error');
            setMigrateMsg(result.message);
        }
        setTimeout(() => setMigrateStatus('idle'), 6000);
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
        const date = new Date().toISOString().split('T')[0];
        link.href = url;
        link.download = `caddy-backup-${date}.json`;
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
        const date = new Date().toISOString().split('T')[0];
        link.href = url;
        link.download = `caddy-backup-${date}.json`;
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

            <hr className="border-stone-200" />

            {/* Advanced Tools Collapsible */}
            <details className="group bg-stone-50 p-4 rounded-2xl border border-stone-200">
                <summary className="cursor-pointer flex items-center justify-between font-bold text-stone-600 hover:text-stone-900 list-none">
                    <span className="flex items-center">🛠️ 고급 데이터 관리 (삭제/복구/초기화)</span>
                    <span className="text-xs bg-stone-200 px-2 py-1 rounded text-stone-500 group-open:hidden">펼치기</span>
                    <span className="text-xs bg-stone-200 px-2 py-1 rounded text-stone-500 hidden group-open:inline">접기</span>
                </summary>

                <div className="space-y-8 pt-6 mt-2 border-t border-stone-200 animate-in slide-in-from-top-2">
                    {/* Time Machine (Data Rollback) */}
                    <section className="space-y-4">
                        <h2 className="text-lg font-bold text-stone-800 flex items-center">
                            <Trash2 className="mr-2 text-stone-600" /> 타임머신 (데이터 정리)
                        </h2>
                        <div className="bg-white p-4 rounded-xl border border-stone-200">
                            <p className="text-sm text-stone-600 mb-3">
                                특정 시점 <strong>이전에 입력된 데이터</strong>를 모두 삭제합니다.<br />
                                <span className="text-xs text-stone-400">(&ldquo;오늘 오후 1시 이전에 연습으로 입력한 거 다 지워줘&rdquo;)</span>
                            </p>
                            <div className="flex gap-2">
                                <input
                                    type="datetime-local"
                                    className="flex-1 p-3 border rounded-xl text-stone-800"
                                    onChange={(e) => {
                                        if (!e.target.value) return;
                                        if (confirm(`${e.target.value.replace('T', ' ')} 이전에 입력된 모든 데이터를 삭제하시겠습니까?\n\n(주의: 일정, 고객, 가계부 모두 포함됩니다)`)) {
                                            const date = new Date(e.target.value).toISOString();
                                            useAppStore.getState().deleteDataBefore(date);
                                            alert('삭제되었습니다.');
                                            window.location.reload();
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    </section>

                    {/* Data Rescue Section */}
                    <section className="space-y-4">
                        <h2 className="text-lg font-bold text-blue-600 flex items-center">
                            <AlertTriangle className="mr-2" /> 데이터 구조대 (응급 복구)
                        </h2>
                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm text-blue-800">
                            <p className="font-bold mb-1">💡 데이터가 안 보이시나요?</p>
                            <p>
                                업데이트 과정에서 옛날 장부가 숨겨졌을 수 있습니다.
                                아래 버튼을 누르면 숨겨진 데이터를 찾아 새 장부로 옮겨드립니다.
                            </p>
                        </div>
                        <button
                            onClick={() => {
                                const raw = localStorage.getItem('caddy-manager-storage');
                                if (raw) {
                                    try {
                                        const parsed = JSON.parse(raw);
                                        const state = parsed.state;
                                        if (state) {
                                            // 1. Recover Schedules
                                            const schedules = state.schedules || [];

                                            // 2. Recover Clients (merge customers + clients)
                                            const oldCustomers = state.customers || [];
                                            const existingClients = state.clients || [];

                                            // Convert old customers to new clients format
                                            const convertedClients = oldCustomers.map((c: any) => ({
                                                ...c,
                                                grade: c.type === 'good' ? 'vip' : c.type === 'bad' ? 'gn' : 'normal',
                                                visitCount: 0,
                                                createdAt: c.createdAt || new Date().toISOString(),
                                            }));

                                            // Merge without duplicates (by ID)
                                            const allClients = [...existingClients];
                                            convertedClients.forEach((c: any) => {
                                                if (!allClients.find((ec: any) => ec.id === c.id)) {
                                                    allClients.push(c);
                                                }
                                            });

                                            // Force Import
                                            const recoveryData = {
                                                schedules: schedules,
                                                clients: allClients,
                                                transactions: state.transactions || [],
                                                feeSettings: state.feeSettings
                                            };

                                            importData(JSON.stringify(recoveryData));
                                            alert(`복구 완료!\n일정: ${schedules.length}개\n고객: ${allClients.length}명 (구버전 ${oldCustomers.length}명 포함)`);
                                            window.location.reload();
                                        }
                                    } catch (e) {
                                        alert('데이터 파실패: ' + e);
                                    }
                                } else {
                                    alert('저장된 데이터가 없습니다.');
                                }
                            }}
                            className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl shadow-md hover:bg-blue-700 transition"
                        >
                            🚑 숨겨진 데이터 찾기 & 복구 (Smart Restore)
                        </button>
                    </section>
                </div>
            </details>

            {/* Supabase 동기화 섹션 */}
            <hr className="border-stone-200" />
            <section className="space-y-4">
                <h2 className="text-lg font-bold text-stone-800 flex items-center">
                    <Database size={18} className="mr-2 text-blue-500" /> Supabase 클라우드 동기화
                </h2>
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm text-blue-800">
                    <p className="font-bold mb-1">☁️ 다기기 동기화</p>
                    <p className="leading-relaxed text-xs">현재 폰의 데이터를 클라우드 DB에 동기화합니다. 폰을 바꿔도 같은 이용코드로 로그인하면 데이터가 유지됩니다.</p>
                </div>
                <button
                    onClick={handleMigrate}
                    disabled={migrateStatus === 'migrating'}
                    className={`w-full py-4 font-bold rounded-xl shadow-md transition flex items-center justify-center gap-2 ${
                        migrateStatus === 'migrating' ? 'bg-stone-300 text-stone-500 cursor-not-allowed' :
                        migrateStatus === 'done' ? 'bg-emerald-600 text-white' :
                        migrateStatus === 'error' ? 'bg-red-500 text-white' :
                        'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                >
                    <RefreshCw size={18} className={migrateStatus === 'migrating' ? 'animate-spin' : ''} />
                    {migrateStatus === 'migrating' ? '동기화 중...' :
                     migrateStatus === 'done' ? '✅ 동기화 완료!' :
                     migrateStatus === 'error' ? '❌ 실패 — 다시 시도' :
                     '지금 바로 동기화하기'}
                </button>
                {migrateMsg && (
                    <p className={`text-xs text-center font-bold ${ migrateStatus === 'done' ? 'text-emerald-600' : 'text-red-500'}`}>{migrateMsg}</p>
                )}
            </section>

            <div className="text-center text-xs text-stone-400 mt-10 pb-10 space-y-2">
                <div className="flex items-center justify-center gap-2">
                    <Link href="/admin" className="inline-block py-2 px-6 bg-stone-100 rounded-full text-stone-500 font-bold hover:bg-stone-200 transition-colors border border-stone-200">
                        관리자 도구 (v1.0)
                    </Link>
                    <Link href="/dealer-login" className="inline-block py-2 px-4 bg-blue-50 rounded-full text-blue-500 font-bold hover:bg-blue-100 transition-colors border border-blue-200 text-[11px]">
                        딜러 로그인
                    </Link>
                </div>
                <p className="text-[10px]">Data stored locally on your device.</p>
            </div>
        </div>
    );
}
