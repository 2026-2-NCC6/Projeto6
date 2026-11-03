package expo.modules.nockhugnativo

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.wifi.WifiManager
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.util.Log

// Serviço em primeiro plano que mantém o NockHug vivo com a tela apagada.
//
// Desde o Android 11 o microfone só grava em segundo plano se o app tiver um
// serviço em primeiro plano do tipo "microphone" iniciado com ele aberto. Sem
// isso, o reconhecedor recebe silêncio, o heartbeat para e a lançadora pausa
// os motores pelo watchdog. O serviço também segura a CPU (wake lock parcial)
// e o rádio Wi-Fi em baixa latência, para o heartbeat não atrasar.
class EscutaService : Service() {
  private var wakeLock: PowerManager.WakeLock? = null
  private var wifiLock: WifiManager.WifiLock? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val titulo = intent?.getStringExtra(EXTRA_TITULO) ?: "NockHug está ouvindo"
    val texto = intent?.getStringExtra(EXTRA_TEXTO) ?: "Diga a palavra de ativação e o comando."
    val notificacao = criarNotificacao(titulo, texto)
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(
          ID_NOTIFICACAO,
          notificacao,
          ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE or ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE,
        )
      } else {
        startForeground(ID_NOTIFICACAO, notificacao)
      }
    } catch (e: Exception) {
      // Sem a permissão de microfone (ou iniciado em segundo plano) o sistema
      // recusa: o app segue funcionando com a tela acesa.
      Log.w(TAG, "startForeground recusado: ${e.message}")
      stopSelf()
      return START_NOT_STICKY
    }
    segurarRecursos()
    return START_NOT_STICKY
  }

  // O usuário fechou o app pela lista de recentes: a escuta acaba junto.
  override fun onTaskRemoved(rootIntent: Intent?) {
    stopSelf()
    super.onTaskRemoved(rootIntent)
  }

  override fun onDestroy() {
    soltarRecursos()
    super.onDestroy()
  }

  private fun segurarRecursos() {
    if (wakeLock == null) {
      val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
      wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "NockHug:escuta").apply {
        setReferenceCounted(false)
        // Teto de segurança: uma sessão esquecida não drena a bateria para sempre.
        acquire(3 * 60 * 60 * 1000L)
      }
    }
    if (wifiLock == null) {
      val wm = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
      val modo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) WifiManager.WIFI_MODE_FULL_LOW_LATENCY else @Suppress("DEPRECATION") WifiManager.WIFI_MODE_FULL_HIGH_PERF
      wifiLock = wm.createWifiLock(modo, "NockHug:lancadora").apply {
        setReferenceCounted(false)
        acquire()
      }
    }
  }

  private fun soltarRecursos() {
    wakeLock?.takeIf { it.isHeld }?.release()
    wakeLock = null
    wifiLock?.takeIf { it.isHeld }?.release()
    wifiLock = null
  }

  private fun criarNotificacao(titulo: String, texto: String): Notification {
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val canal = NotificationChannel(CANAL, "Sessão em andamento", NotificationManager.IMPORTANCE_LOW).apply {
        description = "Mostra que o NockHug está ouvindo os comandos com a tela apagada."
        setShowBadge(false)
      }
      nm.createNotificationChannel(canal)
    }
    val abrir = packageManager.getLaunchIntentForPackage(packageName)?.let {
      it.flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
      PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CANAL)
    } else {
      @Suppress("DEPRECATION") Notification.Builder(this)
    }
    return builder
      .setContentTitle(titulo)
      .setContentText(texto)
      .setSmallIcon(applicationInfo.icon)
      .setOngoing(true)
      .setCategory(Notification.CATEGORY_SERVICE)
      .apply { abrir?.let { setContentIntent(it) } }
      .build()
  }

  companion object {
    const val TAG = "NockHug"
    const val CANAL = "nockhug_escuta"
    const val ID_NOTIFICACAO = 4626
    const val EXTRA_TITULO = "titulo"
    const val EXTRA_TEXTO = "texto"
  }
}
