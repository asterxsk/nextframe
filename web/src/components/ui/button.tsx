import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/* Keycap geometry: a 4px-corner-free rectangle with a 1px edge and a dark
 bottom inset, so a button reads as something you press rather than a pill.
   The primary is the only filled one and the only place the blue is loud. */
const buttonVariants = cva(
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-none font-medium transition-[background-color,border-color,color,transform] duration-100 disabled:pointer-events-none disabled:opacity-40 active:translate-y-px [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'border border-signal bg-signal text-white shadow-[inset_0_-2px_0_rgba(0,20,60,0.45),inset_0_1px_0_rgba(255,255,255,0.14)] hover:bg-signal-hi hover:border-signal-hi',
        outline:
          'border border-[#2b3038] bg-raised text-ink-2 shadow-[inset_0_-2px_0_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-[#3a414b] hover:text-ink',
        ghost: 'border border-transparent text-ink-2 hover:bg-white/[0.05] hover:text-ink',
        quiet: 'border border-transparent text-muted hover:bg-white/[0.05] hover:text-ink',
      },
      size: {
        sm: 'h-7 px-2.5 text-[12px]',
        md: 'h-8 px-3 text-[12.5px]',
        lg: 'h-9 px-4 text-[13px]',
        icon: 'h-7 w-7 p-0',
      },
    },
    defaultVariants: { variant: 'outline', size: 'md' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
    );
  },
);
Button.displayName = 'Button';

export { buttonVariants };
