/** Datas da API são instantes UTC à meia-noite: exiba/edite sempre em UTC para não "voltar um dia". */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function isoToLocalDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function localDateToIso(d: Date | null | undefined): string | null {
  if (!d) return null;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export const WEEKDAYS = [
  'Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado',
];

export const monthOptions = MONTHS.map((label, i) => ({ value: i + 1, label }));

/** A temporada da WWE começa depois da WrestleMania (maio) e termina na WrestleMania (abril). */
export const SEASON_MONTHS = [5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3, 4];

/** 0 = maio ... 11 = abril */
export const seasonMonthIndex = (month: number) => (month - 5 + 12) % 12;

export interface EpisodeLike {
  month: number;
  week: number | null;
  night?: number | null;
  show?: { kind?: string; weekday?: number | null; name?: string } | null;
}

/**
 * Ordem de jogo: mês (maio→abril), semana e, dentro da semana, os shows semanais por
 * dia (segunda primeiro) e só depois PLEs/especiais — como na planilha.
 */
export function episodeOrderKey(e: EpisodeLike): number {
  // semana > dia da semana do show > shows semanais antes de PLE/especial > noite
  const weekly = e.show?.kind === 'WEEKLY';
  return seasonMonthIndex(e.month) * 100000 + gameWeek(e.week) * 1000 + gameDayOffset(e) * 10 + (weekly ? 0 : 5) + (e.night ?? 0);
}

export const compareEpisodes = (a: EpisodeLike, b: EpisodeLike) =>
  episodeOrderKey(a) - episodeOrderKey(b) || (a.show?.name ?? '').localeCompare(b.show?.name ?? '');

/** Episódio de um mês anterior ao início do universe na temporada (vazio = maio, nada fica de fora). */
export const beforeStart = (month: number, startMonth: number | null | undefined) =>
  seasonMonthIndex(month) < seasonMonthIndex(startMonth ?? 5);

/** Calendário do jogo: todo mês tem 4 semanas (segunda a domingo). */
export const gameWeek = (week: number | null | undefined) => Math.min(Math.max(week ?? 4, 1), 4);

export const GAME_WEEKDAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

/**
 * Coluna do episódio na semana (0 = segunda ... 6 = domingo): o dia do show; sem ele,
 * semanal = segunda e PLE = sábado. A Noite 2 de um PLE vai um dia depois.
 * (Mesma regra do backend: services/timeline.js.)
 */
export function gameDayOffset(e: EpisodeLike): number {
  const weekday = e.show?.weekday ?? (e.show?.kind === 'WEEKLY' ? 1 : 6);
  const night = e.night && e.night > 1 ? e.night - 1 : 0;
  return Math.min((weekday + 6) % 7 + night, 6);
}

export const gameDayName = (e: EpisodeLike) => GAME_WEEKDAYS[gameDayOffset(e)];
