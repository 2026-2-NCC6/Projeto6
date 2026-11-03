import { randomBytes } from 'node:crypto';
import type { PatchTreino, SessaoDoc, TreinoDoc } from './armazenamento.js';
import { falha, invalido } from './erros.js';
import {
  CATEGORIAS,
  IDS_RESERVADOS,
  LIMITE_COMANDOS,
  LIMITE_SERIES,
  LIMITES,
  NIVEIS,
  NOME_MAX,
  OBJETIVOS,
  PRESETS,
  XP_MAX,
  duracaoEstimadaMin,
  presetDaVelocidade,
  velocidadeValida,
  type Categoria,
  type Nivel,
  type Objetivo,
  type Preset,
  type Velocidade,
} from './limites.js';

const PROIBIDOS_CRIAR = ['status', 'versao', 'autorId', 'publicadoEm', 'atualizadoEm', 'duracaoEstimadaMin'] as const;
const PROIBIDOS_PATCH = ['id', ...PROIBIDOS_CRIAR] as const;

function texto(valor: unknown): string | undefined {
  return typeof valor === 'string' ? valor : undefined;
}

function inteiroNoCampo(valor: unknown, campo: string, campos: Record<string, string>): number | undefined {
  if (valor === undefined) return undefined;
  if (typeof valor !== 'number' || !Number.isInteger(valor)) {
    campos[campo] = 'Use um número inteiro.';
    return undefined;
  }
  return valor;
}

function faixaPasso(valor: number, min: number, max: number, passo: number): boolean {
  return valor >= min && valor <= max && (valor - min) % passo === 0;
}

export function validarCorpoObjeto(corpo: unknown): Record<string, unknown> {
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) {
    throw falha(400, 'pedido_invalido', 'O corpo precisa ser um objeto JSON.');
  }
  return corpo as Record<string, unknown>;
}

export function lerLimite(valor: unknown): number {
  if (valor === undefined) return 20;
  if (Array.isArray(valor) || typeof valor !== 'string' || !/^\d+$/.test(valor)) {
    throw falha(400, 'pedido_invalido', 'O limite é inválido.');
  }
  const n = Number(valor);
  if (n < 1) throw falha(400, 'pedido_invalido', 'O limite é inválido.');
  return Math.min(n, 50);
}

export function enumQuery<T extends string>(valor: unknown, permitidos: readonly T[], nome: string): T | undefined {
  if (valor === undefined) return undefined;
  if (typeof valor !== 'string' || !permitidos.includes(valor as T)) {
    throw falha(400, 'pedido_invalido', `${nome} é inválido.`);
  }
  return valor as T;
}

function rejeitarProibidos(corpo: Record<string, unknown>, chaves: readonly string[], campos: Record<string, string>): void {
  for (const chave of chaves) {
    if (chave in corpo) campos[chave] = 'Este campo não pode ser alterado por aqui.';
  }
}

