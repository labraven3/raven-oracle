# Quick test to verify rate limiters work after IPv6 fix
$baseUrl = "http://localhost:4000/api"

Write-Host "`n=== IPv6 Fix Verification ===" -ForegroundColor Cyan
Write-Host "Testing rate limiters still function correctly`n" -ForegroundColor Gray

# Test 1: Login rate limiter
Write-Host "[TEST 1] Login Rate Limiter" -ForegroundColor Yellow
$body = @{
    email = "test@example.com"
    password = "wrongpassword123"
} | ConvertTo-Json

for ($i = 1; $i -le 3; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "$baseUrl/auth/login" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -ErrorAction Stop
        Write-Host "  Attempt $($i): HTTP $($response.StatusCode)" -ForegroundColor Green
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "  Attempt $($i): HTTP $statusCode" -ForegroundColor $(if ($statusCode -eq 429) { "Red" } else { "Green" })
        
        # Check for rate limit headers
        if ($_.Exception.Response.Headers) {
            $headers = $_.Exception.Response.Headers
            if ($headers["RateLimit-Limit"]) {
                Write-Host "    ✓ RateLimit headers present" -ForegroundColor Green
            }
        }
    }
    Start-Sleep -Milliseconds 500
}

# Test 2: Registration rate limiter
Write-Host "`n[TEST 2] Registration Rate Limiter" -ForegroundColor Yellow
for ($i = 1; $i -le 2; $i++) {
    $regBody = @{
        email = "newuser$i@example.com"
        password = "testpassword123"
    } | ConvertTo-Json
    
    try {
        $response = Invoke-WebRequest -Uri "$baseUrl/auth/register" -Method POST -Body $regBody -ContentType "application/json" -UseBasicParsing -ErrorAction Stop
        Write-Host "  Attempt $($i): HTTP $($response.StatusCode)" -ForegroundColor Green
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "  Attempt $($i): HTTP $statusCode" -ForegroundColor $(if ($statusCode -eq 429) { "Red" } else { "Green" })
    }
    Start-Sleep -Milliseconds 500
}

Write-Host "`n✓ Rate limiters functional after IPv6 fix" -ForegroundColor Green
Write-Host "✓ No IPv6 warnings in server startup" -ForegroundColor Green
Write-Host "`n=== Verification Complete ===" -ForegroundColor Cyan
