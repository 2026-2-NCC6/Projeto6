// Repositório local (local-first, ADR 0003). As telas só conhecem esta
// interface; quando a API existir, ela ganha uma implementação que sincroniza
// sem que nenhuma tela mude.

import * as SQLite from 'expo-sqlite';
import type { ItemFila } from '@/dados/sincronizacao';
import type { IdConquista } from '@/dominio/gamificacao';
import type { Configuracao, Perfil, Sessao, Treino } from '@/dominio/tipos';

export type { ItemFila };

export interface Repositorio {
  lerPerfil(): Promise<Perfil | null>;
  salvarPerfil(p: Perfil): Promise<void>;
  lerConfig(): Promise<Configuracao | null>;
  salvarConfig(c: Configuracao): Promise<void>;
  listarSessoes(): Promise<Sessao[]>;
  salvarSessao(s: Sessao): Promise<void>;
  listarTreinos(): Promise<Treino[]>;
  salvarTreino(t: Treino): Promise<void>;
  apagarTreino(id: string): Promise<void>;
  listarConquistas(): Promise<Map<IdConquista, number>>;
  registrarConquistas(ids: IdConquista[], em: number): Promise<void>;
  exportar(): Promise<string>;
  apagarTudo(): Promise<void>;
  listarFila(): Promise<ItemFila[]>;
  gravarFila(item: ItemFila): Promise<void>;
}

function jsonOuNulo<T>(json: string): T | null {
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

const ESQUEMA = `
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS kv (chave TEXT PRIMARY KEY NOT NULL, valor TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessoes (id TEXT PRIMARY KEY NOT NULL, inicio INTEGER NOT NULL, json TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS sessoes_inicio ON sessoes (inicio);
CREATE TABLE IF NOT EXISTS treinos (id TEXT PRIMARY KEY NOT NULL, json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS conquistas (id TEXT PRIMARY KEY NOT NULL, em INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS fila (
  id TEXT PRIMARY KEY NOT NULL,
  tipo TEXT NOT NULL,
  json TEXT NOT NULL,
  tentativas INTEGER NOT NULL,
  estado TEXT NOT NULL,
  ultimo_erro TEXT
);
`;

export class RepositorioSqlite implements Repositorio {
  private db: SQLite.SQLiteDatabase | null = null;

  private async banco(): Promise<SQLite.SQLiteDatabase> {
    if (!this.db) {
      this.db = await SQLite.openDatabaseAsync('nockhug.db');
      await this.db.execAsync(ESQUEMA);
    }
    return this.db;
  }

  private async lerKv<T>(chave: string): Promise<T | null> {
    const r = await (await this.banco()).getFirstAsync<{ valor: string }>('SELECT valor FROM kv WHERE chave = ?', chave);
    if (!r) return null;
    try {
      return JSON.parse(r.valor) as T;
    } catch {
      // Um registro corrompido não pode impedir o app de abrir.
      return null;
    }
  }

  private async gravarKv(chave: string, valor: unknown) {
    await (await this.banco()).runAsync('INSERT OR REPLACE INTO kv (chave, valor) VALUES (?, ?)', chave, JSON.stringify(valor));
  }

  lerPerfil = () => this.lerKv<Perfil>('perfil');
  salvarPerfil = (p: Perfil) => this.gravarKv('perfil', p);
  lerConfig = () => this.lerKv<Configuracao>('config');
  salvarConfig = (c: Configuracao) => this.gravarKv('config', c);

  async listarSessoes(): Promise<Sessao[]> {
    const rs = await (await this.banco()).getAllAsync<{ json: string }>('SELECT json FROM sessoes ORDER BY inicio DESC');
    return rs.map((r) => jsonOuNulo<Sessao>(r.json)).filter((s): s is Sessao => !!s);
  }

  async salvarSessao(s: Sessao) {
    await (await this.banco()).runAsync('INSERT OR REPLACE INTO sessoes (id, inicio, json) VALUES (?, ?, ?)', s.id, s.inicio, JSON.stringify(s));
  }

  async listarTreinos(): Promise<Treino[]> {
    // rowid preserva a ordem de criação mesmo depois de editar um treino.
    const rs = await (await this.banco()).getAllAsync<{ json: string }>('SELECT json FROM treinos ORDER BY rowid');
    return rs.map((r) => jsonOuNulo<Treino>(r.json)).filter((t): t is Treino => !!t);
  }

  async salvarTreino(t: Treino) {
    // UPSERT (e não INSERT OR REPLACE) para editar sem trocar a posição na lista.
    await (await this.banco()).runAsync(
      'INSERT INTO treinos (id, json) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET json = excluded.json',
      t.id,
      JSON.stringify(t),
    );
  }

  async apagarTreino(id: string) {
    await (await this.banco()).runAsync('DELETE FROM treinos WHERE id = ?', id);
  }

  async listarConquistas(): Promise<Map<IdConquista, number>> {
    const rs = await (await this.banco()).getAllAsync<{ id: IdConquista; em: number }>('SELECT id, em FROM conquistas');
    return new Map(rs.map((r) => [r.id, r.em]));
  }

  async registrarConquistas(ids: IdConquista[], em: number) {
    const db = await this.banco();
    for (const id of ids) await db.runAsync('INSERT OR IGNORE INTO conquistas (id, em) VALUES (?, ?)', id, em);
  }

  async exportar(): Promise<string> {
    const [perfil, sessoes, treinos, conquistas] = await Promise.all([
      this.lerPerfil(),
      this.listarSessoes(),
      this.listarTreinos(),
      this.listarConquistas(),
    ]);
    return JSON.stringify({ exportadoEm: new Date().toISOString(), perfil, treinos, conquistas: Object.fromEntries(conquistas), sessoes }, null, 2);
  }

  async listarFila(): Promise<ItemFila[]> {
    const rs = await (await this.banco()).getAllAsync<{ id: string; tipo: string; json: string; tentativas: number; estado: ItemFila['estado']; ultimo_erro: string | null }>(
      'SELECT id, tipo, json, tentativas, estado, ultimo_erro FROM fila',
    );
    return rs.map((r) => ({ id: r.id, tipo: r.tipo, json: r.json, tentativas: r.tentativas, estado: r.estado, ultimoErro: r.ultimo_erro }));
  }

  async gravarFila(item: ItemFila) {
    await (await this.banco()).runAsync(
      `INSERT INTO fila (id, tipo, json, tentativas, estado, ultimo_erro) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET tipo = excluded.tipo, json = excluded.json, tentativas = excluded.tentativas, estado = excluded.estado, ultimo_erro = excluded.ultimo_erro`,
      item.id,
      item.tipo,
      item.json,
      item.tentativas,
      item.estado,
      item.ultimoErro,
    );
  }

  async apagarTudo() {
    await (await this.banco()).execAsync('DELETE FROM kv; DELETE FROM sessoes; DELETE FROM treinos; DELETE FROM conquistas; DELETE FROM fila;');
  }
}

export const repositorio: Repositorio = new RepositorioSqlite();
