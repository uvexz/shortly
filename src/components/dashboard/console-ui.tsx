import type { ComponentType, ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type ConsoleTone = "neutral" | "good" | "warning" | "danger" | "accent"
type ConsoleIcon = ComponentType<{ className?: string }>

export const consoleSurfaceClassName =
  "rounded-lg bg-card shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_2px_2px_rgba(0,0,0,0.02)]"

export const consoleInsetClassName =
  "rounded-md bg-muted/[0.18] shadow-[0_0_0_1px_rgba(0,0,0,0.06)]"

const toneDotClassNames: Record<ConsoleTone, string> = {
  neutral: "bg-muted-foreground/45",
  good: "bg-[#398E4A]",
  warning: "bg-[#FF990A]",
  danger: "bg-destructive",
  accent: "bg-[#0072F5]",
}

export function getConsoleToneDotClassName(tone: ConsoleTone) {
  return toneDotClassNames[tone]
}

export function ConsoleKicker({
  children,
  icon: Icon,
  className,
}: {
  children: ReactNode
  icon?: ConsoleIcon
  className?: string
}) {
  return (
    <p
      className={cn(
        "flex items-center gap-1.5 text-[11px] font-medium uppercase text-muted-foreground",
        className
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
    </p>
  )
}

export function ConsoleMetric({
  label,
  value,
  description,
  icon: Icon,
  tone = "neutral",
  className,
}: {
  label: string
  value: ReactNode
  description: string
  icon: ConsoleIcon
  tone?: ConsoleTone
  className?: string
}) {
  return (
    <div className={cn(consoleSurfaceClassName, "min-w-0 p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full", toneDotClassNames[tone])} />
            <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          </div>
          <div className="mt-2 truncate text-2xl font-semibold tabular-nums text-foreground">{value}</div>
        </div>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground shadow-[0_0_0_1px_rgba(0,0,0,0.08)]">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 truncate text-xs text-muted-foreground">{description}</p>
    </div>
  )
}

export function ConsoleStatusBadge({
  label,
  tone = "neutral",
  className,
}: {
  label: ReactNode
  tone?: ConsoleTone
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-6 gap-1.5 rounded-full border-transparent bg-background px-2 text-[10px] font-medium text-muted-foreground shadow-[0_0_0_1px_rgba(0,0,0,0.08)]",
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", toneDotClassNames[tone])} />
      {label}
    </Badge>
  )
}

export function ConsoleCodeBlock({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <pre
      className={cn(
        "overflow-x-auto rounded-lg bg-muted/[0.18] p-4 font-mono text-xs leading-6 text-foreground/80 shadow-[0_0_0_1px_rgba(0,0,0,0.08)] whitespace-pre-wrap break-words",
        className
      )}
    >
      {children}
    </pre>
  )
}
