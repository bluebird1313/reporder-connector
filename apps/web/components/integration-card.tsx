"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

interface Integration {
  id: string
  name: string
  status: "active" | "error" | "syncing"
  lastSync: string
  itemsCount: number
  icon: string
}

interface IntegrationCardProps {
  integration: Integration
  onSync: (id: string) => void
  syncing: boolean
}

export function IntegrationCard({ integration, onSync, syncing }: IntegrationCardProps) {
  return (
    <Card className={cn("transition-all hover:shadow-lg", integration.status === "error" && "border-destructive/50")}>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="text-3xl">{integration.icon}</div>
              <div>
                <h3 className="font-semibold text-lg">{integration.name}</h3>
                <Badge variant={integration.status === "active" ? "default" : "destructive"} className="mt-1">
                  {integration.status === "active" ? "Active" : "Error"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Last synced</span>
              <span className="font-medium">{integration.lastSync}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Items</span>
              <span className="font-medium">{integration.itemsCount.toLocaleString()}</span>
            </div>
          </div>

          {/* Action */}
          <Button className="w-full" onClick={() => onSync(integration.id)} disabled={syncing}>
            <RefreshCw className={cn("h-4 w-4 mr-2", syncing && "animate-spin")} />
            {syncing ? "Syncing..." : "Sync Now"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
