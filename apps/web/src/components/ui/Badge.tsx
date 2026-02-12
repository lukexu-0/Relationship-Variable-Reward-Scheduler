import type { PropsWithChildren } from "react";

type BadgeVariant = "default" | "accent" | "ok" | "warn";

interface BadgeProps extends PropsWithChildren {
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  const classNames = ["badge", `badge-${variant}`, className].filter(Boolean).join(" ");
  return <span className={classNames}>{children}</span>;
}
