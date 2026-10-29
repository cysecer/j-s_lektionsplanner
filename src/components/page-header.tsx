import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="grid gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-muted-foreground max-w-prose">{description}</p> : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">{actions}</div>
      ) : null}
    </div>
  );
}

/** Friendly placeholder for empty lists, with an optional next step. */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
      {icon ? <div className="text-muted-foreground [&_svg]:size-10">{icon}</div> : null}
      <p className="text-lg font-medium">{title}</p>
      {description ? <p className="text-muted-foreground max-w-md">{description}</p> : null}
      {action}
    </div>
  );
}