function lerOpcionais(corpo: Record<string, unknown>, campos: Record<string, string>, destino: PatchTreino): void {
  if ('bolasPorSerie' in corpo) {
    const n = inteiroNoCampo(corpo.bolasPorSerie, 'bolasPorSerie', campos);
    if (n !== undefined) destino.bolasPorSerie = n;
  }
  if ('series' in corpo) {
    const n = inteiroNoCampo(corpo.series, 'series', campos);
    if (n !== undefined) destino.series = n;
  }
  if ('descansoS' in corpo) {
    const n = inteiroNoCampo(corpo.descansoS, 'descansoS', campos);
    if (n !== undefined) destino.descansoS = n;
  }
  if ('velocidade' in corpo) {
    if (corpo.velocidade === null) destino.velocidade = null;
    else if (!velocidadeValida(corpo.velocidade)) campos.velocidade = 'Lançador de 0 a 100% e alimentador de 15 a 40%.';
    else destino.velocidade = corpo.velocidade;
  }
  if ('preset' in corpo) {
    if (typeof corpo.preset !== 'string' || !PRESETS.includes(corpo.preset as Preset)) campos.preset = 'O preset é inválido.';
    else destino.preset = corpo.preset as Preset;
  }
  if ('categoria' in corpo) {
    if (typeof corpo.categoria !== 'string' || !CATEGORIAS.includes(corpo.categoria as Categoria)) campos.categoria = 'A categoria é inválida.';
    else destino.categoria = corpo.categoria as Categoria;
  }
  if ('objetivo' in corpo) {
    if (typeof corpo.objetivo !== 'string' || !OBJETIVOS.includes(corpo.objetivo as Objetivo)) campos.objetivo = 'O objetivo é inválido.';
    else destino.objetivo = corpo.objetivo as Objetivo;
  }
  if ('nivel' in corpo) {
    if (typeof corpo.nivel !== 'string' || !NIVEIS.includes(corpo.nivel as Nivel)) campos.nivel = 'O nível é inválido.';
    else destino.nivel = corpo.nivel as Nivel;
  }
  if ('publico' in corpo) {
    if (corpo.publico !== 'adulto') campos.publico = 'O público é adulto.';
    else destino.publico = 'adulto';
  }
  if ('licenca' in corpo) {
    if (corpo.licenca !== 'uso-academico') campos.licenca = 'A licença é uso acadêmico.';
    else destino.licenca = 'uso-academico';
  }
  if ('remuneracao' in corpo) {
    if (corpo.remuneracao !== 'gratuito') campos.remuneracao = 'A remuneração é gratuita.';
    else destino.remuneracao = 'gratuito';
  }
  if ('padrao' in corpo) destino.padrao = false;
}

function conferirNumeros(doc: { bolasPorSerie?: number; series?: number; descansoS?: number }, campos: Record<string, string>, exigidos: boolean): void {
  const bolas = doc.bolasPorSerie;
  const series = doc.series;
  const descanso = doc.descansoS;
  const livre = bolas === 0;
  if (bolas === undefined && series === undefined && descanso === undefined && !exigidos) return;
  if (livre) {
    if (series !== undefined && series !== 0) campos.series = 'No treino livre, séries é 0.';
    if (descanso !== undefined && descanso !== 0) campos.descansoS = 'No treino livre, o descanso é 0.';
    if (exigidos && series !== 0) campos.series = 'No treino livre, séries é 0.';
    if (exigidos && descanso !== 0) campos.descansoS = 'No treino livre, o descanso é 0.';
    return;
  }
  if (bolas === undefined) {
    if (exigidos) campos.bolasPorSerie = 'Informe as bolas por série.';
  } else if (!faixaPasso(bolas, LIMITES.bolasPorSerie.min, LIMITES.bolasPorSerie.max, LIMITES.bolasPorSerie.passo)) {
    campos.bolasPorSerie = 'Use de 5 a 60 bolas, de 5 em 5.';
  }
  if (series === undefined) {
    if (exigidos) campos.series = 'Informe as séries.';
  } else if (!faixaPasso(series, LIMITES.series.min, LIMITES.series.max, LIMITES.series.passo)) {
    campos.series = 'Use de 1 a 10 séries.';
  }
  if (descanso === undefined) {
    if (exigidos) campos.descansoS = 'Informe o descanso.';
  } else if (!faixaPasso(descanso, LIMITES.descansoS.min, LIMITES.descansoS.max, LIMITES.descansoS.passo)) {
    campos.descansoS = 'Use de 10 a 120 segundos, de 5 em 5.';
  }
}

export function novoIdPublico(): string {
  return `pub-${randomBytes(6).toString('hex')}`;
}

