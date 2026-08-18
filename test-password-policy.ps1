# Password Policy Enhancement Verification (Phase 3 Task 2)
# Tests new password requirements:
# - Minimum 12 characters
# - At least 1 uppercase
# - At least 1 lowercase  
# - At least 1 number
# - Maximum 128 characters

$baseUrl = "http://localhost:4000/api"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "PASSWORD POLICY VERIFICATION (TASK 2)" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

function Test-Registration {
    param(
        [string]$TestName,
        [string]$Email,
        [string]$Password,
        [int]$ExpectedStatus,
        [string]$ExpectedResult
    )
    
    $body = @{
        email = $Email
        password = $Password
    } | ConvertTo-Json
    
    try {
        $response = Invoke-WebRequest -Uri "$baseUrl/auth/register" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -ErrorAction Stop
        $json = $response.Content | ConvertFrom-Json
        Write-Host "  [$TestName]" -ForegroundColor Yellow
        Write-Host "    Password: $Password" -ForegroundColor Gray
        Write-Host "    Status: $($response.StatusCode)" -ForegroundColor Green
        Write-Host "    Result: $ExpectedResult" -ForegroundColor $(if ($response.StatusCode -eq $ExpectedStatus) { "Green" } else { "Red" })
        if ($json.message) {
            Write-Host "    Message: $($json.message)" -ForegroundColor Gray
        }
    }
    catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $responseBody = $reader.ReadToEnd()
        $reader.Close()
        $stream.Close()
        
        $json = $null
        try { $json = $responseBody | ConvertFrom-Json } catch {}
        
        Write-Host "  [$TestName]" -ForegroundColor Yellow
        Write-Host "    Password: $Password" -ForegroundColor Gray
        Write-Host "    Status: $statusCode" -ForegroundColor $(if ($statusCode -eq $ExpectedStatus) { "Green" } else { "Red" })
        Write-Host "    Result: $ExpectedResult" -ForegroundColor $(if ($statusCode -eq $ExpectedStatus) { "Green" } else { "Red" })
        if ($json -and $json.message) {
            Write-Host "    Message: $($json.message)" -ForegroundColor Gray
        }
    }
    Write-Host ""
}

# Test 1: Too short (11 characters)
Test-Registration -TestName "FAIL: Too short (11 chars)" `
    -Email "test1@example.com" `
    -Password "Password123" `
    -ExpectedStatus 400 `
    -ExpectedResult "Should reject (< 12 chars)"

# Test 2: No uppercase
Test-Registration -TestName "FAIL: No uppercase" `
    -Email "test2@example.com" `
    -Password "password1234" `
    -ExpectedStatus 400 `
    -ExpectedResult "Should reject (no uppercase)"

# Test 3: No lowercase
Test-Registration -TestName "FAIL: No lowercase" `
    -Email "test3@example.com" `
    -Password "PASSWORD1234" `
    -ExpectedStatus 400 `
    -ExpectedResult "Should reject (no lowercase)"

# Test 4: No number
Test-Registration -TestName "FAIL: No number" `
    -Email "test4@example.com" `
    -Password "PasswordAbcd" `
    -ExpectedStatus 400 `
    -ExpectedResult "Should reject (no number)"

# Test 5: Valid minimum (12 chars, all requirements)
Test-Registration -TestName "PASS: Valid minimum" `
    -Email "test5@example.com" `
    -Password "Password1234" `
    -ExpectedStatus 201 `
    -ExpectedResult "Should accept (12 chars, all requirements)"

# Test 6: Valid with special chars
Test-Registration -TestName "PASS: Valid with special chars" `
    -Email "test6@example.com" `
    -Password "P@ssw0rd1234!" `
    -ExpectedStatus 201 `
    -ExpectedResult "Should accept (special chars allowed)"

# Test 7: Valid longer password
Test-Registration -TestName "PASS: Valid longer password" `
    -Email "test7@example.com" `
    -Password "MySecurePassword123456" `
    -ExpectedStatus 201 `
    -ExpectedResult "Should accept (22 chars)"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "VERIFICATION COMPLETE" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Summary of Requirements:" -ForegroundColor White
Write-Host "  Minimum length: 12 characters" -ForegroundColor White
Write-Host "  Maximum length: 128 characters" -ForegroundColor White
Write-Host "  At least 1 uppercase letter (A-Z)" -ForegroundColor White
Write-Host "  At least 1 lowercase letter (a-z)" -ForegroundColor White
Write-Host "  At least 1 number (0-9)" -ForegroundColor White
Write-Host ""
