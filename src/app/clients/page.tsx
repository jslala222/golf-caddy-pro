
'use client';

import { useState, useMemo } from 'react';
import { useAppStore, type Client, type ClientGrade, type Caddy, type CaddyRank } from '@/lib/store';
import { Search, UserPlus, Phone, Car, Edit, Trash2, X, User, Users, Hash } from 'lucide-react';

type TabType = 'all' | 'vip' | 'gn' | 'normal';
type PageTab = 'clients' | 'caddies';
type CaddyGroupTab = 'all' | '1' | '2' | '3' | '4' | '5' | '6';

export default function ClientsPage() {
    const { clients, addClient, updateClient, deleteClient, caddies, addCaddy, updateCaddy, deleteCaddy } = useAppStore();
    const [pageTab, setPageTab] = useState<PageTab>('clients');
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'list' | 'form'>('list');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabType>('all');

    // Form State
    const [name, setName] = useState('');
    const [contact, setContact] = useState('');
    const [carInfo, setCarInfo] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [memo, setMemo] = useState('');
    const [grade, setGrade] = useState<ClientGrade>('normal');

    // 캐디 관리 상태
    const [caddyGroupTab, setCaddyGroupTab] = useState<CaddyGroupTab>('all');
    const [caddyViewMode, setCaddyViewMode] = useState<'list' | 'form'>('list');
    const [editingCaddyId, setEditingCaddyId] = useState<string | null>(null);
    const [caddyName, setCaddyName] = useState('');
    const [caddyNo, setCaddyNo] = useState('');
    const [caddyGroupNo, setCaddyGroupNo] = useState('');
    const [caddyRank, setCaddyRank] = useState<CaddyRank>('normal');
    const [caddyContact, setCaddyContact] = useState('');
    const [caddyMemo, setCaddyMemo] = useState('');
    const [caddySearchTerm, setCaddySearchTerm] = useState('');

    const filteredCaddies = useMemo(() => {
        return caddies.filter(c => {
            const matchGroup = caddyGroupTab === 'all' || String(c.group_no) === caddyGroupTab;
            const matchSearch = !caddySearchTerm || c.name.includes(caddySearchTerm) ||
                String(c.caddy_no ?? '').includes(caddySearchTerm);
            return matchGroup && matchSearch && c.is_active;
        }).sort((a, b) => (a.caddy_no ?? 999) - (b.caddy_no ?? 999));
    }, [caddies, caddyGroupTab, caddySearchTerm]);

    const caddyGroupCounts = useMemo(() => {
        const counts: Record<string, number> = { all: 0 };
        for (let i = 1; i <= 6; i++) counts[String(i)] = 0;
        caddies.filter(c => c.is_active).forEach(c => {
            counts.all++;
            if (c.group_no) counts[String(c.group_no)] = (counts[String(c.group_no)] ?? 0) + 1;
        });
        return counts;
    }, [caddies]);

    const resetCaddyForm = () => {
        setCaddyName(''); setCaddyNo(''); setCaddyGroupNo('');
        setCaddyRank('normal'); setCaddyContact(''); setCaddyMemo('');
        setEditingCaddyId(null); setCaddyViewMode('list');
    };

    const handleCaddySubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!caddyName.trim()) return;
        const data = {
            name: caddyName.trim(),
            caddy_no: caddyNo ? Number(caddyNo) : undefined,
            group_no: caddyGroupNo ? Number(caddyGroupNo) : undefined,
            rank: caddyRank,
            contact: caddyContact,
            memo: caddyMemo,
            is_active: true,
        };
        if (editingCaddyId) {
            updateCaddy(editingCaddyId, data);
        } else {
            addCaddy(data);
        }
        resetCaddyForm();
    };

    const handleCaddyEdit = (c: Caddy) => {
        setEditingCaddyId(c.id);
        setCaddyName(c.name);
        setCaddyNo(c.caddy_no ? String(c.caddy_no) : '');
        setCaddyGroupNo(c.group_no ? String(c.group_no) : '');
        setCaddyRank(c.rank);
        setCaddyContact(c.contact ?? '');
        setCaddyMemo(c.memo ?? '');
        setCaddyViewMode('form');
    };

    // Counts
    const counts = useMemo(() => {
        return {
            all: clients.length,
            vip: clients.filter(c => c.grade === 'vip').length,
            gn: clients.filter(c => c.grade === 'gn').length,
            normal: clients.filter(c => c.grade === 'normal').length,
        };
    }, [clients]);

    // Filtered Clients
    const filteredClients = useMemo(() => {
        return clients.filter(client => {
            // 1. Tab Filter
            if (activeTab !== 'all' && client.grade !== activeTab) return false;

            // 2. Search Filter
            const searchLower = searchTerm.toLowerCase();
            return (
                client.name.toLowerCase().includes(searchLower) ||
                (client.contact && client.contact.includes(searchTerm)) ||
                (client.carInfo && client.carInfo.toLowerCase().includes(searchLower))
            );
        }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); // Newest first
    }, [clients, searchTerm, activeTab]);

    const formatPhoneNumber = (value: string) => {
        const numbers = value.replace(/[^0-9]/g, '');
        if (numbers.length <= 3) return numbers;
        if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
        return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
    };

    const handleContactChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setContact(formatPhoneNumber(e.target.value));
    };

    const handleCaddyContactChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCaddyContact(formatPhoneNumber(e.target.value));
    };

    const resetForm = () => {
        setName('');
        setContact('');
        setCarInfo('');
        setBirthDate('');
        setMemo('');
        setGrade('normal');
        setEditingId(null);
        setViewMode('list');
    };

    const handleAddNewClick = () => {
        resetForm();
        setViewMode('form');
    };

    const handleEditClick = (client: Client) => {
        setEditingId(client.id);
        setName(client.name);
        setContact(client.contact || '');
        setCarInfo(client.carInfo || '');
        setBirthDate(client.birthDate || '');
        setMemo(client.memo || '');
        setGrade(client.grade);
        setViewMode('form');
    };

    const handleDelete = (id: string) => {
        if (confirm('정말 삭제하시겠습니까?')) {
            deleteClient(id);
            if (editingId === id) resetForm();
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            alert('이름을 입력해주세요.');
            return;
        }

        const clientData = {
            name,
            contact,
            carInfo,
            birthDate,
            memo,
            grade
        };

        if (editingId) {
            updateClient(editingId, clientData);
        } else {
            addClient(clientData);
        }
        resetForm();
    };

    // Render Grade Badge
    const renderGradeBadge = (g: ClientGrade) => {
        switch (g) {
            case 'vip': return <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full">VIP 😇</span>;
            case 'gn': return <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-1 rounded-full border border-red-200">진상 🤬</span>;
            default: return <span className="bg-stone-100 text-stone-500 text-xs font-bold px-2 py-1 rounded-full">일반 🙂</span>;
        }
    };

    return (
        <div className="min-h-screen bg-stone-50 flex flex-col">
            {/* Header (Fixed) */}
            <div className="bg-white px-6 pt-6 pb-2 border-b border-stone-100 sticky top-0 z-10">
                {/* 인원관리 / 캐디관리 상단 탭 */}
                <div className="flex gap-1 p-1 bg-stone-100 rounded-2xl mb-4">
                    <button
                        onClick={() => setPageTab('clients')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl font-black text-sm transition ${pageTab === 'clients' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-400'}`}
                    >
                        <User size={15} /> 고객관리
                    </button>
                    <button
                        onClick={() => setPageTab('caddies')}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl font-black text-sm transition ${pageTab === 'caddies' ? 'bg-white text-emerald-700 shadow-sm' : 'text-stone-400'}`}
                    >
                        <Users size={15} /> 캐디관리
                    </button>
                </div>

                {pageTab === 'clients' && (
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-2xl font-bold text-stone-900 flex items-center">
                        <User className="mr-2 text-emerald-600" /> 고객 관리
                    </h1>
                    <button
                        onClick={handleAddNewClick}
                        className="bg-stone-900 text-white p-3 rounded-full hover:bg-stone-700 transition shadow-lg"
                    >
                        <UserPlus size={20} />
                    </button>
                </div>
                )}

                {pageTab === 'caddies' && (
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-2xl font-bold text-stone-900 flex items-center">
                        <Users className="mr-2 text-emerald-600" /> 캐디 관리
                    </h1>
                    <button
                        onClick={() => { resetCaddyForm(); setCaddyViewMode('form'); }}
                        className="bg-emerald-600 text-white p-3 rounded-full hover:bg-emerald-700 transition shadow-lg"
                    >
                        <UserPlus size={20} />
                    </button>
                </div>
                )}

                {/* 고객관리 탭 필터 */}
                {pageTab === 'clients' && (
                <div className="flex space-x-1 overflow-x-auto no-scrollbar pb-2">
                    {[
                        { id: 'all', label: '전체', count: counts.all },
                        { id: 'vip', label: 'VIP 😇', count: counts.vip },
                        { id: 'gn', label: '진상 🤬', count: counts.gn },
                        { id: 'normal', label: '일반 🙂', count: counts.normal },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as TabType)}
                            className={`flex items-center px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all border
                            ${activeTab === tab.id
                                    ? 'bg-stone-900 text-white border-stone-900 shadow-md'
                                    : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'
                                }`}
                        >
                            {tab.label}
                            <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? 'bg-stone-700 text-stone-200' : 'bg-stone-100 text-stone-400'}`}>
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>
                )}

                {/* 캐디관리 조 탭 필터 */}
                {pageTab === 'caddies' && (
                <div className="flex space-x-1 overflow-x-auto no-scrollbar pb-2">
                    {(['all','1','2','3','4','5','6'] as CaddyGroupTab[]).map(g => (
                        <button key={g}
                            onClick={() => setCaddyGroupTab(g)}
                            className={`flex items-center px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border
                            ${caddyGroupTab === g ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-white text-stone-500 border-stone-200'}`}
                        >
                            {g === 'all' ? '전체' : `${g}조`}
                            <span className={`ml-1.5 text-[10px] px-1 py-0.5 rounded-full ${caddyGroupTab === g ? 'bg-emerald-500 text-white' : 'bg-stone-100 text-stone-400'}`}>
                                {caddyGroupCounts[g] ?? 0}
                            </span>
                        </button>
                    ))}
                </div>
                )}
            </div>

            <div className="p-6 flex-1 pb-24">
                {/* ====== 고객관리 섹션 ====== */}
                {pageTab === 'clients' && (viewMode === 'list' ? (
                    <>
                        {/* Search Bar */}
                        <div className="relative mb-6">
                            <input
                                type="text"
                                placeholder="이름, 전화번호, 차량번호 검색..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full p-4 pl-12 bg-white rounded-2xl border-none shadow-sm text-stone-700 focus:ring-2 focus:ring-emerald-500 transition"
                            />
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
                        </div>

                        {/* Client List */}
                        <div className="space-y-4">
                            {filteredClients.length === 0 ? (
                                <div className="text-center py-10 text-stone-400">
                                    <p className="mb-2">
                                        {searchTerm ? '검색 결과가 없습니다.' : '등록된 고객이 없습니다.'}
                                    </p>
                                    <p className="text-sm">새로운 고객을 등록해보세요!</p>
                                </div>
                            ) : (
                                filteredClients.map(client => (
                                    <div
                                        key={client.id}
                                        className={`bg-white p-5 rounded-2xl shadow-sm border-l-4 transition relative overflow-hidden group
                                    ${client.grade === 'vip' ? 'border-l-blue-500 border-y border-r border-blue-50' :
                                                client.grade === 'gn' ? 'border-l-red-500 border-y border-r border-red-50' : 'border-l-stone-300 border-y border-r border-stone-100'}`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-lg font-bold text-stone-800">{client.name}</h3>
                                                {renderGradeBadge(client.grade)}
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleEditClick(client)}
                                                    className="p-2 text-stone-400 hover:text-emerald-600 bg-stone-50 rounded-lg"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(client.id)}
                                                    className="p-2 text-stone-400 hover:text-red-600 bg-stone-50 rounded-lg"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-1 text-sm text-stone-500">
                                            {client.contact && (
                                                <div className="flex items-center gap-2">
                                                    <Phone size={14} className="text-stone-300" />
                                                    {client.contact}
                                                </div>
                                            )}
                                            {client.carInfo && (
                                                <div className="flex items-center gap-2">
                                                    <Car size={14} className="text-stone-300" />
                                                    {client.carInfo}
                                                </div>
                                            )}
                                        </div>

                                        {client.memo && (
                                            <div className="mt-3 p-3 bg-stone-50 rounded-xl text-stone-600 text-sm">
                                                {client.memo}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </>
                ) : (
                    <div className="bg-white rounded-3xl p-6 shadow-sm animate-in slide-in-from-bottom-4">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-stone-900">
                                {editingId ? '고객 정보 수정' : '새 고객 등록'}
                            </h2>
                            <button onClick={resetForm} className="p-2 bg-stone-50 rounded-full text-stone-400">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Name Input */}
                            <div>
                                <label className="block text-sm font-bold text-stone-500 mb-1 ml-1">이름</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="고객 이름 입력"
                                    className="w-full p-4 bg-stone-50 rounded-2xl font-bold text-stone-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition"
                                />
                            </div>

                            {/* Grade Selection */}
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setGrade('vip')}
                                    className={`p-3 rounded-xl font-bold text-sm transition border-2
                                ${grade === 'vip' ? 'bg-blue-50 border-blue-400 text-blue-600' : 'bg-white border-stone-100 text-stone-400'}`}
                                >
                                    VIP 😇
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setGrade('normal')}
                                    className={`p-3 rounded-xl font-bold text-sm transition border-2
                                ${grade === 'normal' ? 'bg-stone-100 border-stone-400 text-stone-600' : 'bg-white border-stone-100 text-stone-400'}`}
                                >
                                    일반 🙂
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setGrade('gn')}
                                    className={`p-3 rounded-xl font-bold text-sm transition border-2
                                ${grade === 'gn' ? 'bg-red-50 border-red-400 text-red-600' : 'bg-white border-stone-100 text-stone-400'}`}
                                >
                                    진상 🤬
                                </button>
                            </div>

                            {/* Contact & Car Info */}
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-stone-500 mb-1 ml-1">전화번호 (선택)</label>
                                    <input
                                        type="tel"
                                        value={contact}
                                        onChange={handleContactChange}
                                        placeholder="010-0000-0000"
                                        className="w-full p-4 bg-stone-50 rounded-2xl text-stone-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-stone-500 mb-1 ml-1">차량 정보 (선택)</label>
                                    <input
                                        type="text"
                                        value={carInfo}
                                        onChange={(e) => setCarInfo(e.target.value)}
                                        placeholder="예: 벤츠 12가3456"
                                        className="w-full p-4 bg-stone-50 rounded-2xl text-stone-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition"
                                    />
                                </div>
                            </div>

                            {/* Memo */}
                            <div>
                                <label className="block text-sm font-bold text-stone-500 mb-1 ml-1">특징 메모</label>
                                <textarea
                                    value={memo}
                                    onChange={(e) => setMemo(e.target.value)}
                                    placeholder="고객 특징, 선호도 등을 적어두세요."
                                    rows={3}
                                    className="w-full p-4 bg-stone-50 rounded-2xl text-stone-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none transition resize-none"
                                />
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                className="w-full py-4 mt-4 bg-stone-900 text-white rounded-2xl font-bold text-lg hover:bg-stone-800 transition shadow-lg"
                            >
                                {editingId ? '수정 완료' : '등록하기'}
                            </button>
                        </form>
                    </div>
                )
                )}

                {/* ====== 캐디관리 섹션 ====== */}
                {pageTab === 'caddies' && (
                <>
                {caddyViewMode === 'list' ? (
                    <>
                        {/* 캐디 검색 */}
                        <div className="relative mb-4">
                            <input type="text" placeholder="이름, 캐디번호 검색..."
                                value={caddySearchTerm} onChange={e => setCaddySearchTerm(e.target.value)}
                                className="w-full p-3 pl-10 bg-white rounded-2xl border-none shadow-sm text-stone-700 focus:ring-2 focus:ring-emerald-400 transition text-sm" />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
                        </div>
                        {/* 캐디 목록 */}
                        <div className="space-y-2">
                            {filteredCaddies.length === 0 ? (
                                <div className="text-center py-12 text-stone-400">
                                    <Users size={36} className="mx-auto mb-3 text-stone-200" />
                                    <p className="font-bold">등록된 캐디가 없습니다.</p>
                                    <p className="text-xs mt-1">우측 상단 + 버튼으로 추가하세요.</p>
                                </div>
                            ) : filteredCaddies.map(c => {
                                // 조별 로또볼 색상
                                const ballColor: Record<number, string> = {
                                    1: 'bg-yellow-400 shadow-yellow-300',
                                    2: 'bg-sky-400 shadow-sky-300',
                                    3: 'bg-red-500 shadow-red-300',
                                    4: 'bg-violet-500 shadow-violet-300',
                                    5: 'bg-emerald-500 shadow-emerald-300',
                                    6: 'bg-orange-500 shadow-orange-300',
                                };
                                const ball = ballColor[c.group_no ?? 0] ?? 'bg-stone-400 shadow-stone-300';
                                return (
                                <div key={c.id} className="bg-white rounded-2xl px-4 py-3 shadow-sm flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        {/* 로또볼 */}
                                        <div className={`w-14 h-14 rounded-full ${ball} shadow-lg flex items-center justify-center flex-shrink-0`}>
                                            <span className="text-white font-black text-xl leading-none drop-shadow">{c.caddy_no ?? '?'}</span>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="font-bold text-stone-800 text-base">{c.name}</span>
                                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full
                                                    ${c.rank === 'leader' ? 'bg-amber-100 text-amber-700' : c.rank === 'standby' ? 'bg-sky-100 text-sky-700' : 'bg-stone-100 text-stone-500'}`}>
                                                    {c.rank === 'leader' ? '⭐조장' : c.rank === 'standby' ? '대기' : '일반'}
                                                </span>
                                            </div>
                                            <div className="flex gap-2 mt-0.5 items-center">
                                                {c.group_no && <span className="text-xs font-bold text-stone-500">{c.group_no}조</span>}
                                                {c.contact && <span className="text-sm font-bold text-stone-700">{c.contact}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-1.5">
                                        <button onClick={() => handleCaddyEdit(c)} className="p-2 text-stone-400 hover:text-emerald-600 bg-stone-50 rounded-lg">
                                            <Edit size={14} />
                                        </button>
                                        <button onClick={() => { if (confirm('삭제하시겠습니까?')) deleteCaddy(c.id); }} className="p-2 text-stone-400 hover:text-red-500 bg-stone-50 rounded-lg">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                                );})}
                        </div>
                    </>
                ) : (
                    <div className="bg-white rounded-3xl p-6 shadow-sm">
                        <div className="flex justify-between items-center mb-5">
                            <h2 className="text-xl font-bold text-stone-900">{editingCaddyId ? '캐디 정보 수정' : '새 캐디 등록'}</h2>
                            <button onClick={resetCaddyForm} className="p-2 bg-stone-50 rounded-full text-stone-400"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleCaddySubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-stone-500 mb-1 ml-1">이름 *</label>
                                <input type="text" value={caddyName} onChange={e => setCaddyName(e.target.value)}
                                    placeholder="캐디 이름"
                                    className="w-full p-4 bg-stone-50 rounded-2xl font-bold text-stone-800 focus:bg-white focus:ring-2 focus:ring-emerald-400 outline-none" />
                            </div>
                            {/* 직위 */}
                            <div>
                                <label className="block text-sm font-bold text-stone-500 mb-2 ml-1">직위</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {([['leader','조장','amber'],['normal','일반','stone'],['standby','대기','sky']] as [CaddyRank,string,string][]).map(([r,label,col]) => (
                                        <button key={r} type="button" onClick={() => setCaddyRank(r)}
                                            className={`py-3 rounded-xl font-bold text-sm border-2 transition
                                            ${caddyRank === r ? `border-${col}-400 bg-${col}-50 text-${col}-700` : 'border-stone-100 bg-white text-stone-400'}`}>
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-sm font-bold text-stone-500 mb-1 ml-1">조번호</label>
                                    <input type="text" inputMode="numeric" value={caddyGroupNo} onChange={e => setCaddyGroupNo(e.target.value.replace(/\D/g,''))}
                                        placeholder="1~6"
                                        className="w-full p-4 bg-stone-50 rounded-2xl text-stone-800 focus:bg-white focus:ring-2 focus:ring-emerald-400 outline-none text-center font-bold" />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-stone-500 mb-1 ml-1">캐디번호</label>
                                    <input type="text" inputMode="numeric" value={caddyNo} onChange={e => setCaddyNo(e.target.value.replace(/\D/g,''))}
                                        placeholder="예: 15"
                                        className="w-full p-4 bg-stone-50 rounded-2xl text-stone-800 focus:bg-white focus:ring-2 focus:ring-emerald-400 outline-none text-center font-bold" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-stone-500 mb-1 ml-1">전화번호 (선택)</label>
                                <input type="tel" value={caddyContact} onChange={handleCaddyContactChange}
                                    placeholder="010-0000-0000"
                                    className="w-full p-4 bg-stone-50 rounded-2xl text-stone-800 focus:bg-white focus:ring-2 focus:ring-emerald-400 outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-stone-500 mb-1 ml-1">메모 (선택)</label>
                                <input type="text" value={caddyMemo} onChange={e => setCaddyMemo(e.target.value)}
                                    placeholder="특이사항 등"
                                    className="w-full p-4 bg-stone-50 rounded-2xl text-stone-800 focus:bg-white focus:ring-2 focus:ring-emerald-400 outline-none" />
                            </div>
                            <button type="submit"
                                className="w-full py-4 mt-2 bg-emerald-600 text-white rounded-2xl font-bold text-lg hover:bg-emerald-700 transition shadow-lg">
                                {editingCaddyId ? '수정 완료' : '캐디 등록'}
                            </button>
                        </form>
                    </div>
                )}
                </>
                )}
            </div>
        </div>
    );
}
