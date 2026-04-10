
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FC } from 'react';
import type { FC } from 'react';
import { X } from 'lucide-react';
import { Schedule } from '@/lib/store';
import AlertModal from './AlertModal';

interface ScheduleModalProps {
  open: boolean;
  date: string | null;
  onClose: () => void;
  schedules: Schedule[];
  addSchedule: (schedule: Omit<Schedule, 'id' | 'createdAt'>) => void;
  updateSchedule: (id: string, updates: Partial<Schedule>) => void;
  deleteSchedule: (id: string) => void;
}

const TYPE_LABEL: Record<string, string> = {
  work: '근무',
  personal: '개인일정',
  holiday: '휴무',
};
const SHIFT_LABEL: Record<string, string> = {
  '1': '1부',
  '2': '2부',
  '3': '3부',
};

function isPast(dateStr: string) {
  const today = new Date();
  const d = new Date(dateStr);
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d < today;
}

export default function ScheduleModal({ open, date, onClose, schedules }: ScheduleModalProps) {
  const router = useRouter();
  if (!open || !date) return null;

  // 휴무, 근무, 개인일정 분리 및 정렬
  const holidays = schedules.filter(s => s.type === 'holiday');
  const works = schedules.filter(s => s.type === 'work');
  const personals = schedules.filter(s => s.type === 'personal');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6 relative">
        <button
          className="absolute top-3 right-3 text-stone-400 hover:text-stone-700"
          onClick={onClose}
          aria-label="닫기"
        >
          <X size={24} />
        </button>
        <div className="mb-4">
          <div className="font-bold text-lg mb-2">
            {(() => {
              if (!date) return '';
              const d = new Date(date);
              const yoil = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
              return `${date} (${yoil}) 일정`;
            })()}
          </div>
          {schedules.length === 0 ? (
            <div className="text-stone-400 text-sm mb-2">등록된 일정이 없습니다.</div>
          ) : (
            <ul className="mb-4 space-y-1 max-h-[420px] overflow-y-auto pr-1">
              {/* 휴무 최상단, 시간 없이 굵은 빨강 */}
              {holidays.map(s => (
                <li key={s.id} className="py-1 border-b last:border-b-0">
                  <span className="font-bold text-red-600 text-base">휴무</span>
                </li>
              ))}
              {/* 근무: 파랑 */}
              {works.map(s => (
                <li key={s.id} className="mb-3">
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 flex items-center gap-3 shadow-sm">
                    <div className="w-2 h-10 rounded-full bg-blue-400 mr-3" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-blue-600">근무</span>
                        <span className="text-xs text-blue-400">{s.shift ? SHIFT_LABEL[s.shift] : ''}</span>
                        <span className="text-xs text-stone-400">{s.time || '00:00'}</span>
                      </div>
                      <div className="font-bold text-stone-800 text-sm">{s.title}</div>
                    </div>
                    <button className="ml-2 px-3 py-1 rounded-lg border border-blue-200 bg-white text-blue-600 text-xs font-bold hover:bg-blue-100 transition">수정</button>
                  </div>
                </li>
              ))}
              {/* 개인일정: 검정 */}
              {personals.map(s => (
                <li key={s.id} className="py-1 border-b last:border-b-0">
                  <span className="font-normal text-stone-900">
                    [개인일정] {s.time} {s.title}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex gap-2 mt-4">
          <button
            className="bg-emerald-500 text-white rounded py-2 font-bold flex-1"
            style={{ flex: 7 }}
            onClick={() => {
              router.push('/schedule');
            }}
          >일정 추가 및 변경</button>
          <button
            className="bg-stone-200 text-stone-700 rounded py-2 font-bold flex-1"
            style={{ flex: 3 }}
            onClick={onClose}
          >닫기</button>
        </div>
      </div>
    </div>
  );
}

// (읽기 전용) 일정 리스트 아이템 컴포넌트 제거됨
