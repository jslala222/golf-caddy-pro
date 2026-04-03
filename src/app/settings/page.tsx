
'use client';

import Link from 'next/link';
import { useRef, useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { Settings, Download, Upload, Trash2, AlertTriangle, FileJson, Save, Cloud } from 'lucide-react';
import { formatNumber } from '@/lib/utils';
import { InstallPWA } from '@/components/InstallPWA';

export default function SettingsPage() {
    const { exportData, importData, resetData, feeSettings, updateFeeSettings } = useAppStore();
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 클라우드 백업 상태
    const [cloudStatus, setCloudStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
    const [cloudMsg, setCloudMsg] = useState('');

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
                    <p className="font-bold mb-1">📢 필독하세요!</p>
                    <p>
                        이 앱은 서버가 없습니다. <strong>폰을 잃어버리면 데이터도 사라집니다.</strong><br />
                        [백업] 버튼을 누르면 <strong>파일 + 클라우드 동시 저장</strong>됩니다.<br />
                        매일 앱 실행 시 클라우드에 <strong>자동 백업</strong>도 진행됩니다.
                    </p>
                </div>

                {/* 클라우드 상태 메시지 */}
                {cloudStatus !== 'idle' && (
                    <div className={`text-sm p-3 rounded-xl font-semibold flex items-center gap-2 ${
                        cloudStatus === 'error' ? 'bg-red-50 text-red-600 border border-red-200' :
                        cloudStatus === 'done'  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        'bg-blue-50 text-blue-600 border border-blue-200'
                    }`}>
                        {cloudStatus === 'uploading' && (
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        )}
                        {cloudStatus === 'uploading' ? '클라우드에 백업 중…' : cloudMsg}
                    </div>
                )}

                {/* 클라우드 자동 백업 안내 */}
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-sm text-blue-800">
                    <p className="font-bold mb-1">☁️ 클라우드 백업이란?</p>
                    <p className="leading-relaxed">
                        데이터를 서버에 안전하게 저장합니다.<br />
                        <strong>폰 분실·교체·초기화</strong> 시 고객센터에 연락하시면
                        <strong> 복구 서비스</strong>를 받으실 수 있습니다.
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-3">

                    {/* 클라우드 백업 저장만 노출 (복원은 관리자만) */}
                    <button
                        onClick={handleCloudUpload}
                        disabled={cloudStatus === 'uploading'}
                        className="flex items-center justify-center w-full py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-500 transition shadow-sm disabled:opacity-50"
                    >
                        <Cloud className="mr-2" size={20} /> 백업 (파일 저장 + 클라우드)
                    </button>

                    <div className="border-t border-stone-200 pt-3 space-y-3">
                        <button
                            onClick={handleExport}
                            className="flex items-center justify-center w-full py-4 bg-white border-2 border-emerald-500 text-emerald-600 rounded-xl font-bold hover:bg-emerald-50 transition shadow-sm"
                        >
                            <Download className="mr-2" /> 백업 파일 저장 (내보내기)
                        </button>

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

            <div className="text-center text-xs text-stone-400 mt-10 pb-10">
                <Link href="/admin" className="inline-block py-2 px-6 bg-stone-100 rounded-full text-stone-500 font-bold hover:bg-stone-200 transition-colors border border-stone-200">
                    관리자 도구 (v1.0)
                </Link>
                <p className="mt-2 text-[10px]">Data stored locally on your device.</p>
            </div>
        </div>
    );
}
