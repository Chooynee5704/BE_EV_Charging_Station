# Test script to cancel a reservation
# Usage: Replace RESERVATION_ID and JWT_TOKEN with actual values

$reservationId = "69081d3131e4c8a1b8d3a077"
$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGUyMmY3MGVlNTg3NzgwNjU2OGQ5MDgiLCJ1c2VybmFtZSI6Im1lb2hvbmduaHUiLCJyb2xlIjoidXNlciIsImlhdCI6MTc2MjEzOTMyNywiZXhwIjoxNzYyMjI1NzI3fQ.rS-c7dfx5q4ihT-cSQRYlc8ln3I4GROTfEU-UOSjzjM"

$url = "http://localhost:3000/reservations/$reservationId/cancel"
$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

Write-Host "Testing PATCH $url" -ForegroundColor Cyan
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri $url -Method Patch -Headers $headers -ErrorAction Stop
    Write-Host "Success!" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 10)
} catch {
    Write-Host "Error:" -ForegroundColor Red
    Write-Host $_.Exception.Message
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body:" -ForegroundColor Yellow
        Write-Host $responseBody
    }
}
