package com.bussola.app

import android.content.Context

/**
 * O que o modo de assalto precisa para funcionar sem a app aberta (ideia #107).
 *
 * A tile do SOS é uma ação, não um atalho: quem a toca está com o telemóvel
 * bloqueado, no bolso, e a app nem está a correr. Para o aviso sair na mesma,
 * o nativo tem de saber sozinho para quem avisar e onde a pessoa está.
 *
 * O JavaScript escreve aqui o que sabe — o contacto de emergência (quando o
 * guardas nas definições) e a última posição (a cada fix) — e a native lê-o
 * quando o aviso é disparado.
 *
 * É memória de cache, não estado de verdade: se a app for morta, o contacto
 * continua lá (é preciso para o SOS funcionar) e a posição é a última
 * conhecida, com a hora ao lado para se saber a idade.
 */
object SosPrefs {
  const val PREFS = "bussola_sos"

  private const val KEY_CONTACT = "contact"
  private const val KEY_LAT = "lat"
  private const val KEY_LON = "lon"
  private const val KEY_ACCURACY = "accuracy"
  private const val KEY_ALT = "alt"
  private const val KEY_FIX_AT = "fix_at"
  private const val KEY_BATTERY = "battery"
  private const val KEY_PENDING = "pending"

  /** A última posição que a app soube. */
  data class Fix(
    val lat: Double,
    val lon: Double,
    val accuracy: Double?,
    val alt: Double?,
    val at: Long,
  )

  private fun prefs(context: Context) =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  /** O contacto de emergência, em formato internacional. */
  fun contact(context: Context): String =
    prefs(context).getString(KEY_CONTACT, "") ?: ""

  fun setContact(context: Context, contact: String) {
    prefs(context).edit().putString(KEY_CONTACT, contact.trim()).apply()
  }

  fun setFix(
    context: Context,
    lat: Double,
    lon: Double,
    accuracy: Double?,
    alt: Double?,
    at: Long,
  ) {
    prefs(context)
      .edit()
      .putString(KEY_LAT, lat.toString())
      .putString(KEY_LON, lon.toString())
      .putString(KEY_ACCURACY, accuracy?.toString())
      .putString(KEY_ALT, alt?.toString())
      .putLong(KEY_FIX_AT, at)
      .apply()
  }

  /** A última posição guardada, ou null se nunca houve fix. */
  fun fix(context: Context): Fix? {
    val p = prefs(context)
    val lat = p.getString(KEY_LAT, null)?.toDoubleOrNull() ?: return null
    val lon = p.getString(KEY_LON, null)?.toDoubleOrNull() ?: return null
    return Fix(
      lat = lat,
      lon = lon,
      accuracy = p.getString(KEY_ACCURACY, null)?.toDoubleOrNull(),
      alt = p.getString(KEY_ALT, null)?.toDoubleOrNull(),
      at = p.getLong(KEY_FIX_AT, 0L),
    )
  }

  fun setBattery(context: Context, percent: Int) {
    prefs(context).edit().putInt(KEY_BATTERY, percent).apply()
  }

  fun battery(context: Context): Int? {
    val p = prefs(context)
    return if (p.contains(KEY_BATTERY)) p.getInt(KEY_BATTERY, -1) else null
  }

  /** Há um aviso em contagem? (o tile mostra-o no subtítulo) */
  fun setPending(context: Context, pending: Boolean) {
    prefs(context).edit().putBoolean(KEY_PENDING, pending).apply()
  }

  fun pending(context: Context): Boolean = prefs(context).getBoolean(KEY_PENDING, false)
}
