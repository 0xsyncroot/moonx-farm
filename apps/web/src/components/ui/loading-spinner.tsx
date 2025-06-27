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

export function LoadingCard() {
  return (
    <div className="trade-card animate-pulse">
      <div className="space-y-4">
        <div className="h-4 bg-muted rounded w-1/4"></div>
        <div className="space-y-2">
          <div className="h-12 bg-muted rounded"></div>
          <div className="h-12 bg-muted rounded"></div>
        </div>
        <div className="h-10 bg-muted rounded"></div>
      </div>
    </div>
  )
} 