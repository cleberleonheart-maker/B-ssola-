package com.bussola.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews

class BussolaWidgetProvider : AppWidgetProvider() {

  override fun onUpdate(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetIds: IntArray,
  ) {
    for (appWidgetId in appWidgetIds) {
      updateWidget(context, appWidgetId)
    }
  }

  override fun onReceive(context: Context, intent: Intent?) {
    super.onReceive(context, intent)
    if (intent?.action == ACTION_UPDATE) {
      val ids = AppWidgetManager
        .getInstance(context)
        .getAppWidgetIds(ComponentName(context, BussolaWidgetProvider::class.java))
      for (appWidgetId in ids) {
        updateWidget(context, appWidgetId)
      }
    }
  }

  private fun updateWidget(context: Context, appWidgetId: Int) {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val views = RemoteViews(context.packageName, R.layout.widget_bussola)
    val heading = prefs.getFloat("heading", -1f)
    views.setTextViewText(
      R.id.widget_heading,
      if (heading >= 0f) String.format("%.0f°", heading) else "--°",
    )
    views.setTextViewText(
      R.id.widget_cardinal,
      prefs.getString("cardinal", "—") ?: "—",
    )
    views.setTextViewText(
      R.id.widget_pressure,
      String.format("%.1f hPa", prefs.getFloat("pressure", 0f)).let {
        if (prefs.getFloat("pressure", 0f) > 0f) it else "-- hPa"
      },
    )
    views.setTextViewText(
      R.id.widget_altitude,
      String.format("%.0f m", prefs.getFloat("altitude", 0f)).let {
        if (prefs.getBoolean("has_alt", false)) it else "-- m"
      },
    )
    views.setTextViewText(
      R.id.widget_temp,
      if (prefs.getString("temp", null) != null) {
        prefs.getString("temp", "")
      } else {
        "--°C"
      },
    )
    val open = PendingIntent.getActivity(
      context,
      0,
      Intent(context, MainActivity::class.java),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    views.setOnClickPendingIntent(R.id.widget_heading, open)
    AppWidgetManager.getInstance(context).updateAppWidget(appWidgetId, views)
  }

  companion object {
    const val ACTION_UPDATE = "com.bussola.app.WIDGET_UPDATE"
    const val PREFS = "bussola_widget"
  }
}