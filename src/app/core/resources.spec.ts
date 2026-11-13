import { describe, expect, it } from 'vitest';
import { fmtDate, isoToLocalDate, localDateToIso } from './format';
import { RESOURCES, buildBody } from './resources';

describe('datas', () => {
  it('formata ISO em dd/mm/aaaa sem deslocar o dia', () => {
    expect(fmtDate('2026-03-29T00:00:00.000Z')).toBe('29/03/2026');
    expect(fmtDate(null)).toBe('');
  });

  it('ida e volta entre ISO e Date local preserva o dia', () => {
    const d = isoToLocalDate('2026-01-31T00:00:00.000Z')!;
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 0, 31]);
    expect(localDateToIso(d)).toBe('2026-01-31');
  });
});

describe('buildBody', () => {
  const wrestlers = RESOURCES['wrestlers'];

  it('na criação omite campos nulos e mantém booleanos', () => {
    const body = buildBody(wrestlers, {
      name: 'John', gender: 'M', contractType: 'FULL_TIME', overall: '88',
      brandIds: ['b1'], alignmentId: null, imageUrl: null, isActive: true,
    });
    expect(body).toMatchObject({ name: 'John', overall: 88, brandIds: ['b1'], isActive: true });
    expect(body).not.toHaveProperty('alignmentId');
    expect(body).not.toHaveProperty('imageUrl');
  });

  it('na edição não reenvia a URL assinada da imagem se não mudou', () => {
    const entity = { id: '1', imageUrl: 'https://signed/url' };
    const unchanged = buildBody(wrestlers, { name: 'A', gender: 'M', imageUrl: 'https://signed/url' }, entity);
    expect(unchanged).not.toHaveProperty('imageUrl');
    const replaced = buildBody(wrestlers, { name: 'A', gender: 'M', imageUrl: 'storage:u/x.png' }, entity);
    expect(replaced['imageUrl']).toBe('storage:u/x.png');
    const removed = buildBody(wrestlers, { name: 'A', gender: 'M', imageUrl: null }, entity);
    expect(removed['imageUrl']).toBeNull();
  });

  it('na edição envia null para limpar vínculos opcionais', () => {
    const body = buildBody(wrestlers, { name: 'A', gender: 'M', alignmentId: null }, { id: '1' });
    expect(body['alignmentId']).toBeNull();
  });

  it('reinado junta lutadores e duplas em holders', () => {
    const body = buildBody(RESOURCES['title-reigns'], {
      titleId: 't', startDate: new Date(2026, 0, 5), endDate: null,
      wrestlerHolderIds: ['w1'], teamHolderIds: ['tm1'],
    });
    expect(body['startDate']).toBe('2026-01-05');
    expect(body['holders']).toEqual([{ wrestlerId: 'w1' }, { teamId: 'tm1' }]);
    expect(body).not.toHaveProperty('wrestlerHolderIds');
  });

  it('esconde campos condicionais (show semanal não manda ppvMonth)', () => {
    const body = buildBody(RESOURCES['shows'], { name: 'RAW', kind: 'WEEKLY', weekday: 1, ppvMonth: 3 });
    expect(body['weekday']).toBe(1);
    expect(body).not.toHaveProperty('ppvMonth');
  });
});
