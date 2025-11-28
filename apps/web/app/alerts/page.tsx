"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  AlertTriangle, 
  Search, 
  CheckCircle2, 
  Clock, 
  Package,
  Store,
  Filter,
  ShoppingCart,
  Bell,
  Archive,
  Tag,
  Eye,
  EyeOff
} from "lucide-react"

interface Alert {
  id: string
  product_id: string
  connection_id: string
  quantity: number
  threshold: number
  status: string
  created_at: string
  product_name: string
  product_sku: string
  product_brand: string
  shop_domain: string
  is_archived: boolean
}

interface Connection {
  id: string
  shop_domain: string
}

export default function AlertsPage() {
  const [loading, setLoading] = useState(true)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [brands, setBrands] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [storeFilter, setStoreFilter] = useState("all")
  const [brandFilter, setBrandFilter] = useState("all")
  const [severityFilter, setSeverityFilter] = useState("all")
  const [showArchived, setShowArchived] = useState(false)
  const [selectedAlerts, setSelectedAlerts] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      setLoading(true)

      // Fetch connections for filter
      const { data: connectionsData } = await supabase
        .from('platform_connections')
        .select('id, shop_domain')
        .eq('is_active', true)

      // Fetch alerts with product and connection details
      const { data: alertsData } = await supabase
        .from('alerts')
        .select(`
          id,
          product_id,
          connection_id,
          quantity,
          threshold,
          status,
          created_at,
          products (
            name,
            sku,
            brand,
            is_archived
          ),
          platform_connections (
            shop_domain
          )
        `)
        .order('quantity', { ascending: true })

      const transformedAlerts: Alert[] = (alertsData || []).map((alert: any) => ({
        id: alert.id,
        product_id: alert.product_id,
        connection_id: alert.connection_id,
        quantity: alert.quantity,
        threshold: alert.threshold,
        status: alert.status,
        created_at: alert.created_at,
        product_name: alert.products?.name || 'Unknown Product',
        product_sku: alert.products?.sku || 'N/A',
        product_brand: alert.products?.brand || 'Unknown',
        shop_domain: alert.platform_connections?.shop_domain || 'Unknown Store',
        is_archived: alert.products?.is_archived || false
      }))

      setConnections(connectionsData || [])
      setAlerts(transformedAlerts)

      // Fetch brands dynamically from database
      const { data: brandsData } = await supabase.rpc('get_all_brands')
      setBrands(brandsData?.map((b: { brand: string }) => b.brand) || [])
    } catch (error) {
      console.error('Error fetching alerts:', error)
    } finally {
      setLoading(false)
    }
  }

  function getSeverity(quantity: number, threshold: number) {
    if (quantity === 0) return { level: 'critical', color: 'bg-red-500', textColor: 'text-red-500', label: 'Out of Stock' }
    if (quantity <= threshold * 0.25) return { level: 'critical', color: 'bg-red-500', textColor: 'text-red-500', label: 'Critical' }
    if (quantity <= threshold * 0.5) return { level: 'warning', color: 'bg-orange-500', textColor: 'text-orange-500', label: 'Low Stock' }
    return { level: 'low', color: 'bg-yellow-500', textColor: 'text-yellow-500', label: 'Warning' }
  }

  function toggleSelectAlert(id: string) {
    const newSelected = new Set(selectedAlerts)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedAlerts(newSelected)
  }

  function selectAll() {
    if (selectedAlerts.size === filteredAlerts.length) {
      setSelectedAlerts(new Set())
    } else {
      setSelectedAlerts(new Set(filteredAlerts.map(a => a.id)))
    }
  }

  async function markAsOrdered(alertIds: string[]) {
    try {
      const { error } = await supabase
        .from('alerts')
        .update({ status: 'ordered' })
        .in('id', alertIds)

      if (!error) {
        setAlerts(alerts.map(a => 
          alertIds.includes(a.id) ? { ...a, status: 'ordered' } : a
        ))
        setSelectedAlerts(new Set())
      }
    } catch (error) {
      console.error('Error updating alerts:', error)
    }
  }

  async function archiveProducts(alertIds: string[]) {
    try {
      // Get product IDs from selected alerts
      const productIds = alerts
        .filter(a => alertIds.includes(a.id))
        .map(a => a.product_id)

      // Archive the products
      const { error } = await supabase
        .from('products')
        .update({ is_archived: true })
        .in('id', productIds)

      if (!error) {
        // Update local state
        setAlerts(alerts.map(a => 
          alertIds.includes(a.id) ? { ...a, is_archived: true } : a
        ))
        setSelectedAlerts(new Set())
      }
    } catch (error) {
      console.error('Error archiving products:', error)
    }
  }

  async function unarchiveProduct(alertId: string, productId: string) {
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_archived: false })
        .eq('id', productId)

      if (!error) {
        setAlerts(alerts.map(a => 
          a.id === alertId ? { ...a, is_archived: false } : a
        ))
      }
    } catch (error) {
      console.error('Error unarchiving product:', error)
    }
  }

  // Filter alerts
  const filteredAlerts = alerts.filter(alert => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      if (!alert.product_name.toLowerCase().includes(query) &&
          !alert.product_sku.toLowerCase().includes(query) &&
          !alert.product_brand.toLowerCase().includes(query)) {
        return false
      }
    }
    // Store filter
    if (storeFilter !== "all" && alert.connection_id !== storeFilter) {
      return false
    }
    // Brand filter
    if (brandFilter !== "all" && alert.product_brand !== brandFilter) {
      return false
    }
    // Severity filter
    if (severityFilter !== "all") {
      const severity = getSeverity(alert.quantity, alert.threshold)
      if (severityFilter === "critical" && severity.level !== "critical") return false
      if (severityFilter === "warning" && severity.level !== "warning" && severity.level !== "low") return false
    }
    // Archived filter
    if (!showArchived && alert.is_archived) return false
    // Status filter - show open by default
    if (alert.status !== 'open') return false
    return true
  })

  const criticalCount = alerts.filter(a => a.status === 'open' && !a.is_archived && getSeverity(a.quantity, a.threshold).level === 'critical').length
  const warningCount = alerts.filter(a => a.status === 'open' && !a.is_archived && getSeverity(a.quantity, a.threshold).level !== 'critical').length
  const archivedCount = alerts.filter(a => a.is_archived).length

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Bell className="h-8 w-8 text-amber-500" />
              Alerts
            </h1>
            <p className="text-muted-foreground mt-1">
              Items that need attention across all stores
            </p>
          </div>
          {selectedAlerts.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {selectedAlerts.size} selected
              </span>
              <Button variant="outline" onClick={() => archiveProducts(Array.from(selectedAlerts))}>
                <Archive className="h-4 w-4 mr-2" />
                Archive
              </Button>
              <Button onClick={() => markAsOrdered(Array.from(selectedAlerts))}>
                <ShoppingCart className="h-4 w-4 mr-2" />
                Mark as Ordered
              </Button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-red-500/10">
                  <AlertTriangle className="h-6 w-6 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-500">{criticalCount}</p>
                  <p className="text-sm text-muted-foreground">Critical</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-orange-500/30 bg-orange-500/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-orange-500/10">
                  <Clock className="h-6 w-6 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-orange-500">{warningCount}</p>
                  <p className="text-sm text-muted-foreground">Warning</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-blue-500/10">
                  <Package className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{alerts.filter(a => a.status === 'ordered').length}</p>
                  <p className="text-sm text-muted-foreground">Ordered</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-slate-500/10">
                  <Archive className="h-6 w-6 text-slate-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{archivedCount}</p>
                  <p className="text-sm text-muted-foreground">Archived</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products, SKU, or brand..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={storeFilter} onValueChange={setStoreFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <Store className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All Stores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stores</SelectItem>
                  {connections.map(conn => (
                    <SelectItem key={conn.id} value={conn.id}>
                      {conn.shop_domain.replace('.myshopify.com', '')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={brandFilter} onValueChange={setBrandFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <Tag className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All Brands" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Brands</SelectItem>
                  {brands.map(brand => (
                    <SelectItem key={brand} value={brand}>
                      {brand}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-full md:w-[160px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All Severities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="critical">Critical Only</SelectItem>
                  <SelectItem value="warning">Warning & Low</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant={showArchived ? "default" : "outline"}
                size="icon"
                onClick={() => setShowArchived(!showArchived)}
                title={showArchived ? "Hide archived" : "Show archived"}
              >
                {showArchived ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Alerts List */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">
                Active Alerts ({filteredAlerts.length})
                {showArchived && archivedCount > 0 && (
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    (showing archived)
                  </span>
                )}
              </CardTitle>
              {filteredAlerts.length > 0 && (
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  {selectedAlerts.size === filteredAlerts.length ? 'Deselect All' : 'Select All'}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredAlerts.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-green-500/10 mx-auto flex items-center justify-center mb-4">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                </div>
                <h3 className="text-lg font-medium">All Caught Up!</h3>
                <p className="text-muted-foreground mt-1">No alerts match your filters.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAlerts.map(alert => {
                  const severity = getSeverity(alert.quantity, alert.threshold)
                  const isSelected = selectedAlerts.has(alert.id)
                  
                  return (
                    <div 
                      key={alert.id}
                      className={`flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
                        alert.is_archived 
                          ? 'opacity-60 border-dashed' 
                          : isSelected 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border hover:border-primary/50 hover:bg-muted/50'
                      }`}
                      onClick={() => toggleSelectAlert(alert.id)}
                    >
                      {/* Checkbox */}
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        isSelected 
                          ? 'bg-primary border-primary' 
                          : 'border-muted-foreground/30'
                      }`}>
                        {isSelected && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                      </div>

                      {/* Severity indicator */}
                      <div className={`w-3 h-3 rounded-full ${severity.color} ${
                        severity.level === 'critical' && !alert.is_archived ? 'animate-pulse' : ''
                      }`} />

                      {/* Product info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{alert.product_name}</span>
                          <Badge variant="outline" className="text-xs">
                            {alert.product_sku}
                          </Badge>
                          {alert.is_archived && (
                            <Badge variant="secondary" className="text-xs">
                              <Archive className="h-3 w-3 mr-1" />
                              Archived
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                          <Tag className="h-3 w-3" />
                          <span className="font-medium">{alert.product_brand}</span>
                          <span>•</span>
                          <Store className="h-3 w-3" />
                          <span>{alert.shop_domain.replace('.myshopify.com', '')}</span>
                        </div>
                      </div>

                      {/* Quantity */}
                      <div className="text-right">
                        <div className={`text-lg font-bold ${severity.textColor}`}>
                          {alert.quantity}
                          <span className="text-sm font-normal text-muted-foreground"> / {alert.threshold}</span>
                        </div>
                        <Badge variant={severity.level === 'critical' ? 'destructive' : 'secondary'} className="mt-1">
                          {severity.label}
                        </Badge>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                        {alert.is_archived ? (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => unarchiveProduct(alert.id, alert.product_id)}
                          >
                            Restore
                          </Button>
                        ) : (
                          <>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => archiveProducts([alert.id])}
                              title="Archive - item is discontinued"
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => markAsOrdered([alert.id])}
                            >
                              <ShoppingCart className="h-4 w-4 mr-1" />
                              Order
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
