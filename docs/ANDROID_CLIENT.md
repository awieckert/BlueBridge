# Android Client Setup for BlueBridge Relay

**Last Updated**: 2026-01-03

## Overview

This guide covers setting up an Android device to connect to BlueBridge Relay running on your Mac, enabling you to send and receive iMessages from your Android device.

---

## Remote Connection: Tailscale (Recommended for Android)

### Why Tailscale is Perfect for Android

✅ **Native Android App** - Official Tailscale app in Google Play Store
✅ **Battery Efficient** - Uses modern WireGuard protocol
✅ **Always Connected** - Maintains connection in background
✅ **Free** - Personal use (unlimited devices)
✅ **Works Anywhere** - Cellular data, WiFi, switching networks seamlessly
✅ **No Port Forwarding** - Works behind any firewall/NAT
✅ **Zero Config** - Automatic mesh networking between Mac and Android

### Setup (5 Minutes)

#### Step 1: Install Tailscale on Mac

```bash
# Install Tailscale
brew install tailscale

# Start and authenticate
sudo tailscale up

# Get your Mac's Tailscale IP
tailscale ip -4
# Example output: 100.64.0.1
```

#### Step 2: Install Tailscale on Android

1. Open **Google Play Store**
2. Search for **"Tailscale"**
3. Install the official Tailscale app
4. Open app and tap **"Sign in"**
5. Login with **same account** as your Mac
6. Accept permissions (VPN profile required)
7. Toggle connection to **ON**

#### Step 3: Verify Connection

**On Android**, open Tailscale app:
- You should see your Mac listed
- Note your Mac's IP (e.g., `100.64.0.1`)
- Both devices show as "Connected"

**Test from Android**:
```bash
# Using Termux or browser
curl http://100.64.0.1:5067/api/health

# Or visit in browser
http://100.64.0.1:5067/api/health
```

#### Step 4: Configure Android App

Your Android app will connect to Mac's Tailscale IP:

**Kotlin/Java (SignalR)**:
```kotlin
import com.microsoft.signalr.HubConnection
import com.microsoft.signalr.HubConnectionBuilder

// Mac's Tailscale IP (find in Tailscale app)
val macTailscaleIp = "100.64.0.1"
val hubUrl = "http://$macTailscaleIp:5067/hubs/messages"

// Create SignalR connection
val hubConnection = HubConnectionBuilder.create(hubUrl)
    .build()

// Listen for incoming messages
hubConnection.on("ReceiveMessage", { message ->
    // Handle incoming iMessage
    Log.d("BlueBridge", "New iMessage: $message")
}, IncomingMessage::class.java)

// Start connection
hubConnection.start().blockingAwait()
```

**With HTTPS** (recommended):
```kotlin
val hubUrl = "https://$macTailscaleIp:7090/hubs/messages"

val hubConnection = HubConnectionBuilder.create(hubUrl)
    // Trust self-signed certificate (development only)
    .withHttpClientBuilder { builder ->
        builder.hostnameVerifier { _, _ -> true }
        // Add SSL context for self-signed cert
    }
    .build()
```

**With API Key**:
```kotlin
val apiKey = "your-api-key-here"
val hubUrl = "http://$macTailscaleIp:5067/hubs/messages?access_token=$apiKey"

val hubConnection = HubConnectionBuilder.create(hubUrl)
    .build()
```

#### Step 5: Send Messages via REST API

```kotlin
import okhttp3.OkHttpClient
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

suspend fun sendMessage(phoneNumber: String, message: String) {
    val client = OkHttpClient()
    val macIp = "100.64.0.1"
    val url = "http://$macIp:5067/api/messages/send"

    val json = JSONObject().apply {
        put("phoneNumber", phoneNumber)
        put("message", message)
    }

    val body = json.toString()
        .toRequestBody("application/json".toMediaType())

    val request = Request.Builder()
        .url(url)
        .post(body)
        // Add API key if enabled
        .addHeader("BB-API-Key", "your-api-key")
        .build()

    val response = client.newCall(request).execute()
    val result = response.body?.string()

    Log.d("BlueBridge", "Send result: $result")
}
```

### Tailscale Features for Android

