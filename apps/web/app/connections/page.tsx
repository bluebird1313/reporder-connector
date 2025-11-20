"use client"

import { useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { ConnectionForm } from "@/components/connection-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Plus, Settings, Trash2 } from "lucide-react"

// Mock existing connections
const existingConnections = [
  { id: "1", platform: "shopify", storeName: "My Shopify Store", status: "active", apiKey: "sk_live_..." },
  { id: "2", platform: "square", storeName: "Square POS", status: "active", apiKey: "sq_..." },
  { id: "3", platform: "lightspeed", storeName: "Lightspeed Retail", status: "error", apiKey: "ls_..." },
]

export default function ConnectionsPage() {
  const [showForm, setShowForm] = useState(false)
  const [connections, setConnections] = useState(existingConnections)

  const handleAddConnection = (newConnection: any) => {
    // This would normally save to Supabase
    console.log("Adding connection:", newConnection)
    setShowForm(false)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Connections</h1>
            <p className="text-muted-foreground mt-2">Manage your retail platform integrations</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Connection
          </Button>
        </div>

        {/* Add Connection Form */}
        {showForm && (
          <Card className="border-primary/50 bg-card/50">
            <CardHeader>
              <CardTitle>Add New Connection</CardTitle>
              <CardDescription>Connect a new retail platform to sync inventory</CardDescription>
            </CardHeader>
            <CardContent>
              <ConnectionForm onSubmit={handleAddConnection} onCancel={() => setShowForm(false)} />
            </CardContent>
          </Card>
        )}

        {/* Existing Connections */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Existing Connections</h2>
          <div className="grid gap-4">
            {connections.map((connection) => (
              <Card key={connection.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold capitalize">{connection.platform}</h3>
                        <Badge variant={connection.status === "active" ? "default" : "destructive"}>
                          {connection.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{connection.storeName}</p>
                      <p className="text-xs text-muted-foreground font-mono">API Key: {connection.apiKey}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon">
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
