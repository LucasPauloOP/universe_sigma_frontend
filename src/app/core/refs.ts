import { Injectable, inject, effect, signal } from '@angular/core';
import { Api } from './api';
import { Entity } from './models';
import { RESOURCES } from './resources';
import { UniverseStore } from './universe-store';

/** Cache das listas usadas em selects/autocompletes e nomes de colunas. */
@Injectable({ providedIn: 'root' })
export class Refs {
  private readonly api = inject(Api);
  private readonly store = inject(UniverseStore);
  private cache = new Map<string, Promise<Entity[]>>();
  /** incrementa a cada carga/invalidação para recalcular nomes em templates */
  readonly version = signal(0);
  private readonly data = new Map<string, Entity[]>();

  constructor() {
    // trocou de universe: descarta tudo
    effect(() => {
      this.store.currentId();
      this.cache.clear();
      this.data.clear();
      this.version.update((v) => v + 1);
    });
  }

  load(key: string): Promise<Entity[]> {
    let p = this.cache.get(key);
    if (!p) {
      p = this.api.all(key).then((list) => {
        this.data.set(key, list);
        this.version.update((v) => v + 1);
        return list;
      });
      this.cache.set(key, p);
      p.catch(() => this.cache.delete(key));
    }
    return p;
  }

  loadMany(keys: string[]) {
    return Promise.all([...new Set(keys)].map((k) => this.load(k)));
  }

  /** Descarta TUDO (ex.: depois de restaurar o universe: os ids antigos deixaram de existir). */
  clear() {
    this.cache.clear();
    this.data.clear();
    this.version.update((v) => v + 1);
  }

  invalidate(key: string) {
    this.cache.delete(key);
    this.data.delete(key);
    this.version.update((v) => v + 1);
  }

  /** Lista já carregada (vazia se ainda não carregou). Leia `version()` para reagir. */
  list(key: string): Entity[] {
    return this.data.get(key) ?? [];
  }

  label(key: string, id: string | null | undefined): string {
    if (!id) return '';
    const e = this.data.get(key)?.find((x) => x.id === id);
    return e ? RESOURCES[key]?.label(e) ?? (e['name'] as string) : '';
  }
}
