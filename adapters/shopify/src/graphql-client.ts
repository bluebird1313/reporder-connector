import { HttpClient, Logger } from '../../shared/utils.js';
import { AdapterError, RateLimitError } from '../../../core/adapters.js';

export class ShopifyGraphQLClient {
  private logger: Logger;

  constructor() {
    this.logger = new Logger({ platform: 'shopify', component: 'graphql' });
  }

  createClient(shopDomain: string, accessToken: string): ShopifyGraphQLClient {
    const client = new ShopifyGraphQLClient();
    client.shopDomain = shopDomain;
    client.accessToken = accessToken;
    client.httpClient = new HttpClient(
      `https://${shopDomain}/admin/api/2023-10`,
      {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      }
    );
    return client;
  }

  private shopDomain!: string;
  private accessToken!: string;
  private httpClient!: HttpClient;

  async query<T = any>(query: string, variables?: any): Promise<T> {
    const logger = this.logger.child({ 
      shopDomain: this.shopDomain,
      queryName: this.extractQueryName(query)
    });

    try {
      logger.debug('Executing GraphQL query');

      const response = await this.httpClient.post('/graphql.json', {
        query: query.trim(),
        variables: variables || {}
      }, {
        platform: 'shopify'
      });

      // Handle GraphQL errors
      if (response.errors && response.errors.length > 0) {
        const error = response.errors[0];
        logger.error('GraphQL query failed', undefined, { error });
        
        throw new AdapterError(
          `GraphQL error: ${error.message}`,
          'shopify',
          'GRAPHQL_ERROR',
          undefined
        );
      }

      // Handle rate limiting
      if (response.extensions?.cost) {
        const { requestedQueryCost, actualQueryCost, throttleStatus } = response.extensions.cost;
        
        logger.debug('GraphQL cost information', {
          requestedQueryCost,
          actualQueryCost,
          throttleStatus
        });

        // Check if we're being throttled
        if (throttleStatus?.maximumAvailable !== undefined && 
            throttleStatus.currentlyAvailable !== undefined &&
            throttleStatus.currentlyAvailable < requestedQueryCost) {
          
          const retryAfter = Math.ceil(
            (requestedQueryCost - throttleStatus.currentlyAvailable) / 
            throttleStatus.restoreRate
          );
          
          throw new RateLimitError('shopify', retryAfter);
        }
      }

      logger.debug('GraphQL query successful');
      return response.data;

    } catch (error) {
      if (error instanceof RateLimitError || error instanceof AdapterError) {
        throw error;
      }

      logger.error('GraphQL request failed', error as Error);
      throw new AdapterError(
        'GraphQL request failed',
        'shopify',
        'GRAPHQL_REQUEST_ERROR',
        undefined,
        error as Error
      );
    }
  }

  async mutation<T = any>(mutation: string, variables?: any): Promise<T> {
    return this.query<T>(mutation, variables);
  }

  // Bulk operations with automatic pagination
  async queryWithPagination<T = any>(
    query: string,
    variables: any,
    extractPath: string,
    maxItems?: number
  ): Promise<T[]> {
    const logger = this.logger.child({ 
      shopDomain: this.shopDomain,
      queryName: this.extractQueryName(query)
    });

    const allItems: T[] = [];
    let cursor: string | undefined;
    let hasNextPage = true;
    let fetchedCount = 0;

    while (hasNextPage && (!maxItems || fetchedCount < maxItems)) {
      const currentVariables = {
        ...variables,
        after: cursor
      };

      const result = await this.query(query, currentVariables);
      
      // Navigate to the data using the extract path
      const data = this.extractNestedData(result, extractPath);
      
      if (!data?.edges) {
        logger.warn('No edges found in paginated response', { extractPath });
        break;
      }

      const items = data.edges.map((edge: any) => edge.node);
      allItems.push(...items);
      fetchedCount += items.length;

      hasNextPage = data.pageInfo?.hasNextPage || false;
      cursor = data.pageInfo?.endCursor;

      logger.debug('Fetched page', {
        itemsInPage: items.length,
        totalItems: allItems.length,
        hasNextPage,
        cursor
      });
    }

    logger.info('Completed paginated query', {
      totalItems: allItems.length,
      pages: cursor ? 'multiple' : 1
    });

    return allItems;
  }

