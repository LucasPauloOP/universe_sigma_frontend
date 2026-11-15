import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { API_BASE } from './api';
import { AuthResponse, Universe, User } from './models';
import { UniverseStore } from './universe-store';

const TOKEN = 'universe-sigma:token';
const REFRESH = 'universe-sigma:refresh';

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly store = inject(UniverseStore);

  readonly token = signal<string | null>(read(TOKEN));
  private refreshToken: string | null = read(REFRESH);
  private refreshing: Promise<string> | null = null;
  readonly user = signal<User | null>(null);
  readonly loggedIn = computed(() => !!this.token());

  async login(email: string, password: string) {
    const res = await firstValueFrom(
      this.http.post<AuthResponse>(`${API_BASE}/auth/login`, { email, password }),
    );
    this.start(res);
    await this.loadUniverses();
  }

  async register(body: {
    email: string;
    password: string;
    name?: string;
    useTemplate: boolean;
  }) {
    const res = await firstValueFrom(
      this.http.post<AuthResponse>(`${API_BASE}/auth/register`, body),
    );
    this.start(res);
    await this.loadUniverses();
    if (res.universe) this.store.select(res.universe.id);
  }

  /** Confirma que o e-mail existe (lança 404 se não existir). */
  async checkEmail(email: string) {
    await firstValueFrom(this.http.post(`${API_BASE}/auth/forgot-password`, { email }));
  }

  async resetPassword(email: string, password: string) {
    await firstValueFrom(this.http.post(`${API_BASE}/auth/reset-password`, { email, password }));
  }

  /** Restaura a sessão após F5: valida o token e carrega os universes. */
  async restore() {
    if (!this.token() || this.user()) return;
    try {
      this.user.set(await firstValueFrom(this.http.get<User>(`${API_BASE}/auth/me`)));
      await this.loadUniverses();
    } catch {
      this.logout(false);
    }
  }

  async loadUniverses() {
    const list = await firstValueFrom(
      this.http.get<Universe[]>(`${API_BASE}/universes`),
    );
    this.store.setUniverses(list);
    return list;
  }

  get canRefresh(): boolean {
    return !!this.refreshToken;
  }

  /**
   * Troca o refresh token por um novo par (rotação). Chamadas concorrentes dividem
   * a mesma requisição; se falhar, quem chamou decide sair da sessão.
   */
  refresh(): Promise<string> {
    if (!this.refreshToken) return Promise.reject(new Error('sem refresh token'));
    this.refreshing ??= firstValueFrom(
      this.http.post<AuthResponse>(`${API_BASE}/auth/refresh`, { refreshToken: this.refreshToken }),
    )
      .then((res) => {
        this.save(res);
        return res.token;
      })
      .finally(() => (this.refreshing = null));
    return this.refreshing;
  }

  /** `revoke`: avisa o servidor para invalidar o refresh token (não faz sentido se ele já foi recusado). */
  logout(navigate = true, revoke = true) {
    const refreshToken = this.refreshToken;
    if (revoke && refreshToken && this.token()) {
      this.http.post(`${API_BASE}/auth/logout`, { refreshToken }).subscribe({ error: () => undefined });
    }
    this.refreshToken = null;
    this.token.set(null);
    this.user.set(null);
    this.store.clear();
    try {
      localStorage.removeItem(TOKEN);
      localStorage.removeItem(REFRESH);
    } catch {
      /* ignore */
    }
    if (navigate) void this.router.navigate(['/login']);
  }

  private start(res: AuthResponse) {
    this.user.set(res.user);
    this.save(res);
  }

  private save(res: AuthResponse) {
    this.token.set(res.token);
    if (res.refreshToken) this.refreshToken = res.refreshToken;
    try {
      localStorage.setItem(TOKEN, res.token);
      if (res.refreshToken) localStorage.setItem(REFRESH, res.refreshToken);
    } catch {
      /* ignore */
    }
  }
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
