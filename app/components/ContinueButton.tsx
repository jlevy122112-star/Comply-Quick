// app/components/ContinueButton.tsx
import React from 'react';
+import { copyToClipboard } from "@/app/lib/utils/copyToClipboard";

interface ContinueButtonProps {
  onClick: () => void;
  label?: string;
  variant?: 'default' | 'primary';
}

export function ContinueButton({
  onClick,
  label = 'Continue',
  variant = 'default',
}: ContinueButtonProps) {
  const base = 'w-full text-white font-semibold py-3 rounded-xl transition-all';
  const styles =
    variant === 'primary'
      ? `${base} bg-gradient-to-r from-teal-500 to-indigo-600 shadow-lg shadow-teal-500/20`
      : `${base} bg-slate-800 hover:bg-slate-700`;

  return (
    <button onClick={onClick} className={styles}>
      {label}
    </button>
  );
}
