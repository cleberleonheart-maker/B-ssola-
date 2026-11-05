package com.bussola.app

import android.content.Context

/**
 * Que tiles o utilizador já adicionou ao painel de Definições Rápidas.
 *
 * O Android não conta à app que tiles estão no painel, mas avisa o serviço
 * quando um tile é adicionado ou removido (`onTileAdded`/`onTileRemoved`).
 * O serviço marca aqui e o módulo lê a marca para as definições.
 */
object TilePrefs {
  const val PREFS = "bussola_tiles"

  fun mark(context: Context, mode: String, added: Boolean) {
    context
      .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      .edit()
      .putBoolean(mode, added)
      .apply()
  }

  fun added(context: Context): List<String> {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    return prefs.all.keys.filter { prefs.getBoolean(it, false) }.sorted()
  }
}