  // Get current shop information
  async getShopInfo(): Promise<any> {
    const query = `
      query getShop {
        shop {
          id
          name
          email
          domain
          myshopifyDomain
          plan {
            displayName
            partnerDevelopment
            shopifyPlus
          }
          features {
            avalaraAvatax
            branding
            captcha
            captchaExternalDomains
            cartRedirection
            dynamicCheckout
            eligibleForPayments
            eligibleForSubscriptions
            giftCards
            googleAnalytics
            internationalDomains
            internationalPriceOverrides
            legacySubscriptionGatewayEnabled
            liveChat
            multiLocation
            onboardingVisual
            reports
            sellsSubscriptions
            showMetrics
            storefront
            usingShopifyBalance
          }
          currencyCode
          currencyFormats {
            moneyFormat
            moneyInEmailsFormat
            moneyWithCurrencyFormat
            moneyWithCurrencyInEmailsFormat
          }
          primaryDomain {
            host
            sslEnabled
            url
          }
          createdAt
          updatedAt
        }
      }
    `;

    const result = await this.query(query);
    return result.shop;
  }

  // Check API limits and usage
  async checkApiLimits(): Promise<{
    restCallLimitCurrent: number;
    restCallLimitMax: number;
    graphqlCallLimitCurrent: number;
    graphqlCallLimitMax: number;
  }> {
    // This information is typically available in response headers
    // For GraphQL, we can make a simple query to check cost limits
    const query = `
      query checkLimits {
        shop {
          id
        }
      }
    `;

    const response = await this.httpClient.post('/graphql.json', {
      query: query.trim()
    }, {
      platform: 'shopify'
    });

    const cost = response.extensions?.cost;
    
    return {
      restCallLimitCurrent: 0, // Would need to track from headers
      restCallLimitMax: 40,
      graphqlCallLimitCurrent: cost?.throttleStatus?.currentlyAvailable || 0,
      graphqlCallLimitMax: cost?.throttleStatus?.maximumAvailable || 1000
    };
  }

  private extractQueryName(query: string): string {
    const match = query.match(/(?:query|mutation)\s+(\w+)/);
    return match ? match[1] : 'unknown';
  }

  private extractNestedData(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
}

// Helper for creating typed GraphQL queries
export class ShopifyQueryBuilder {
  static products(options: {
    first?: number;
    after?: string;
    query?: string;
    includeVariants?: boolean;
    includeInventory?: boolean;
  } = {}) {
    const {
      first = 50,
      after,
      query,
      includeVariants = false,
      includeInventory = false
    } = options;

    let variantsField = '';
    if (includeVariants) {
      variantsField = `
        variants(first: 100) {
          edges {
            node {
              id
              title
              sku
              barcode
              price
              inventoryManagement
              inventoryPolicy
              ${includeInventory ? `
                inventoryItem {
                  id
                  inventoryLevels(first: 50) {
                    edges {
                      node {
                        available
                        location {
                          id
                          name
                        }
                        updatedAt
                      }
                    }
                  }
                }
              ` : ''}
              createdAt
              updatedAt
            }
          }
        }
      `;
    }

    return {
      query: `
        query getProducts($first: Int!, $after: String, $query: String) {
          products(first: $first, after: $after, query: $query) {
            edges {
              node {
                id
                title
                handle
                description
                vendor
                productType
                status
                ${variantsField}
                createdAt
                updatedAt
              }
            }
            pageInfo {
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
          }
        }
      `,
      variables: {
        first,
        after,
        query
      }
    };
  }

  static inventoryLevels(options: {
    inventoryItemIds?: string[];
    locationIds?: string[];
    first?: number;
    after?: string;
  } = {}) {
    const { inventoryItemIds, locationIds, first = 250, after } = options;

    return {
      query: `
        query getInventoryLevels($inventoryItemIds: [ID!], $locationIds: [ID!], $first: Int!, $after: String) {
          inventoryLevels(inventoryItemIds: $inventoryItemIds, locationIds: $locationIds, first: $first, after: $after) {
            edges {
              node {
                id
                available
                incoming
                committed
                onHand
                inventoryItem {
                  id
                  sku
                  variant {
                    id
                    title
                    product {
                      id
                      title
                    }
                  }
                }
                location {
                  id
                  name
                }
                updatedAt
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `,
      variables: {
        inventoryItemIds,
        locationIds,
        first,
        after
      }
    };
  }

  static locations(options: { first?: number; after?: string } = {}) {
    const { first = 50, after } = options;

    return {
      query: `
        query getLocations($first: Int!, $after: String) {
          locations(first: $first, after: $after) {
            edges {
              node {
                id
                name
                address {
                  formatted
                  address1
                  address2
                  city
                  province
                  country
                  zip
                }
                isActive
                shipsInventory
                fulfillsOnlineOrders
                createdAt
                updatedAt
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `,
      variables: {
        first,
        after
      }
    };
  }
}
