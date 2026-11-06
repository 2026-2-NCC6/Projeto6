import AVFoundation
import ExpoModulesCore

// No iOS a escuta com a tela apagada vem do UIBackgroundModes "audio" e da
// sessão playAndRecord do reconhecedor (com allowBluetooth, o fone vira o
// microfone sozinho). Este módulo só informa de onde o áudio está vindo; as
// demais funções existem para o JavaScript ser o mesmo nas duas plataformas.
public class NockhugNativoModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NockhugNativo")

    Function("iniciarEscuta") { (_: String, _: String) -> Bool in
      true
    }

    Function("pararEscuta") {}

    Function("vincularAoWifi") { () -> Bool in
      false
    }

    Function("desvincularWifi") {}

    Function("usarMicrofoneDoFone") { (_: Bool) -> String? in
      AVAudioSession.sharedInstance().currentRoute.inputs.first { NockhugNativoModule.ehFoneBluetooth($0.portType) }?.portName
    }

    Function("foneBluetoothDisponivel") { () -> String? in
      AVAudioSession.sharedInstance().availableInputs?.first { NockhugNativoModule.ehFoneBluetooth($0.portType) }?.portName
    }

    // Com o fone conectado, o iOS usa o microfone dele sozinho. Para ouvir
    // pelo celular, o app pede a entrada embutida como preferida.
    Function("preferirMicrofoneDoCelular") { (ligar: Bool) in
      let sessao = AVAudioSession.sharedInstance()
      let embutido = ligar ? sessao.availableInputs?.first { $0.portType == .builtInMic } : nil
      try? sessao.setPreferredInput(embutido)
    }

    Function("entradaDeAudio") { () -> [String: Any?] in
      guard let entrada = AVAudioSession.sharedInstance().currentRoute.inputs.first else {
        return ["tipo": "celular", "nome": nil]
      }
      if NockhugNativoModule.ehFoneBluetooth(entrada.portType) {
        return ["tipo": "fone_bt", "nome": entrada.portName]
      }
      if entrada.portType == .headsetMic || entrada.portType == .usbAudio {
        return ["tipo": "fone_fio", "nome": entrada.portName]
      }
      return ["tipo": "celular", "nome": nil]
    }
  }

  static func ehFoneBluetooth(_ tipo: AVAudioSession.Port) -> Bool {
    tipo == .bluetoothHFP || tipo == .bluetoothLE
  }
}
