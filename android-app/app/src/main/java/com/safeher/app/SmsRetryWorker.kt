package com.safeher.app

import android.content.Context
import android.telephony.SmsManager
import androidx.work.Worker
import androidx.work.WorkerParameters
import org.json.JSONArray
import org.json.JSONObject

class SmsRetryWorker(appContext: Context, workerParams: WorkerParameters) :
    Worker(appContext, workerParams) {

    override fun doWork(): Result {
        val prefs = applicationContext.getSharedPreferences("sms_queue_prefs", Context.MODE_PRIVATE)
        val queueStr = prefs.getString("queue", "[]")
        val queue = JSONArray(queueStr)

        if (queue.length() == 0) {
            return Result.success()
        }

        val smsManager = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
            applicationContext.getSystemService(SmsManager::class.java)
        } else {
            @Suppress("DEPRECATION")
            SmsManager.getDefault()
        }

        if (smsManager == null) {
            return Result.retry()
        }

        val remainingQueue = JSONArray()

        for (i in 0 until queue.length()) {
            val item = queue.getJSONObject(i)
            val phoneNumber = item.getString("phone_number")
            val message = item.getString("message")

            try {
                // Try sending without PendingIntent this time (since we are connected)
                // If it fails again due to connection, the worker can retry
                val parts = smsManager.divideMessage(message)
                if (parts.size > 1) {
                    smsManager.sendMultipartTextMessage(phoneNumber, null, parts, null, null)
                } else {
                    smsManager.sendTextMessage(phoneNumber, null, message, null, null)
                }
            } catch (e: Exception) {
                e.printStackTrace()
                // Put back in queue if it fails exceptionally
                remainingQueue.put(item)
            }
        }

        prefs.edit().putString("queue", remainingQueue.toString()).apply()

        return if (remainingQueue.length() == 0) Result.success() else Result.retry()
    }
}
