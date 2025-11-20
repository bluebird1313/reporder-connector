import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"

interface InventoryItem {
  id: string
  product_name: string
  sku: string
  quantity: number
  source: string
  last_updated: string
}

interface InventoryTableProps {
  inventory: InventoryItem[]
}

export function InventoryTable({ inventory }: InventoryTableProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)

    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return date.toLocaleDateString()
  }

  const getSourceColor = (source: string) => {
    switch (source.toLowerCase()) {
      case "shopify":
        return "default"
      case "square":
        return "secondary"
      case "lightspeed":
        return "outline"
      default:
        return "default"
    }
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product Name</TableHead>
            <TableHead>SKU</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead>Source</TableHead>
            <TableHead className="text-right">Last Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {inventory.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                No inventory items found
              </TableCell>
            </TableRow>
          ) : (
            inventory.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.product_name}</TableCell>
                <TableCell className="font-mono text-sm text-muted-foreground">{item.sku}</TableCell>
                <TableCell className="text-right font-semibold">{item.quantity}</TableCell>
                <TableCell>
                  <Badge variant={getSourceColor(item.source)}>{item.source}</Badge>
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {formatDate(item.last_updated)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  )
}
