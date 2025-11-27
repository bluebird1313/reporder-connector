"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, Package, AlertTriangle, Store, Tag, Archive, Eye, EyeOff } from "lucide-react"
import { supabase } from "@/lib/supabase"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface InventoryItem {
  id: string
  product_id: string
  location_name: string
  quantity: number
  low_stock_threshold: number
  updated_at: string
  product_name: string
  product_sku: string
  product_brand: string
  shop_domain: string
  connection_id: string
  is_archived: boolean
}

interface Connection {
  id: string
  shop_domain: string
}

export default function InventoryPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [brands, setBrands] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [storeFilter, setStoreFilter] = useState("all")
  const [brandFilter, setBrandFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showArchived, setShowArchived] = useState(false)

  useEffect(() => {
    fetchInventory()
  }, [])

  async function fetchInventory() {
    try {
      setLoading(true)
      
      // Fetch connections
      const { data: connectionsData } = await supabase
        .from('platform_connections')
        .select('id, shop_domain')
        .eq('is_active', true)

      setConnections(connectionsData || [])

      const { data, error } = await supabase
        .from('inventory_levels')
        .select(`
          id,
          product_id,
          location_name,
          quantity,
          low_stock_threshold,
          updated_at,
          products (
            name,
            sku,
            brand,
            connection_id,
            is_archived,
            platform_connections (
              shop_domain
            )
          )
        `)
        .order('quantity', { ascending: true })

      if (error) throw error
      
      // Transform the data
      const transformedData: InventoryItem[] = (data || []).map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        location_name: item.location_name || 'Default',
        quantity: item.quantity,
        low_stock_threshold: item.low_stock_threshold || 10,
        updated_at: item.updated_at,
        product_name: item.products?.name || 'Unknown',
        product_sku: item.products?.sku || 'N/A',
        product_brand: item.products?.brand || 'Unknown',
        shop_domain: item.products?.platform_connections?.shop_domain || 'Unknown',
        connection_id: item.products?.connection_id || '',
        is_archived: item.products?.is_archived || false
      }))
      
      // Extract unique brands
      const uniqueBrands = [...new Set(transformedData.map(i => i.product_brand).filter(Boolean))]
      uniqueBrands.sort()
      setBrands(uniqueBrands)

      setInventory(transformedData)
    } catch (error) {
      console.error('Error fetching inventory:', error)
    } finally {
      setLoading(false)
    }
  }

  async function toggleArchive(productId: string, currentArchived: boolean) {
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_archived: !currentArchived })
        .eq('id', productId)

      if (!error) {
        setInventory(inventory.map(i => 
          i.product_id === productId ? { ...i, is_archived: !currentArchived } : i
        ))
      }
    } catch (error) {
      console.error('Error toggling archive:', error)
    }
  }

  // Filter inventory
  const filteredInventory = inventory.filter((item) => {
    // Search filter
    const searchLower = searchQuery.toLowerCase()
    if (searchQuery && 
        !item.product_name.toLowerCase().includes(searchLower) &&
        !item.product_sku.toLowerCase().includes(searchLower) &&
        !item.product_brand.toLowerCase().includes(searchLower) &&
        !item.location_name.toLowerCase().includes(searchLower)) {
      return false
    }
    
    // Store filter
    if (storeFilter !== "all" && item.connection_id !== storeFilter) {
      return false
    }

    // Brand filter
    if (brandFilter !== "all" && item.product_brand !== brandFilter) {
      return false
    }

    // Status filter
    if (statusFilter === "low" && item.quantity > item.low_stock_threshold) {
      return false
    }
    if (statusFilter === "healthy" && item.quantity <= item.low_stock_threshold) {
      return false
    }

    // Archived filter
    if (!showArchived && item.is_archived) {
      return false
    }

    return true
  })

  function getStockStatus(quantity: number, threshold: number) {
    if (quantity === 0) return { label: 'Out of Stock', variant: 'destructive' as const }
    if (quantity <= threshold) return { label: 'Low Stock', variant: 'destructive' as const }
    if (quantity <= threshold * 2) return { label: 'Warning', variant: 'secondary' as const }
    return { label: 'In Stock', variant: 'default' as const }
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

  const lowStockCount = inventory.filter(
    item => !item.is_archived && item.quantity <= (item.low_stock_threshold || 10)
  ).length

  const archivedCount = inventory.filter(item => item.is_archived).length

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Package className="h-8 w-8 text-blue-500" />
              Inventory
            </h1>
            <p className="text-muted-foreground mt-1">
              {loading ? 'Loading...' : `${filteredInventory.length} items • ${lowStockCount} low stock`}
              {archivedCount > 0 && !showArchived && ` • ${archivedCount} archived (hidden)`}
            </p>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Package className="h-4 w-4" />
                <span className="text-sm">Total Items</span>
              </div>
              <p className="text-2xl font-bold mt-1">{inventory.filter(i => !i.is_archived).length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Package className="h-4 w-4" />
                <span className="text-sm">Total Units</span>
              </div>
              <p className="text-2xl font-bold mt-1">
                {inventory.filter(i => !i.is_archived).reduce((sum, item) => sum + item.quantity, 0).toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card className="border-destructive/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">Low Stock Items</span>
              </div>
              <p className="text-2xl font-bold mt-1 text-destructive">{lowStockCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Archive className="h-4 w-4" />
                <span className="text-sm">Archived</span>
              </div>
              <p className="text-2xl font-bold mt-1">{archivedCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search products, SKU, brand, or location..."
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
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[140px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="low">Low Stock</SelectItem>
                  <SelectItem value="healthy">Healthy</SelectItem>
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

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Store</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Loading inventory...
                  </TableCell>
                </TableRow>
              ) : filteredInventory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {searchQuery || brandFilter !== "all" || storeFilter !== "all" 
                      ? 'No matching items found.' 
                      : 'No inventory data yet.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredInventory.map((item) => {
                  const status = getStockStatus(item.quantity, item.low_stock_threshold || 10)
                  
                  return (
                    <TableRow key={item.id} className={item.is_archived ? 'opacity-60' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{item.product_name}</span>
                          {item.is_archived && (
                            <Badge variant="secondary" className="text-xs">
                              <Archive className="h-3 w-3 mr-1" />
                              Archived
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.product_brand}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {item.product_sku}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {item.shop_domain?.replace('.myshopify.com', '') || 'Unknown'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {item.quantity.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.updated_at ? formatDate(item.updated_at) : 'Never'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleArchive(item.product_id, item.is_archived)}
                          title={item.is_archived ? "Restore" : "Archive"}
                        >
                          {item.is_archived ? "Restore" : <Archive className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  )
}
