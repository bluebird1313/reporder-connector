"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard-layout"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  Package,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  Copy,
  ExternalLink,
  Trash2,
  Mail
} from "lucide-react"
import Link from "next/link"

interface RestockRequest {
  id: string
  connection_id: string
  status: string
  magic_token: string
  sent_at: string | null
  approved_at: string | null
  rejected_at: string | null
  retailer_notes: string | null
  created_at: string
  shop_domain: string
}

interface RequestItem {
  id: string
  product_name: string
  product_sku: string
  current_quantity: number
  requested_quantity: number
  approved_quantity: number | null
}

export default function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [request, setRequest] = useState<RestockRequest | null>(null)
  const [items, setItems] = useState<RequestItem[]>([])
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchRequest()
  }, [resolvedParams.id])

  async function fetchRequest() {
    try {
      setLoading(true)

      const { data: requestData, error } = await supabase
        .from('restock_requests')
        .select(`
          id,
          connection_id,
          status,
          magic_token,
          sent_at,
          approved_at,
          rejected_at,
          retailer_notes,
          created_at,
          platform_connections (
            shop_domain
          )
        `)
        .eq('id', resolvedParams.id)
        .single()

      if (error) throw error

      setRequest({
        ...requestData,
        shop_domain: (requestData.platform_connections as any)?.shop_domain || 'Unknown Store'
      })

      // Fetch items
      const { data: itemsData } = await supabase
        .from('restock_request_items')
        .select(`
          id,
          current_quantity,
          requested_quantity,
          approved_quantity,
          products (
            name,
            sku
          )
        `)
        .eq('request_id', resolvedParams.id)

      const transformedItems: RequestItem[] = (itemsData || []).map((item: any) => ({
        id: item.id,
        product_name: item.products?.name || 'Unknown',
        product_sku: item.products?.sku || 'N/A',
        current_quantity: item.current_quantity,
        requested_quantity: item.requested_quantity,
        approved_quantity: item.approved_quantity
      }))

      setItems(transformedItems)
    } catch (err) {
      console.error('Error fetching request:', err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSend() {
    if (!request) return

    setSending(true)
    try {
      await supabase
        .from('restock_requests')
        .update({ 
          status: 'pending',
          sent_at: new Date().toISOString()
        })
        .eq('id', request.id)

      setRequest({ ...request, status: 'pending', sent_at: new Date().toISOString() })
    } catch (err) {
      console.error('Error sending request:', err)
    } finally {
      setSending(false)
    }
  }

  async function handleDelete() {
    if (!request) return
    if (!confirm('Are you sure you want to delete this request?')) return

    setDeleting(true)
    try {
      // Delete items first
      await supabase
        .from('restock_request_items')
        .delete()
        .eq('request_id', request.id)

      // Delete request
      await supabase
        .from('restock_requests')
        .delete()
        .eq('id', request.id)

      router.push('/requests')
    } catch (err) {
      console.error('Error deleting request:', err)
    } finally {
      setDeleting(false)
    }
  }

  function copyApprovalLink() {
    if (!request) return
    const link = `${window.location.origin}/approve/${request.magic_token}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function getStatusInfo(status: string) {
    switch (status) {
      case 'draft':
        return { label: 'Draft', color: 'bg-slate-500', icon: Package }
      case 'pending':
        return { label: 'Pending Approval', color: 'bg-yellow-500', icon: Clock }
      case 'approved':
        return { label: 'Approved', color: 'bg-green-500', icon: CheckCircle2 }
      case 'rejected':
        return { label: 'Rejected', color: 'bg-red-500', icon: XCircle }
      case 'ordered':
        return { label: 'Ordered', color: 'bg-blue-500', icon: Package }
      default:
        return { label: status, color: 'bg-slate-500', icon: Package }
    }
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-24">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    )
  }

  if (!request) {
    return (
      <DashboardLayout>
        <div className="text-center py-24">
          <h2 className="text-2xl font-bold">Request Not Found</h2>
          <Button asChild className="mt-4">
            <Link href="/requests">Back to Requests</Link>
          </Button>
        </div>
      </DashboardLayout>
    )
  }

  const statusInfo = getStatusInfo(request.status)
  const StatusIcon = statusInfo.icon
  const totalRequested = items.reduce((sum, i) => sum + i.requested_quantity, 0)
  const totalApproved = items.reduce((sum, i) => sum + (i.approved_quantity || 0), 0)

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
          
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">Restock Request</h1>
                <Badge className={`${statusInfo.color} text-white`}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {statusInfo.label}
                </Badge>
              </div>
              <p className="text-muted-foreground mt-1 flex items-center gap-2">
                <Store className="h-4 w-4" />
                {request.shop_domain.replace('.myshopify.com', '')}
              </p>
            </div>
            
            <div className="flex gap-2">
              {request.status === 'draft' && (
                <>
                  <Button 
                    variant="outline" 
                    className="text-destructive hover:text-destructive"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                  <Button onClick={handleSend} disabled={sending}>
                    <Send className="h-4 w-4 mr-2" />
                    {sending ? 'Sending...' : 'Send for Approval'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Approval Link Card */}
        {(request.status === 'pending' || request.status === 'draft') && (
          <Card className="border-blue-500/30 bg-blue-500/5">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="h-4 w-4 text-blue-500" />
                Approval Link
              </CardTitle>
              <CardDescription>
                Send this link to the retailer for them to approve the request
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}/approve/${request.magic_token}`}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button variant="outline" onClick={copyApprovalLink}>
                  {copied ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </>
                  )}
                </Button>
                <Button variant="outline" asChild>
                  <a 
                    href={`/approve/${request.magic_token}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Request Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Request Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="font-medium">{formatDate(request.created_at)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sent</p>
                <p className="font-medium">{formatDate(request.sent_at)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {request.status === 'approved' ? 'Approved' : 
                   request.status === 'rejected' ? 'Rejected' : 'Response'}
                </p>
                <p className="font-medium">
                  {request.approved_at ? formatDate(request.approved_at) :
                   request.rejected_at ? formatDate(request.rejected_at) : 'Pending'}
                </p>
              </div>
            </div>
            
            {request.retailer_notes && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">Retailer Notes</p>
                <p className="mt-1 bg-muted p-3 rounded-lg text-sm">{request.retailer_notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              Items ({items.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Current Stock</TableHead>
                    <TableHead className="text-right">Requested</TableHead>
                    {request.status === 'approved' && (
                      <TableHead className="text-right">Approved</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(item => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.product_name}</TableCell>
                      <TableCell className="font-mono text-sm">{item.product_sku}</TableCell>
                      <TableCell className="text-right">
                        <span className={item.current_quantity === 0 ? 'text-red-500' : 'text-orange-500'}>
                          {item.current_quantity}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{item.requested_quantity}</TableCell>
                      {request.status === 'approved' && (
                        <TableCell className="text-right font-medium text-green-500">
                          {item.approved_quantity || item.requested_quantity}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            {/* Summary */}
            <div className="mt-4 pt-4 border-t flex justify-end">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">
                  Total Requested: <span className="font-medium text-foreground">{totalRequested.toLocaleString()} units</span>
                </p>
                {request.status === 'approved' && (
                  <p className="text-sm text-green-500 mt-1">
                    Total Approved: <span className="font-medium">{totalApproved.toLocaleString()} units</span>
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}

