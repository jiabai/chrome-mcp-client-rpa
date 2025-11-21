# ===== Start-ChromeDriver.ps1 =====
# ChromeDriver Service Startup Script
# Default port: 9515
# IP binding configuration: use "127.0.0.1" for localhost only, "0.0.0.0" for all interfaces, or specific IP

$chromeDriverPath = "D:\Github\chrome-mcp-client-rpa\chromedriver\win64-142.0.7444.175\chromedriver-win64\chromedriver.exe"
$port = 9515
$allowedOrigins = "*"
$urlBase = "/"
$bindIp = "127.0.0.1"  # Default to localhost for security

Write-Host "Starting ChromeDriver..." -ForegroundColor Green
Write-Host "Path: $chromeDriverPath" -ForegroundColor Yellow
Write-Host "Port: $port" -ForegroundColor Yellow
Write-Host "Bind IP: $bindIp" -ForegroundColor Yellow
Write-Host "Allowed Origins: $allowedOrigins" -ForegroundColor Yellow

# Check if chromedriver exists
if (-not (Test-Path $chromeDriverPath)) {
    Write-Host "Error: ChromeDriver not found at: $chromeDriverPath" -ForegroundColor Red
    Write-Host "Please ensure ChromeDriver is properly installed" -ForegroundColor Red
    exit 1
}

# Start ChromeDriver
try {
    & $chromeDriverPath --port=$port --allowed-origins=$allowedOrigins --url-base=$urlBase --whitelisted-ips=$bindIp
} catch {
    Write-Host "ChromeDriver startup interrupted (this is normal when service is running)" -ForegroundColor Yellow
}

<#
IP Binding Configuration:
- 127.0.0.1 (default): Only accepts connections from localhost (most secure)
- 0.0.0.0: Accepts connections from any IP address (use with caution)
- Specific IP: Replace with your machine's IP address to bind to a specific interface

To change the binding IP, modify the $bindIp variable at the top of this script
#>