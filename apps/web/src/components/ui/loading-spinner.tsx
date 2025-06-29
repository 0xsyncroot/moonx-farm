/**
 * Skeleton Loading System
 * 
 * A comprehensive set of skeleton loading components for better UX:
 * 
 * Basic Components:
 * - Skeleton: Base skeleton component with variants (default, rounded, circle)
 * - SkeletonText: Multi-line text skeleton
 * - SkeletonAvatar: Avatar placeholder with different sizes
 * 
 * Complex Components:
 * - SkeletonCard: Card layout with optional avatar, title, content, and actions
 * - SkeletonList: List of items with optional avatars
 * - SkeletonTable: Table layout with configurable rows and columns
 * 
 * Usage Examples:
 * - <Skeleton className="h-4 w-[250px]" />
 * - <SkeletonText lines={3} />
 * - <SkeletonAvatar size="lg" />
 * - <SkeletonCard showAvatar={true} contentLines={4} showActions={true} />
 * - <SkeletonList items={5} showAvatar={true} />
 * - <SkeletonTable rows={5} columns={4} />
 */

import { cn } from "@/lib/utils"

interface LoadingSpinnerProps {
  className?: string
  size?: "sm" | "md" | "lg"
}

export function LoadingSpinner({ className, size = "md" }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8", 
    lg: "h-12 w-12"
  }

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div
        className={cn(
          "animate-spin rounded-full border-2 border-muted border-t-primary",
          sizeClasses[size]
        )}
      />
    </div>
  )
}

// Skeleton Base Component
interface SkeletonProps {
  className?: string
  variant?: "default" | "rounded" | "circle"
  width?: string | number
  height?: string | number
}

export function Skeleton({ 
  className, 
  variant = "default",
  width,
  height,
  ...props 
}: SkeletonProps & React.HTMLAttributes<HTMLDivElement>) {
  const variantClasses = {
    default: "rounded",
    rounded: "rounded-lg", 
    circle: "rounded-full"
  }

  const style = {
    ...(width && { width: typeof width === 'number' ? `${width}px` : width }),
    ...(height && { height: typeof height === 'number' ? `${height}px` : height })
  }

  return (
    <div
      className={cn(
        "animate-pulse bg-muted",
        variantClasses[variant],
        className
      )}
      style={style}
      {...props}
    />
  )
}

// Skeleton Text Component
interface SkeletonTextProps {
  lines?: number
  className?: string
}

export function SkeletonText({ lines = 1, className }: SkeletonTextProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton 
          key={index}
          className={cn(
            "h-4",
            index === lines - 1 && lines > 1 ? "w-3/4" : "w-full"
          )}
        />
      ))}
    </div>
  )
}

// Skeleton Avatar Component
interface SkeletonAvatarProps {
  size?: "sm" | "md" | "lg" | "xl"
  className?: string
}

export function SkeletonAvatar({ size = "md", className }: SkeletonAvatarProps) {
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
    xl: "h-16 w-16"
  }

  return (
    <Skeleton 
      variant="circle"
      className={cn(sizeClasses[size], className)}
    />
  )
}

// Skeleton Card Component
interface SkeletonCardProps {
  className?: string
  showAvatar?: boolean
  avatarSize?: "sm" | "md" | "lg" | "xl"
  titleLines?: number
  contentLines?: number
  showActions?: boolean
}

export function SkeletonCard({ 
  className,
  showAvatar = false,
  avatarSize = "md",
  titleLines = 1,
  contentLines = 3,
  showActions = false
}: SkeletonCardProps) {
  return (
    <div className={cn("p-4 space-y-4", className)}>
      {/* Header with optional avatar */}
      {showAvatar && (
        <div className="flex items-center space-x-3">
          <SkeletonAvatar size={avatarSize} />
          <div className="flex-1">
            <SkeletonText lines={titleLines} />
          </div>
        </div>
      )}
      
      {/* Title if no avatar */}
      {!showAvatar && titleLines > 0 && (
        <SkeletonText lines={titleLines} />
      )}
      
      {/* Content */}
      {contentLines > 0 && (
        <SkeletonText lines={contentLines} />
      )}
      
      {/* Actions */}
      {showActions && (
        <div className="flex space-x-2">
          <Skeleton className="h-10 w-20" variant="rounded" />
          <Skeleton className="h-10 w-24" variant="rounded" />
        </div>
      )}
    </div>
  )
}

// Skeleton List Component
interface SkeletonListProps {
  items?: number
  showAvatar?: boolean
  className?: string
}

export function SkeletonList({ 
  items = 3, 
  showAvatar = false,
  className 
}: SkeletonListProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: items }).map((_, index) => (
        <div key={index} className="flex items-center space-x-3">
          {showAvatar && <SkeletonAvatar size="sm" />}
          <div className="flex-1">
            <SkeletonText lines={2} />
          </div>
        </div>
      ))}
    </div>
  )
}

// Skeleton Table Component
interface SkeletonTableProps {
  rows?: number
  columns?: number
  className?: string
}

export function SkeletonTable({ 
  rows = 5, 
  columns = 4, 
  className 
}: SkeletonTableProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {/* Header */}
      <div className="flex space-x-4">
        {Array.from({ length: columns }).map((_, index) => (
          <Skeleton key={`header-${index}`} className="h-8 flex-1" />
        ))}
      </div>
      
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={`row-${rowIndex}`} className="flex space-x-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton 
              key={`cell-${rowIndex}-${colIndex}`} 
              className="h-12 flex-1" 
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// Legacy LoadingCard for backward compatibility
export function LoadingCard() {
  return (
    <div className="trade-card">
      <SkeletonCard 
        titleLines={1}
        contentLines={2}
        showActions={true}
      />
    </div>
  )
} 