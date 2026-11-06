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
 *
 * Há uma classe por modo do app (os 19 de `DISPLAY_MODES`), para que o
 * utilizador possa pôr no painel de atalhos o modo que quiser — e não só os
 * que a app achou mais prováveis.
 */
abstract class ModeTileService : TileService() {

  /** O modo que este tile abre. */
  protected abstract val mode: String

  override fun onStartListening() {
    super.onStartListening()
    // O tile só é ouvido quando está no painel: o Android avisou-o de que
    // está lá, e é isso que as definições mostram.
    TilePrefs.mark(this, mode, true)
    refresh()
  }

  override fun onTileAdded() {
    super.onTileAdded()
    TilePrefs.mark(this, mode, true)
  }

  override fun onTileRemoved() {
    super.onTileRemoved()
    TilePrefs.mark(this, mode, false)
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

class TileLevel : ModeTileService() {
  override val mode = "level"
}

class TileAr : ModeTileService() {
  override val mode = "ar"
}

class TileCamera : ModeTileService() {
  override val mode = "camera"
}

class TileMetal : ModeTileService() {
  override val mode = "metal"
}

class TileTheodolite : ModeTileService() {
  override val mode = "theodolite"
}

class TileEmf : ModeTileService() {
  override val mode = "emf"
}

class TileSun : ModeTileService() {
  override val mode = "sun"
}

class TileWind : ModeTileService() {
  override val mode = "wind"
}

class TileTrack : ModeTileService() {
  override val mode = "track"
}

class TileMap : ModeTileService() {
  override val mode = "map"
}

class TileNotes : ModeTileService() {
  override val mode = "notes"
}

class TileOdometer : ModeTileService() {
  override val mode = "odometer"
}

class TileCadence : ModeTileService() {
  override val mode = "cadence"
}

class TileHeight : ModeTileService() {
  override val mode = "height"
}

class TileCar : ModeTileService() {
  override val mode = "car"
}

class TileTri : ModeTileService() {
  override val mode = "tri"
}

class TileSelftest : ModeTileService() {
  override val mode = "selftest"
}

class TileDiag : ModeTileService() {
  override val mode = "diag"
}

/**
 * A tile do modo de assalto (ideia #107).
 *
 * Nao e um modo como os outros: e uma accao. E nao abre a app — quem esta a
 * ser assaltado tem o telemóvel bloqueado, no bolso, e um ecrã a acender-se
 * e o pior sitio para estar. Por isso a tile arranca o `SosAlertService`:
 * uma contagem de 10 s com uma notificacao silenciosa e um botao de cancelar,
 * e depois o SMS sai sozinho, com a ultima posicao conhecida, para o
 * contacto guardado.
 *
 * Sem contacto guardado nao ha para quem avisar: nesse caso a tile abre a
 * app no ecra de emergencia (o atalho `bussola://sos`, o mesmo do botao do
 * widget), que e onde o contacto se guarda e o aviso se manda a mao.
 *
 * Vive nesta classe porque o Android so mostra um tile por servico: o tile
 * do SOS e um servico como os outros, so que nao aponta para um modo.
 */
class TileSos : TileService() {
  override fun onStartListening() {
    super.onStartListening()
    TilePrefs.mark(this, "sos", true)
    refresh()
  }

  override fun onTileAdded() {
    super.onTileAdded()
    TilePrefs.mark(this, "sos", true)
  }

  override fun onTileRemoved() {
    super.onTileRemoved()
    TilePrefs.mark(this, "sos", false)
  }

  override fun onClick() {
    // Um aviso já em contagem: o segundo toque não dispara um segundo SMS.
    // Quem tocou duas vezes por engano ia avisar duas vezes — e a segunda
    // vez sem querer, quando já o tinha cancelado.
    if (SosPrefs.pending(this)) {
      refresh()
      return
    }
    val contacto = SosPrefs.contact(this)
    if (contacto.isBlank()) {
      abrirEcraEmergencia()
      return
    }
    val intent = Intent(this, SosAlertService::class.java).setAction(SosAlertService.ACTION_SEND)
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        startForegroundService(intent)
      } else {
        startService(intent)
      }
      SosPrefs.setPending(this, true)
    } catch (_: Exception) {
      // O Android pode recusar um servico de foreground neste contexto. Nao
      // e a hora de falhar calado: abre-se a app, que e o caminho de sempre.
      abrirEcraEmergencia()
      return
    }
    refresh()
  }

  private fun abrirEcraEmergencia() {
    val intent = Intent(this, MainActivity::class.java).apply {
      action = Intent.ACTION_VIEW
      data = Uri.parse("bussola://sos")
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      val pending = PendingIntent.getActivity(
        this,
        "sos".hashCode(),
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
      startActivityAndCollapse(pending)
    } else {
      @Suppress("DEPRECATION")
      startActivity(intent)
    }
  }

  private fun refresh() {
    val tile = qsTile ?: return
    val pending = SosPrefs.pending(this)
    tile.state = if (pending) Tile.STATE_ACTIVE else Tile.STATE_INACTIVE
    // O subtítulo só existe a partir do Android 10; antes disso o tile
    // fica só com o estado.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      tile.subtitle = if (pending) getString(R.string.tile_sos_pending) else null
    }
    tile.updateTile()
  }
}
