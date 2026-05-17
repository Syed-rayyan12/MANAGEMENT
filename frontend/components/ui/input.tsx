import * as React from 'react'

import { cn } from '@/lib/utils'

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full rounded-[7px] border border-border bg-surface px-2.5 py-1.5 text-[13px] text-foreground placeholder:text-fg-4 focus:outline-none focus:ring-2 focus:ring-accent-soft focus:border-accent-line disabled:cursor-not-allowed disabled:opacity-50 transition-colors duration-[120ms]',
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'

export { Input }
