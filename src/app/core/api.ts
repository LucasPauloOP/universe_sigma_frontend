import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Entity, Page } from './models';
import { UniverseStore } from './universe-store';

/** Base da API. Em dev o proxy (proxy.conf.json) encaminha /api para o backend. */
export const API_BASE = `${environment.apiOrigin}/api`;

type Params = Record<string, string | number | boolean | undefined | null>;

const toParams = (p?: Params) => {
  let params = new HttpParams();
  for (const [k, v] of Object.entries(p ?? {})) {
    if (v !== undefined && v !== null && v !== '') params = params.set(k, String(v));
  }
  return params;
};

/** Cliente das rotas dentro de um universe: /api/universes/:id/... */
@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);
  private readonly store = inject(UniverseStore);

  private url(path: string): string {
    const id = this.store.currentId();
    if (!id) throw new Error('Nenhum universe selecionado');
    return `${API_BASE}/universes/${id}/${path}`;
  }

  /** Lista uma página. */
  page<T = Entity>(path: string, params?: Params): Promise<Page<T>> {
    return firstValueFrom(
      this.http.get<Page<T>>(this.url(path), { params: toParams(params) }),
    );
  }

  /** Busca todos os registros (a API limita a 500 por página). */
  async all<T = Entity>(path: string, params?: Params): Promise<T[]> {
    const limit = 500;
    const out: T[] = [];
    for (let offset = 0; ; offset += limit) {
      const page = await this.page<T>(path, { ...params, limit, offset });
      out.push(...page.data);
      if (out.length >= page.total || page.data.length === 0) return out;
    }
  }

  /** Só o total (limit=1). */
  async count(path: string): Promise<number> {
    return (await this.page(path, { limit: 1 })).total;
  }

  get<T = Entity>(path: string): Promise<T> {
    return firstValueFrom(this.http.get<T>(this.url(path)));
  }

  post<T = Entity>(path: string, body: unknown = {}): Promise<T> {
    return firstValueFrom(this.http.post<T>(this.url(path), body));
  }

  put<T = Entity>(path: string, body: unknown): Promise<T> {
    return firstValueFrom(this.http.put<T>(this.url(path), body));
  }

  delete(path: string): Promise<unknown> {
    return firstValueFrom(this.http.delete(this.url(path)));
  }

  /** POST multipart (arquivo + campos de texto). */
  postForm<T = Entity>(path: string, body: FormData): Promise<T> {
    return firstValueFrom(this.http.post<T>(this.url(path), body));
  }

  /** Upload de imagem: devolve { imageUrl (salvar), url (preview) }. */
  upload(file: File): Promise<{ key: string; imageUrl: string; url: string }> {
    const body = new FormData();
    body.append('file', file);
    return firstValueFrom(
      this.http.post<{ key: string; imageUrl: string; url: string }>(
        this.url('uploads'),
        body,
      ),
    );
  }
}
