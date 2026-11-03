package expo.modules.nockhugnativo

import android.content.Context
import android.content.Intent
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.util.Log
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// O que o NockHug precisa do Android e nenhuma biblioteca do app entrega:
// 1. escuta com a tela apagada (EscutaService);
// 2. o app preso ao Wi-Fi da lançadora, que não tem internet: sem isso, com os
//    dados móveis ligados, o Android manda as requisições para 192.168.4.1
//    pela rede celular e elas estouram o tempo ("a lançadora não armou");
// 3. o microfone do fone Bluetooth, que o Android só usa com o canal SCO.
class NockhugNativoModule : Module() {
  private val contexto: Context
    get() = appContext.reactContext ?: throw IllegalStateException("Sem contexto do app")

  private var scoLigado = false

  override fun definition() = ModuleDefinition {
    Name("NockhugNativo")

    Function("iniciarEscuta") { titulo: String, texto: String ->
      val intent = Intent(contexto, EscutaService::class.java)
        .putExtra(EscutaService.EXTRA_TITULO, titulo)
        .putExtra(EscutaService.EXTRA_TEXTO, texto)
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) contexto.startForegroundService(intent)
        else contexto.startService(intent)
        true
      } catch (e: Exception) {
        Log.w(EscutaService.TAG, "Não iniciou a escuta em segundo plano: ${e.message}")
        false
      }
    }

    Function("pararEscuta") {
      contexto.stopService(Intent(contexto, EscutaService::class.java))
    }

    // Prende as conexões do app à rede Wi-Fi atual. Devolve false se não há
    // Wi-Fi conectado.
    Function("vincularAoWifi") {
      val cm = contexto.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
      @Suppress("DEPRECATION")
      val wifi = cm.allNetworks.firstOrNull { cm.getNetworkCapabilities(it)?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true }
      if (wifi == null) false else cm.bindProcessToNetwork(wifi)
    }

    Function("desvincularWifi") {
      val cm = contexto.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
      cm.bindProcessToNetwork(null)
    }

    // Liga (ou solta) o microfone do fone Bluetooth. Devolve o nome do fone
    // em uso, ou null se não há fone Bluetooth com microfone.
    Function("usarMicrofoneDoFone") { ligar: Boolean ->
      val am = contexto.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      if (!ligar) {
        soltarSco(am)
        return@Function null
      }
      try {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          val fone = am.availableCommunicationDevices.firstOrNull {
            it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO || it.type == AudioDeviceInfo.TYPE_BLE_HEADSET
          } ?: return@Function null
          am.mode = AudioManager.MODE_IN_COMMUNICATION
          if (!am.setCommunicationDevice(fone)) {
            am.mode = AudioManager.MODE_NORMAL
            return@Function null
          }
          scoLigado = true
          fone.productName?.toString()
        } else {
          val fone = am.getDevices(AudioManager.GET_DEVICES_INPUTS).firstOrNull { it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO }
            ?: return@Function null
          am.mode = AudioManager.MODE_IN_COMMUNICATION
          @Suppress("DEPRECATION")
          am.startBluetoothSco()
          @Suppress("DEPRECATION")
          am.isBluetoothScoOn = true
          scoLigado = true
          fone.productName?.toString()
        }
      } catch (e: Exception) {
        Log.w(EscutaService.TAG, "Microfone do fone indisponível: ${e.message}")
        soltarSco(am)
        null
      }
    }

    // De onde o áudio está vindo agora: fone Bluetooth, fone com fio/USB ou o
    // microfone do celular.
    Function("entradaDeAudio") {
      val am = contexto.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      if (scoLigado && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        am.communicationDevice?.let {
          if (it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO || it.type == AudioDeviceInfo.TYPE_BLE_HEADSET) {
            return@Function mapOf("tipo" to "fone_bt", "nome" to it.productName?.toString())
          }
        }
      }
      val entradas = am.getDevices(AudioManager.GET_DEVICES_INPUTS)
      if (scoLigado) {
        entradas.firstOrNull { it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO }?.let {
          return@Function mapOf("tipo" to "fone_bt", "nome" to it.productName?.toString())
        }
      }
      entradas.firstOrNull { it.type == AudioDeviceInfo.TYPE_WIRED_HEADSET || it.type == AudioDeviceInfo.TYPE_USB_HEADSET }?.let {
        return@Function mapOf("tipo" to "fone_fio", "nome" to it.productName?.toString())
      }
      mapOf("tipo" to "celular", "nome" to null)
    }

    OnDestroy {
      try {
        contexto.stopService(Intent(contexto, EscutaService::class.java))
      } catch (_: Exception) {
      }
    }
  }

  private fun soltarSco(am: AudioManager) {
    if (!scoLigado) return
    scoLigado = false
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        am.clearCommunicationDevice()
      } else {
        @Suppress("DEPRECATION")
        am.isBluetoothScoOn = false
        @Suppress("DEPRECATION")
        am.stopBluetoothSco()
      }
      am.mode = AudioManager.MODE_NORMAL
    } catch (e: Exception) {
      Log.w(EscutaService.TAG, "Falha ao soltar o fone: ${e.message}")
    }
  }
}
