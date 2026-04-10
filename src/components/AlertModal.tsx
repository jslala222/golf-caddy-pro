import React from 'react';

interface AlertModalProps {
  open: boolean;
  message: string;
  onClose: () => void;
}

export default function AlertModal({ open, message, onClose }: AlertModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-2xl relative animate-in fade-in-from-top-4 text-center">
        <div className="mb-4 text-stone-800 font-bold text-lg">알림</div>
        <div className="mb-6 text-stone-600 text-base whitespace-pre-line">{message}</div>
        <button
          onClick={onClose}
          className="w-full bg-emerald-500 text-white rounded py-2 font-bold mt-2 hover:bg-emerald-600 transition"
        >
          확인
        </button>
      </div>
    </div>
  );
}
