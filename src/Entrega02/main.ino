// NockHug — firmware v2 (Entrega 02)
//
// Lançadora controlada pelo app mobile, por Wi-Fi (Access Point + HTTP) ou por
// Bluetooth Low Energy (GATT). Os dois transportes ficam ativos ao mesmo tempo
// e falam o mesmo contrato (PRD §10; ADR 0001).
//
// Máquina de estados (PRD §7):
//   REPOUSO --armar--> ARMADO --ligar--> LANCANDO <--pausar/retomar--> PAUSADO
//   LANCANDO/PAUSADO --desligar--> ARMADO
//   qualquer estado --emergencia--> PARADA_SEGURA --reiniciar--> REPOUSO
//
// A lançadora, e não o app, decide quando parar (ADR 0004): ao fim das N bolas
// estimadas, ao fim de uma duração pedida, ou quando o app fica 3 s sem dar
// sinal de vida (watchdog).

#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// ---------------------------------------------------------------- segurança
// Mitigações do Relatório de Vulnerabilidades (Redes e Cibersegurança).
// As credenciais ficam em segredos.h, fora do git (modelo: segredos.exemplo.h).
#include "segredos.h"
const char *ssid = NOCKHUG_SSID;
const char *password = NOCKHUG_SENHA;   // V1: senha forte no AP
const char *TOKEN = NOCKHUG_TOKEN;      // V2/V6: token nos dois transportes

const char *FW_VERSAO = "2.1.0";

// ---------------------------------------------------------------- hardware
const int pinoAlimentador = 25;  // motor de 20 RPM (base giratória)
const int pinoLancador = 26;     // motor de 14 000 RPM (roda do cano)
const int PASSOS_RAMPA = 50;     // 51 passos (0..50) de 15 ms, como na Entrega 01
const unsigned long MS_PASSO_RAMPA = 15;
// Duty final padrão, o da Entrega 01: lançador 100/255 (39,2%), alimentador
// 25/255 (9,8%). O app pode pedir outro duty a cada "ligar" (velocidade por treino).
const int DUTY_LANCADOR_PADRAO = 100;
const int DUTY_ALIMENTADOR_PADRAO = 25;
const int DUTY_MIN = 10;   // piso: um valor zerado ou inválido não deixa o motor parado em LANCANDO
const int DUTY_MAX = 255;

// ---------------------------------------------------------------- tempos
const unsigned long WATCHDOG_MS = 3000;
const unsigned long MS_POR_BOLA_PADRAO = 3000;  // provisório até calibrar
const unsigned long MS_POR_BOLA_MIN = 300;
const unsigned long MS_POR_BOLA_MAX = 20000;
const unsigned long DURACAO_MAX_MS = 600000;    // 10 min por série, no máximo

// ---------------------------------------------------------------- BLE
#define BLE_SERVICE_UUID "4e4f434b-4855-4700-8000-00000000a001"
#define BLE_CMD_UUID     "4e4f434b-4855-4700-8000-00000000a002"
#define BLE_STATUS_UUID  "4e4f434b-4855-4700-8000-00000000a003"

enum Estado { REPOUSO, ARMADO, LANCANDO, PAUSADO, PARADA_SEGURA };
const char *NOMES_ESTADO[] = { "REPOUSO", "ARMADO", "LANCANDO", "PAUSADO", "PARADA_SEGURA" };

WebServer server(80);
Preferences prefs;

Estado estado = REPOUSO;
String motivo = "";               // por que o último estado foi alcançado
String transporte = "";           // por onde veio o último comando aceito
int bolasAlvo = 0;                // 0 = treino livre
unsigned long duracaoAlvoMs = 0;  // 0 = sem limite de tempo (usada na calibração)
unsigned long msPorBola = MS_POR_BOLA_PADRAO;  // medido com o alimentador em alimentadorCalib
bool calibrado = false;
int dutyLancador = DUTY_LANCADOR_PADRAO;        // da série em andamento
int dutyAlimentador = DUTY_ALIMENTADOR_PADRAO;
int alimentadorCalib = DUTY_ALIMENTADOR_PADRAO; // duty do alimentador na calibração

unsigned long tempoAlimentandoMs = 0;  // tempo acumulado com motores ligados na série
unsigned long ultimoTick = 0;
unsigned long ultimoContato = 0;
int passoRampa = 0;
unsigned long ultimoPassoRampa = 0;

unsigned long seq = 0;            // conta comandos processados, para o app casar resposta
String ultimoResultado = "";

BLECharacteristic *bleStatus = nullptr;
bool bleConectado = false;
volatile bool blePendente = false;
String bleComando = "";
unsigned long ultimoNotify = 0;

