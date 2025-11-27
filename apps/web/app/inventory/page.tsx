"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, Package, AlertTriangle } from "lucide-react"
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
  products: {
    name: string
    sku: string
    brand: string
    platform_connections: {
      shop_domain: string
      platform: string
    } | null
  } | null
}

export default function InventoryPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchInventory()
  }, [])

  async function fetchInventory() {
    try {
      setLoading(true)
      
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
            platform_connections (
              shop_domain,
              platform
            )
          )
        `)
        .order('quantity', { ascending: true })

      if (error) throw error
      
      // Transform the data to match our expected type
      const transformedData: InventoryItem[] = (data || []).map((item: any) => ({
        ...item,
        products: item.products ? {
          name: item.products.name,
          sku: item.products.sku,
          brand: item.products.brand,
          platform_connections: item.products.platform_connections || null
        } : null
      }))
      
      setInventory(transformedData)
    } catch (error) {
      console.error('Error fetching inventory:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter inventory based on search
  const filteredInventory = inventory.filter((item) => {
    const product = item.products
    const searchLower = searchQuery.toLowerCase()
    return (
      product?.name?.toLowerCase().includes(searchLower) ||
      product?.sku?.toLowerCase().includes(searchLower) ||
      product?.brand?.toLowerCase().includes(searchLower) ||
      item.location_name?.toLowerCase().includes(searchLower)
    )
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
    item => item.quantity <= (item.low_stock_threshold || 10)
  ).length

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
            <p className="text-muted-foreground mt-2">
              {loading ? 'Loading...' : `${inventory.length} items tracked • ${lowStockCount} low stock`}
            </p>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search products, SKU, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Package className="h-4 w-4" />
              <span className="text-sm">Total Items</span>
            </div>
            <p className="text-2xl font-bold mt-1">{inventory.length}</p>
          </div>
          <div className="bg-card rounded-lg border p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Package className="h-4 w-4" />
              <span className="text-sm">Total Units</span>
            </div>
            <p className="text-2xl font-bold mt-1">
              {inventory.reduce((sum, item) => sum + item.quantity, 0).toLocaleString()}
            </p>
          </div>
          <div className="bg-card rounded-lg border p-4 border-destructive/50">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">Low Stock Items</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-destructive">{lowStockCount}</p>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Store</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Loading inventory...
                  </TableCell>
                </TableRow>
              ) : filteredInventory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {searchQuery ? 'No matching items found.' : 'No inventory data yet.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredInventory.map((item) => {
                  const product = item.products
                  const connection = product?.platform_connections as any
                  const status = getStockStatus(item.quantity, item.low_stock_threshold || 10)
                  
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{product?.name || 'Unknown'}</p>
                          <p className="text-sm text-muted-foreground">{product?.brand || ''}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {product?.sku || 'N/A'}
                      </TableCell>
                      <TableCell>{item.location_name || 'Default'}</TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {connection?.shop_domain?.replace('.myshopify.com', '') || 'Unknown'}
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
