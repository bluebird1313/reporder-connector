"use client"

import { useState, useEffect, use } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { 
  Package,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Store,
  Minus,
  Plus
} from "lucide-react"

interface RequestItem {
  id: string
  product_id: string
  product_name: string
  product_sku: string
  current_quantity: number
  requested_quantity: number
  approved_quantity: number
  selected: boolean
}

interface RestockRequest {
  id: string
  status: string
  shop_domain: string
  created_at: string
  token_expires_at: string
  retailer_notes: string | null
}

export default function ApprovalPage({ params }: { params: Promise<{ token: string }> }) {
  const resolvedParams = use(params)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [request, setRequest] = useState<RestockRequest | null>(null)
  const [items, setItems] = useState<RequestItem[]>([])
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<'approved' | 'rejected' | null>(null)

  useEffect(() => {
    fetchRequest()
  }, [resolvedParams.token])

  async function fetchRequest() {
    try {
      setLoading(true)
      setError(null)

      // Find request by magic token
      const { data: requestData, error: requestError } = await supabase
        .from('restock_requests')
        .select(`
          id,
          status,
          token_expires_at,
          retailer_notes,
          created_at,
          platform_connections (
            shop_domain
          )
        `)
        .eq('magic_token', resolvedParams.token)
        .single()

      if (requestError || !requestData) {
        setError('Invalid or expired approval link.')
        return
      }

      // Check if expired
      if (new Date(requestData.token_expires_at) < new Date()) {
        setError('This approval link has expired. Please contact your agency for a new link.')
        return
      }

      // Check if already processed
      if (requestData.status === 'approved') {
        setSuccess('approved')
        return
      }
      if (requestData.status === 'rejected') {
        setSuccess('rejected')
        return
      }

      setRequest({
        id: requestData.id,
        status: requestData.status,
        shop_domain: (requestData.platform_connections as any)?.shop_domain || 'Your Store',
        created_at: requestData.created_at,
        token_expires_at: requestData.token_expires_at,
        retailer_notes: requestData.retailer_notes
      })

      // Fetch request items
      const { data: itemsData } = await supabase
        .from('restock_request_items')
        .select(`
          id,
          product_id,
          current_quantity,
          requested_quantity,
          approved_quantity,
          products (
            name,
            sku
          )
        `)
        .eq('request_id', requestData.id)

      const transformedItems: RequestItem[] = (itemsData || []).map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.products?.name || 'Unknown Product',
        product_sku: item.products?.sku || 'N/A',
        current_quantity: item.current_quantity,
        requested_quantity: item.requested_quantity,
        approved_quantity: item.approved_quantity || item.requested_quantity,
        selected: true
      }))

      setItems(transformedItems)

    } catch (err) {
      console.error('Error fetching request:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function toggleItem(itemId: string) {
    setItems(items.map(item => 
      item.id === itemId ? { ...item, selected: !item.selected } : item
    ))
  }

  function updateQuantity(itemId: string, qty: number) {
    setItems(items.map(item => 
      item.id === itemId ? { ...item, approved_quantity: Math.max(0, qty) } : item
    ))
  }

  async function handleSubmit(approved: boolean) {
    if (!request) return

    setSubmitting(true)
    try {
      if (approved) {
        // Update each item with approved quantity
        const selectedItems = items.filter(i => i.selected)
        
        for (const item of selectedItems) {
          await supabase
            .from('restock_request_items')
            .update({ approved_quantity: item.approved_quantity })
            .eq('id', item.id)
        }

        // Update request status
        await supabase
          .from('restock_requests')
          .update({ 
            status: 'approved',
            approved_at: new Date().toISOString(),
            retailer_notes: notes || null
          })
          .eq('id', request.id)

        setSuccess('approved')
      } else {
        // Reject the request
        await supabase
          .from('restock_requests')
          .update({ 
            status: 'rejected',
            rejected_at: new Date().toISOString(),
            retailer_notes: notes || null
          })
          .eq('id', request.id)

        setSuccess('rejected')
      }
    } catch (err) {
      console.error('Error submitting:', err)
      setError('Failed to submit. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const selectedItems = items.filter(i => i.selected)
  const totalUnits = selectedItems.reduce((sum, i) => sum + i.approved_quantity, 0)

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-slate-800/50 border-slate-700">
          <CardContent className="pt-8 text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/20 mx-auto flex items-center justify-center mb-4">
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
            <h2 className="text-xl font-semibold text-white">Link Invalid</h2>
            <p className="text-slate-400 mt-2">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-slate-800/50 border-slate-700">
          <CardContent className="pt-8 text-center">
            <div className={`w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4 ${
              success === 'approved' ? 'bg-green-500/20' : 'bg-red-500/20'
            }`}>
              {success === 'approved' 
                ? <CheckCircle2 className="h-8 w-8 text-green-500" />
                : <XCircle className="h-8 w-8 text-red-500" />
              }
            </div>
            <h2 className="text-xl font-semibold text-white">
              {success === 'approved' ? 'Request Approved!' : 'Request Declined'}
            </h2>
            <p className="text-slate-400 mt-2">
              {success === 'approved' 
                ? 'Thank you! Your agency has been notified and will proceed with the order.'
                : 'The request has been declined. Your agency has been notified.'
              }
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Main approval form
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="border-b border-slate-700 bg-slate-800/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
              <span className="text-white font-bold">R</span>
            </div>
            <div>
              <span className="font-bold text-white text-lg">RepOrder</span>
              <span className="text-slate-400 text-sm block -mt-0.5">Inventory Connector</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Request Header */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
              <Store className="h-4 w-4" />
              <span>{request?.shop_domain.replace('.myshopify.com', '')}</span>
            </div>
            <CardTitle className="text-white text-2xl">Restock Request</CardTitle>
            <CardDescription className="text-slate-400">
              Submitted {formatDate(request?.created_at || '')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-amber-400 text-sm">
              <Clock className="h-4 w-4" />
              <span>This link expires {formatDate(request?.token_expires_at || '')}</span>
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Package className="h-5 w-5" />
              Items to Restock ({items.length})
            </CardTitle>
            <CardDescription className="text-slate-400">
              Review and adjust quantities as needed. Uncheck items to exclude them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {items.map(item => (
                <div 
                  key={item.id}
                  className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                    item.selected 
                      ? 'border-blue-500/50 bg-blue-500/10' 
                      : 'border-slate-600 bg-slate-700/30 opacity-60'
                  }`}
                >
                  {/* Checkbox */}
                  <Checkbox
                    checked={item.selected}
                    onCheckedChange={() => toggleItem(item.id)}
                    className="border-slate-500 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                  />

                  {/* Product info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white truncate">{item.product_name}</span>
                      <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
                        {item.product_sku}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-sm">
                      <span className="text-slate-400">
                        Current stock: 
                        <span className={`ml-1 font-medium ${
                          item.current_quantity === 0 ? 'text-red-400' : 'text-amber-400'
                        }`}>
                          {item.current_quantity}
                        </span>
                      </span>
                      <span className="text-slate-500">|</span>
                      <span className="text-slate-400">
                        Requested: <span className="text-white font-medium">{item.requested_quantity}</span>
                      </span>
                    </div>
                  </div>

                  {/* Quantity adjuster */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-400">Order:</span>
                    <div className="flex items-center">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-r-none border-slate-600 bg-slate-700 hover:bg-slate-600 text-white"
                        onClick={() => updateQuantity(item.id, item.approved_quantity - 5)}
                        disabled={!item.selected}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Input
                        type="number"
                        value={item.approved_quantity}
                        onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 0)}
                        className="h-9 w-20 rounded-none text-center border-slate-600 bg-slate-700 text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        disabled={!item.selected}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-l-none border-slate-600 bg-slate-700 hover:bg-slate-600 text-white"
                        onClick={() => updateQuantity(item.id, item.approved_quantity + 5)}
                        disabled={!item.selected}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-base">Add a Note (Optional)</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Any special instructions or comments..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Summary & Actions */}
        <Card className="bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border-blue-500/30">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-white font-semibold text-lg">
                  {selectedItems.length} items • {totalUnits.toLocaleString()} total units
                </p>
                <p className="text-slate-400 text-sm mt-1">
                  {selectedItems.length === items.length 
                    ? 'All items selected' 
                    : `${items.length - selectedItems.length} items excluded`
                  }
                </p>
              </div>
              <div className="flex gap-3">
                <Button 
                  variant="outline"
                  className="border-slate-500 text-slate-300 hover:bg-slate-700 hover:text-white"
                  onClick={() => handleSubmit(false)}
                  disabled={submitting}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Decline
                </Button>
                <Button 
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => handleSubmit(true)}
                  disabled={submitting || selectedItems.length === 0}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {submitting ? 'Submitting...' : 'Approve Order'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-slate-500 text-sm py-4">
          <p>Questions? Contact your agency representative.</p>
          <p className="mt-1">Powered by RepOrder Connector</p>
        </div>
      </div>
    </div>
  )
}

