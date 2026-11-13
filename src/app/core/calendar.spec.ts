import { describe, expect, it } from 'vitest';
import { SEASON_MONTHS, compareEpisodes, seasonMonthIndex } from './format';

const weekly = (name: string, weekday: number) => ({ kind: 'WEEKLY', weekday, name });
const ple = (name: string) => ({ kind: 'PLE', weekday: null, name });

describe('calendário da temporada (maio → abril)', () => {
  it('maio é o primeiro mês e abril o último', () => {
    expect(SEASON_MONTHS[0]).toBe(5);
    expect(SEASON_MONTHS.at(-1)).toBe(4);
    expect(seasonMonthIndex(5)).toBe(0);
    expect(seasonMonthIndex(12)).toBe(7);
    expect(seasonMonthIndex(1)).toBe(8);
    expect(seasonMonthIndex(4)).toBe(11);
  });

  it('ordena como a planilha: RAW, SmackDown, depois o PLE da semana', () => {
    const eps = [
      { month: 6, week: 1, show: weekly('RAW', 1) },
      { month: 5, week: 4, show: ple('Bad Blood') },
      { month: 5, week: 4, show: weekly('SmackDown', 5) },
      { month: 5, week: 4, show: weekly('RAW', 1) },
      { month: 1, week: 1, show: weekly('RAW', 1) }, // janeiro vem depois de dezembro
      { month: 12, week: 2, show: weekly('RAW', 1) },
      { month: 5, week: 2, show: { kind: 'SPECIAL', weekday: null, name: 'SNME' } },
      { month: 5, week: 2, show: weekly('SmackDown', 5) },
    ];
    const order = [...eps].sort(compareEpisodes).map((e) => `${e.month}/${e.week}/${e.show.name}`);
    expect(order).toEqual([
      '5/2/SmackDown',
      '5/2/SNME',
      '5/4/RAW',
      '5/4/SmackDown',
      '5/4/Bad Blood',
      '6/1/RAW',
      '12/2/RAW',
      '1/1/RAW',
    ]);
  });
});

describe('início do universe na temporada', () => {
  it('episódios antes do mês de início ficam de fora', async () => {
    const { beforeStart } = await import('./format');
    expect(beforeStart(6, 8)).toBe(true); // junho < agosto
    expect(beforeStart(8, 8)).toBe(false);
    expect(beforeStart(1, 8)).toBe(false); // janeiro vem depois de agosto na temporada
    expect(beforeStart(5, null)).toBe(false); // sem início = maio: nada fica de fora
    expect(beforeStart(4, undefined)).toBe(false);
  });
});

describe('PLE em duas noites', () => {
  it('Noite 1 vem antes da Noite 2 e depois dos shows semanais da mesma semana', () => {
    const eps = [
      { month: 4, week: 3, night: 2, show: { kind: 'PLE', weekday: null, name: 'WrestleMania' } },
      { month: 4, week: 3, night: 1, show: { kind: 'PLE', weekday: null, name: 'WrestleMania' } },
      { month: 4, week: 3, night: null, show: { kind: 'WEEKLY', weekday: 5, name: 'SmackDown' } },
    ];
    const order = [...eps].sort(compareEpisodes).map((e) => e.night ?? 'smack');
    expect(order).toEqual(['smack', 1, 2]);
  });
});

describe('calendário do jogo (4 semanas por mês)', () => {
  it('coluna = dia do show (segunda = 0); sem dia: semanal segunda, PLE sábado', async () => {
    const { gameDayOffset, gameDayName, gameWeek } = await import('./format');
    expect(gameDayOffset({ month: 5, week: 1, show: { kind: 'WEEKLY', weekday: 1 } })).toBe(0);
    expect(gameDayOffset({ month: 5, week: 1, show: { kind: 'WEEKLY', weekday: 5 } })).toBe(4);
    expect(gameDayOffset({ month: 5, week: 1, show: { kind: 'WEEKLY', weekday: 0 } })).toBe(6); // domingo
    expect(gameDayOffset({ month: 5, week: 1, show: { kind: 'WEEKLY', weekday: null } })).toBe(0);
    expect(gameDayName({ month: 5, week: 1, show: { kind: 'PLE', weekday: null } })).toBe('Sábado');
    expect(gameDayName({ month: 5, week: 1, night: 2, show: { kind: 'PLE', weekday: null } })).toBe('Domingo');
    expect(gameWeek(null)).toBe(4);
    expect(gameWeek(5)).toBe(4);
    expect(gameWeek(0)).toBe(1);
  });
});