**Auto-reconnect**: Automatically reconnects when switching between WiFi/cellular

**Exit Nodes**: Route all traffic through Mac if needed (VPN mode)

**MagicDNS**: Access Mac by name instead of IP:
```kotlin
// Instead of IP
val hubUrl = "http://YOUR-MAC-NAME:5067/hubs/messages"
```

**Split Tunneling**: Only BlueBridge traffic goes through VPN

**Battery Optimization**: Tailscale uses minimal battery (WireGuard is very efficient)

---

## Alternative: Without Tailscale (Same Network Only)

If on **same WiFi network** as Mac:

```kotlin
// Mac's local IP (from ifconfig on Mac)
val macLocalIp = "192.168.1.50"
val hubUrl = "http://$macLocalIp:5067/hubs/messages"

val hubConnection = HubConnectionBuilder.create(hubUrl).build()
```

**Limitations**:
- Only works on same WiFi network
- Breaks when you leave home
- Mac IP might change (DHCP)

---

## Android SignalR Library Setup

### Gradle Dependencies

Add to your `build.gradle.kts` (app level):

```kotlin
dependencies {
    // SignalR for Android
    implementation("com.microsoft.signalr:signalr:8.0.0")

    // OkHttp for HTTP requests
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    // Gson for JSON parsing
    implementation("com.google.code.gson:gson:2.10.1")

    // Coroutines for async operations
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
}
```

### Permissions

Add to `AndroidManifest.xml`:

```xml
<manifest>
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <!-- Optional: For Tailscale VPN -->
    <!-- Tailscale app handles VPN permission -->

    <application>
        <!-- Your app content -->
    </application>
</manifest>
```

---

## Complete Android Example

### Repository Pattern

**Data Models**:
```kotlin
// src/main/java/com/example/bluebridge/models/IncomingMessage.kt
data class IncomingMessage(
    val messageId: Long,
    val text: String,
    val timestamp: String,
    val sender: String,
    val conversationId: String
)

data class SendMessageRequest(
    val phoneNumber: String,
    val message: String
)

data class SendMessageResponse(
    val success: Boolean,
    val messageId: String?,
    val timestamp: String?,
    val error: String?
)
```

**BlueBridge Service**:
```kotlin
// src/main/java/com/example/bluebridge/service/BlueBridgeService.kt
import android.util.Log
import com.microsoft.signalr.HubConnection
import com.microsoft.signalr.HubConnectionBuilder
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow

class BlueBridgeService {
    private val TAG = "BlueBridgeService"

    // Mac's Tailscale IP (get from Tailscale app)
    private val macIp = "100.64.0.1"
    private val apiKey = "your-api-key-here" // Optional

    private var hubConnection: HubConnection? = null

    // Flow for incoming messages
    private val _incomingMessages = MutableSharedFlow<IncomingMessage>()
    val incomingMessages = _incomingMessages.asSharedFlow()

    // Initialize SignalR connection
    fun connect() {
        val hubUrl = "http://$macIp:5067/hubs/messages?access_token=$apiKey"

        hubConnection = HubConnectionBuilder.create(hubUrl)
            .build()

        // Listen for incoming messages
        hubConnection?.on("ReceiveMessage", { message: IncomingMessage ->
            Log.d(TAG, "Received message: ${message.text}")
            _incomingMessages.tryEmit(message)
        }, IncomingMessage::class.java)

        // Listen for queued messages
        hubConnection?.on("ReceiveQueuedMessages", { messages: List<IncomingMessage> ->
            Log.d(TAG, "Received ${messages.size} queued messages")
            messages.forEach { _incomingMessages.tryEmit(it) }
        }, List::class.java, IncomingMessage::class.java)

        // Start connection
        try {
            hubConnection?.start()?.blockingAwait()
            Log.d(TAG, "Connected to BlueBridge Relay")
        } catch (e: Exception) {
            Log.e(TAG, "Connection failed: ${e.message}")
        }
    }

    // Send message via REST API
    suspend fun sendMessage(phoneNumber: String, message: String): SendMessageResponse? {
        val client = OkHttpClient()
        val url = "http://$macIp:5067/api/messages/send"

        val json = JSONObject().apply {
            put("phoneNumber", phoneNumber)
            put("message", message)
        }

        val body = json.toString()
            .toRequestBody("application/json".toMediaType())

        val request = Request.Builder()
            .url(url)
            .post(body)
            .addHeader("BB-API-Key", apiKey)
            .build()

        return try {
            val response = client.newCall(request).execute()
            val responseBody = response.body?.string()
            Gson().fromJson(responseBody, SendMessageResponse::class.java)
        } catch (e: Exception) {
            Log.e(TAG, "Send failed: ${e.message}")
            null
        }
    }

    // Disconnect
    fun disconnect() {
        hubConnection?.stop()
        Log.d(TAG, "Disconnected from BlueBridge Relay")
    }
}
```

