import { Injectable, computed, signal } from '@angular/core';
import { Universe } from './models';

const KEY = 'universe-sigma:universe';

/** Universe selecionado (persistido) e a lista do usuário. */
@Injectable({ providedIn: 'root' })
export class UniverseStore {
  readonly universes = signal<Universe[]>([]);
  readonly currentId = signal<string | null>(read());
  readonly current = computed(
    () => this.universes().find((u) => u.id === this.currentId()) ?? null,
  );

  select(id: string | null) {
    this.currentId.set(id);
    try {
      if (id) localStorage.setItem(KEY, id);
      else localStorage.removeItem(KEY);
    } catch {
      /* storage indisponível: segue só em memória */
    }
  }

  /** Atualiza a lista e garante que o selecionado ainda existe. */
  setUniverses(list: Universe[]) {
    this.universes.set(list);
    if (!list.some((u) => u.id === this.currentId())) {
      this.select(list[0]?.id ?? null);
    }
  }

  clear() {
    this.universes.set([]);
    this.select(null);
  }
}

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
