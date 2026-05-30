package com.safeher.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Bundle
import android.os.Vibrator
import android.telephony.SmsManager
import android.webkit.GeolocationPermissions
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import android.media.MediaRecorder
import android.content.Intent
import android.content.ActivityNotFoundException
import androidx.core.content.FileProvider
import java.io.File
import android.os.Handler
import android.os.Looper
import org.json.JSONArray
import kotlin.math.sqrt

class MainActivity : AppCompatActivity(), SensorEventListener {

    private lateinit var webView: WebView
    private lateinit var sensorManager: SensorManager
    private var accelerometer: Sensor? = null

    // Shake detection state
    private var lastShakeTime: Long = 0
    private var shakeCount = 0
    private val SHAKE_THRESHOLD = 12f
    private val SHAKE_SLOP_TIME_MS = 500
    private val SHAKE_COUNT_RESET_TIME_MS = 3000
    private val SHAKES_TO_TRIGGER = 3

    companion object {
        private const val PERMISSION_REQUEST_CODE = 100
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        supportActionBar?.hide()

        webView = WebView(this)
        setContentView(webView)

        setupWebView()
        requestPermissions()
        setupShakeDetector()

        webView.loadUrl("file:///android_asset/index.html")
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val webSettings: WebSettings = webView.settings
        webSettings.javaScriptEnabled = true
        webSettings.domStorageEnabled = true
        webSettings.allowFileAccess = true
        webSettings.allowFileAccessFromFileURLs = true
        webSettings.allowUniversalAccessFromFileURLs = true
        webSettings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        webSettings.cacheMode = WebSettings.LOAD_NO_CACHE

        webView.clearCache(true)
        webView.webViewClient = WebViewClient()

        webView.webChromeClient = object : WebChromeClient() {
            override fun onGeolocationPermissionsShowPrompt(
                origin: String,
                callback: GeolocationPermissions.Callback
            ) {
                callback.invoke(origin, true, false)
            }
        }

        webView.addJavascriptInterface(AndroidSMSBridge(), "AndroidSMS")
        webView.addJavascriptInterface(AndroidShakeBridge(), "AndroidShake")
    }

