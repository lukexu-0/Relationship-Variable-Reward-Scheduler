import type { PropsWithChildren } from "react";

interface CardProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  className?: string;
}

export function Card({ title, subtitle, className, children }: CardProps) {
  const classNames = ["card", className].filter(Boolean).join(" ");
  return (
    <section className={classNames}>
      <h2>{title}</h2>
      {subtitle ? <p className="helper">{subtitle}</p> : null}
      {children}
    </section>
  );
}
