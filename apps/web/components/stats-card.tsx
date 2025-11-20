import type React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface StatsCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  trend?: string
  variant?: "default" | "success" | "error"
}

export function StatsCard({ title, value, icon, trend, variant = "default" }: StatsCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold">{value}</p>
            {trend && (
              <p
                className={cn(
                  "text-xs",
                  variant === "success" && "text-green-500",
                  variant === "error" && "text-destructive",
                  variant === "default" && "text-muted-foreground",
                )}
              >
                {trend}
              </p>
            )}
          </div>
          <div
            className={cn(
              "rounded-full p-3",
              variant === "success" && "bg-green-500/10 text-green-500",
              variant === "error" && "bg-destructive/10 text-destructive",
              variant === "default" && "bg-primary/10 text-primary",
            )}
          >
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
