import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "./cn";

const CONTROL =
  "w-full rounded-lg bg-gray-950 border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 " +
  "transition-colors focus:border-indigo-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed";

function Label({ htmlFor, label, hint }: { htmlFor: string; label: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center justify-between">
      <label htmlFor={htmlFor} className="text-xs font-medium text-gray-300">
        {label}
      </label>
      {hint && <span className="text-[11px] text-gray-500">{hint}</span>}
    </div>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  hint?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, id, className, ...props },
  ref
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div>
      {label && <Label htmlFor={fieldId} label={label} hint={hint} />}
      <input id={fieldId} ref={ref} className={cn(CONTROL, className)} {...props} />
    </div>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  hint?: ReactNode;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, id, className, ...props },
  ref
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div>
      {label && <Label htmlFor={fieldId} label={label} hint={hint} />}
      <textarea id={fieldId} ref={ref} className={cn(CONTROL, "resize-y", className)} {...props} />
    </div>
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  hint?: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, id, className, children, ...props },
  ref
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <div>
      {label && <Label htmlFor={fieldId} label={label} hint={hint} />}
      <select id={fieldId} ref={ref} className={cn(CONTROL, "cursor-pointer", className)} {...props}>
        {children}
      </select>
    </div>
  );
});

/** Accessible checkbox row used by the multi-select region/pixel pickers. */
export function CheckboxRow({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 transition-colors",
        checked ? "border-indigo-500/60 bg-indigo-500/10" : "border-gray-800 bg-gray-950 hover:border-gray-700",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-600 bg-gray-900 text-indigo-500 focus:ring-indigo-500"
      />
      <span className="min-w-0">
        <span className="block text-sm text-gray-100">{label}</span>
        {description && <span className="block text-xs text-gray-500">{description}</span>}
      </span>
    </label>
  );
}
