import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

export const Tabs = TabsPrimitive.Root;

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List ref={ref} className={cn('flex items-stretch gap-0', className)} {...props} />
));
TabsList.displayName = 'TabsList';

/* An editor tab strip: no fill on the inactive state, a 1px top rule on the
 active one, and the label tinted rather than boxed. The underline is the
   indicator, so nothing here needs a border-radius or a chip. */
export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'group relative inline-flex h-full items-center gap-2 px-3 text-[12.5px] text-muted transition-colors',
      'hover:text-ink',
      'data-[state=active]:text-ink',
      'after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-transparent after:content-[""]',
      'data-[state=active]:after:bg-signal',
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = 'TabsTrigger';

export const TabsContent = TabsPrimitive.Content;
