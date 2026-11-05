package com.bussola.app

import android.Manifest
import android.content.pm.PackageManager
import android.telephony.SmsManager
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Envio de SMS em silêncio, para o modo de assalto (ideia #107).
 *
 * O beacon abria a app de SMS com o texto e o número já escritos, e quem
 * estava a ser assaltado tinha de tocar em "enviar" — com o ecrã aceso, à
 * vista de toda a gente, e a desbloquear o telemóvel pelo caminho. Numa
 * emergência discreta isso não serve.
 *
 * Aqui o SMS sai direto, sem abrir nada: o `SmsManager` manda a mensagem e
 * a app continua exatamente como estava. A permissão `SEND_SMS` é pedida
 * antes, nas definições — pedir a meio de uma agressão seria pior.
 *
 * Sem a permissão, o módulo não inventa: devolve `no_permission` e o
 * JavaScript volta ao caminho antigo, o compositor de SMS.
 */
class SosSenderModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  /** A permissão de enviar SMS já foi concedida? */
  @ReactMethod
  fun canSend(promise: Promise) {
    promise.resolve(hasPermission())
  }

  /**
   * Manda o SMS. Devolve `sent`, `no_permission`, `invalid` ou `failed`.
   *
   * `invalid` é o número que não é um telefone: o `SmsManager` rebentaria
   * com uma exceção, e uma exceção a meio de uma emergência é o pior sítio
   * para ela acontecer.
   */
  @ReactMethod
  fun sendSms(contact: String, message: String, promise: Promise) {
    val numero = contact.trim()
    if (numero.isEmpty()) {
      promise.resolve("invalid")
      return
    }
    if (!hasPermission()) {
      promise.resolve("no_permission")
      return
    }
    try {
      @Suppress("DEPRECATION")
      val manager = SmsManager.getDefault()
      manager.sendTextMessage(numero, null, message, null, null)
      promise.resolve("sent")
    } catch (e: Exception) {
      promise.resolve("failed")
    }
  }

  private fun hasPermission(): Boolean =
    ContextCompat.checkSelfPermission(reactContext, Manifest.permission.SEND_SMS) ==
      PackageManager.PERMISSION_GRANTED

  companion object {
    const val NAME = "SosSender"
  }
}