export function validarNovoTreino(corpo: unknown, agora: string): { id: string; doc: TreinoDoc; autorPronto: true } {
  const json = validarCorpoObjeto(corpo);
  const campos: Record<string, string> = {};
  rejeitarProibidos(json, PROIBIDOS_CRIAR, campos);
  const nome = texto(json.nome)?.trim() ?? '';
  if (!nome) campos.nome = 'Dê um nome ao treino.';
  else if (nome.length > NOME_MAX) campos.nome = `Use no máximo ${NOME_MAX} caracteres.`;

  let id = novoIdPublico();
  if ('id' in json) {
    if (typeof json.id !== 'string') campos.id = 'O id é inválido.';
    else if ((IDS_RESERVADOS as readonly string[]).includes(json.id)) {
      throw falha(422, 'id_reservado', 'Este id é reservado aos treinos do app.', { campos: { id: 'Este id é reservado.' } });
    } else if (!/^pub-[0-9a-f]{12}$/.test(json.id)) campos.id = 'O id precisa ser pub- seguido de 12 hexadecimais.';
    else id = json.id;
  }

  const patch: PatchTreino = {};
  lerOpcionais(json, campos, patch);
  if (Object.keys(campos).length) throw invalido(campos);
  conferirNumeros(patch, campos, false);
  if (Object.keys(campos).length) throw invalido(campos);

  const doc: TreinoDoc = {
    id,
    nome,
    padrao: false,
    status: 'rascunho',
    versao: 0,
    atualizadoEm: agora,
  };
  aplicarPatch(doc, patch);
  doc.padrao = false;
  doc.status = 'rascunho';
  doc.versao = 0;
  doc.atualizadoEm = agora;
  return { id, doc, autorPronto: true };
}

export function aplicarPatch(doc: TreinoDoc, patch: PatchTreino): TreinoDoc {
  if (patch.nome !== undefined) doc.nome = patch.nome.trim();
  if (patch.bolasPorSerie !== undefined) doc.bolasPorSerie = patch.bolasPorSerie;
  if (patch.series !== undefined) doc.series = patch.series;
  if (patch.descansoS !== undefined) doc.descansoS = patch.descansoS;
  if ('velocidade' in patch) {
    if (patch.velocidade === null) {
      delete doc.velocidade;
      delete doc.preset;
    }
    else if (patch.velocidade) {
      doc.velocidade = patch.velocidade;
      doc.preset = presetDaVelocidade(patch.velocidade);
    }
  }
  if (patch.preset !== undefined && !('velocidade' in patch)) doc.preset = patch.preset;
  if (patch.categoria !== undefined) doc.categoria = patch.categoria;
  if (patch.objetivo !== undefined) doc.objetivo = patch.objetivo;
  if (patch.nivel !== undefined) doc.nivel = patch.nivel;
  if (patch.publico !== undefined) doc.publico = patch.publico;
  if (patch.licenca !== undefined) doc.licenca = patch.licenca;
  if (patch.remuneracao !== undefined) doc.remuneracao = patch.remuneracao;
  doc.padrao = false;
  return doc;
}

export function validarPatch(corpo: unknown): PatchTreino {
  const json = validarCorpoObjeto(corpo);
  const campos: Record<string, string> = {};
  rejeitarProibidos(json, PROIBIDOS_PATCH, campos);
  if ('nome' in json) {
    const nome = texto(json.nome)?.trim() ?? '';
    if (!nome) campos.nome = 'Dê um nome ao treino.';
    else if (nome.length > NOME_MAX) campos.nome = `Use no máximo ${NOME_MAX} caracteres.`;
  }
  const patch: PatchTreino = {};
  if ('nome' in json && typeof json.nome === 'string') patch.nome = json.nome;
  lerOpcionais(json, campos, patch);
  if (Object.keys(campos).length) throw invalido(campos);
  return patch;
}

export function validarRascunhoResultante(doc: TreinoDoc): void {
  const campos: Record<string, string> = {};
  const nome = doc.nome.trim();
  if (!nome) campos.nome = 'Dê um nome ao treino.';
  else if (nome.length > NOME_MAX) campos.nome = `Use no máximo ${NOME_MAX} caracteres.`;
  conferirNumeros(doc, campos, false);
  if (doc.velocidade && !velocidadeValida(doc.velocidade)) campos.velocidade = 'Lançador de 0 a 100% e alimentador de 15 a 40%.';
  if (Object.keys(campos).length) throw invalido(campos);
}

