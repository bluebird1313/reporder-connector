"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface ConnectionFormProps {
  onSubmit: (data: any) => void
  onCancel: () => void
}

export function ConnectionForm({ onSubmit, onCancel }: ConnectionFormProps) {
  const [formData, setFormData] = useState({
    platform: "",
    storeName: "",
    apiKey: "",
    apiSecret: "",
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.platform) newErrors.platform = "Platform is required"
    if (!formData.storeName) newErrors.storeName = "Store name is required"
    if (!formData.apiKey) newErrors.apiKey = "API key is required"
    if (!formData.apiSecret) newErrors.apiSecret = "API secret is required"

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validate()) {
      onSubmit(formData)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="platform">Platform *</Label>
        <Select value={formData.platform} onValueChange={(value) => setFormData({ ...formData, platform: value })}>
          <SelectTrigger id="platform">
            <SelectValue placeholder="Select a platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="shopify">Shopify</SelectItem>
            <SelectItem value="square">Square</SelectItem>
            <SelectItem value="lightspeed">Lightspeed</SelectItem>
          </SelectContent>
        </Select>
        {errors.platform && <p className="text-sm text-destructive">{errors.platform}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="storeName">Store Name *</Label>
        <Input
          id="storeName"
          placeholder="My Store"
          value={formData.storeName}
          onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
        />
        {errors.storeName && <p className="text-sm text-destructive">{errors.storeName}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="apiKey">API Key *</Label>
        <Input
          id="apiKey"
          type="password"
          placeholder="Enter your API key"
          value={formData.apiKey}
          onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
        />
        {errors.apiKey && <p className="text-sm text-destructive">{errors.apiKey}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="apiSecret">API Secret *</Label>
        <Input
          id="apiSecret"
          type="password"
          placeholder="Enter your API secret"
          value={formData.apiSecret}
          onChange={(e) => setFormData({ ...formData, apiSecret: e.target.value })}
        />
        {errors.apiSecret && <p className="text-sm text-destructive">{errors.apiSecret}</p>}
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" className="flex-1">
          Add Connection
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
