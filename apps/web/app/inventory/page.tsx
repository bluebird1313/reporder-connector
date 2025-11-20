"use client"

import { useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { InventoryTable } from "@/components/inventory-table"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"

// Mock inventory data - structure ready for Supabase
const mockInventory = [
  {
    id: "1",
    product_name: "Wireless Headphones",
    sku: "WH-1000XM4",
    quantity: 45,
    source: "Shopify",
    last_updated: "2024-01-20T10:30:00Z",
  },
  {
    id: "2",
    product_name: "Smart Watch",
    sku: "SW-ULTRA-2",
    quantity: 23,
    source: "Square",
    last_updated: "2024-01-20T09:15:00Z",
  },
  {
    id: "3",
    product_name: "USB-C Cable",
    sku: "USBC-2M",
    quantity: 156,
    source: "Shopify",
    last_updated: "2024-01-20T11:45:00Z",
  },
  {
    id: "4",
    product_name: "Laptop Stand",
    sku: "LS-ALU-001",
    quantity: 34,
    source: "Lightspeed",
    last_updated: "2024-01-19T16:20:00Z",
  },
  {
    id: "5",
    product_name: "Mechanical Keyboard",
    sku: "KB-MECH-RGB",
    quantity: 12,
    source: "Square",
    last_updated: "2024-01-20T08:00:00Z",
  },
  {
    id: "6",
    product_name: "Mouse Pad XL",
    sku: "MP-XL-001",
    quantity: 67,
    source: "Shopify",
    last_updated: "2024-01-20T10:00:00Z",
  },
  {
    id: "7",
    product_name: "Webcam HD",
    sku: "WC-1080P",
    quantity: 29,
    source: "Lightspeed",
    last_updated: "2024-01-19T14:30:00Z",
  },
  {
    id: "8",
    product_name: "Phone Case",
    sku: "PC-SLIM-BLK",
    quantity: 203,
    source: "Shopify",
    last_updated: "2024-01-20T12:00:00Z",
  },
  {
    id: "9",
    product_name: "Screen Protector",
    sku: "SP-GLASS-9H",
    quantity: 145,
    source: "Square",
    last_updated: "2024-01-20T09:30:00Z",
  },
  {
    id: "10",
    product_name: "Power Bank",
    sku: "PB-20000MAH",
    quantity: 56,
    source: "Shopify",
    last_updated: "2024-01-20T11:15:00Z",
  },
]

export default function InventoryPage() {
  const [searchQuery, setSearchQuery] = useState("")

  // Filter inventory based on search
  const filteredInventory = mockInventory.filter(
    (item) =>
      item.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.source.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
            <p className="text-muted-foreground mt-2">View and manage your synced inventory items</p>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search products, SKU, or source..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Table */}
        <InventoryTable inventory={filteredInventory} />
      </div>
    </DashboardLayout>
  )
}
