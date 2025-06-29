import { cn } from '@/lib/utils'

interface ChainIconProps {
  icon: string
  className?: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
}

const sizeClasses = {
  xs: 'w-2 h-2',
  sm: 'w-2.5 h-2.5', 
  md: 'w-3 h-3',
  lg: 'w-4 h-4'
}

export function ChainIcon({ icon, className, size = 'sm' }: ChainIconProps) {
  // If icon is SVG string, render it
  if (icon.startsWith('<svg')) {
    return (
      <div 
        className={cn(sizeClasses[size], 'flex items-center justify-center', className)}
        dangerouslySetInnerHTML={{ __html: icon }}
        style={{ 
          lineHeight: 0,
          fontSize: 0
        }}
      />
    )
  }
  
  // Fallback for emoji or other strings
  return (
    <span className={cn('flex items-center justify-center', sizeClasses[size], className)}>
      {icon}
    </span>
  )
} 