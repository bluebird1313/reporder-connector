"use client"

import { useState, useEffect, use } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { 
  ArrowLeft,
  Store, 
  RefreshCw, 
  Package,
  AlertTriangle,
  Search,
  Settings,
  ExternalLink,
  CheckCircle2,
  FileText
} from "lucide-react"
import Link from "next/link"

interface StoreDetail {
  id: string
  store_id: string
  platform: string
  shop_domain: string
  is_active: boolean
  last_sync_at: string | null
  created_at: string
  scopes: string[]
}

interface Product {
  id: string
  name: string
  sku: string
  brand: string
  external_id: string
  quantity: number
  threshold: number
  hasAlert: boolean
}

interface Alert {
  id: string
  product_id: string
  quantity: number
  threshold: number
  status: string
  product_name: string
  product_sku: string
}

export default function StoreDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [store, setStore] = useState<StoreDetail | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("all")

  useEffect(() => {
    fetchStoreData()
  }, [resolvedParams.id])

  async function fetchStoreData() {
    try {
      setLoading(true)

      // Fetch store connection
      const { data: storeData, error: storeError } = await supabase
        .from('platform_connections')
        .select('*')
        .eq('id', resolvedParams.id)
        .single()

      if (storeError) throw storeError
      setStore(storeData)

      // Fetch products with inventory
      const { data: productsData } = await supabase
        .from('products')
        .select(`
          id,
          name,
          sku,
          brand,
          external_id,
          inventory_levels (
            quantity,
            low_stock_threshold
          ),
          alerts (
            id,
            status
          )
        `)
        .eq('connection_id', resolvedParams.id)
        .order('name')

      const transformedProducts: Product[] = (productsData || []).map((p: any) => {
        const inventory = p.inventory_levels?.[0]
        const openAlerts = (p.alerts || []).filter((a: any) => a.status === 'open')
        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          brand: p.brand,
          external_id: p.external_id,
          quantity: inventory?.quantity || 0,
          threshold: inventory?.low_stock_threshold || 10,
          hasAlert: openAlerts.length > 0
        }
      })

      setProducts(transformedProducts)

      // Fetch alerts for this store
      const { data: alertsData } = await supabase
        .from('alerts')
        .select(`
          id,
          product_id,
          quantity,
          threshold,
          status,
          products (
            name,
            sku
          )
        `)
        .eq('connection_id', resolvedParams.id)
        .eq('status', 'open')
        .order('quantity', { ascending: true })

      const transformedAlerts: Alert[] = (alertsData || []).map((a: any) => ({
        id: a.id,
        product_id: a.product_id,
        quantity: a.quantity,
        threshold: a.threshold,
        status: a.status,
        product_name: a.products?.name || 'Unknown',
        product_sku: a.products?.sku || 'N/A'
      }))

      setAlerts(transformedAlerts)

    } catch (error) {
      console.error('Error fetching store data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSync() {
    setSyncing(true)
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3004'
      const response = await fetch(`${apiUrl}/api/sync/${resolvedParams.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      
      if (response.ok) {
        setTimeout(() => {
          fetchStoreData()
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

  function formatDate(dateString: string | null) {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function getStockStatus(quantity: number, threshold: number) {
    if (quantity === 0) return { label: 'Out of Stock', color: 'bg-red-500', variant: 'destructive' as const }
    if (quantity <= threshold) return { label: 'Low Stock', color: 'bg-orange-500', variant: 'destructive' as const }
    return { label: 'In Stock', color: 'bg-green-500', variant: 'default' as const }
  }

  // Filter products based on search and tab
  const filteredProducts = products.filter(product => {
    const matchesSearch = !searchQuery || 
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchQuery.toLowerCase())
    
    if (activeTab === 'low') {
      return matchesSearch && product.quantity <= product.threshold
    }
    return matchesSearch
  })

  const lowStockCount = products.filter(p => p.quantity <= p.threshold).length
  const totalUnits = products.reduce((sum, p) => sum + p.quantity, 0)

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!store) {
    return (
      <DashboardLayout>
        <div className="text-center py-24">
          <h2 className="text-2xl font-bold">Store Not Found</h2>
          <p className="text-muted-foreground mt-2">This store connection doesn&apos;t exist.</p>
          <Button asChild className="mt-4">
            <Link href="/stores">Back to Stores</Link>
          </Button>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <Link 
            href="/stores" 
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors w-fit"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Stores
          </Link>
          
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center text-white text-2xl">
                🛍️
              </div>
              <div>
                <h1 className="text-2xl font-bold">
                  {store.shop_domain.replace('.myshopify.com', '')}
                </h1>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="capitalize">{store.platform}</Badge>
                  <Badge variant={store.is_active ? "default" : "secondary"}>
                    {store.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleSync} disabled={syncing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync Now'}
              </Button>
              <Button asChild>
                <Link href={`/requests/new?store=${resolvedParams.id}`}>
                  <FileText className="h-4 w-4 mr-2" />
                  Create Restock Request
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-blue-500/10">
                  <Package className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{products.length}</p>
                  <p className="text-sm text-muted-foreground">Products</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-green-500/10">
                  <Package className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalUnits.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">Total Units</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={lowStockCount > 0 ? "border-orange-500/30" : ""}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${lowStockCount > 0 ? 'bg-orange-500/10' : 'bg-muted'}`}>
                  <AlertTriangle className={`h-6 w-6 ${lowStockCount > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-orange-500' : ''}`}>{lowStockCount}</p>
                  <p className="text-sm text-muted-foreground">Low Stock</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-purple-500/10">
                  <CheckCircle2 className="h-6 w-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{alerts.length}</p>
                  <p className="text-sm text-muted-foreground">Open Alerts</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Store Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="h-4 w-4" />
              Store Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Store Domain</p>
                <p className="font-medium flex items-center gap-2">
                  {store.shop_domain}
                  <a 
                    href={`https://${store.shop_domain}/admin`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Connected Since</p>
                <p className="font-medium">{formatDate(store.created_at)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Synced</p>
                <p className="font-medium">{formatDate(store.last_sync_at)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Products Table with Tabs */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <CardTitle>Products</CardTitle>
              <div className="flex gap-4">
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="all">All Products ({products.length})</TabsTrigger>
                <TabsTrigger value="low" className="text-orange-500">
                  Low Stock ({lowStockCount})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value={activeTab}>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Threshold</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProducts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            {searchQuery ? 'No matching products found.' : 'No products yet.'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredProducts.map(product => {
                          const status = getStockStatus(product.quantity, product.threshold)
                          return (
                            <TableRow key={product.id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{product.name}</p>
                                  <p className="text-sm text-muted-foreground">{product.brand}</p>
                                </div>
                              </TableCell>
                              <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                              <TableCell className="text-right font-medium">
                                {product.quantity.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {product.threshold}
                              </TableCell>
                              <TableCell>
                                <Badge variant={status.variant}>
                                  {status.label}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          )
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}

