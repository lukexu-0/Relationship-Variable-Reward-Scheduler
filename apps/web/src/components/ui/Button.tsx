import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type ButtonVariant = "primary" | "soft" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, PropsWithChildren {
  variant?: ButtonVariant;
}

export function Button({ variant = "primary", children, className, ...props }: ButtonProps) {
  const classNames = ["btn", `btn-${variant}`, className].filter(Boolean).join(" ");
  return (
    <button {...props} className={classNames}>
      {children}
    </button>
  );
}
