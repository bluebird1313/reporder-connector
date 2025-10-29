#!/bin/bash

# Shopify OAuth Testing Script
# This script helps you test the Shopify OAuth flow

set -e

echo "🧪 Shopify OAuth Flow Test Script"
echo "=================================="
echo ""

# Check if server is running
echo "📡 Checking if API server is running..."
if curl -s http://localhost:3004/health > /dev/null; then
    echo "✅ Server is running on port 3004"
else
    echo "❌ Server is not running!"
    echo "Please start the server with: cd services/api && npm run dev"
    exit 1
fi

echo ""

# Prompt for shop name
read -p "Enter your Shopify store name (without .myshopify.com): " SHOP_NAME

if [ -z "$SHOP_NAME" ]; then
    echo "❌ Shop name is required"
    exit 1
fi

echo ""
echo "🔗 Testing OAuth Flow..."
echo "========================"
echo ""

# Test 1: Auth endpoint
echo "1️⃣ Testing auth endpoint..."
AUTH_URL="http://localhost:3004/api/shopify/auth?shop=$SHOP_NAME"
echo "   URL: $AUTH_URL"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" "$AUTH_URL" 2>&1)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" -eq "302" ] || [ "$HTTP_CODE" -eq "301" ]; then
    echo "✅ Auth endpoint is working (redirect to Shopify)"
    echo "   HTTP Code: $HTTP_CODE"
    echo ""
    echo "🌐 Open this URL in your browser to complete OAuth:"
    echo "   $AUTH_URL"
else
    echo "⚠️  Unexpected response code: $HTTP_CODE"
    echo "   Response: $RESPONSE"
fi

echo ""

# Test 2: Verify endpoint (before connection)
echo "2️⃣ Testing verify endpoint (should show not connected)..."
VERIFY_URL="http://localhost:3004/api/shopify/verify?shop=$SHOP_NAME.myshopify.com"
echo "   URL: $VERIFY_URL"
echo ""

VERIFY_RESPONSE=$(curl -s "$VERIFY_URL")
echo "   Response: $VERIFY_RESPONSE"
echo ""

if echo "$VERIFY_RESPONSE" | grep -q '"connected":false'; then
    echo "✅ Verify endpoint working (not yet connected)"
elif echo "$VERIFY_RESPONSE" | grep -q '"connected":true'; then
    echo "✅ Store is already connected!"
else
    echo "⚠️  Unexpected verify response"
fi

echo ""
echo "📋 Next Steps:"
echo "=============="
echo ""
echo "1. Open the auth URL in your browser:"
echo "   $AUTH_URL"
echo ""
echo "2. Authorize the app in Shopify"
echo ""
echo "3. After authorization, verify the connection:"
echo "   curl $VERIFY_URL"
echo ""
echo "4. Check your Supabase dashboard to see the saved connection"
echo ""

# Optional: Open browser automatically (works on macOS, Linux with xdg-open, WSL)
if command -v open &> /dev/null; then
    read -p "Would you like to open the auth URL in your browser now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        open "$AUTH_URL"
    fi
elif command -v xdg-open &> /dev/null; then
    read -p "Would you like to open the auth URL in your browser now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        xdg-open "$AUTH_URL"
    fi
fi

echo ""
echo "✨ Testing complete!"

