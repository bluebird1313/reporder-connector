"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Settings, ExternalLink, RefreshCw, Trash2, AlertTriangle } from "lucide-react"
import { supabase } from "@/lib/supabase"

interface Connection {
  id: string
  platform: string
  shop_domain: string
  is_active: boolean
  last_sync_at: string
  scopes: string[]
  created_at: string
}

export default function ConnectionsPage() {
  const [showForm, setShowForm] = useState(false)
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [shopName, setShopName] = useState("")
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState<string | null>(null)

  useEffect(() => {
    fetchConnections()
  }, [])

  async function fetchConnections() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('platform_connections')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setConnections(data || [])
    } catch (error) {
      console.error('Error fetching connections:', error)
    } finally {
      setLoading(false)
    }
  }

  function handleConnectShopify() {
    if (!shopName) return
    
    // Get the API URL - in production this would be your Render URL
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3004'
    const normalizedShop = shopName.replace('.myshopify.com', '')
    
    // Redirect to OAuth
    window.location.href = `${apiUrl}/api/shopify/auth?shop=${normalizedShop}`
  }

  async function handleDisconnect(connectionId: string, shopDomain: string) {
    try {
      setDisconnecting(connectionId)
      
      // Get the API URL
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3004'
      
      // Call the disconnect API endpoint
      const response = await fetch(`${apiUrl}/api/connections/${connectionId}/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) {
        // If API fails, try direct Supabase update as fallback
        console.log('API disconnect failed, using direct update...')
        
        // Delete related data first
        await supabase.from('alerts').delete().eq('connection_id', connectionId)
        
        // Get product IDs for this connection
        const { data: products } = await supabase
          .from('products')
          .select('id')
          .eq('connection_id', connectionId)
        
        if (products && products.length > 0) {
          const productIds = products.map(p => p.id)
          await supabase.from('inventory_levels').delete().in('product_id', productIds)
          await supabase.from('products').delete().eq('connection_id', connectionId)
        }
        
        // Finally delete the connection
        const { error } = await supabase
          .from('platform_connections')
          .delete()
          .eq('id', connectionId)
        
        if (error) throw error
      }

      // Refresh the connections list
      await fetchConnections()
      setShowDisconnectConfirm(null)
      
    } catch (error) {
      console.error('Error disconnecting:', error)
      alert('Failed to disconnect. Please try again.')
    } finally {
      setDisconnecting(null)
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function getPlatformIcon(platform: string) {
    switch (platform) {
      case 'shopify': return '🛍️'
      case 'lightspeed': return '⚡'
      case 'square': return '⬛'
      default: return '🔗'
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Connections</h1>
            <p className="text-muted-foreground mt-2">
              Manage your retail platform integrations
            </p>
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
              <CardTitle>Connect a New Store</CardTitle>
              <CardDescription>
                Connect a Shopify store to start syncing inventory
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="shop">Shopify Store Name</Label>
                    <div className="flex gap-2">
                      <Input
                        id="shop"
                        placeholder="your-store"
                        value={shopName}
                        onChange={(e) => setShopName(e.target.value)}
                      />
                      <span className="flex items-center text-muted-foreground text-sm">
                        .myshopify.com
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleConnectShopify} disabled={!shopName}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Connect Shopify
                  </Button>
                  <Button variant="outline" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  You will be redirected to Shopify to authorize the connection.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Existing Connections */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            {loading ? 'Loading...' : `${connections.length} Connected Store${connections.length !== 1 ? 's' : ''}`}
          </h2>
          
          {loading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Loading connections...
              </CardContent>
            </Card>
          ) : connections.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground mb-4">
                  No stores connected yet. Add your first connection to start syncing inventory.
                </p>
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Store
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {connections.map((connection) => (
                <Card key={connection.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-2xl">
                          {getPlatformIcon(connection.platform)}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold">
                              {connection.shop_domain}
                            </h3>
                            <Badge variant={connection.is_active ? "default" : "destructive"}>
                              {connection.is_active ? "Active" : "Disconnected"}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground capitalize">
                            {connection.platform} Integration
                          </p>
                          <div className="flex gap-4 text-xs text-muted-foreground mt-2">
                            <span>Connected: {formatDate(connection.created_at)}</span>
                            {connection.last_sync_at && (
                              <span>Last sync: {formatDate(connection.last_sync_at)}</span>
                            )}
                          </div>
                          {connection.scopes && connection.scopes.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {connection.scopes.map((scope, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {scope}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" title="Sync Now">
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Settings">
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          title="Disconnect"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setShowDisconnectConfirm(connection.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Disconnect Confirmation */}
                    {showDisconnectConfirm === connection.id && (
                      <div className="mt-4 p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                          <div className="flex-1">
                            <h4 className="font-medium text-destructive">Disconnect this store?</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              This will remove the connection and delete all synced products and inventory data for <strong>{connection.shop_domain}</strong>. 
                              You can reconnect the store anytime.
                            </p>
                            <div className="flex gap-2 mt-3">
                              <Button 
                                variant="destructive" 
                                size="sm"
                                onClick={() => handleDisconnect(connection.id, connection.shop_domain)}
                                disabled={disconnecting === connection.id}
                              >
                                {disconnecting === connection.id ? 'Disconnecting...' : 'Yes, Disconnect'}
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setShowDisconnectConfirm(null)}
                                disabled={disconnecting === connection.id}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Coming Soon */}
        <Card className="border-dashed">
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              <h3 className="font-medium mb-2">More Integrations Coming Soon</h3>
              <p className="text-sm">
                Lightspeed and Square integrations are in development.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
