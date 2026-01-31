# Android Emulator Setup for BlueBridge

**Last Updated**: 2026-01-24

## Overview

This guide covers connecting the Android emulator to BlueBridge Relay running on a Mac via Tailscale, using the development PC as a proxy.

## Architecture

```
Android Emulator → 10.0.2.2:5067 → PC (Windows) → 100.103.236.107:5067 → Mac (BlueBridge Relay)
```

The emulator uses the special address `10.0.2.2` to reach the host PC, which forwards traffic through Tailscale to the Mac.

---

## Setup

### Prerequisites

- ✅ Tailscale installed and running on PC
- ✅ Tailscale installed and running on Mac
- ✅ Both devices logged into same Tailscale account
- ✅ Mac Tailscale IP: `100.103.236.107`
- ✅ BlueBridge Relay running on Mac

### Step 1: Set Up Port Forwarding on PC

Run these commands in **PowerShell as Administrator**:

```powershell
# Forward HTTP port (5067)
netsh interface portproxy add v4tov4 listenport=5067 listenaddress=0.0.0.0 connectport=5067 connectaddress=100.103.236.107

# Forward HTTPS port (7090) - optional, if using HTTPS
netsh interface portproxy add v4tov4 listenport=7090 listenaddress=0.0.0.0 connectport=7090 connectaddress=100.103.236.107
```

### Step 2: Verify Port Forwarding

```powershell
# Check forwarding rules
netsh interface portproxy show all

# Should show:
# Listen on ipv4:             Connect to ipv4:
# Address         Port        Address         Port
# --------------- ----------  --------------- ----------
# 0.0.0.0         5067        100.103.236.107 5067
# 0.0.0.0         7090        100.103.236.107 7090
```

### Step 3: Test Connection from PC

```bash
# Test direct connection to Mac
curl http://100.103.236.107:5067/api/health

# Test forwarded connection (what emulator will use)
curl http://localhost:5067/api/health
```

Both should return the same health check response.

### Step 4: Configure Windows Firewall

Allow incoming connections on the forwarded ports:

```powershell
# Allow port 5067
netsh advfirewall firewall add rule name="BlueBridge Relay HTTP" dir=in action=allow protocol=TCP localport=5067

# Allow port 7090 (if using HTTPS)
netsh advfirewall firewall add rule name="BlueBridge Relay HTTPS" dir=in action=allow protocol=TCP localport=7090
```

---

## Android App Configuration

### For Emulator Development

Use `10.0.2.2` to connect to your PC (which forwards to Mac):

```kotlin
// src/main/java/com/yourapp/config/NetworkConfig.kt
object NetworkConfig {
    // For emulator: 10.0.2.2 routes to host PC
    // PC forwards to Mac via Tailscale (100.103.236.107)
    private const val EMULATOR_HOST = "10.0.2.2"

    // For production: Use Mac's Tailscale IP directly
    private const val PRODUCTION_HOST = "100.103.236.107"

    // Auto-detect if running in emulator
    val baseUrl: String = if (Build.FINGERPRINT.contains("generic")) {
        "http://$EMULATOR_HOST:5067"
    } else {
        "http://$PRODUCTION_HOST:5067"
    }

    val hubUrl: String = "$baseUrl/hubs/messages"
}
```

### SignalR Connection

```kotlin
import com.microsoft.signalr.HubConnection
import com.microsoft.signalr.HubConnectionBuilder

class BlueBridgeService {
    private var hubConnection: HubConnection? = null

    fun connect() {
        val hubUrl = NetworkConfig.hubUrl // Uses 10.0.2.2 in emulator

        hubConnection = HubConnectionBuilder.create(hubUrl)
            .build()

        hubConnection?.on("ReceiveMessage", { message: IncomingMessage ->
            // Handle incoming iMessage
            Log.d("BlueBridge", "Received: ${message.text}")
        }, IncomingMessage::class.java)

        hubConnection?.start()?.blockingAwait()
        Log.d("BlueBridge", "Connected to BlueBridge Relay")
    }
}
```

### REST API Calls

