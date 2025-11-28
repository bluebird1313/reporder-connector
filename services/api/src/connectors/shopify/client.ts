import logger from '../../lib/logger'

// ============================================
// Shopify GraphQL Client
// ============================================

export async function shopifyGraphQL(shopDomain: string, accessToken: string, query: string, variables: any = {}) {
  const url = `https://${shopDomain}/admin/api/2024-10/graphql.json`
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({ query, variables }),
    })

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.status} ${response.statusText}`)
    }

    const data: any = await response.json()
    
    if (data.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors, null, 2)}`)
    }

    return data.data
  } catch (error) {
    logger.error('GraphQL Request Failed', { shop: shopDomain, error })
    throw error
  }
}

// ============================================
// Queries
// ============================================

export const PRODUCTS_QUERY = `
  query getProducts($first: Int!, $cursor: String) {
    products(first: $first, after: $cursor) {
      edges {
        node {
          id
          title
          handle
          productType
          vendor
          status
          createdAt
          updatedAt
          variants(first: 20) {
            edges {
              node {
                id
                title
                sku
                barcode
                price
                inventoryItem {
                  id
                  tracked
                }
                createdAt
                updatedAt
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`

export const INVENTORY_LEVELS_QUERY = `
  query getInventoryLevels($inventoryItemId: ID!, $first: Int!) {
    inventoryItem(id: $inventoryItemId) {
      id
      inventoryLevels(first: $first) {
        edges {
          node {
            id
            quantities(names: "available") {
              name
              quantity
            }
            location {
              id
              name
            }
            updatedAt
          }
        }
      }
    }
  }
`

// Query to get all unique vendors (brands) in the store
export const VENDORS_QUERY = `
  query getVendors($first: Int!) {
    shop {
      name
    }
    productVendors(first: $first) {
      edges {
        node
      }
    }
  }
`

// Query products filtered by specific vendors
export const PRODUCTS_BY_VENDORS_QUERY = `
  query getProductsByVendors($first: Int!, $cursor: String, $query: String!) {
    products(first: $first, after: $cursor, query: $query) {
      edges {
        node {
          id
          title
          handle
          productType
          vendor
          status
          createdAt
          updatedAt
          variants(first: 20) {
            edges {
              node {
                id
                title
                sku
                barcode
                price
                inventoryItem {
                  id
                  tracked
                }
                createdAt
                updatedAt
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`



