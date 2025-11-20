"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { IntegrationCard } from "@/components/integration-card"
import { StatsCard } from "@/components/stats-card"
import { Package, AlertTriangle, CheckCircle2, ShoppingBag, Activity } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type IntegrationStatus = "active" | "error" | "syncing";

interface IntegrationData {
    id: string;
    name: string;
    status: IntegrationStatus;
    lastSync: string;
    itemsCount: number;
    icon: string;
}

interface ProductInventory {
  id: string
  name: string
  sku: string
  quantity: number
  low_stock_threshold: number
  status: 'low_stock' | 'in_stock'
}

export default function DashboardPage() {
  const [syncing, setSyncing] = useState<string | null>(null)
  const [inventory, setInventory] = useState<ProductInventory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchInventory()
  }, [])

  async function fetchInventory() {
    try {
      // Join products with inventory_levels
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          sku,
          default_min_stock,
          inventory_levels (
            quantity
          )
        `)
      
      if (error) throw error

      if (data) {
        const formattedInventory = data.map((item: any) => {
          const quantity = item.inventory_levels?.[0]?.quantity || 0
          const threshold = item.default_min_stock || 0
          return {
            id: item.id,
            name: item.name,
            sku: item.sku,
            quantity: quantity,
            low_stock_threshold: threshold,
            status: quantity <= threshold ? 'low_stock' : 'in_stock'
          } as ProductInventory
        })
        setInventory(formattedInventory)
      }
    } catch (error) {
      console.error('Error fetching inventory:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSync = (integrationId: string) => {
    setSyncing(integrationId)
    // Simulate sync
    setTimeout(() => {
      setSyncing(null)
      fetchInventory() // Refresh data
    }, 2000)
  }

  const totalItems = inventory.reduce((sum, item) => sum + item.quantity, 0)
  const lowStockItems = inventory.filter(item => item.status === 'low_stock')
  
  // Mock integrations for now (until we have real connection status table)
  const integrations: IntegrationData[] = [
    {
      id: "shopify",
      name: "Sendero Shopify",
      status: "active",
      lastSync: "Just now",
      itemsCount: totalItems,
      icon: "🛍️",
    }
  ]

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sendero Dashboard</h1>
          <p className="text-muted-foreground mt-2">Real-time inventory monitoring</p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-3">
          <StatsCard
            title="Total Inventory Units"
            value={loading ? "..." : totalItems.toLocaleString()}
            icon={<Package className="h-5 w-5" />}
            trend="Tracked across all locations"
          />
          <StatsCard
            title="Low Stock Alerts"
            value={loading ? "..." : lowStockItems.length}
            icon={<AlertTriangle className="h-5 w-5" />}
            trend={lowStockItems.length > 0 ? "Items need reordering" : "Stock levels healthy"}
            variant={lowStockItems.length > 0 ? "error" : "success"}
          />
           <StatsCard
            title="Active Products"
            value={loading ? "..." : inventory.length}
            icon={<ShoppingBag className="h-5 w-5" />}
            trend="Unique SKUs managed"
            variant="success"
          />
        </div>

        {/* Low Stock Alerts Table */}
        {lowStockItems.length > 0 && (
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Low Stock Warnings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {lowStockItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">{item.sku}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="destructive">{item.quantity} units</Badge>
                      <p className="text-xs text-muted-foreground mt-1">Min: {item.low_stock_threshold}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Integrations */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Connected Stores</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {integrations.map((integration) => (
              <IntegrationCard
                key={integration.id}
                integration={integration}
                onSync={handleSync}
                syncing={syncing === integration.id}
              />
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
