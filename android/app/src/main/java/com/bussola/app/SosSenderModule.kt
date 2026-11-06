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

  /**
   * O contacto de emergência, para o aviso sair sem a app aberta.
   *
   * Quem guarda o contacto nas definições escreve-o aqui; a tile do SOS lê-o
   * de volta quando o telemóvel está bloqueado e a app nem está a correr.
   */
  @ReactMethod
  fun cacheContact(contact: String, promise: Promise) {
    SosPrefs.setContact(reactContext, contact)
    promise.resolve(true)
  }

  /** A última posição, para o aviso levar as coordenadas. */
  @ReactMethod
  fun cacheFix(
    lat: Double,
    lon: Double,
    accuracy: Double,
    alt: Double,
    at: Double,
    promise: Promise,
  ) {
    SosPrefs.setFix(
      reactContext,
      lat,
      lon,
      if (accuracy.isNaN()) null else accuracy,
      if (alt.isNaN()) null else alt,
      at.toLong(),
    )
    promise.resolve(true)
  }

  /** A última percentagem de bateria conhecida. */
  @ReactMethod
  fun cacheBattery(percent: Double, promise: Promise) {
    SosPrefs.setBattery(reactContext, percent.toInt())
    promise.resolve(true)
  }

  /**
   * As credenciais da nuvem, para o aviso conseguir criar a sessao de
   * rastreio sem a app aberta.
   *
   * O refresh token e o que interessa: o access token expira em uma hora e o
   * aviso pode ser disparado dias depois de a app ter estado fechada.
   */
  @ReactMethod
  fun cacheCloud(
    refreshToken: String,
    url: String,
    anonKey: String,
    userId: String,
    livePageUrl: String,
    liveMinutes: Double,
    promise: Promise,
  ) {
    SosPrefs.setCloud(
      reactContext,
      refreshToken,
      url,
      anonKey,
      userId,
      livePageUrl,
      liveMinutes.toInt(),
    )
    promise.resolve(true)
  }

  /** O que o nativo sabe: para os testes e para o diagnóstico. */
  @ReactMethod
  fun cachedState(promise: Promise) {
    val fix = SosPrefs.fix(reactContext)
    val map = com.facebook.react.bridge.Arguments.createMap()
    map.putString("contact", SosPrefs.contact(reactContext))
    map.putInt("battery", SosPrefs.battery(reactContext) ?: -1)
    map.putBoolean("pending", SosPrefs.pending(reactContext))
    map.putBoolean("hasCloud", SosPrefs.refreshToken(reactContext).isNotBlank())
    if (fix != null) {
      map.putDouble("lat", fix.lat)
      map.putDouble("lon", fix.lon)
      map.putDouble("fixAt", fix.at.toDouble())
    }
    promise.resolve(map)
  }

  private fun hasPermission(): Boolean =
    ContextCompat.checkSelfPermission(reactContext, Manifest.permission.SEND_SMS) ==
      PackageManager.PERMISSION_GRANTED

  companion object {
    const val NAME = "SosSender"
  }
}
