import type { PropsWithChildren, ReactNode } from "react";

interface CardProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
  className?: string;
  headerAction?: ReactNode;
}

export function Card({ title, subtitle, className, headerAction, children }: CardProps) {
  const classNames = ["card", className].filter(Boolean).join(" ");
  const headerClassNames = ["card-header-row", subtitle ? "with-subtitle" : "no-subtitle"]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={classNames}>
      <div className={headerClassNames}>
        <div>
          <h2>{title}</h2>
          {subtitle ? <p className="helper">{subtitle}</p> : null}
        </div>
        {headerAction ? <div className="card-header-action">{headerAction}</div> : null}
      </div>
      {children}
    </section>
  );
}
