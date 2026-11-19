import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold tracking-tight cursor-pointer select-none transition-all duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border border-primary/40 shadow-[0_2px_4px_rgba(37,159,253,0.22),inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-1px_0_rgba(0,0,0,0.15)] hover:bg-primary/95 hover:shadow-[0_4px_12px_rgba(37,159,253,0.35)] active:shadow-inner",
        destructive:
          "bg-destructive text-destructive-foreground border border-destructive/40 shadow-xs hover:bg-destructive/90 active:shadow-inner",
        outline:
          "border border-border/90 bg-card/90 text-foreground shadow-2xs hover:border-primary/60 hover:text-primary hover:bg-primary/5 hover:shadow-xs",
        secondary:
          "bg-secondary/90 text-secondary-foreground border border-border/80 shadow-2xs hover:bg-secondary hover:border-border",
        ghost:
          "text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted/80",
        link:
          "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 sm:h-11 px-4 text-xs sm:text-sm",
        sm: "h-9 px-3 text-xs",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10 sm:h-11 sm:w-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
