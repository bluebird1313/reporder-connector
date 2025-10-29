# Shopify OAuth Testing Script for PowerShell
# Run this with: .\test-shopify-oauth.ps1

Write-Host "🧪 Shopify OAuth Flow Test Script" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Check if server is running
Write-Host "📡 Checking if API server is running..." -ForegroundColor Yellow
try {
    $healthCheck = Invoke-WebRequest -Uri "http://localhost:3004/health" -UseBasicParsing -ErrorAction Stop
    Write-Host "✅ Server is running on port 3004" -ForegroundColor Green
} catch {
    Write-Host "❌ Server is not running!" -ForegroundColor Red
    Write-Host "Please start the server with: cd services/api; npm run dev" -ForegroundColor Yellow
    exit 1
}

Write-Host ""

# Prompt for shop name
$shopName = Read-Host "Enter your Shopify store name (without .myshopify.com)"

if ([string]::IsNullOrWhiteSpace($shopName)) {
    Write-Host "❌ Shop name is required" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "🔗 Testing OAuth Flow..." -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Auth endpoint
Write-Host "1️⃣ Testing auth endpoint..." -ForegroundColor Yellow
$authUrl = "http://localhost:3004/api/shopify/auth?shop=$shopName"
Write-Host "   URL: $authUrl" -ForegroundColor Gray
Write-Host ""

try {
    $response = Invoke-WebRequest -Uri $authUrl -MaximumRedirection 0 -ErrorAction SilentlyContinue
    # A redirect (302/301) is expected
    Write-Host "✅ Auth endpoint is working (redirects to Shopify)" -ForegroundColor Green
    Write-Host "   HTTP Code: $($response.StatusCode)" -ForegroundColor Gray
} catch {
    if ($_.Exception.Response.StatusCode -eq 302 -or $_.Exception.Response.StatusCode -eq 301) {
        Write-Host "✅ Auth endpoint is working (redirect to Shopify)" -ForegroundColor Green
        Write-Host "   HTTP Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Gray
    } else {
        Write-Host "⚠️  Unexpected response: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "🌐 Open this URL in your browser to complete OAuth:" -ForegroundColor Cyan
Write-Host "   $authUrl" -ForegroundColor White
Write-Host ""

# Test 2: Verify endpoint (before connection)
Write-Host "2️⃣ Testing verify endpoint (checking connection status)..." -ForegroundColor Yellow
$verifyUrl = "http://localhost:3004/api/shopify/verify?shop=$shopName.myshopify.com"
Write-Host "   URL: $verifyUrl" -ForegroundColor Gray
Write-Host ""

try {
    $verifyResponse = Invoke-WebRequest -Uri $verifyUrl -UseBasicParsing
    $verifyData = $verifyResponse.Content | ConvertFrom-Json
    
    Write-Host "   Response:" -ForegroundColor Gray
    Write-Host "   $($verifyResponse.Content)" -ForegroundColor White
    Write-Host ""
    
    if ($verifyData.connected -eq $false) {
        Write-Host "✅ Verify endpoint working (not yet connected)" -ForegroundColor Green
    } elseif ($verifyData.connected -eq $true) {
        Write-Host "✅ Store is already connected!" -ForegroundColor Green
        Write-Host "   Status: $($verifyData.status)" -ForegroundColor Gray
        Write-Host "   Scopes: $($verifyData.scopes -join ', ')" -ForegroundColor Gray
    } else {
        Write-Host "⚠️  Unexpected verify response" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Error testing verify endpoint: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "==============" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Open the auth URL in your browser:" -ForegroundColor White
Write-Host "   $authUrl" -ForegroundColor Yellow
Write-Host ""
Write-Host "2. Authorize the app in Shopify" -ForegroundColor White
Write-Host ""
Write-Host "3. After authorization, verify the connection:" -ForegroundColor White
Write-Host "   Invoke-WebRequest '$verifyUrl' | ConvertFrom-Json" -ForegroundColor Yellow
Write-Host ""
Write-Host "4. Check your Supabase dashboard to see the saved connection" -ForegroundColor White
Write-Host ""

# Optional: Open browser automatically
$openBrowser = Read-Host "Would you like to open the auth URL in your browser now? (y/n)"
if ($openBrowser -eq 'y' -or $openBrowser -eq 'Y') {
    Start-Process $authUrl
    Write-Host "✅ Opening browser..." -ForegroundColor Green
}

Write-Host ""
Write-Host "✨ Testing complete!" -ForegroundColor Cyan

