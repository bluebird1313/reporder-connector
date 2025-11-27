"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { StatsCard } from "@/components/stats-card"
import { Package, AlertTriangle, Store, RefreshCw } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface Alert {
  id: string
  quantity: number
  threshold: number
  status: string
  created_at: string
  product_name: string
  product_sku: string
  product_brand: string
}

interface Connection {
  id: string
  platform: string
  shop_domain: string
  is_active: boolean
  last_sync_at: string
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [stats, setStats] = useState({
    totalProducts: 0,
    totalInventory: 0,
    openAlerts: 0,
    connectedStores: 0
  })

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      setLoading(true)

      // Fetch connections
      const { data: connectionsData } = await supabase
        .from('platform_connections')
        .select('*')
        .eq('is_active', true)

      // Fetch open alerts with product details
      const { data: alertsData } = await supabase
        .from('alerts')
        .select(`
          id,
          quantity,
          threshold,
          status,
          created_at,
          products (
            name,
            sku,
            brand
          )
        `)
        .eq('status', 'open')
        .order('quantity', { ascending: true })
        .limit(10)

      // Transform alerts data to flatten product info
      const transformedAlerts: Alert[] = (alertsData || []).map((alert: any) => ({
        id: alert.id,
        quantity: alert.quantity,
        threshold: alert.threshold,
        status: alert.status,
        created_at: alert.created_at,
        product_name: alert.products?.name || 'Unknown Product',
        product_sku: alert.products?.sku || 'N/A',
        product_brand: alert.products?.brand || 'Unknown Brand'
      }))

      // Fetch product count
      const { count: productCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })

      // Fetch total inventory
      const { data: inventoryData } = await supabase
        .from('inventory_levels')
        .select('quantity')

      const totalInventory = inventoryData?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0

      setConnections(connectionsData || [])
      setAlerts(transformedAlerts)
      setStats({
        totalProducts: productCount || 0,
        totalInventory,
        openAlerts: transformedAlerts.length,
        connectedStores: connectionsData?.length || 0
      })

    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSync() {
    setSyncing(true)
    try {
      // Get the API URL from environment or use default
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3004'
      
      const response = await fetch(`${apiUrl}/api/sync/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (response.ok) {
        // Wait a moment for sync to complete then refresh data
        setTimeout(() => {
          fetchData()
          setSyncing(false)
        }, 3000)
      } else {
        setSyncing(false)
      }
    } catch (error) {
      console.error('Sync error:', error)
      setSyncing(false)
    }
  }

  function getAlertUrgency(quantity: number) {
    if (quantity === 0) return { color: 'bg-red-500', label: 'Out of Stock' }
    if (quantity <= 5) return { color: 'bg-orange-500', label: 'Critical' }
    return { color: 'bg-yellow-500', label: 'Low Stock' }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-2">
              Real-time inventory monitoring across all connected stores
            </p>
          </div>
          <Button onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Now'}
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-4">
          <StatsCard
            title="Connected Stores"
            value={loading ? "..." : stats.connectedStores.toString()}
            icon={<Store className="h-5 w-5" />}
            trend="Active integrations"
          />
          <StatsCard
            title="Total Products"
            value={loading ? "..." : stats.totalProducts.toLocaleString()}
            icon={<Package className="h-5 w-5" />}
            trend="Unique SKUs tracked"
          />
          <StatsCard
            title="Total Inventory"
            value={loading ? "..." : stats.totalInventory.toLocaleString()}
            icon={<Package className="h-5 w-5" />}
            trend="Units across all locations"
          />
          <StatsCard
            title="Open Alerts"
            value={loading ? "..." : stats.openAlerts.toString()}
            icon={<AlertTriangle className="h-5 w-5" />}
            trend={stats.openAlerts > 0 ? "Items need attention" : "All stock healthy"}
            variant={stats.openAlerts > 0 ? "error" : "success"}
          />
        </div>

        {/* Connected Stores */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Connected Stores
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : connections.length === 0 ? (
              <p className="text-muted-foreground">No stores connected yet.</p>
            ) : (
              <div className="space-y-4">
                {connections.map(conn => (
                  <div key={conn.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                        <span className="text-lg">🛍️</span>
                      </div>
                      <div>
                        <p className="font-medium">{conn.shop_domain}</p>
                        <p className="text-sm text-muted-foreground capitalize">{conn.platform}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={conn.is_active ? "default" : "secondary"}>
                        {conn.is_active ? "Active" : "Inactive"}
                      </Badge>
                      {conn.last_sync_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Last sync: {formatDate(conn.last_sync_at)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        {alerts.length > 0 && (
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Low Stock Alerts ({alerts.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {alerts.map(alert => {
                  const urgency = getAlertUrgency(alert.quantity)
                  return (
                    <div 
                      key={alert.id} 
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full ${urgency.color}`} />
                        <div>
                          <p className="font-medium">{alert.product_name}</p>
                          <p className="text-sm text-muted-foreground">
                            SKU: {alert.product_sku} • {alert.product_brand}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="destructive">
                          {alert.quantity} units
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          Threshold: {alert.threshold}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* No Alerts Message */}
        {!loading && alerts.length === 0 && (
          <Card className="border-green-500/50 bg-green-50/50">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-green-100 mx-auto flex items-center justify-center mb-4">
                  <Package className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-lg font-medium text-green-800">All Stock Levels Healthy</h3>
                <p className="text-green-600 mt-1">No low stock alerts at this time.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
