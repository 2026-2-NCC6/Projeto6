#include <WiFi.h>
#include <WebServer.h>

const char *ssid = "ESP32_Voz_Direta";
const char *password = "12345678";

WebServer server(80);

// Pinos dos motores (mantidos do código 2)
const int pinoMotor1 = 25;
const int pinoMotor2 = 26;
const int VELOCIDADE_ALVO = 50;

// Variável para rastrear o status e informar a página web
bool motoresLigados = false;

const char PAGE_MAIN[] = R"rawliteral(
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Diagnostico de Voz ESP32 - Motores</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: center; padding: 15px; background: #0f172a; color: #f8fafc; margin: 0; }
    h2 { margin: 10px 0; color: #38bdf8; }
    .card { background: #1e293b; padding: 15px; border-radius: 10px; max-width: 500px; margin: 0 auto 15px auto; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); }
    #btnMic { width: 100%; padding: 16px; font-size: 16px; border: none; border-radius: 8px; background: #2563eb; color: white; cursor: pointer; font-weight: bold; transition: 0.3s; }
    #btnMic.active { background: #dc2626; animation: pulse 1.2s infinite; }
    #statusBox { font-size: 18px; margin: 10px 0; font-weight: bold; }
    #consoleLog { background: #020617; border: 1px solid #334155; border-radius: 8px; padding: 10px; text-align: left; font-family: 'Courier New', Courier, monospace; font-size: 12px; height: 220px; overflow-y: scroll; color: #a5f3fc; }
    .log-info { color: #38bdf8; }
    .log-success { color: #4ade80; font-weight: bold; }
    .log-warn { color: #facc15; }
    .log-error { color: #f87171; font-weight: bold; }
    @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.6; } 100% { opacity: 1; } }
  </style>
</head>
<body>
  <div class="card">
    <h2>ESP32 Voice Console - Motores</h2>
    <div id="statusBox">Status: <span id="ledStatus" style="color:#94a3b8">DESCONHECIDO</span></div>
    <button id="btnMic" onclick="toggleVoice()">1. Iniciar Escuta de Voz</button>
  </div>

  <div class="card">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
      <span style="font-weight:bold; font-size:13px; color:#94a3b8;">Terminal de Eventos do Navegador:</span>
      <button onclick="clearConsole()" style="background:#475569; color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:10px; cursor:pointer;">Limpar</button>
    </div>
    <div id="consoleLog"></div>
  </div>

  <script>
    const consoleBox = document.getElementById('consoleLog');
    let recognition;
    let isListening = false;

    function log(msg, type = 'info') {
      const now = new Date();
      const time = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');
      const div = document.createElement('div');
      div.className = 'log-' + type;
      div.innerText = '[' + time + '] ' + msg;
      consoleBox.appendChild(div);
      consoleBox.scrollTop = consoleBox.scrollHeight;
    }

    function clearConsole() {
      consoleBox.innerHTML = '';
      log("Console limpo.", "info");
    }

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.lang = 'pt-BR';
      recognition.interimResults = false;

      recognition.onstart = function() {
        log("Microfone ATIVADO. Aguardando fala...", "success");
      };

      recognition.onaudiostart = function() {
        log("Captura de audio iniciada pelo driver.", "info");
      };

      recognition.onspeechstart = function() {
        log("Som de voz detectado! Processando...", "warn");
      };

      recognition.onresult = function(event) {
        const lastResult = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
        log("Frase reconhecida: \"" + lastResult + "\"", "success");

        if (lastResult.includes('desligar') || lastResult.includes('apagar') || lastResult.includes('desliga') || lastResult.includes('off')) {
          sendCmd('/desligar');
        } else if (lastResult.includes('ligar') || lastResult.includes('acender') || lastResult.includes('liga') || lastResult.includes('on')) {
          sendCmd('/ligar');
        } else {
          log("Comando nao mapeado. Diga 'ligar' ou 'desligar'.", "warn");
        }
      };

      recognition.onerror = function(event) {
        log("ERRO NA API DE VOZ: " + event.error, "error");
      };

      recognition.onend = function() {
        log("Reconhecimento finalizado.", "info");
        if (isListening) {
          log("Reiniciando escuta continua...", "warn");
          try { recognition.start(); } catch(e) {}
        }
      };
    } else {
      log("ERRO: Navegador sem suporte a SpeechRecognition.", "error");
    }

    function toggleVoice() {
      if (!recognition) return;
      const btn = document.getElementById('btnMic');
      if (!isListening) {
        try {
          recognition.start();
          isListening = true;
          btn.innerText = "2. Escutando... (Toque p/ Parar)";
          btn.classList.add('active');
          log("Iniciando requisicao de escuta...", "info");
        } catch(e) {
          log("Excecao ao iniciar: " + e.message, "error");
        }
      } else {
        isListening = false;
        recognition.stop();
        btn.innerText = "1. Iniciar Escuta de Voz";
        btn.classList.remove('active');
        log("Escuta pausada pelo usuario.", "warn");
      }
    }

    function sendCmd(endpoint) {
      log("Enviando HTTP GET para: " + endpoint + " ...", "info");
      fetch(endpoint)
        .then(res => res.text())
        .then(data => {
          log("ESP32 respondeu: " + data, "success");
          if(data === "LIGADO") {
            document.getElementById('ledStatus').innerHTML = '<span style="color:#4ade80">LIGADO</span>';
          } else {
            document.getElementById('ledStatus').innerHTML = '<span style="color:#f87171">DESLIGADO</span>';
          }
        })
        .catch(err => {
          log("Falha ao comunicar com ESP32: " + err.message, "error");
        });
    }

    window.onload = function() {
      log("Pagina carregada com sucesso.", "info");
      sendCmd('/status');
    };
  </script>
</body>
</html>
)rawliteral";

void handleRoot() {
  server.send(200, "text/html", PAGE_MAIN);
}

void handleLigar() {
  // Acelera suavemente se os motores estiverem parados
  if (!motoresLigados) {
    for (int velocidade = 0; velocidade <= VELOCIDADE_ALVO; velocidade++) {
      analogWrite(pinoMotor1, velocidade / 2); // Reduz pela metade (chega a 25)
      analogWrite(pinoMotor2, velocidade * 2); // Dobra a velocidade (chega a 100)
      delay(15);
    }
    motoresLigados = true;
    Serial.println("[ESP32] -> Motores LIGADOS (Pino 25: 50%, Pino 26: 200%)");
  }
  server.send(200, "text/plain", "LIGADO");
}

void handleDesligar() {
  // Desliga os motores imediatamente
  analogWrite(pinoMotor1, 0);
  analogWrite(pinoMotor2, 0);
  motoresLigados = false;
  
  Serial.println("[ESP32] -> Motores DESLIGADOS");
  server.send(200, "text/plain", "DESLIGADO");
}

void handleStatus() {
  String estado = motoresLigados ? "LIGADO" : "DESLIGADO";
  server.send(200, "text/plain", estado);
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  // Configura os pinos dos motores como saída
  pinMode(pinoMotor1, OUTPUT);
  pinMode(pinoMotor2, OUTPUT);

  // Garante que os motores iniciem desligados
  analogWrite(pinoMotor1, 0);
  analogWrite(pinoMotor2, 0);

  WiFi.softAP(ssid, password);

  server.on("/", handleRoot);
  server.on("/ligar", handleLigar);
  server.on("/desligar", handleDesligar);
  server.on("/status", handleStatus);

  server.begin();
  Serial.println("ESP32 Voice Server para Motores Atualizado.");
}

void loop() {
  // A lógica de manter a velocidade agora é gerenciada pelo estado do pino (analogWrite)
  // Então o loop() só precisa lidar com as requisições web.
  server.handleClient();
}
