# BlueBridge Emulator Port Forwarding Removal
# Run this script as Administrator

$HttpPort = 5067
$HttpsPort = 7090

Write-Host "Removing port forwarding for BlueBridge Relay..." -ForegroundColor Cyan

# Show current rules
Write-Host "`nCurrent port forwarding rules:" -ForegroundColor Yellow
netsh interface portproxy show all

# Remove HTTP port forwarding
Write-Host "`nRemoving HTTP port forwarding (port $HttpPort)..." -ForegroundColor Green
netsh interface portproxy delete v4tov4 listenport=$HttpPort listenaddress=0.0.0.0

# Remove HTTPS port forwarding
Write-Host "Removing HTTPS port forwarding (port $HttpsPort)..." -ForegroundColor Green
netsh interface portproxy delete v4tov4 listenport=$HttpsPort listenaddress=0.0.0.0

# Remove firewall rules
Write-Host "`nRemoving Windows Firewall rules..." -ForegroundColor Green
netsh advfirewall firewall delete rule name="BlueBridge Relay HTTP"
netsh advfirewall firewall delete rule name="BlueBridge Relay HTTPS"

# Show updated rules
Write-Host "`nRemaining port forwarding rules:" -ForegroundColor Cyan
netsh interface portproxy show all

Write-Host "`nPort forwarding removed!" -ForegroundColor Green