    private fun setupShakeDetector() {
        sensorManager = getSystemService(Context.SENSOR_SERVICE) as SensorManager
        accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
        accelerometer?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_UI)
        }
    }

    override fun onResume() {
        super.onResume()
        accelerometer?.let {
            sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_UI)
        }
    }

    override fun onPause() {
        super.onPause()
        sensorManager.unregisterListener(this)
    }

    override fun onSensorChanged(event: SensorEvent?) {
        if (event?.sensor?.type != Sensor.TYPE_ACCELEROMETER) return

        val x = event.values[0]
        val y = event.values[1]
        val z = event.values[2]

        val gForce = sqrt((x * x + y * y + z * z).toDouble()).toFloat() / SensorManager.GRAVITY_EARTH

        if (gForce > SHAKE_THRESHOLD) {
            val now = System.currentTimeMillis()
            if (lastShakeTime + SHAKE_SLOP_TIME_MS > now) return

            if (lastShakeTime + SHAKE_COUNT_RESET_TIME_MS < now) {
                shakeCount = 0
            }

            lastShakeTime = now
            shakeCount++

            if (shakeCount >= SHAKES_TO_TRIGGER) {
                shakeCount = 0
                onShakeDetected()
            }
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    private fun onShakeDetected() {
        runOnUiThread {
            // Vibrate to confirm detection
            @Suppress("DEPRECATION")
            val vibrator = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                vibrator.vibrate(
                    android.os.VibrationEffect.createWaveform(
                        longArrayOf(0, 200, 100, 200, 100, 500), -1
                    )
                )
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(longArrayOf(0, 200, 100, 200, 100, 500), -1)
            }
            // Notify JS layer
            webView.evaluateJavascript("window.onShakeSOS && window.onShakeSOS()", null)
        }
    }

    private fun requestPermissions() {
        val permissionsToRequest = mutableListOf<String>()

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            permissionsToRequest.add(Manifest.permission.ACCESS_FINE_LOCATION)
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) {
            permissionsToRequest.add(Manifest.permission.SEND_SMS)
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            permissionsToRequest.add(Manifest.permission.RECORD_AUDIO)
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            permissionsToRequest.add(Manifest.permission.CAMERA)
        }

        if (permissionsToRequest.isNotEmpty()) {
            ActivityCompat.requestPermissions(
                this,
                permissionsToRequest.toTypedArray(),
                PERMISSION_REQUEST_CODE
            )
        }
    }

    inner class AndroidSMSBridge {
        @JavascriptInterface
        fun sendEmergencySMS(contactsJsonString: String, message: String) {
            if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) {
                runOnUiThread {
                    Toast.makeText(this@MainActivity, "SMS Permission not granted!", Toast.LENGTH_SHORT).show()
                }
                return
            }

            try {
                val contactsArray = JSONArray(contactsJsonString)
                val smsManager = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                    getSystemService(SmsManager::class.java)
                } else {
                    @Suppress("DEPRECATION")
                    SmsManager.getDefault()
                }

                if (smsManager == null) {
                    runOnUiThread {
                        Toast.makeText(this@MainActivity, "SMS Manager not available", Toast.LENGTH_SHORT).show()
                    }
                    return
                }

                var successCount = 0
                for (i in 0 until contactsArray.length()) {
                    val phoneNumber = contactsArray.getString(i)
                    if (phoneNumber.isNotBlank()) {
                        val parts = smsManager.divideMessage(message)
                        if (parts.size > 1) {
                            smsManager.sendMultipartTextMessage(phoneNumber, null, parts, null, null)
                        } else {
                            smsManager.sendTextMessage(phoneNumber, null, message, null, null)
                        }
                        successCount++
                    }
                }

                runOnUiThread {
                    Toast.makeText(this@MainActivity, "🚨 SOS Sent to $successCount contacts!", Toast.LENGTH_LONG).show()
                }

            } catch (e: Exception) {
                e.printStackTrace()
                runOnUiThread {
                    Toast.makeText(this@MainActivity, "Failed to send SMS: ${e.message}", Toast.LENGTH_SHORT).show()
                }
            }
        }

        @JavascriptInterface
        fun startSosVideoRecording() {
            if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED ||
                ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                runOnUiThread {
                    Toast.makeText(this@MainActivity, "Camera/Audio Permission not granted! Cannot record SOS.", Toast.LENGTH_SHORT).show()
                }
                return
            }
            runOnUiThread {
                recordAndShareVideoWhatsApp()
            }
        }
    }

    inner class AndroidShakeBridge {
        @JavascriptInterface
        fun isShakeSupported(): Boolean = accelerometer != null
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            @Suppress("DEPRECATION")
            super.onBackPressed()
        }
    }

    private var mediaRecorder: MediaRecorder? = null
    private var videoFile: File? = null
    private var camera: android.hardware.Camera? = null

    private fun recordAndShareVideoWhatsApp() {
        try {
            val videoDir = File(cacheDir, "video")
            if (!videoDir.exists()) videoDir.mkdirs()
            videoFile = File(videoDir, "sos_evidence.mp4")
            
            // Open legacy camera to record silently without preview
            @Suppress("DEPRECATION")
            camera = android.hardware.Camera.open()
            val surfaceTexture = android.graphics.SurfaceTexture(10)
            @Suppress("DEPRECATION")
            camera?.setPreviewTexture(surfaceTexture)
            @Suppress("DEPRECATION")
            camera?.unlock()
            
            mediaRecorder = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                MediaRecorder(this)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }
            
            mediaRecorder?.apply {
                @Suppress("DEPRECATION")
                setCamera(camera)
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setVideoSource(MediaRecorder.VideoSource.CAMERA)
                @Suppress("DEPRECATION")
                val profile = when {
                    android.media.CamcorderProfile.hasProfile(android.media.CamcorderProfile.QUALITY_720P) -> 
                        android.media.CamcorderProfile.get(android.media.CamcorderProfile.QUALITY_720P)
                    android.media.CamcorderProfile.hasProfile(android.media.CamcorderProfile.QUALITY_1080P) -> 
                        android.media.CamcorderProfile.get(android.media.CamcorderProfile.QUALITY_1080P)
                    else -> 
                        android.media.CamcorderProfile.get(android.media.CamcorderProfile.QUALITY_HIGH)
                }
                @Suppress("DEPRECATION")
                setProfile(profile)
                setOutputFile(videoFile!!.absolutePath)
                prepare()
                start()
            }
            
            Toast.makeText(this, "Recording SOS Video & Audio (30s)...", Toast.LENGTH_LONG).show()
            
            Handler(Looper.getMainLooper()).postDelayed({
                stopRecordingAndShare()
            }, 30000)
            
        } catch (e: Exception) {
            e.printStackTrace()
            mediaRecorder?.release()
            mediaRecorder = null
            @Suppress("DEPRECATION")
            camera?.release()
            camera = null
            Toast.makeText(this, "Failed to start recording: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    private fun stopRecordingAndShare() {
        try {
            mediaRecorder?.apply {
                stop()
                release()
            }
            mediaRecorder = null
            
            @Suppress("DEPRECATION")
            camera?.lock()
            @Suppress("DEPRECATION")
            camera?.release()
            camera = null
            
            if (videoFile != null && videoFile!!.exists()) {
                val uri = FileProvider.getUriForFile(this, "com.safeher.app.fileprovider", videoFile!!)
                val shareIntent = Intent(Intent.ACTION_SEND).apply {
                    type = "video/mp4"
                    putExtra(Intent.EXTRA_STREAM, uri)
                    putExtra(Intent.EXTRA_TEXT, "URGENT: SafeHer SOS Video Evidence!")
                    setPackage("com.whatsapp")
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                
                try {
                    startActivity(shareIntent)
                } catch (e: ActivityNotFoundException) {
                    Toast.makeText(this, "WhatsApp is not installed. Choose an app to send.", Toast.LENGTH_LONG).show()
                    shareIntent.setPackage(null)
                    startActivity(Intent.createChooser(shareIntent, "Share SOS Audio via"))
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
            Toast.makeText(this, "Failed to stop recording or share", Toast.LENGTH_SHORT).show()
        }
    }
}
