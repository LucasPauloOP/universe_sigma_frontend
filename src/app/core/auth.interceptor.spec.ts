import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService } from 'primeng/api';
import { beforeEach, describe, expect, it } from 'vitest';
import { API_BASE } from './api';
import { Auth } from './auth';
import { authInterceptor } from './auth.interceptor';

const user = { id: 'u', email: 'a@b.c' };
const tick = () => new Promise<void>((r) => setTimeout(r));

describe('refresh token', () => {
  let http: HttpClient;
  let ctl: HttpTestingController;
  let auth: Auth;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('universe-sigma:token', 'old');
    localStorage.setItem('universe-sigma:refresh', 'r1');
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'login', children: [] }]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(), MessageService],
    });
    http = TestBed.inject(HttpClient);
    ctl = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(Auth);
  });

  it('401 renova uma vez e repete a requisição com o novo token', async () => {
    const done = new Promise((res) => http.get(`${API_BASE}/universes`).subscribe(res));
    ctl.expectOne(`${API_BASE}/universes`).flush({}, { status: 401, statusText: 'Unauthorized' });
    const refresh = ctl.expectOne(`${API_BASE}/auth/refresh`);
    expect(refresh.request.body).toEqual({ refreshToken: 'r1' });
    refresh.flush({ token: 'new', refreshToken: 'r2', user });
    await tick();
    const retry = ctl.expectOne(`${API_BASE}/universes`);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer new');
    retry.flush([{ id: 'x' }]);
    expect(await done).toEqual([{ id: 'x' }]);
    expect(localStorage.getItem('universe-sigma:refresh')).toBe('r2');
    expect(auth.token()).toBe('new');
  });

  it('requisições simultâneas dividem um único refresh', async () => {
    http.get(`${API_BASE}/a`).subscribe({ error: () => undefined });
    http.get(`${API_BASE}/b`).subscribe({ error: () => undefined });
    ctl.expectOne(`${API_BASE}/a`).flush({}, { status: 401, statusText: 'x' });
    ctl.expectOne(`${API_BASE}/b`).flush({}, { status: 401, statusText: 'x' });
    const refreshes = ctl.match(`${API_BASE}/auth/refresh`);
    expect(refreshes.length).toBe(1);
    refreshes[0].flush({ token: 'new', refreshToken: 'r2', user });
    await tick();
    ctl.expectOne(`${API_BASE}/a`).flush({});
    ctl.expectOne(`${API_BASE}/b`).flush({});
  });

  it('refresh recusado encerra a sessão sem chamar logout', async () => {
    http.get(`${API_BASE}/universes`).subscribe({ error: () => undefined });
    ctl.expectOne(`${API_BASE}/universes`).flush({}, { status: 401, statusText: 'x' });
    ctl.expectOne(`${API_BASE}/auth/refresh`).flush({ message: 'inválido' }, { status: 401, statusText: 'x' });
    await tick();
    expect(auth.token()).toBeNull();
    expect(localStorage.getItem('universe-sigma:refresh')).toBeNull();
    ctl.expectNone(`${API_BASE}/auth/logout`);
  });

  it('erro comum na requisição repetida não derruba a sessão', async () => {
    http.post(`${API_BASE}/segments`, {}).subscribe({ error: () => undefined });
    ctl.expectOne(`${API_BASE}/segments`).flush({}, { status: 401, statusText: 'x' });
    ctl.expectOne(`${API_BASE}/auth/refresh`).flush({ token: 'new', refreshToken: 'r2', user });
    await tick();
    ctl.expectOne(`${API_BASE}/segments`).flush({ message: 'inválido' }, { status: 422, statusText: 'x' });
    expect(auth.token()).toBe('new');
  });

  it('sem refresh token, o 401 encerra a sessão como antes', () => {
    localStorage.removeItem('universe-sigma:refresh');
    const a = TestBed.inject(Auth) as unknown as { refreshToken: string | null };
    a.refreshToken = null;
    http.get(`${API_BASE}/universes`).subscribe({ error: () => undefined });
    ctl.expectOne(`${API_BASE}/universes`).flush({}, { status: 401, statusText: 'x' });
    ctl.expectNone(`${API_BASE}/auth/refresh`);
    expect(auth.token()).toBeNull();
  });

  it('logout manual avisa o servidor para revogar o refresh token', () => {
    auth.logout(false);
    const req = ctl.expectOne(`${API_BASE}/auth/logout`);
    expect(req.request.body).toEqual({ refreshToken: 'r1' });
    req.flush(null, { status: 204, statusText: 'No Content' });
  });
});
