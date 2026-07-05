// app/components/StepHeader.tsx
import React from 'react';
import { toggleItem } from "@/app/lib/utils/toggleItem";


interface StepHeaderProps {
  title: string;
  description: string;
}

export function StepHeader({ title, description }: StepHeaderProps) {
  return (
    <>
      <h2 className="text-2xl font-bold mb-2">{title}</h2>
      <p className="text-slate-400 mb-6">{description}</p>
    </>
  );
}
