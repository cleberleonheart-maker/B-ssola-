package com.bussola.app

import android.content.ContentValues
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.io.BufferedInputStream
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

class ApkDownloaderModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "ApkDownloader"

  /** Downloads vivos, por id. `cancel` desliga a flag e fecha a conexão. */
  private val cancelled = java.util.concurrent.ConcurrentHashMap<String, Boolean>()
  private val connections = java.util.concurrent.ConcurrentHashMap<String, HttpURLConnection>()
  private val partials = java.util.concurrent.ConcurrentHashMap<String, android.net.Uri>()

  private fun emit(event: String, payload: com.facebook.react.bridge.WritableMap) {
    reactContext.emitDeviceEvent(event, payload)
  }

  private fun isCancelled(id: String): Boolean = cancelled[id] == true

  /**
   * Interrompe um download e apaga o arquivo parcial.
   *
   * Sem apagar, o `.apk` truncado fica em Downloads e o próximo "instalar"
   * pode pegá-lo. Não emitimos evento: quem cancelou (o JS) já está com a
   * promise rejeitada e um `Done` tarde reabriria a tela de instalação.
   *
   * O `Thread` do download também apaga ao notar a flag, mas ele só acorda no
   * próximo `read()`. Apagar aqui é o que garante que o ficheiro desapareça já,
   * mesmo que a thread travada demore a acordar.
   */
  @ReactMethod
  fun cancel(id: String, promise: Promise) {
    cancelled[id] = true
    try {
      connections[id]?.disconnect()
    } catch (_: Exception) {
    }
    connections.remove(id)
    partials.remove(id)?.let { uri -> deleteUri(uri) }
    promise.resolve(true)
  }

  @ReactMethod
  fun download(url: String, fileName: String, id: String, promise: Promise) {
    cancelled.remove(id)
    Thread {
      var output: java.io.OutputStream? = null
      var connection: HttpURLConnection? = null
      var insertedUri: android.net.Uri? = null
      var settled = false
      // Fora do `try`: o `catch` precisa dele para apagar o ficheiro parcial,
      // e foi declarado dentro do `try` — o `compileDebugKotlin` acusava
      // "unresolved reference" e nada do módulo compilava.
      val safeName = if (fileName.endsWith(".apk")) fileName else "$fileName.apk"
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          val values = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, safeName)
            put(MediaStore.MediaColumns.MIME_TYPE, "application/vnd.android.package-archive")
            put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
          }
          insertedUri = reactContext.contentResolver.insert(
            MediaStore.Downloads.EXTERNAL_CONTENT_URI,
            values,
          )
          output = insertedUri?.let { reactContext.contentResolver.openOutputStream(it) }
        }
        if (output == null) {
          val fallbackDir = reactContext.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
            ?: reactContext.filesDir
          if (!fallbackDir.exists()) fallbackDir.mkdirs()
          val file = File(fallbackDir, safeName)
          output = file.outputStream()
          partials[id] = android.net.Uri.fromFile(file)
        }

        connection = (URL(url).openConnection() as HttpURLConnection).apply {
          connectTimeout = 20000
          readTimeout = 30000
          instanceFollowRedirects = true
        }
        connections[id] = connection
        connection.connect()
        val code = connection.responseCode
        if (code !in 200..299) {
          throw IllegalStateException("HTTP $code ao baixar o APK")
        }
        val total = connection.contentLengthLong
        val input = BufferedInputStream(connection.inputStream)
        val buffer = ByteArray(64 * 1024)
        var received = 0L
        var lastEmit = 0L
        while (true) {
          if (isCancelled(id)) {
            throw IllegalStateException("download_cancelled")
          }
          val read = input.read(buffer)
          if (read <= 0) break
          output.write(buffer, 0, read)
          received += read
          val now = System.currentTimeMillis()
          if (now - lastEmit > 120) {
            lastEmit = now
            val map = Arguments.createMap().apply {
              putString("id", id)
              putDouble("received", received.toDouble())
              putDouble("total", total.toDouble())
            }
            emit("ApkDownloaderProgress", map)
          }
        }
        output.flush()
        output.close()
        output = null
        connections.remove(id)
        partials.remove(id)
        connection.disconnect()

        // Chega aqui depois do `output.close()`, então apagar o arquivo é seguro.
        if (isCancelled(id)) {
          deletePartial(insertedUri, safeName)
          settled = true
          promise.resolve(false)
          return@Thread
        }

        val done = Arguments.createMap().apply {
          putString("id", id)
          putString("name", safeName)
          putDouble("received", received.toDouble())
          putString("uri", insertedUri?.toString() ?: "")
        }
        emit("ApkDownloaderDone", done)
        settled = true
        promise.resolve(true)
      } catch (error: Exception) {
        try {
          output?.close()
        } catch (_: Exception) {
        }
        try {
          connections.remove(id)
          connection?.disconnect()
        } catch (_: Exception) {
        }
        val cancelledDownload = isCancelled(id) ||
          (error.message ?: "") == "download_cancelled"
        partials.remove(id)
        deletePartial(insertedUri, safeName)
        cancelled.remove(id)
        if (cancelledDownload) {
          // Cancelado: quem pediu o cancelamento já trata do estado da tela.
          // Emitir `Error` aqui reabriria um erro que o usuário acabou de
          // resolver fechando o modal.
          if (!settled) {
            settled = true
            promise.resolve(false)
          }
          return@Thread
        }
        val fail = Arguments.createMap().apply {
          putString("id", id)
          putString("message", error.message ?: error.toString())
        }
        emit("ApkDownloaderError", fail)
        if (!settled) {
          settled = true
          promise.reject("download_failed", error.message ?: "Falha ao baixar", error)
        }
      }
    }.start()
  }

  /**
   * Confere o SHA-256 do arquivo já em disco antes de o mandar instalar.
   *
   * O hash esperado não vem do próprio APK: vem de fora (a GitHub calcula um
   * `digest` por asset, e o CI grava outro na nuvem), por isso comparar é o que
   * distingue "o arquivo é o que o servidor anunciou" de "o arquivo que chegou
   * é outro". O HTTPS resolve o servidor falso; isto resolve o binário trocado
   * no caminho.
   *
   * Se não bater, o arquivo é apagado. Deixá-lo na pasta Downloads seria deixar
   * um `.apk` com cara de atualização à espera de alguém tocar nele — que é
   * exactamente o que o utilizador faria a seguir.
   */
  @ReactMethod
  fun verify(uriString: String, expected: String, promise: Promise) {
    val expectedNorm = normHash(expected)
    if (uriString.isEmpty()) {
      promise.reject("verify_failed", "Arquivo do APK indisponível")
      return
    }
    if (expectedNorm.isEmpty()) {
      promise.reject("hash_missing", "Hash esperado ausente ou mal formado")
      return
    }
    Thread {
      var input: java.io.InputStream? = null
      try {
        val uri = Uri.parse(uriString)
        input = reactContext.contentResolver.openInputStream(uri)
          ?: throw IllegalStateException("não foi possível abrir o APK")
        val digest = java.security.MessageDigest.getInstance("SHA-256")
        val buffer = ByteArray(64 * 1024)
        while (true) {
          val read = input.read(buffer)
          if (read <= 0) break
          digest.update(buffer, 0, read)
        }
        val found = digest.digest().joinToString("") {
          String.format("%02x", it.toInt() and 0xff)
        }
        if (found == expectedNorm) {
          promise.resolve(true)
        } else {
          deleteUri(uri)
          promise.reject(
            "hash_mismatch",
            "O arquivo não é o APK anunciado ($found)",
          )
        }
      } catch (error: Exception) {
        promise.reject("verify_failed", error.message ?: "Falha ao verificar", error)
      } finally {
        try {
          input?.close()
        } catch (_: Exception) {
        }
      }
    }.start()
  }

  /** Minúsculo, sem `sha256:` e sem separadores. Inválido volta vazio. */
  private fun normHash(value: String): String {
    val cleaned = value.trim().lowercase().removePrefix("sha-256:").removePrefix("sha256:")
    return if (cleaned.length == 64 && cleaned.all { it in "0123456789abcdef" }) {
      cleaned
    } else {
      ""
    }
  }

  /** Apaga o arquivo meio baixado, seja do MediaStore ou do diretório interno. */
  private fun deletePartial(insertedUri: android.net.Uri?, fileName: String) {
    if (insertedUri != null) {
      deleteUri(insertedUri)
      return
    }
    try {
      val dir = reactContext.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)
        ?: reactContext.filesDir
      File(dir, fileName).delete()
    } catch (_: Exception) {
    }
  }

  /** Apaga uma linha do MediaStore, se ela existir. */
  private fun deleteUri(uri: android.net.Uri) {
    try {
      reactContext.contentResolver.delete(uri, null, null)
    } catch (_: Exception) {
    }
  }

  @ReactMethod
  fun install(uriString: String, promise: Promise) {
    try {
      if (uriString.isEmpty()) {
        promise.reject("install_failed", "Arquivo do APK indisponível")
        return
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O &&
        !reactContext.packageManager.canRequestPackageInstalls()
      ) {
        val settingsIntent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES).apply {
          data = Uri.parse("package:${reactContext.packageName}")
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        reactContext.startActivity(settingsIntent)
        promise.reject("install_permission", "Permita instalar apps desta fonte")
        return
      }
      val installIntent = Intent(Intent.ACTION_VIEW).apply {
        setDataAndType(
          Uri.parse(uriString),
          "application/vnd.android.package-archive",
        )
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      reactContext.startActivity(installIntent)
      promise.resolve(true)
    } catch (error: Exception) {
      promise.reject("install_failed", error.message ?: "Falha ao instalar", error)
    }
  }
}
