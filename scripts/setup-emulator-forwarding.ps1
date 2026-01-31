# BlueBridge Emulator Port Forwarding Setup
# Run this script as Administrator

$MacTailscaleIP = "100.103.236.107"
$HttpPort = 5067
$HttpsPort = 7090

Write-Host "Setting up port forwarding for BlueBridge Relay..." -ForegroundColor Cyan
Write-Host "Mac Tailscale IP: $MacTailscaleIP" -ForegroundColor Yellow

# Add HTTP port forwarding
Write-Host "`nAdding HTTP port forwarding (port $HttpPort)..." -ForegroundColor Green
netsh interface portproxy add v4tov4 listenport=$HttpPort listenaddress=0.0.0.0 connectport=$HttpPort connectaddress=$MacTailscaleIP

# Add HTTPS port forwarding (optional)
Write-Host "Adding HTTPS port forwarding (port $HttpsPort)..." -ForegroundColor Green
netsh interface portproxy add v4tov4 listenport=$HttpsPort listenaddress=0.0.0.0 connectport=$HttpsPort connectaddress=$MacTailscaleIP

# Configure Windows Firewall
Write-Host "`nConfiguring Windows Firewall..." -ForegroundColor Green
netsh advfirewall firewall add rule name="BlueBridge Relay HTTP" dir=in action=allow protocol=TCP localport=$HttpPort
netsh advfirewall firewall add rule name="BlueBridge Relay HTTPS" dir=in action=allow protocol=TCP localport=$HttpsPort

# Show current rules
Write-Host "`nCurrent port forwarding rules:" -ForegroundColor Cyan
netsh interface portproxy show all

# Test connection
Write-Host "`nTesting connection to Mac..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://${MacTailscaleIP}:${HttpPort}/api/health" -TimeoutSec 5
    Write-Host "✓ Direct connection to Mac successful!" -ForegroundColor Green
    Write-Host "Response: $($response.StatusCode)" -ForegroundColor Gray
} catch {
    Write-Host "✗ Failed to connect to Mac directly" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host "`nTesting forwarded connection..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:${HttpPort}/api/health" -TimeoutSec 5
    Write-Host "✓ Forwarded connection successful!" -ForegroundColor Green
    Write-Host "Response: $($response.StatusCode)" -ForegroundColor Gray
} catch {
    Write-Host "✗ Failed to connect via forwarding" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
}

Write-Host "`n" -NoNewline
Write-Host "Setup complete! " -ForegroundColor Green -NoNewline
Write-Host "Your Android emulator can now connect to: " -NoNewline
Write-Host "http://10.0.2.2:$HttpPort" -ForegroundColor Yellow

Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Test in emulator browser: http://10.0.2.2:$HttpPort/api/health"
Write-Host "2. Update your Android app to use: 10.0.2.2:$HttpPort"
Write-Host "3. See docs\EMULATOR_SETUP.md for full details"
