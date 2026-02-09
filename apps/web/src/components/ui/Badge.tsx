import type { PropsWithChildren } from "react";

type BadgeVariant = "default" | "accent" | "ok" | "warn";

interface BadgeProps extends PropsWithChildren {
  variant?: BadgeVariant;
}

export function Badge({ children, variant = "default" }: BadgeProps) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}
