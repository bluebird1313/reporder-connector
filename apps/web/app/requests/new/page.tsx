"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  ArrowLeft,
  Store, 
  Package,
  AlertTriangle,
  Search,
  Send,
  Save,
  Plus,
  Minus
} from "lucide-react"
import Link from "next/link"

interface Connection {
  id: string
  shop_domain: string
}

interface LowStockProduct {
  id: string
  name: string
  sku: string
  brand: string
  quantity: number
  threshold: number
  selected: boolean
  reorderQty: number
}

function NewRequestContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedStore = searchParams.get('store')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [connections, setConnections] = useState<Connection[]>([])
  const [selectedStore, setSelectedStore] = useState<string>(preselectedStore || "")
  const [products, setProducts] = useState<LowStockProduct[]>([])
  const [notes, setNotes] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    fetchConnections()
  }, [])

  useEffect(() => {
    if (selectedStore) {
      fetchLowStockProducts(selectedStore)
    }
  }, [selectedStore])

  async function fetchConnections() {
    try {
      const { data } = await supabase
        .from('platform_connections')
        .select('id, shop_domain')
        .eq('is_active', true)

      setConnections(data || [])
      
      // If preselected store, set it
      if (preselectedStore && data?.find(c => c.id === preselectedStore)) {
        setSelectedStore(preselectedStore)
      }
    } catch (error) {
      console.error('Error fetching connections:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchLowStockProducts(connectionId: string) {
    try {
      setLoading(true)

      // Fetch products with low stock alerts
      const { data: alertsData } = await supabase
        .from('alerts')
        .select(`
          id,
          product_id,
          quantity,
          threshold,
          products (
            id,
            name,
            sku,
            brand
          )
        `)
        .eq('connection_id', connectionId)
        .eq('status', 'open')
        .order('quantity', { ascending: true })

      const transformedProducts: LowStockProduct[] = (alertsData || []).map((alert: any) => ({
        id: alert.products?.id || alert.product_id,
        name: alert.products?.name || 'Unknown',
        sku: alert.products?.sku || 'N/A',
        brand: alert.products?.brand || '',
        quantity: alert.quantity,
        threshold: alert.threshold,
        selected: true, // Select all by default
        reorderQty: Math.max(alert.threshold * 2 - alert.quantity, alert.threshold) // Suggest reorder to 2x threshold
      }))

      setProducts(transformedProducts)
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }

  function toggleProduct(productId: string) {
    setProducts(products.map(p => 
      p.id === productId ? { ...p, selected: !p.selected } : p
    ))
  }

  function updateReorderQty(productId: string, qty: number) {
    setProducts(products.map(p => 
      p.id === productId ? { ...p, reorderQty: Math.max(1, qty) } : p
    ))
  }

  function selectAll() {
    const allSelected = products.every(p => p.selected)
    setProducts(products.map(p => ({ ...p, selected: !allSelected })))
  }

  async function handleSave(sendNow: boolean = false) {
    const selectedProducts = products.filter(p => p.selected)
    if (selectedProducts.length === 0) {
      alert('Please select at least one product')
      return
    }

    if (!selectedStore) {
      alert('Please select a store')
      return
    }

    setSaving(true)
    try {
      // Create the restock request
      const { data: request, error: requestError } = await supabase
        .from('restock_requests')
        .insert({
          connection_id: selectedStore,
          status: sendNow ? 'pending' : 'draft',
          sent_at: sendNow ? new Date().toISOString() : null,
          retailer_notes: notes || null
        })
        .select()
        .single()

      if (requestError) throw requestError

      // Add the request items
      const items = selectedProducts.map(p => ({
        request_id: request.id,
        product_id: p.id,
        current_quantity: p.quantity,
        requested_quantity: p.reorderQty
      }))

      const { error: itemsError } = await supabase
        .from('restock_request_items')
        .insert(items)

      if (itemsError) throw itemsError

      // Redirect to the request detail page or requests list
      router.push(`/requests/${request.id}`)
    } catch (error) {
      console.error('Error creating request:', error)
      alert('Failed to create request')
    } finally {
      setSaving(false)
    }
  }

  const selectedProducts = products.filter(p => p.selected)
  const filteredProducts = products.filter(p => 
    !searchQuery || 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <Link 
            href="/requests" 
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors w-fit"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Requests
          </Link>
          
          <div>
            <h1 className="text-2xl font-bold">Create Restock Request</h1>
            <p className="text-muted-foreground mt-1">
              Select low stock items to include in your restock request
            </p>
          </div>
        </div>

        {/* Store Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Store className="h-4 w-4" />
              Select Store
            </CardTitle>
            <CardDescription>
              Choose the store this request is for
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedStore} onValueChange={setSelectedStore}>
              <SelectTrigger className="w-full md:w-[300px]">
                <SelectValue placeholder="Select a store..." />
              </SelectTrigger>
              <SelectContent>
                {connections.map(conn => (
                  <SelectItem key={conn.id} value={conn.id}>
                    {conn.shop_domain.replace('.myshopify.com', '')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Product Selection */}
        {selectedStore && (
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Package className="h-4 w-4" />
                    Low Stock Items
                  </CardTitle>
                  <CardDescription>
                    {selectedProducts.length} of {products.length} items selected
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <div className="relative w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Button variant="outline" size="sm" onClick={selectAll}>
                    {products.every(p => p.selected) ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-green-500/10 mx-auto flex items-center justify-center mb-4">
                    <Package className="h-8 w-8 text-green-500" />
                  </div>
                  <h3 className="text-lg font-medium">No Low Stock Items</h3>
                  <p className="text-muted-foreground mt-1">
                    This store has no products that need restocking.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredProducts.map(product => (
                    <div 
                      key={product.id}
                      className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                        product.selected 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      {/* Checkbox */}
                      <Checkbox
                        checked={product.selected}
                        onCheckedChange={() => toggleProduct(product.id)}
                      />

                      {/* Severity indicator */}
                      <div className={`w-3 h-3 rounded-full ${
                        product.quantity === 0 ? 'bg-red-500 animate-pulse' :
                        product.quantity <= product.threshold * 0.5 ? 'bg-red-500' :
                        'bg-orange-500'
                      }`} />

                      {/* Product info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{product.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {product.sku}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                          <span>Current: <strong className={product.quantity === 0 ? 'text-red-500' : 'text-orange-500'}>{product.quantity}</strong></span>
                          <span>•</span>
                          <span>Threshold: {product.threshold}</span>
                        </div>
                      </div>

                      {/* Reorder quantity */}
                      <div className="flex items-center gap-2">
                        <Label className="text-sm text-muted-foreground whitespace-nowrap">Reorder:</Label>
                        <div className="flex items-center">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 rounded-r-none"
                            onClick={() => updateReorderQty(product.id, product.reorderQty - 5)}
                            disabled={!product.selected}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Input
                            type="number"
                            value={product.reorderQty}
                            onChange={(e) => updateReorderQty(product.id, parseInt(e.target.value) || 0)}
                            className="h-8 w-16 rounded-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            disabled={!product.selected}
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 rounded-l-none"
                            onClick={() => updateReorderQty(product.id, product.reorderQty + 5)}
                            disabled={!product.selected}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {selectedStore && products.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notes (Optional)</CardTitle>
              <CardDescription>
                Add any notes for the retailer about this restock request
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="E.g., Priority items, special instructions..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        {selectedStore && selectedProducts.length > 0 && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <p className="font-semibold">
                    {selectedProducts.length} items selected
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Total reorder: {selectedProducts.reduce((sum, p) => sum + p.reorderQty, 0).toLocaleString()} units
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => handleSave(false)}
                    disabled={saving}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save as Draft
                  </Button>
                  <Button 
                    onClick={() => handleSave(true)}
                    disabled={saving}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    {saving ? 'Creating...' : 'Create & Send'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}

export default function NewRequestPage() {
  return (
    <Suspense fallback={
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    }>
      <NewRequestContent />
    </Suspense>
  )
}

