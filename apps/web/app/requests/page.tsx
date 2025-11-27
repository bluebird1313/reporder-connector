"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  FileText, 
  Plus, 
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  Package,
  Store,
  ChevronRight,
  AlertTriangle
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
  item_count: number
}

interface Connection {
  id: string
  shop_domain: string
}

export default function RequestsPage() {
  const [loading, setLoading] = useState(true)
  const [requests, setRequests] = useState<RestockRequest[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [statusFilter, setStatusFilter] = useState("all")
  const [storeFilter, setStoreFilter] = useState("all")

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      setLoading(true)

      // Fetch connections
      const { data: connectionsData } = await supabase
        .from('platform_connections')
        .select('id, shop_domain')
        .eq('is_active', true)

      // Fetch restock requests with connection info and item count
      const { data: requestsData } = await supabase
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
          ),
          restock_request_items (
            id
          )
        `)
        .order('created_at', { ascending: false })

      const transformedRequests: RestockRequest[] = (requestsData || []).map((r: any) => ({
        id: r.id,
        connection_id: r.connection_id,
        status: r.status,
        magic_token: r.magic_token,
        sent_at: r.sent_at,
        approved_at: r.approved_at,
        rejected_at: r.rejected_at,
        retailer_notes: r.retailer_notes,
        created_at: r.created_at,
        shop_domain: r.platform_connections?.shop_domain || 'Unknown Store',
        item_count: r.restock_request_items?.length || 0
      }))

      setConnections(connectionsData || [])
      setRequests(transformedRequests)
    } catch (error) {
      console.error('Error fetching requests:', error)
    } finally {
      setLoading(false)
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'draft':
        return { label: 'Draft', variant: 'secondary' as const, icon: FileText }
      case 'pending':
        return { label: 'Pending Approval', variant: 'default' as const, icon: Clock }
      case 'approved':
        return { label: 'Approved', variant: 'default' as const, icon: CheckCircle2, color: 'text-green-500' }
      case 'rejected':
        return { label: 'Rejected', variant: 'destructive' as const, icon: XCircle }
      case 'ordered':
        return { label: 'Ordered', variant: 'default' as const, icon: Package, color: 'text-blue-500' }
      default:
        return { label: status, variant: 'secondary' as const, icon: FileText }
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

  // Filter requests
  const filteredRequests = requests.filter(request => {
    if (statusFilter !== "all" && request.status !== statusFilter) return false
    if (storeFilter !== "all" && request.connection_id !== storeFilter) return false
    return true
  })

  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    draft: requests.filter(r => r.status === 'draft').length
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <FileText className="h-8 w-8 text-purple-500" />
              Restock Requests
            </h1>
            <p className="text-muted-foreground mt-1">
              Create and manage inventory restock requests for approval
            </p>
          </div>
          <Button asChild>
            <Link href="/requests/new">
              <Plus className="h-4 w-4 mr-2" />
              New Request
            </Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-purple-500/10">
                  <FileText className="h-6 w-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-yellow-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-yellow-500/10">
                  <Clock className="h-6 w-6 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-500">{stats.pending}</p>
                  <p className="text-sm text-muted-foreground">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-green-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-green-500/10">
                  <CheckCircle2 className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-500">{stats.approved}</p>
                  <p className="text-sm text-muted-foreground">Approved</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-muted">
                  <FileText className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.draft}</p>
                  <p className="text-sm text-muted-foreground">Drafts</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <Select value={storeFilter} onValueChange={setStoreFilter}>
                <SelectTrigger className="w-full md:w-[200px]">
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
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending">Pending Approval</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="ordered">Ordered</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Requests List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">
              Requests ({filteredRequests.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-muted mx-auto flex items-center justify-center mb-4">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium">No Requests Yet</h3>
                <p className="text-muted-foreground mt-1 max-w-md mx-auto">
                  Create your first restock request to start getting retailer approvals.
                </p>
                <Button asChild className="mt-4">
                  <Link href="/requests/new">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Request
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRequests.map(request => {
                  const statusInfo = getStatusBadge(request.status)
                  const StatusIcon = statusInfo.icon
                  
                  return (
                    <Link
                      key={request.id}
                      href={`/requests/${request.id}`}
                      className="flex items-center gap-4 p-4 rounded-xl border hover:border-primary/50 hover:bg-muted/50 transition-all group"
                    >
                      {/* Status Icon */}
                      <div className={`p-3 rounded-xl bg-muted ${statusInfo.color || ''}`}>
                        <StatusIcon className="h-5 w-5" />
                      </div>

                      {/* Request Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {request.shop_domain.replace('.myshopify.com', '')}
                          </span>
                          <Badge variant={statusInfo.variant}>
                            {statusInfo.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Package className="h-3 w-3" />
                            {request.item_count} items
                          </span>
                          <span>Created {formatDate(request.created_at)}</span>
                        </div>
                      </div>

                      {/* Actions based on status */}
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        {request.status === 'draft' && (
                          <Button size="sm" variant="outline">
                            <Send className="h-4 w-4 mr-1" />
                            Send
                          </Button>
                        )}
                        {request.status === 'pending' && (
                          <span className="text-sm text-muted-foreground">
                            Awaiting response
                          </span>
                        )}
                      </div>

                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </Link>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Create from Alerts */}
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-amber-500/10">
                <AlertTriangle className="h-6 w-6 text-amber-500" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Create from Low Stock Alerts</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Quickly create a restock request from your current low stock alerts.
                </p>
                <Button variant="outline" className="mt-3" asChild>
                  <Link href="/alerts">
                    View Alerts
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}

