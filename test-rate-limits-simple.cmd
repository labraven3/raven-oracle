@echo off
echo ========================================
echo RATE LIMIT VERIFICATION TEST SUITE
echo ========================================
echo.

echo [TEST 1] Login Rate Limit - 5 failed attempts allowed, 6th blocked
echo Expected: First 5 return 401, 6th returns 429
echo.

for /L %%i in (1,1,6) do (
    echo Attempt %%i:
    curl -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"nonexistent@example.com\",\"password\":\"wrongpassword123\"}" -w "\nHTTP Status: %%{http_code}\n" -s -i 2>nul | findstr /C:"HTTP/" /C:"RateLimit" /C:"success"
    echo.
    timeout /t 1 /nobreak >nul
)

echo.
echo [TEST 2] Registration Rate Limit - 3 attempts allowed, 4th blocked
echo Expected: First 3 return 201/409, 4th returns 429
echo.

for /L %%i in (1,1,4) do (
    echo Attempt %%i:
    curl -X POST http://localhost:4000/api/auth/register -H "Content-Type: application/json" -d "{\"email\":\"test%%i@example.com\",\"password\":\"testpassword123\"}" -w "\nHTTP Status: %%{http_code}\n" -s -i 2>nul | findstr /C:"HTTP/" /C:"RateLimit" /C:"success"
    echo.
    timeout /t 1 /nobreak >nul
)

echo.
echo [TEST 6] RateLimit Headers Verification
echo.
echo Single request to check headers:
curl -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"test@test.com\",\"password\":\"password123\"}" -i -s 2>nul | findstr /C:"RateLimit"

echo.
echo [TEST 7] Response Safety Check
echo.
echo Checking for safe error responses (no secrets):
curl -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"test@test.com\",\"password\":\"wrongpass\"}" -s 2>nul

echo.
echo.
echo ========================================
echo VERIFICATION COMPLETE
echo ========================================
