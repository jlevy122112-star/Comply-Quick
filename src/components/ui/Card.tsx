import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

/** Surface container matching the app's gray-900 / gray-800 card language. */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-xl border border-gray-800 bg-gray-900 shadow-sm shadow-black/20", className)}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  icon,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-gray-800 p-5", className)}>
      <div className="flex items-start gap-3 min-w-0">
        {icon && <span className="text-xl leading-none shrink-0">{icon}</span>}
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          {description && <p className="mt-1 text-sm text-gray-400">{description}</p>}
        </div>
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}