// ---------------------------------------------------------------- motores
void zerarMotores() {
  analogWrite(pinoLancador, 0);
  analogWrite(pinoAlimentador, 0);
  passoRampa = 0;
}

// Cada passo leva os dois motores a passo/PASSOS_RAMPA do duty pedido.
void aplicarRampa(int passo) {
  analogWrite(pinoLancador, dutyLancador * passo / PASSOS_RAMPA);
  analogWrite(pinoAlimentador, dutyAlimentador * passo / PASSOS_RAMPA);
}

// A rampa roda no loop(), sem bloquear o servidor: um "desligar" dito durante
// a aceleração é atendido na hora (corrige a §3.1 da Entrega 01).
void avancarRampa(unsigned long agora) {
  if (estado != LANCANDO || passoRampa >= PASSOS_RAMPA) return;
  if (agora - ultimoPassoRampa < MS_PASSO_RAMPA) return;
  ultimoPassoRampa = agora;
  passoRampa++;
  aplicarRampa(passoRampa);
}

// A calibração vale para o duty em que foi medida. Com o alimentador em outra
// velocidade, o tempo por bola escala na proporção inversa (aproximação: um
// motor com redução não responde de forma perfeitamente linear ao duty).
unsigned long msPorBolaAtual() {
  return max(MS_POR_BOLA_MIN, msPorBola * (unsigned long)alimentadorCalib / (unsigned long)dutyAlimentador);
}

int bolasEstimadas() {
  return (int)(tempoAlimentandoMs / msPorBolaAtual());
}

int limitarDuty(long d) {
  return (int)constrain(d, (long)DUTY_MIN, (long)DUTY_MAX);
}

void mudarEstado(Estado novo, const String &porque) {
  estado = novo;
  motivo = porque;
  if (novo != LANCANDO) zerarMotores();
  Serial.printf("[NockHug] -> %s (%s)\n", NOMES_ESTADO[novo], porque.c_str());
}

// ---------------------------------------------------------------- status
String statusJson() {
  String j = "{";
  j += "\"estado\":\"" + String(NOMES_ESTADO[estado]) + "\"";
  j += ",\"motivo\":" + (motivo.length() ? "\"" + motivo + "\"" : String("null"));
  j += ",\"bolasAlvo\":" + String(bolasAlvo);
  j += ",\"bolasEstimadas\":" + String(bolasEstimadas());
  j += ",\"tempoMs\":" + String(tempoAlimentandoMs);
  j += ",\"msPorBola\":" + String(msPorBola);
  j += ",\"calibrado\":" + String(calibrado ? "true" : "false");
  j += ",\"lancador\":" + String(dutyLancador);
  j += ",\"alimentador\":" + String(dutyAlimentador);
  j += ",\"alimentadorCalib\":" + String(alimentadorCalib);
  j += ",\"transporte\":" + (transporte.length() ? "\"" + transporte + "\"" : String("null"));
  j += ",\"seq\":" + String(seq);
  j += ",\"resultado\":" + (ultimoResultado.length() ? "\"" + ultimoResultado + "\"" : String("null"));
  j += ",\"fw\":\"" + String(FW_VERSAO) + "\"";
  j += "}";
  return j;
}

void notificarBle() {
  if (!bleStatus) return;
  String j = statusJson();
  bleStatus->setValue(j.c_str());
  if (bleConectado) bleStatus->notify();
}

