package com.safeher.app

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telephony.SmsManager
import androidx.work.Constraints
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import org.json.JSONArray
import org.json.JSONObject

class SmsResultReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val phoneNumber = intent.getStringExtra("phone_number") ?: return
        val message = intent.getStringExtra("message") ?: return

        if (resultCode != Activity.RESULT_OK) {
            // Failed to send. Queue for retry.
            queueSmsForRetry(context, phoneNumber, message)
            
            // Schedule the worker to run when network is connected
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val retryWorkRequest = OneTimeWorkRequestBuilder<SmsRetryWorker>()
                .setConstraints(constraints)
                .build()

            WorkManager.getInstance(context).enqueue(retryWorkRequest)
        }
    }

    private fun queueSmsForRetry(context: Context, phoneNumber: String, message: String) {
        val prefs = context.getSharedPreferences("sms_queue_prefs", Context.MODE_PRIVATE)
        val queueStr = prefs.getString("queue", "[]")
        val queue = JSONArray(queueStr)

        val item = JSONObject()
        item.put("phone_number", phoneNumber)
        item.put("message", message)
        queue.put(item)

        prefs.edit().putString("queue", queue.toString()).apply()
    }
}
