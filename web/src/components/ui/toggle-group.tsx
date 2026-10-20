import * as React from 'react';
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';
import { cn } from '@/lib/utils';

/** A segmented control. One option at a time, the selected one carrying the
 * signal tint; used for view modes and small in-figure switches. */
export const ToggleGroup = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root>
>(({ className, ...props }, ref) => (
  <ToggleGroupPrimitive.Root
    ref={ref}
    className={cn('inline-flex items-center gap-0.5', className)}
    {...props}
  />
));
ToggleGroup.displayName = 'ToggleGroup';

export const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item>
>(({ className, ...props }, ref) => (
  <ToggleGroupPrimitive.Item
    ref={ref}
    className={cn(
      'inline-flex h-6 items-center justify-center rounded-none px-2 font-mono text-[10px] text-muted transition-colors',
      'hover:bg-white/[0.05] hover:text-ink',
      'data-[state=on]:bg-white/[0.06] data-[state=on]:text-ink',
      'data-[state=on]:shadow-[inset_0_-1px_0_var(--color-signal)]',
      'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-signal',
      className,
    )}
    {...props}
  />
));
ToggleGroupItem.displayName = 'ToggleGroupItem';
