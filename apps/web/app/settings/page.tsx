"use client"

import { useState } from "react"
import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  Settings, 
  AlertTriangle, 
  Bell, 
  Clock, 
  Save,
  CheckCircle2,
  Package,
  Mail
} from "lucide-react"

export default function SettingsPage() {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  
  // Settings state
  const [defaultThreshold, setDefaultThreshold] = useState(10)
  const [criticalThreshold, setCriticalThreshold] = useState(3)
  const [autoSync, setAutoSync] = useState(true)
  const [syncInterval, setSyncInterval] = useState("15")
  const [emailAlerts, setEmailAlerts] = useState(false)
  const [emailDigest, setEmailDigest] = useState(false)
  const [emailAddress, setEmailAddress] = useState("")

  async function handleSave() {
    setSaving(true)
    // Simulate save - in production, this would save to database
    await new Promise(resolve => setTimeout(resolve, 1000))
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Settings className="h-8 w-8 text-slate-500" />
              Settings
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure your inventory monitoring preferences
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saved ? (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                Saved!
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </>
            )}
          </Button>
        </div>

        {/* Default Thresholds */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Default Stock Thresholds
            </CardTitle>
            <CardDescription>
              Set default alert thresholds for new products. Individual products can override these values.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="lowStock" className="flex items-center gap-2">
                  Low Stock Alert
                  <Badge variant="secondary" className="text-yellow-600 bg-yellow-100">Warning</Badge>
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="lowStock"
                    type="number"
                    value={defaultThreshold}
                    onChange={(e) => setDefaultThreshold(parseInt(e.target.value) || 0)}
                    className="w-24"
                    min={1}
                  />
                  <span className="text-sm text-muted-foreground">units</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Alert when stock falls below this level
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="critical" className="flex items-center gap-2">
                  Critical Alert
                  <Badge variant="destructive">Critical</Badge>
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="critical"
                    type="number"
                    value={criticalThreshold}
                    onChange={(e) => setCriticalThreshold(parseInt(e.target.value) || 0)}
                    className="w-24"
                    min={0}
                  />
                  <span className="text-sm text-muted-foreground">units</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Critical alert when stock is extremely low
                </p>
              </div>
            </div>
            
            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium mb-2">Threshold Preview</h4>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span>&gt; {defaultThreshold} = Healthy</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span>{criticalThreshold + 1} - {defaultThreshold} = Low Stock</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span>0 - {criticalThreshold} = Critical</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sync Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              Sync Settings
            </CardTitle>
            <CardDescription>
              Configure how and when inventory data syncs from connected stores
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Automatic Sync</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically sync inventory at regular intervals
                </p>
              </div>
              <Switch 
                checked={autoSync} 
                onCheckedChange={setAutoSync}
              />
            </div>
            
            {autoSync && (
              <div className="space-y-2">
                <Label>Sync Frequency</Label>
                <Select value={syncInterval} onValueChange={setSyncInterval}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">Every 5 minutes</SelectItem>
                    <SelectItem value="15">Every 15 minutes</SelectItem>
                    <SelectItem value="30">Every 30 minutes</SelectItem>
                    <SelectItem value="60">Every hour</SelectItem>
                    <SelectItem value="360">Every 6 hours</SelectItem>
                    <SelectItem value="1440">Once daily</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  More frequent syncs provide real-time data but may use more API quota
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-purple-500" />
              Notifications
            </CardTitle>
            <CardDescription>
              Configure how you receive alerts about inventory status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email Alerts
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receive immediate email notifications for critical stock levels
                </p>
              </div>
              <Switch 
                checked={emailAlerts} 
                onCheckedChange={setEmailAlerts}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Daily Digest</Label>
                <p className="text-sm text-muted-foreground">
                  Receive a daily summary of all low stock items
                </p>
              </div>
              <Switch 
                checked={emailDigest} 
                onCheckedChange={setEmailDigest}
              />
            </div>

            {(emailAlerts || emailDigest) && (
              <div className="space-y-2 pt-4 border-t">
                <Label htmlFor="email">Notification Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  className="max-w-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Email notifications will be sent to this address
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Restock Request Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-green-500" />
              Restock Requests
            </CardTitle>
            <CardDescription>
              Configure default settings for restock requests
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Default Reorder Multiplier</Label>
              <Select defaultValue="2">
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1.5">1.5x threshold</SelectItem>
                  <SelectItem value="2">2x threshold</SelectItem>
                  <SelectItem value="3">3x threshold</SelectItem>
                  <SelectItem value="4">4x threshold</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Default suggested reorder quantity based on threshold
              </p>
            </div>

            <div className="space-y-2">
              <Label>Approval Link Expiry</Label>
              <Select defaultValue="7">
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 days</SelectItem>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="14">14 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                How long approval links remain valid
              </p>
            </div>
          </CardContent>
        </Card>

        {/* API Information */}
        <Card>
          <CardHeader>
            <CardTitle>API Information</CardTitle>
            <CardDescription>
              Connection details for your integrated services
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="text-sm font-medium">Backend API</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3004'}
                  </p>
                </div>
                <Badge variant="outline" className="text-green-500 border-green-500">
                  <div className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                  Connected
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div>
                  <p className="text-sm font-medium">Database</p>
                  <p className="text-xs text-muted-foreground">Supabase PostgreSQL</p>
                </div>
                <Badge variant="outline" className="text-green-500 border-green-500">
                  <div className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                  Connected
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
