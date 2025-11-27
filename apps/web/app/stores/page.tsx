"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  Store, 
  Plus, 
  RefreshCw, 
  ExternalLink,
  Package,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  ChevronRight
} from "lucide-react"
import Link from "next/link"

interface StoreConnection {
  id: string
  store_id: string
  platform: string
  shop_domain: string
  is_active: boolean
  last_sync_at: string | null
  created_at: string
  productCount: number
  alertCount: number
}

export default function StoresPage() {
  const [loading, setLoading] = useState(true)
  const [connections, setConnections] = useState<StoreConnection[]>([])
  const [syncing, setSyncing] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)

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
        .order('created_at', { ascending: false })

      // For each connection, get product count and alert count
      const enrichedConnections = await Promise.all(
        (connectionsData || []).map(async (conn) => {
          const { count: productCount } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('connection_id', conn.id)

          const { count: alertCount } = await supabase
            .from('alerts')
            .select('*', { count: 'exact', head: true })
            .eq('connection_id', conn.id)
            .eq('status', 'open')

          return {
            ...conn,
            productCount: productCount || 0,
            alertCount: alertCount || 0
          }
        })
      )

      setConnections(enrichedConnections)
    } catch (error) {
      console.error('Error fetching stores:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSync(connectionId: string) {
    setSyncing(connectionId)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3004'
      const response = await fetch(`${apiUrl}/api/sync/${connectionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (response.ok) {
        setTimeout(() => {
          fetchData()
          setSyncing(null)
        }, 3000)
      } else {
        setSyncing(null)
      }
    } catch (error) {
      console.error('Sync error:', error)
      setSyncing(null)
    }
  }

  async function handleDisconnect(connectionId: string) {
    if (!confirm('Are you sure you want to disconnect this store? All synced data will be removed.')) {
      return
    }

    setDisconnecting(connectionId)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3004'
      const response = await fetch(`${apiUrl}/api/connections/${connectionId}/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (response.ok) {
        setConnections(connections.filter(c => c.id !== connectionId))
      }
    } catch (error) {
      console.error('Disconnect error:', error)
    } finally {
      setDisconnecting(null)
    }
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function getHealthStatus(alertCount: number) {
    if (alertCount === 0) return { color: 'bg-green-500', label: 'Healthy', textColor: 'text-green-500' }
    if (alertCount <= 3) return { color: 'bg-yellow-500', label: 'Attention', textColor: 'text-yellow-500' }
    return { color: 'bg-red-500', label: 'Critical', textColor: 'text-red-500' }
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3004'

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Store className="h-8 w-8 text-blue-500" />
              Stores
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage your connected retail platforms
            </p>
          </div>
          <Button asChild>
            <a href={`${apiUrl}/api/shopify/auth?shop=YOUR-STORE.myshopify.com`} target="_blank" rel="noopener noreferrer">
              <Plus className="h-4 w-4 mr-2" />
              Add Store
            </a>
          </Button>
        </div>

        {/* Connection Instructions */}
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-blue-500/10">
                <Plus className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <h3 className="font-semibold">Connect a New Store</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  To connect a Shopify store, send the store owner this link:
                </p>
                <code className="mt-2 block text-xs bg-muted px-3 py-2 rounded-lg break-all">
                  {apiUrl}/api/shopify/auth?shop=STORE-NAME.myshopify.com
                </code>
                <p className="text-xs text-muted-foreground mt-2">
                  Replace STORE-NAME with the actual store&apos;s myshopify.com subdomain.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stores Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : connections.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-muted mx-auto flex items-center justify-center mb-4">
                  <Store className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium">No Stores Connected</h3>
                <p className="text-muted-foreground mt-1 max-w-md mx-auto">
                  Connect your first store to start monitoring inventory and receiving low stock alerts.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {connections.map(conn => {
              const health = getHealthStatus(conn.alertCount)
              
              return (
                <Card key={conn.id} className="group hover:border-primary/50 transition-colors">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white text-xl">
                          🛍️
                        </div>
                        <div>
                          <CardTitle className="text-base font-semibold">
                            {conn.shop_domain.replace('.myshopify.com', '')}
                          </CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs capitalize">
                              {conn.platform}
                            </Badge>
                            <div className={`w-2 h-2 rounded-full ${health.color}`} />
                            <span className={`text-xs ${health.textColor}`}>{health.label}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-lg font-semibold">{conn.productCount}</p>
                          <p className="text-xs text-muted-foreground">Products</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                        <AlertTriangle className={`h-4 w-4 ${conn.alertCount > 0 ? 'text-amber-500' : 'text-muted-foreground'}`} />
                        <div>
                          <p className="text-lg font-semibold">{conn.alertCount}</p>
                          <p className="text-xs text-muted-foreground">Alerts</p>
                        </div>
                      </div>
                    </div>

                    {/* Last Sync */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Last sync</span>
                      <span>{formatDate(conn.last_sync_at)}</span>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => handleSync(conn.id)}
                        disabled={syncing === conn.id}
                      >
                        <RefreshCw className={`h-4 w-4 mr-1 ${syncing === conn.id ? 'animate-spin' : ''}`} />
                        {syncing === conn.id ? 'Syncing...' : 'Sync'}
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/stores/${conn.id}`}>
                          View
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Link>
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDisconnect(conn.id)}
                        disabled={disconnecting === conn.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

