// app/components/SelectionButton.tsx
import React from 'react';
import { toggleItem } from "@/app/lib/utils/toggleItem";


interface SelectionButtonProps {
  label: string;
  selected: boolean;
  onClick: () => void;
  className?: string;
  children?: React.ReactNode;
}

export function SelectionButton({
  label,
  selected,
  onClick,
  className = '',
  children,
}: SelectionButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`p-4 rounded-xl border font-medium transition-all ${
        selected
          ? 'border-teal-500 bg-teal-950/20 text-teal-400'
          : 'border-slate-800 bg-slate-900 hover:border-slate-700'
      } ${className}`}
    >
      {children ?? label}
    </button>
  );
}
