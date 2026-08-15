import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center font-extrabold transition-all cursor-pointer rounded-xl disabled:opacity-50 disabled:pointer-events-none";

    let variantStyles = "bg-emerald-600 text-white hover:bg-emerald-700";
    if (variant === "primary") {
      variantStyles = "bg-[#B5451B] text-white hover:bg-[#963714]";
    } else if (variant === "outline") {
      variantStyles = "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50";
    } else if (variant === "ghost") {
      variantStyles = "bg-transparent text-slate-700 hover:bg-slate-100";
    }

    let sizeStyles = "px-4 py-2 text-sm";
    if (size === "sm") {
      sizeStyles = "px-3 py-1.5 text-xs";
    } else if (size === "lg") {
      sizeStyles = "px-6 py-3 text-base";
    }

    return (
      <button
        className={cn(baseStyles, variantStyles, sizeStyles, className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
