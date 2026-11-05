package com.bussola.app

import android.app.PendingIntent
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService

/**
 * Tiles das Definições Rápidas (ideia #14).
 *
 * Cada tile abre a app já no seu modo, pelo atalho `bussola://mode/<modo>` —
 * o mesmo caminho que o JavaScript lê para escolher o modo. O Android só
 * mostra um tile por serviço, por isso cada modo tem a sua classe; o que
 * muda entre elas é só o modo.
 */
abstract class ModeTileService : TileService() {

  /** O modo que este tile abre. */
  protected abstract val mode: String

  override fun onStartListening() {
    super.onStartListening()
    refresh()
  }

  override fun onClick() {
    val intent = Intent(this, MainActivity::class.java).apply {
      action = Intent.ACTION_VIEW
      data = Uri.parse("bussola://mode/$mode")
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      val pending = PendingIntent.getActivity(
        this,
        mode.hashCode(),
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
      startActivityAndCollapse(pending)
    } else {
      @Suppress("DEPRECATION")
      startActivity(intent)
    }
    refresh()
  }

  private fun refresh() {
    val tile = qsTile ?: return
    tile.state = Tile.STATE_INACTIVE
    tile.updateTile()
  }
}

class TileCompass : ModeTileService() {
  override val mode = "compass"
}

class TileAr : ModeTileService() {
  override val mode = "ar"
}

class TileLevel : ModeTileService() {
  override val mode = "level"
}

class TileMetal : ModeTileService() {
  override val mode = "metal"
}

class TileEmf : ModeTileService() {
  override val mode = "emf"
}

class TileSun : ModeTileService() {
  override val mode = "sun"
}

class TileTrack : ModeTileService() {
  override val mode = "track"
}

class TileTri : ModeTileService() {
  override val mode = "tri"
}