**ViewModel**:
```kotlin
// src/main/java/com/example/bluebridge/viewmodel/MessagingViewModel.kt
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.launch

class MessagingViewModel : ViewModel() {
    private val blueBridgeService = BlueBridgeService()

    val incomingMessages = blueBridgeService.incomingMessages

    init {
        blueBridgeService.connect()
    }

    fun sendMessage(phoneNumber: String, message: String) {
        viewModelScope.launch {
            val result = blueBridgeService.sendMessage(phoneNumber, message)
            if (result?.success == true) {
                Log.d("ViewModel", "Message sent successfully")
            } else {
                Log.e("ViewModel", "Failed to send: ${result?.error}")
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        blueBridgeService.disconnect()
    }
}
```

**Composable UI** (Jetpack Compose):
```kotlin
// src/main/java/com/example/bluebridge/ui/MessagingScreen.kt
@Composable
fun MessagingScreen(viewModel: MessagingViewModel = viewModel()) {
    var phoneNumber by remember { mutableStateOf("") }
    var messageText by remember { mutableStateOf("") }
    val messages = viewModel.incomingMessages.collectAsState(initial = null)

    Column(modifier = Modifier.padding(16.dp)) {
        // Send message UI
        OutlinedTextField(
            value = phoneNumber,
            onValueChange = { phoneNumber = it },
            label = { Text("Phone Number") },
            modifier = Modifier.fillMaxWidth()
        )

        OutlinedTextField(
            value = messageText,
            onValueChange = { messageText = it },
            label = { Text("Message") },
            modifier = Modifier.fillMaxWidth()
        )

        Button(
            onClick = {
                viewModel.sendMessage(phoneNumber, messageText)
                messageText = ""
            },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Send via iMessage")
        }

        // Display incoming messages
        messages.value?.let { msg ->
            Card(modifier = Modifier.padding(top = 16.dp)) {
                Column(modifier = Modifier.padding(8.dp)) {
                    Text("From: ${msg.sender}", fontWeight = FontWeight.Bold)
                    Text(msg.text)
                    Text(msg.timestamp, fontSize = 12.sp)
                }
            }
        }
    }
}
```

---

## Android Background Service

To keep connection alive in background:

```kotlin
// src/main/java/com/example/bluebridge/service/BlueBridgeForegroundService.kt
import android.app.Service
import android.content.Intent
import android.os.IBinder

class BlueBridgeForegroundService : Service() {
    private lateinit var blueBridgeService: BlueBridgeService

    override fun onCreate() {
        super.onCreate()

        // Create notification channel
        val notification = createNotification()
        startForeground(1, notification)

        // Connect to relay
        blueBridgeService = BlueBridgeService()
        blueBridgeService.connect()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        blueBridgeService.disconnect()
        super.onDestroy()
    }
}
```

---

## Troubleshooting Android

### Can't Connect to Mac

1. **Check Tailscale**:
   - Open Tailscale app
   - Verify both devices show "Connected"
   - Note Mac's IP address

2. **Test in Browser**:
   - Open Chrome on Android
   - Visit `http://MAC_TAILSCALE_IP:5067/api/health`
   - Should show JSON response

3. **Check Mac Firewall**:
   - Mac must allow incoming on port 5067/7090
   - See CLAUDE.md for firewall setup

### SignalR Connection Fails

