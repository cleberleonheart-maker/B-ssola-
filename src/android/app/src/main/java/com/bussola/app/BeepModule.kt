package com.bussola.app

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import kotlin.math.PI
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin

class BeepModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule() {

  override fun getName(): String = "Beep"

  @Volatile
  private var activeTrack: AudioTrack? = null

  @Volatile
  private var volume: Float = 0.85f

  private val lock = Any()

  @ReactMethod
  fun tone(frequency: Double, durationMs: Double) {
    val freq = frequency.toFloat().coerceIn(80f, 5000f)
    val dur = durationMs.coerceIn(10.0, 4000.0)
    val thread = Thread { playSine(freq, dur) }
    thread.start()
  }

  private fun playSine(freq: Float, durationMs: Double) {
    val sampleRate = 44100
    val frames = ((sampleRate.toLong() * durationMs) / 1000.0).toInt().coerceAtLeast(330)
    val fadeFrames = min(660, frames / 3)
    val gain = (volume.coerceIn(0f, 1f) * 0.5f * Short.MAX_VALUE)
    if (gain <= 0f) return
    val freq2 = freq * 2.0 * PI
    val pcm = ShortArray(frames)
    for (i in 0 until frames) {
      val fade = when {
        i < fadeFrames -> i.toFloat() / fadeFrames
        i > frames - fadeFrames -> (frames - i).toFloat() / fadeFrames
        else -> 1f
      }
      pcm[i] = (sin(freq2 * i / sampleRate) * gain * fade).toInt().toShort()
    }

    try {
      val minBuf = AudioTrack.getMinBufferSize(
        sampleRate,
        AudioFormat.CHANNEL_OUT_MONO,
        AudioFormat.ENCODING_PCM_16BIT,
      )
      val bufferSizeBytes = max(minBuf, frames * 2)
      val track = AudioTrack.Builder()
        .setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build(),
        )
        .setAudioFormat(
          AudioFormat.Builder()
            .setSampleRate(sampleRate)
            .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
            .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
            .build(),
        )
        .setBufferSizeInBytes(bufferSizeBytes)
        .setTransferMode(AudioTrack.MODE_STATIC)
        .build()
      if (track.state != AudioTrack.STATE_INITIALIZED) {
        track.release()
        return
      }
      synchronized(lock) {
        activeTrack?.let {
          try {
            it.stop()
          } catch (_: Exception) {
          }
          try {
            it.release()
          } catch (_: Exception) {
          }
        }
        activeTrack = track
      }
      track.write(pcm, 0, frames)
      track.play()

      var interrupted = false
      while (track.playState == AudioTrack.PLAYSTATE_PLAYING) {
        if (Thread.currentThread().isInterrupted) {
          interrupted = true
          break
        }
        try {
          Thread.sleep(20)
        } catch (e: InterruptedException) {
          Thread.currentThread().interrupt()
          interrupted = true
          break
        }
      }
      try {
        if (!interrupted) track.stop()
      } catch (_: Exception) {
      }
      try {
        track.release()
      } catch (_: Exception) {
      }
      synchronized(lock) {
        if (activeTrack === track) activeTrack = null
      }
    } catch (_: Exception) {
    }
  }

  @ReactMethod
  fun stop() {
    synchronized(lock) {
      activeTrack?.let {
        try {
          it.stop()
        } catch (_: Exception) {
        }
        try {
          it.release()
        } catch (_: Exception) {
        }
      }
      activeTrack = null
    }
  }

  @ReactMethod
  fun setVolume(v: Double) {
    volume = v.toFloat().coerceIn(0f, 1f)
  }

  override fun invalidate() {
    stop()
    super.invalidate()
  }
}