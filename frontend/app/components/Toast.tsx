'use client';

import React, { useEffect } from "react";

export interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

interface ToastContainerProps {
  toasts: Toast[];
  removeToast: (id: string) => void;
}

export default function ToastContainer({ toasts, removeToast }: ToastContainerProps) {
  return (
    <div className="fixed top-6 right-6 flex flex-col gap-2.5 z-[1000]">
      {toasts.map((toast) => (
        <ToastAlert key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

interface ToastAlertProps {
  toast: Toast;
  onClose: () => void;
}

function ToastAlert({ toast, onClose }: ToastAlertProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [onClose]);

  let borderStyle = "border-l-accent-blue";
  let icon = "info";

  if (toast.type === "success") {
    borderStyle = "border-l-color-easy";
    icon = "check_circle";
  } else if (toast.type === "error") {
    borderStyle = "border-l-color-again";
    icon = "error";
  }

  return (
    <div className={`bg-bg-card border-l-4 ${borderStyle} shadow-2xl rounded-lg px-5 py-4 min-w-[280px] max-w-[400px] text-text-primary flex items-center gap-3 animate-slide-in`}>
      <span className="material-symbols-outlined text-xl flex-shrink-0">{icon}</span>
      <span className="text-[13px] font-semibold flex-1 leading-snug">{toast.message}</span>
      <button onClick={onClose} className="bg-transparent border-none text-text-disabled hover:text-text-primary cursor-pointer flex items-center justify-center p-1 rounded-full hover:bg-white/5 transition-all">
        <span className="material-symbols-outlined text-[16px]">close</span>
      </button>
    </div>
  );
}
