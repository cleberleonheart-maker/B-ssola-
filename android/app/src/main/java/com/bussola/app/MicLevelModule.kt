package com.bussola.app

import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import kotlin.math.sqrt

/**
 * Captura o nível de ruído/vento pelo microfone (RMS normalizado em 0..1)
 * rodando em thread própria. Usado pelo modo "Vento" da Bússola.
 */
class MicLevelModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule() {

  override fun getName(): String = "MicLevel"

  @Volatile
  private var running = false

  @Volatile
  private var level = -1.0

  private var thread: Thread? = null
  private val lock = Any()

  @ReactMethod
  fun start() {
    synchronized(lock) {
      if (running) return
      running = true
      level = -1.0
    }
    val t = Thread({ runLoop() }, "mic-level")
    t.isDaemon = true
    thread = t
    t.start()
  }

  private fun runLoop() {
    val sampleRate = 16000
    val minBuf = try {
      AudioRecord.getMinBufferSize(
        sampleRate,
        AudioFormat.CHANNEL_IN_MONO,
        AudioFormat.ENCODING_PCM_16BIT,
      )
    } catch (_: Exception) {
      0
    }
    if (minBuf <= 0) {
      synchronized(lock) { running = false }
      return
    }

    var recorder: AudioRecord? = null
    try {
      recorder = AudioRecord.Builder()
        .setAudioSource(MediaRecorder.AudioSource.MIC)
        .setSampleRate(sampleRate)
        .setChannelMask(AudioFormat.CHANNEL_IN_MONO)
        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
        .setBufferSizeInBytes(minBuf * 2)
        .build()
      if (recorder.state != AudioRecord.STATE_INITIALIZED) {
        synchronized(lock) { running = false }
        return
      }
      recorder.startRecording()
      val buf = ShortArray(2048)
      // janela RMS de ~250ms para suavizar a turbulência do vento
      val rmsTarget = sampleRate / 4
      var sum = 0.0
      var count = 0
      while (running) {
        val n = try {
          recorder.read(buf, 0, buf.size)
        } catch (_: Exception) {
          -1
        }
        if (n <= 0) continue
        for (i in 0 until n) {
          val v = buf[i].toDouble()
          sum += v * v
          count++
        }
        if (count >= rmsTarget) {
          val rms = sqrt(sum / count)
          sum = 0.0
          count = 0
          val norm = (rms / 32768.0).coerceIn(0.0, 1.0)
          synchronized(lock) { level = norm }
        }
      }
    } catch (_: Exception) {
      synchronized(lock) { level = -1.0 }
    } finally {
      try {
        recorder?.stop()
      } catch (_: Exception) {
      }
      try {
        recorder?.release()
      } catch (_: Exception) {
      }
      synchronized(lock) { running = false }
    }
  }

  @ReactMethod
  fun stop() {
    synchronized(lock) { running = false }
    thread?.interrupt()
    thread = null
  }

  @ReactMethod
  fun getLevel(promise: Promise) {
    synchronized(lock) {
      promise.resolve(level)
    }
  }

  override fun invalidate() {
    stop()
    super.invalidate()
  }
}