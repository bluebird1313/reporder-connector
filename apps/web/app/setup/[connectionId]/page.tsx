"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { 
  Store,
  Tag,
  CheckCircle2,
  Search,
  Loader2,
  ShieldCheck,
  Package,
  ArrowRight
} from "lucide-react"

interface VendorData {
  shopName: string
  shopDomain: string
  vendors: string[]
  approvedVendors: string[] | null
  setupComplete: boolean
  totalVendors: number
}

export default function BrandPickerPage({ params }: { params: Promise<{ connectionId: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [vendorData, setVendorData] = useState<VendorData | null>(null)
  const [selectedVendors, setSelectedVendors] = useState<Set<string>>(new Set())
  const [selectAll, setSelectAll] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3004'

  useEffect(() => {
    fetchVendors()
  }, [resolvedParams.connectionId])

  async function fetchVendors() {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`${apiUrl}/api/vendors/${resolvedParams.connectionId}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('Connection not found. The link may have expired.')
          return
        }
        throw new Error('Failed to fetch vendors')
      }

      const data: VendorData = await response.json()
      setVendorData(data)

      // If setup is already complete, redirect to connections
      if (data.setupComplete) {
        router.push('/connections')
        return
      }

      // Pre-select previously approved vendors if any
      if (data.approvedVendors) {
        setSelectedVendors(new Set(data.approvedVendors))
      }

    } catch (err) {
      console.error('Error fetching vendors:', err)
      setError('Failed to load brand data. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function toggleVendor(vendor: string) {
    const newSelected = new Set(selectedVendors)
    if (newSelected.has(vendor)) {
      newSelected.delete(vendor)
    } else {
      newSelected.add(vendor)
    }
    setSelectedVendors(newSelected)
    
    // Uncheck "Select All" if we manually change individual vendors
    if (selectAll && newSelected.size !== vendorData?.vendors.length) {
      setSelectAll(false)
    }
    // Check "Select All" if all vendors are now selected
    if (newSelected.size === vendorData?.vendors.length) {
      setSelectAll(true)
    }
  }

  function handleSelectAll(checked: boolean) {
    setSelectAll(checked)
    if (checked && vendorData) {
      setSelectedVendors(new Set(vendorData.vendors))
    } else {
      setSelectedVendors(new Set())
    }
  }

  async function handleSubmit() {
    if (!vendorData) return
    
    // Must select at least one vendor (unless selecting all)
    if (!selectAll && selectedVendors.size === 0) {
      setError('Please select at least one brand to continue.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`${apiUrl}/api/vendors/${resolvedParams.connectionId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          selectAll 
            ? { selectAll: true }
            : { vendors: Array.from(selectedVendors) }
        )
      })

      if (!response.ok) {
        throw new Error('Failed to save brand selection')
      }

      // Success! Redirect to connections page
      router.push('/connections?setup=complete')

    } catch (err) {
      console.error('Error saving vendors:', err)
      setError('Failed to save your selection. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Filter vendors by search
  const filteredVendors = vendorData?.vendors.filter(v =>
    v.toLowerCase().includes(searchQuery.toLowerCase())
  ) || []

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-blue-500 animate-spin mx-auto" />
          <p className="text-slate-400 mt-4">Loading your store&apos;s brands...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error && !vendorData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-slate-800/50 border-slate-700">
          <CardContent className="pt-8 text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/20 mx-auto flex items-center justify-center mb-4">
              <Store className="h-8 w-8 text-red-500" />
            </div>
            <h2 className="text-xl font-semibold text-white">Something went wrong</h2>
            <p className="text-slate-400 mt-2">{error}</p>
            <Button 
              className="mt-6" 
              variant="outline"
              onClick={() => fetchVendors()}
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

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
        {/* Store Info */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
              <Store className="h-4 w-4" />
              <span>{vendorData?.shopDomain.replace('.myshopify.com', '')}</span>
              <Badge variant="outline" className="text-green-400 border-green-500/50">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            </div>
            <CardTitle className="text-white text-2xl">Choose which brands to share</CardTitle>
            <CardDescription className="text-slate-400 text-base">
              RepOrder will only sync inventory for the brands you select below. 
              Your other products remain completely private.
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Privacy Notice */}
        <Card className="bg-emerald-500/10 border-emerald-500/30">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <ShieldCheck className="h-6 w-6 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-white font-medium">Your data stays private</h3>
                <p className="text-slate-300 text-sm mt-1">
                  We only access inventory data for the brands you explicitly approve. 
                  Products from other vendors are never synced or stored in our system.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Brand Selection */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Your Brands ({vendorData?.totalVendors || 0})
            </CardTitle>
            <CardDescription className="text-slate-400">
              Select the brands this platform should have access to.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                placeholder="Search brands..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
              />
            </div>

            {/* Select All */}
            <div 
              className={`flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
                selectAll 
                  ? 'border-blue-500/50 bg-blue-500/10' 
                  : 'border-slate-600 bg-slate-700/30 hover:bg-slate-700/50'
              }`}
              onClick={() => handleSelectAll(!selectAll)}
            >
              <Checkbox
                checked={selectAll}
                onCheckedChange={handleSelectAll}
                className="border-slate-500 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
              />
              <div className="flex-1">
                <span className="font-medium text-white">Select All Brands</span>
                <p className="text-sm text-slate-400 mt-0.5">
                  Grant access to all {vendorData?.totalVendors} brands in your store
                </p>
              </div>
              <Badge variant="outline" className="border-slate-600 text-slate-400">
                Full Access
              </Badge>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-4 py-2">
              <div className="flex-1 h-px bg-slate-700" />
              <span className="text-slate-500 text-sm">or select specific brands</span>
              <div className="flex-1 h-px bg-slate-700" />
            </div>

            {/* Vendor List */}
            <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
              {filteredVendors.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  {searchQuery ? 'No brands match your search' : 'No brands found in store'}
                </div>
              ) : (
                filteredVendors.map(vendor => (
                  <div 
                    key={vendor}
                    className={`flex items-center gap-4 p-3 rounded-lg border transition-all cursor-pointer ${
                      selectedVendors.has(vendor) && !selectAll
                        ? 'border-blue-500/50 bg-blue-500/10' 
                        : selectAll
                          ? 'border-blue-500/30 bg-blue-500/5 opacity-60'
                          : 'border-slate-600 bg-slate-700/20 hover:bg-slate-700/40'
                    }`}
                    onClick={() => !selectAll && toggleVendor(vendor)}
                  >
                    <Checkbox
                      checked={selectAll || selectedVendors.has(vendor)}
                      onCheckedChange={() => !selectAll && toggleVendor(vendor)}
                      disabled={selectAll}
                      className="border-slate-500 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                    />
                    <Package className="h-4 w-4 text-slate-500" />
                    <span className="font-medium text-white">{vendor}</span>
                  </div>
                ))
              )}
            </div>

            {/* Error message */}
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary & Submit */}
        <Card className="bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border-blue-500/30">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-white font-semibold text-lg">
                  {selectAll 
                    ? `All ${vendorData?.totalVendors} brands selected`
                    : `${selectedVendors.size} brand${selectedVendors.size !== 1 ? 's' : ''} selected`
                  }
                </p>
                <p className="text-slate-400 text-sm mt-1">
                  {selectAll 
                    ? 'RepOrder will have access to your entire inventory'
                    : selectedVendors.size > 0
                      ? 'Only these brands will be synced'
                      : 'Select at least one brand to continue'
                  }
                </p>
              </div>
              <Button 
                className="bg-blue-600 hover:bg-blue-700 text-white px-8"
                onClick={handleSubmit}
                disabled={submitting || (!selectAll && selectedVendors.size === 0)}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    Complete Setup
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-slate-500 text-sm py-4">
          <p>You can change your brand selection anytime from the connections settings.</p>
          <p className="mt-1">Powered by RepOrder Connector</p>
        </div>
      </div>
    </div>
  )
}

