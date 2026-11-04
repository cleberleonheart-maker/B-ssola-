package com.bussola.app

import android.content.Context
import android.telephony.PhoneNumberUtils
import android.telephony.TelephonyManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.Locale

/**
 * Números de telefone no formato internacional.
 *
 * O WhatsApp só resolve um número em E.164 ("+5521999990000"): com o número
 * local ("21999990000") diz que o número não está no WhatsApp, mesmo
 * estando — o erro é do formato, não do número. O mesmo se passa com o SMS
 * quando o WhatsApp está definido como app de SMS por omissão.
 *
 * O Android sabe passar um número local para o formato internacional quando
 * lhe dizem de que país é: `PhoneNumberUtils.formatNumberToE164` com o ISO do
 * país. O país vem da rede (SIM) e, na falta dela, do sistema.
 *
 * Não pede permissões: o país da rede lê-se sem `READ_PHONE_STATE` e o resto
 * é matemática.
 */
class PhoneNumberModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = NAME

  /** O país do telemóvel em ISO de duas letras ("BR"), ou "" se não houver. */
  @ReactMethod
  fun countryIso(promise: Promise) {
    try {
      promise.resolve(currentCountryIso())
    } catch (e: Exception) {
      promise.resolve("")
    }
  }

  /**
   * Passa um número ao formato internacional. Devolve null quando não há
   * maneira de saber de que país é o número (o que acontece quando o número
   * já traz "+" mas não é válido).
   */
  @ReactMethod
  fun toE164(number: String, promise: Promise) {
    try {
      promise.resolve(toE164OrNull(number))
    } catch (e: Exception) {
      promise.resolve(null)
    }
  }

  private fun currentCountryIso(): String {
    val telephony =
      reactContext.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager
    val fromNetwork = telephony?.networkCountryIso
    if (!fromNetwork.isNullOrBlank()) return fromNetwork.uppercase(Locale.US)
    val fromSystem = Locale.getDefault().country
    return if (fromSystem.isNotBlank()) fromSystem.uppercase(Locale.US) else ""
  }

  private fun toE164OrNull(raw: String): String? {
    val trimmed = raw.trim()
    if (trimmed.isEmpty()) return null
    val iso = currentCountryIso()
    if (iso.isEmpty()) return null
    return PhoneNumberUtils.formatNumberToE164(trimmed, iso)
  }

  companion object {
    const val NAME = "PhoneNumber"
  }
}