// ---------------------------------------------------------------- comandos
// Resultado de um comando: código no estilo HTTP (200, 400, 401, 409).
int executar(const String &op, const String &arg, const String &token, const String &via) {
  seq++;

  if (op == "status") { ultimoResultado = "ok"; return 200; }

  if (token != TOKEN) {
    ultimoResultado = "nao_autorizado";
    Serial.printf("[NockHug] -> %s NEGADO via %s (token)\n", op.c_str(), via.c_str());
    return 401;
  }

  ultimoContato = millis();
  if (op == "ping") { ultimoResultado = "ok"; return 200; }

  int codigo = 409;

  // A emergência vale em qualquer estado e não depende de nada.
  if (op == "emergencia") {
    mudarEstado(PARADA_SEGURA, "emergencia");
    codigo = 200;
  } else if (estado == PARADA_SEGURA) {
    // Em PARADA_SEGURA nenhum comando chega à máquina, exceto reiniciar.
    if (op == "reiniciar") { mudarEstado(REPOUSO, "reiniciada"); codigo = 200; }
  } else if (op == "armar") {
    if (estado == REPOUSO) { mudarEstado(ARMADO, "checklist"); codigo = 200; }
    else if (estado == ARMADO) codigo = 200;
  } else if (op == "desarmar") {
    if (estado == ARMADO) { mudarEstado(REPOUSO, "desarmada"); codigo = 200; }
  } else if (op == "ligar") {
    // Trava dupla: o app já confere, mas a lançadora confere de novo.
    if (estado == ARMADO) {
      bolasAlvo = 0;
      duracaoAlvoMs = 0;
      dutyLancador = DUTY_LANCADOR_PADRAO;
      dutyAlimentador = DUTY_ALIMENTADOR_PADRAO;
      // arg: "N" (bolas; 0 = livre) ou "t:MS" (duração, usada na calibração),
      // seguido opcionalmente de ",l:DUTY,a:DUTY" (velocidade de cada motor).
      int virgula = arg.indexOf(',');
      String alvo = virgula < 0 ? arg : arg.substring(0, virgula);
      if (alvo.startsWith("t:")) duracaoAlvoMs = min((unsigned long)alvo.substring(2).toInt(), DURACAO_MAX_MS);
      else bolasAlvo = max(0, (int)alvo.toInt());
      while (virgula >= 0) {
        int proxima = arg.indexOf(',', virgula + 1);
        String par = proxima < 0 ? arg.substring(virgula + 1) : arg.substring(virgula + 1, proxima);
        if (par.startsWith("l:")) dutyLancador = limitarDuty(par.substring(2).toInt());
        else if (par.startsWith("a:")) dutyAlimentador = limitarDuty(par.substring(2).toInt());
        virgula = proxima;
      }
      tempoAlimentandoMs = 0;
      passoRampa = 0;
      ultimoTick = millis();
      mudarEstado(LANCANDO, "ligar");
      codigo = 200;
    }
  } else if (op == "desligar") {
    if (estado == LANCANDO || estado == PAUSADO) { mudarEstado(ARMADO, "desligar"); codigo = 200; }
  } else if (op == "pausar") {
    if (estado == LANCANDO) { mudarEstado(PAUSADO, "pausar"); codigo = 200; }
  } else if (op == "retomar") {
    if (estado == PAUSADO) {
      passoRampa = 0;
      ultimoTick = millis();
      mudarEstado(LANCANDO, "retomar");
      codigo = 200;
    }
  } else if (op == "calibrar") {
    unsigned long ms = (unsigned long)arg.toInt();
    if (estado != LANCANDO && ms >= MS_POR_BOLA_MIN && ms <= MS_POR_BOLA_MAX) {
      // A medição foi feita na série anterior, com o alimentador em dutyAlimentador.
      msPorBola = ms;
      alimentadorCalib = dutyAlimentador;
      calibrado = true;
      prefs.putULong("msPorBola", msPorBola);
      prefs.putInt("alimCalib", alimentadorCalib);
      Serial.printf("[NockHug] -> calibrado: %lu ms por bola (alimentador %d/255)\n", msPorBola, alimentadorCalib);
      codigo = 200;
    } else if (estado != LANCANDO) {
      codigo = 400;
    }
  } else {
    codigo = 400;
  }

  if (codigo == 200) transporte = via;
  ultimoResultado = codigo == 200 ? "ok" : (codigo == 409 ? "estado_invalido" : "invalido");
  return codigo;
}

// ---------------------------------------------------------------- HTTP
void responder(int codigo) {
  server.send(codigo, "application/json", statusJson());
  notificarBle();
}

void rotaHttp(const char *op) {
  String arg = "";
  if (server.hasArg("bolas")) arg = server.arg("bolas");
  if (server.hasArg("duracaoMs")) arg = "t:" + server.arg("duracaoMs");
  if (server.hasArg("msPorBola")) arg = server.arg("msPorBola");
  if (server.hasArg("lancador")) arg += ",l:" + server.arg("lancador");
  if (server.hasArg("alimentador")) arg += ",a:" + server.arg("alimentador");
  responder(executar(op, arg, server.arg("token"), "wifi"));
}

void handleRoot() {
  server.send(200, "text/plain",
    "NockHug firmware " + String(FW_VERSAO) + "\nUse o app NockHug para controlar a lancadora.\n");
}

// ---------------------------------------------------------------- BLE
class ServidorCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *s) override { bleConectado = true; }
  void onDisconnect(BLEServer *s) override {
    bleConectado = false;
    BLEDevice::startAdvertising();  // volta a anunciar para reconexão manual
  }
};

// O callback só guarda o comando; quem executa é o loop(), para não disputar
// o estado com o servidor HTTP.
class ComandoCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *c) override {
    if (blePendente) return;  // um comando por vez
    bleComando = String(c->getValue().c_str());
    blePendente = true;
  }
};

