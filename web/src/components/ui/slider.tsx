import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '@/lib/utils';

export const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn('relative flex h-5 w-full touch-none select-none items-center', className)}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-px w-full overflow-visible bg-[#2b3038]">
      <SliderPrimitive.Range className="absolute h-px bg-signal" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      className={cn(
        'block h-3.5 w-[5px] rounded-none border border-signal-hi bg-signal shadow-[0_0_0_2px_var(--color-canvas)]',
        'focus-visible:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-signal-hi',
      )}
    />
  </SliderPrimitive.Root>
));
Slider.displayName = 'Slider';