export function validarParaPublicar(doc: TreinoDoc): Record<string, string> {
  const campos: Record<string, string> = {};
  const nome = doc.nome?.trim() ?? '';
  if (!nome) campos.nome = 'Dê um nome ao treino.';
  else if (nome.length > NOME_MAX) campos.nome = `Use no máximo ${NOME_MAX} caracteres.`;
  conferirNumeros(
    {
      bolasPorSerie: doc.bolasPorSerie,
      series: doc.series,
      descansoS: doc.descansoS,
    },
    campos,
    true,
  );
  if (!doc.velocidade) campos.velocidade = 'Escolha a velocidade dos motores.';
  else if (!velocidadeValida(doc.velocidade)) campos.velocidade = 'Lançador de 0 a 100% e alimentador de 15 a 40%.';
  if (!doc.categoria || !CATEGORIAS.includes(doc.categoria)) campos.categoria = 'Escolha a categoria.';
  if (!doc.objetivo || !OBJETIVOS.includes(doc.objetivo)) campos.objetivo = 'Escolha o objetivo.';
  if (!doc.nivel || !NIVEIS.includes(doc.nivel)) campos.nivel = 'Escolha o nível.';
  if (doc.publico && doc.publico !== 'adulto') campos.publico = 'O público é adulto.';
  if (doc.licenca !== 'uso-academico') campos.licenca = 'A licença é uso acadêmico.';
  if (doc.remuneracao !== 'gratuito') campos.remuneracao = 'A remuneração é gratuita.';
  return campos;
}

export function documentoPublicado(doc: TreinoDoc, agora: string): TreinoDoc {
  const campos = validarParaPublicar(doc);
  if (Object.keys(campos).length) throw invalido(campos);
  const livre = doc.bolasPorSerie === 0;
  const bolas = livre ? 0 : doc.bolasPorSerie!;
  const series = livre ? 0 : doc.series!;
  const descansoS = livre ? 0 : doc.descansoS!;
  const velocidade = doc.velocidade as Velocidade;
  return {
    ...structuredClone(doc),
    nome: doc.nome.trim(),
    bolasPorSerie: bolas,
    series,
    descansoS,
    padrao: false,
    velocidade,
    preset: presetDaVelocidade(velocidade),
    status: 'publicado',
    versao: doc.versao + 1,
    publico: 'adulto',
    licenca: 'uso-academico',
    remuneracao: 'gratuito',
    duracaoEstimadaMin: duracaoEstimadaMin({ bolasPorSerie: bolas, series, descansoS }),
    publicadoEm: agora,
    atualizadoEm: agora,
  };
}

function inteiroCampo(valor: unknown, campo: string, campos: Record<string, string>): number | undefined {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    campos[campo] = 'Use um número.';
    return undefined;
  }
  return valor;
}

