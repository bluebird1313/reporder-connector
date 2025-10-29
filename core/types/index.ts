import { z } from 'zod';

// Platform types
export const PlatformSchema = z.enum(['shopify', 'lightspeed', 'square']);
export type Platform = z.infer<typeof PlatformSchema>;

// Core data models
export const NormalizedInventoryEventSchema = z.object({
  platform: PlatformSchema,
  shopId: z.string(),
  variantExternalId: z.string(),
  locationExternalId: z.string(),
  quantity: z.number().int().min(0),
  observedAt: z.string().datetime(),
});

export type NormalizedInventoryEvent = z.infer<typeof NormalizedInventoryEventSchema>;

export const InventorySnapshotSchema = z.object({
  id: z.string().uuid().optional(),
  platform: PlatformSchema,
  shopId: z.string(),
  variantExternalId: z.string(),
  locationExternalId: z.string(),
  quantity: z.number().int().min(0),
  threshold: z.number().int().min(0),
  isOutOfStock: z.boolean(),
  lastUpdatedAt: z.string().datetime(),
  createdAt: z.string().datetime().optional(),
});

export type InventorySnapshot = z.infer<typeof InventorySnapshotSchema>;

export const ProductSchema = z.object({
  id: z.string().uuid().optional(),
  platform: PlatformSchema,
  shopId: z.string(),
  externalId: z.string(),
  title: z.string(),
  handle: z.string().optional(),
  productType: z.string().optional(),
  vendor: z.string().optional(),
  status: z.enum(['active', 'archived', 'draft']),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type Product = z.infer<typeof ProductSchema>;

export const VariantSchema = z.object({
  id: z.string().uuid().optional(),
  platform: PlatformSchema,
  shopId: z.string(),
  productId: z.string().uuid(),
  externalId: z.string(),
  externalProductId: z.string(),
  title: z.string(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  price: z.number().optional(),
  inventoryManagement: z.enum(['shopify', 'manual', 'fulfillment_service']).optional(),
  inventoryPolicy: z.enum(['deny', 'continue']).optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type Variant = z.infer<typeof VariantSchema>;

export const LocationSchema = z.object({
  id: z.string().uuid().optional(),
  platform: PlatformSchema,
  shopId: z.string(),
  externalId: z.string(),
  name: z.string(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  isActive: z.boolean(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type Location = z.infer<typeof LocationSchema>;

export const IncidentSchema = z.object({
  id: z.string().uuid().optional(),
  platform: PlatformSchema,
  shopId: z.string(),
  variantExternalId: z.string(),
  locationExternalId: z.string(),
  type: z.enum(['OOS_OPENED', 'OOS_RESOLVED']),
  quantity: z.number().int().min(0),
  threshold: z.number().int().min(0),
  status: z.enum(['open', 'resolved', 'ignored']),
  resolvedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
});

export type Incident = z.infer<typeof IncidentSchema>;

export const ShopSchema = z.object({
  id: z.string().uuid().optional(),
  platform: PlatformSchema,
  shopDomain: z.string(),
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  tokenExpiresAt: z.string().datetime().optional(),
  installedAt: z.string().datetime().optional(),
  status: z.enum(['active', 'suspended', 'uninstalled']),
  webhookEndpointId: z.string().optional(),
  scopes: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
});

export type Shop = z.infer<typeof ShopSchema>;

// Auth related types
export const AuthResultSchema = z.object({
  success: z.boolean(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  scopes: z.array(z.string()).optional(),
  error: z.string().optional(),
});

export type AuthResult = z.infer<typeof AuthResultSchema>;

// Webhook event types
export const WebhookEventSchema = z.object({
  id: z.string().uuid().optional(),
  platform: PlatformSchema,
  shopId: z.string(),
  eventType: z.string(),
  payload: z.record(z.any()),
  signature: z.string().optional(),
  verified: z.boolean(),
  processedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime().optional(),
});

export type WebhookEvent = z.infer<typeof WebhookEventSchema>;

// Threshold configuration
export const ThresholdSchema = z.object({
  id: z.string().uuid().optional(),
  platform: PlatformSchema,
  shopId: z.string(),
  variantExternalId: z.string(),
  locationExternalId: z.string(),
  threshold: z.number().int().min(0),
  hysteresis: z.number().int().min(1).default(1),
  isActive: z.boolean().default(true),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type Threshold = z.infer<typeof ThresholdSchema>;

// RepOrder notification payload
export const RepOrderNotificationSchema = z.object({
  type: z.enum(['OOS_OPENED', 'OOS_RESOLVED']),
  platform: PlatformSchema,
  shop: z.string(),
  variantId: z.string(),
  qty: z.number().int().min(0),
  threshold: z.number().int().min(0),
  incidentId: z.string(),
  observedAt: z.string().datetime(),
  metadata: z.record(z.any()).optional(),
});

export type RepOrderNotification = z.infer<typeof RepOrderNotificationSchema>;