```kotlin
// Enable logging
import com.microsoft.signalr.HubConnectionBuilder
import com.microsoft.signalr.LogLevel

val hubConnection = HubConnectionBuilder.create(hubUrl)
    .withHandshakeResponseTimeout(30000) // 30 seconds
    .configureLogging(LogLevel.INFORMATION)
    .build()
```

**Check logs** in Android Studio Logcat:
```
Tag: SignalR
Filter: Error
```

### SSL Certificate Issues (HTTPS)

For self-signed certificates in development:

```kotlin
import java.security.SecureRandom
import java.security.cert.X509Certificate
import javax.net.ssl.*

// DO NOT USE IN PRODUCTION
val trustAllCerts = arrayOf<TrustManager>(
    object : X509TrustManager {
        override fun checkClientTrusted(chain: Array<X509Certificate>, authType: String) {}
        override fun checkServerTrusted(chain: Array<X509Certificate>, authType: String) {}
        override fun getAcceptedIssuers(): Array<X509Certificate> = arrayOf()
    }
)

val sslContext = SSLContext.getInstance("TLS").apply {
    init(null, trustAllCerts, SecureRandom())
}

val hubConnection = HubConnectionBuilder.create(hubUrl)
    .withHttpClientBuilder { builder ->
        builder.sslSocketFactory(
            sslContext.socketFactory,
            trustAllCerts[0] as X509TrustManager
        )
        builder.hostnameVerifier { _, _ -> true }
    }
    .build()
```

**Production**: Install certificate properly or use trusted CA cert

---

## Battery Optimization

Android may kill background connections. To prevent:

1. **Request Battery Optimization Exemption**:
```kotlin
val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
intent.data = Uri.parse("package:${packageName}")
startActivity(intent)
```

2. **Use Foreground Service** (shown above)

3. **WorkManager for Reconnection**:
```kotlin
val reconnectWork = PeriodicWorkRequestBuilder<ReconnectWorker>(
    15, TimeUnit.MINUTES
).build()

WorkManager.getInstance(context)
    .enqueue(reconnectWork)
```

---

## Network Change Handling

Reconnect when switching WiFi/cellular:

```kotlin
class NetworkCallback : ConnectivityManager.NetworkCallback() {
    override fun onAvailable(network: Network) {
        // Reconnect SignalR
        blueBridgeService.reconnect()
    }
}

val connectivityManager = getSystemService(ConnectivityManager::class.java)
connectivityManager.registerDefaultNetworkCallback(networkCallback)
```

---

## Summary: Android + Tailscale Setup

**Total Setup Time**: ~10 minutes

1. ✅ Install Tailscale on Mac: `brew install tailscale && sudo tailscale up`
2. ✅ Install Tailscale app on Android from Play Store
3. ✅ Login to same account on both
4. ✅ Note Mac's Tailscale IP in app
5. ✅ Use IP in Android app: `http://100.64.0.1:5067`
6. ✅ Works anywhere - home WiFi, cellular, coffee shop, etc.

**No need for**:
- ❌ Port forwarding
- ❌ Router configuration
- ❌ Dynamic DNS
- ❌ Firewall rules (beyond Mac local)
- ❌ Static IP addresses

**Android app can**:
- ✅ Send iMessages via REST API
- ✅ Receive iMessages via SignalR
- ✅ Work from anywhere with internet
- ✅ Switch networks seamlessly
- ✅ Maintain persistent connection

---

## Next Steps

1. **Setup Tailscale** (5 minutes)
2. **Test with cURL** in Android browser
3. **Add SignalR dependency** to your Android project
4. **Implement BlueBridgeService** (copy code above)
5. **Build your UI** for sending/receiving messages
6. **Test end-to-end** (Android → Mac → iMessage)

For more Android development resources:
- [Microsoft SignalR Android Docs](https://learn.microsoft.com/en-us/aspnet/core/signalr/java-client)
- [Tailscale Android Setup](https://tailscale.com/kb/1080/cli/#using-tailscale-on-android)
- [OkHttp Documentation](https://square.github.io/okhttp/)

---

**Questions?** See [CLAUDE.md](../CLAUDE.md) for server-side troubleshooting and [REMOTE_ACCESS.md](REMOTE_ACCESS.md) for alternative connection methods.