```kotlin
suspend fun sendMessage(phoneNumber: String, message: String) {
    val client = OkHttpClient()
    val url = "${NetworkConfig.baseUrl}/api/messages/send"

    val json = JSONObject().apply {
        put("phoneNumber", phoneNumber)
        put("message", message)
    }

    val body = json.toString()
        .toRequestBody("application/json".toMediaType())

    val request = Request.Builder()
        .url(url)
        .post(body)
        .addHeader("BB-API-Key", "your-api-key") // If using API keys
        .build()

    val response = client.newCall(request).execute()
    Log.d("BlueBridge", "Response: ${response.body?.string()}")
}
```

---

## Testing

### 1. Test from PC Browser

Visit: `http://localhost:5067/api/health`

Should return health check JSON.

### 2. Test from Emulator Browser

1. Open Chrome in Android emulator
2. Visit: `http://10.0.2.2:5067/api/health`
3. Should return same health check JSON

### 3. Test SignalR Connection

Run your Android app in the emulator and check Logcat for:
```
BlueBridge: Connected to BlueBridge Relay
```

---

## Managing Port Forwarding

### View Current Rules

```powershell
netsh interface portproxy show all
```

### Remove Specific Rule

```powershell
# Remove HTTP forwarding
netsh interface portproxy delete v4tov4 listenport=5067 listenaddress=0.0.0.0

# Remove HTTPS forwarding
netsh interface portproxy delete v4tov4 listenport=7090 listenaddress=0.0.0.0
```

### Remove All Rules

```powershell
netsh interface portproxy reset
```

### Persistence

**Good news**: These port forwarding rules persist across PC reboots automatically. You don't need to recreate them each time.

---

## Troubleshooting

### Can't Connect from Emulator

1. **Verify Tailscale connection**:
   ```bash
   tailscale status
   ```
   Ensure Mac shows as "active" and IP is `100.103.236.107`

2. **Test PC → Mac connection**:
   ```bash
   curl http://100.103.236.107:5067/api/health
   ```

3. **Test PC localhost forwarding**:
   ```bash
   curl http://localhost:5067/api/health
   ```

4. **Check port forwarding rules**:
   ```powershell
   netsh interface portproxy show all
   ```

5. **Check Windows Firewall**:
   ```powershell
   netsh advfirewall firewall show rule name="BlueBridge Relay HTTP"
   ```

6. **Test from emulator browser**:
   - Open Chrome in emulator
   - Visit `http://10.0.2.2:5067/api/health`

### Connection Refused

- Verify BlueBridge Relay is running on Mac
- Check Mac's firewall allows port 5067
- Verify Mac Tailscale IP hasn't changed: `tailscale ip -4`

### SignalR Connection Fails

Enable verbose logging:

```kotlin
val hubConnection = HubConnectionBuilder.create(hubUrl)
    .withHandshakeResponseTimeout(30000)
    .configureLogging(LogLevel.INFORMATION)
    .build()
```

Check Logcat for connection errors.

### Port Already in Use

If port 5067 is already in use on your PC:

```powershell
# Find what's using the port
netstat -ano | findstr :5067

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

---

## Switching Between Mac IPs

If your Mac's Tailscale IP changes, update the forwarding rule:

```powershell
# Remove old rule
netsh interface portproxy delete v4tov4 listenport=5067 listenaddress=0.0.0.0

# Add new rule with updated IP
netsh interface portproxy add v4tov4 listenport=5067 listenaddress=0.0.0.0 connectport=5067 connectaddress=NEW_MAC_IP
```

---

## For Production (Real Android Device)

When deploying to a real Android device:

1. Install Tailscale app on Android device
2. Login to same Tailscale account
3. Update `NetworkConfig.kt` to use production mode:

```kotlin
object NetworkConfig {
    // Real device can connect directly via Tailscale
    private const val MAC_TAILSCALE_IP = "100.103.236.107"

    val baseUrl = "http://$MAC_TAILSCALE_IP:5067"
    val hubUrl = "$baseUrl/hubs/messages"
}
```

No port forwarding needed - direct Tailscale connection!

---

## Summary

- ✅ **Emulator** uses `10.0.2.2:5067` → PC forwards → Mac Tailscale IP
- ✅ **Port forwarding** persists across PC reboots
- ✅ **No Tailscale** needed in emulator (uses PC's connection)
- ✅ **Production devices** connect directly via Tailscale

---

**Questions?** See [ANDROID_CLIENT.md](ANDROID_CLIENT.md) for production setup or [CLAUDE.md](../CLAUDE.md) for server-side configuration.