export function validarSessao(corpo: unknown): SessaoDoc {
  const json = validarCorpoObjeto(corpo);
  const campos: Record<string, string> = {};
  const id = texto(json.id)?.trim() ?? '';
  if (!id || id.length > 40) campos.id = 'Informe o id da sessão.';

  const treinoBruto = json.treino;
  let treino: SessaoDoc['treino'] | undefined;
  if (!treinoBruto || typeof treinoBruto !== 'object' || Array.isArray(treinoBruto)) {
    campos.treino = 'A sessão precisa do treino.';
  } else {
    const t = treinoBruto as Record<string, unknown>;
    const tid = texto(t.id)?.trim() ?? '';
    const nome = texto(t.nome)?.trim() ?? '';
    const bolas = inteiroCampo(t.bolasPorSerie, 'treino.bolasPorSerie', campos);
    const series = inteiroCampo(t.series, 'treino.series', campos);
    const descanso = inteiroCampo(t.descansoS, 'treino.descansoS', campos);
    if (!tid) campos['treino.id'] = 'O treino precisa de id.';
    if (!nome) campos['treino.nome'] = 'O treino precisa de nome.';
    if (t.velocidade !== undefined && t.velocidade !== null && !velocidadeValida(t.velocidade)) {
      campos['treino.velocidade'] = 'A velocidade do treino é inválida.';
    }
    if (!campos['treino.bolasPorSerie'] && bolas !== undefined && series !== undefined && descanso !== undefined && tid && nome) {
      treino = {
        id: tid,
        nome: nome.slice(0, NOME_MAX),
        bolasPorSerie: bolas,
        series,
        descansoS: descanso,
        padrao: t.padrao === true,
        ...(velocidadeValida(t.velocidade) ? { velocidade: t.velocidade, preset: presetDaVelocidade(t.velocidade) } : {}),
      };
    }
  }

  const inicio = inteiroCampo(json.inicio, 'inicio', campos);
  const fim = inteiroCampo(json.fim, 'fim', campos);
  if (inicio !== undefined && fim !== undefined && fim < inicio) campos.fim = 'O fim não pode ser anterior ao início.';
  if (json.xp === undefined || typeof json.xp !== 'number' || !Number.isInteger(json.xp) || json.xp < 0 || json.xp > XP_MAX) {
    campos.xp = 'O XP fica entre 0 e 100000.';
  }
  if (json.transporte !== 'wifi' && json.transporte !== 'ble' && json.transporte !== 'simulada') {
    campos.transporte = 'O transporte é wifi, ble ou simulada.';
  }
  if (json.encerradaPor !== 'concluida' && json.encerradaPor !== 'praticante' && json.encerradaPor !== 'parada_segura') {
    campos.encerradaPor = 'O encerramento é inválido.';
  }

  const motivos = new Set(['serie_concluida', 'desligar', 'emergencia', 'conexao_perdida', 'encerrada']);
  const origens = new Set(['voz', 'botao', 'auto']);
  let series: SessaoDoc['series'] = [];
  if (!Array.isArray(json.series)) campos.series = 'As séries precisam ser uma lista.';
  else if (json.series.length > LIMITE_SERIES) campos.series = 'No máximo 30 séries.';
  else {
    series = json.series.map((item, i) => {
      const s = (item ?? {}) as Record<string, unknown>;
      const motivo = texto(s.motivo) ?? '';
      if (!motivos.has(motivo)) campos[`series.${i}.motivo`] = 'Motivo inválido.';
      if (typeof s.indice !== 'number' || typeof s.bolas !== 'number' || typeof s.inicio !== 'number' || typeof s.fim !== 'number') {
        campos[`series.${i}`] = 'Série incompleta.';
      }
      return {
        indice: Number(s.indice),
        bolas: Number(s.bolas),
        inicio: Number(s.inicio),
        fim: Number(s.fim),
        motivo: motivo as SessaoDoc['series'][number]['motivo'],
      };
    });
  }

  let comandos: SessaoDoc['comandos'] = [];
  if (!Array.isArray(json.comandos)) campos.comandos = 'Os comandos precisam ser uma lista.';
  else if (json.comandos.length > LIMITE_COMANDOS) campos.comandos = 'No máximo 500 comandos.';
  else {
    comandos = json.comandos.map((item, i) => {
      const c = (item ?? {}) as Record<string, unknown>;
      const origem = texto(c.origem) ?? '';
      if (!origens.has(origem)) campos[`comandos.${i}.origem`] = 'Origem inválida.';
      if (typeof c.ts !== 'number' || typeof c.comando !== 'string' || typeof c.aceito !== 'boolean' || typeof c.transcricao !== 'string') {
        campos[`comandos.${i}`] = 'Comando incompleto.';
      }
      const latencia = c.latenciaMs;
      if (latencia !== null && typeof latencia !== 'number') campos[`comandos.${i}.latenciaMs`] = 'Latência inválida.';
      const motivo = c.motivo;
      if (motivo !== null && typeof motivo !== 'string') campos[`comandos.${i}.motivo`] = 'Motivo inválido.';
      return {
        ts: Number(c.ts),
        origem: origem as SessaoDoc['comandos'][number]['origem'],
        transcricao: typeof c.transcricao === 'string' ? c.transcricao : '',
        comando: typeof c.comando === 'string' ? c.comando : '',
        aceito: c.aceito === true,
        motivo: typeof motivo === 'string' ? motivo : null,
        latenciaMs: typeof latencia === 'number' ? latencia : null,
      };
    });
  }

  if (Object.keys(campos).length || !treino || inicio === undefined || fim === undefined) throw invalido(campos);
  return {
    id,
    treino,
    inicio,
    fim,
    transporte: json.transporte as SessaoDoc['transporte'],
    series,
    comandos,
    encerradaPor: json.encerradaPor as SessaoDoc['encerradaPor'],
    xp: json.xp as number,
  };
}