// Formato da escrita: "token|operacao|argumento"
void processarBle() {
  if (!blePendente) return;
  String cmd = bleComando;
  blePendente = false;

  int p1 = cmd.indexOf('|');
  int p2 = cmd.indexOf('|', p1 + 1);
  if (p1 < 0) { seq++; ultimoResultado = "invalido"; notificarBle(); return; }
  String token = cmd.substring(0, p1);
  String op = p2 < 0 ? cmd.substring(p1 + 1) : cmd.substring(p1 + 1, p2);
  String arg = p2 < 0 ? "" : cmd.substring(p2 + 1);
  op.trim();
  arg.trim();

  executar(op, arg, token, "ble");
  notificarBle();
}

void iniciarBle() {
  uint8_t mac[6];
  WiFi.macAddress(mac);
  char nome[20];
  snprintf(nome, sizeof(nome), "NockHug-%02X%02X", mac[4], mac[5]);

  BLEDevice::init(nome);
  BLEDevice::setMTU(247);  // cabe o JSON de status inteiro numa notificação
  BLEServer *srv = BLEDevice::createServer();
  srv->setCallbacks(new ServidorCallbacks());
  BLEService *svc = srv->createService(BLE_SERVICE_UUID);

  BLECharacteristic *cmd = svc->createCharacteristic(
    BLE_CMD_UUID, BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR);
  cmd->setCallbacks(new ComandoCallbacks());

  bleStatus = svc->createCharacteristic(
    BLE_STATUS_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  bleStatus->addDescriptor(new BLE2902());
  bleStatus->setValue(statusJson().c_str());

  svc->start();
  BLEAdvertising *adv = BLEDevice::getAdvertising();
  adv->addServiceUUID(BLE_SERVICE_UUID);
  adv->setScanResponse(true);
  BLEDevice::startAdvertising();
  Serial.printf("[NockHug] BLE anunciando como %s\n", nome);
}

// ---------------------------------------------------------------- ciclo
void atualizarSerie(unsigned long agora) {
  if (estado != LANCANDO) { ultimoTick = agora; return; }

  tempoAlimentandoMs += agora - ultimoTick;
  ultimoTick = agora;

  // Watchdog: sem sinal do app por 3 s, para os motores (PRD §7, regra 4).
  if (agora - ultimoContato > WATCHDOG_MS) {
    mudarEstado(PAUSADO, "conexao_perdida");
    notificarBle();
    return;
  }

  bool fimBolas = bolasAlvo > 0 && bolasEstimadas() >= bolasAlvo;
  bool fimTempo = duracaoAlvoMs > 0 && tempoAlimentandoMs >= duracaoAlvoMs;
  if (fimBolas || fimTempo) {
    mudarEstado(ARMADO, fimBolas ? "serie_concluida" : "tempo_concluido");
    notificarBle();
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);

  // Pinos zerados antes de qualquer outra coisa.
  pinMode(pinoLancador, OUTPUT);
  pinMode(pinoAlimentador, OUTPUT);
  zerarMotores();

  prefs.begin("nockhug", false);
  msPorBola = prefs.getULong("msPorBola", 0);
  calibrado = msPorBola != 0;
  if (!calibrado) msPorBola = MS_POR_BOLA_PADRAO;
  alimentadorCalib = limitarDuty(prefs.getInt("alimCalib", DUTY_ALIMENTADOR_PADRAO));

  WiFi.mode(WIFI_AP);
  WiFi.softAP(ssid, password);

  server.on("/", handleRoot);
  server.on("/status", []() { responder(executar("status", "", "", "wifi")); });
  server.on("/ping", []() { rotaHttp("ping"); });
  server.on("/armar", []() { rotaHttp("armar"); });
  server.on("/desarmar", []() { rotaHttp("desarmar"); });
  server.on("/ligar", []() { rotaHttp("ligar"); });
  server.on("/desligar", []() { rotaHttp("desligar"); });
  server.on("/pausar", []() { rotaHttp("pausar"); });
  server.on("/retomar", []() { rotaHttp("retomar"); });
  server.on("/emergencia", []() { rotaHttp("emergencia"); });
  server.on("/reiniciar", []() { rotaHttp("reiniciar"); });
  server.on("/calibrar", []() { rotaHttp("calibrar"); });
  server.begin();

  iniciarBle();
  Serial.printf("[NockHug] firmware %s pronto. AP %s em %s\n",
    FW_VERSAO, ssid, WiFi.softAPIP().toString().c_str());
}

void loop() {
  server.handleClient();
  processarBle();
  // Lido depois dos comandos: eles gravam ultimoContato/ultimoTick com millis(),
  // e um "agora" anterior a isso faria agora - ultimoContato estourar (unsigned)
  // e disparar o watchdog no mesmo instante.
  unsigned long agora = millis();
  avancarRampa(agora);
  atualizarSerie(agora);

  // Com o app conectado por BLE, o status sai a cada 500 ms.
  if (bleConectado && agora - ultimoNotify >= 500) {
    ultimoNotify = agora;
    notificarBle();
  }
}
