import { describe, expect, it } from 'vitest';
import { SuggestedEpisode, SuggestedSegment, sidesOf, toApiSegment, toBulkItems, withoutSegment } from './ai-plan';

const seg = (names: [string, number][]): SuggestedSegment => ({
  type: 'MATCH',
  stakes: 'NONE',
  isMainEvent: false,
  isDone: false,
  titleChanged: false,
  participants: names.map(([n, side], i) => ({ wrestlerId: `id${i}`, side, isWinner: false, wrestlerName: n }))
});
const ep = (id: string, segments: SuggestedSegment[]): SuggestedEpisode => ({ episodeId: id, label: id, showName: 'RAW', date: '', segments, warnings: [] });

describe('ai-plan', () => {
  it('agrupa os lados em ordem', () => {
    expect(sidesOf(seg([['A', 2], ['B', 1], ['C', 2]]))).toEqual([['B'], ['A', 'C']]);
  });
  it('tira os campos só de exibição do payload', () => {
    expect(toApiSegment(seg([['A', 1]])).participants[0]).toEqual({ wrestlerId: 'id0', side: 1, isWinner: false });
  });
  it('bulk: só episódios marcados e com segmentos', () => {
    const items = toBulkItems([ep('a', [seg([['A', 1]])]), ep('b', []), ep('c', [seg([['B', 1]])])], new Set(['a', 'b']), true);
    expect(items.map((i) => i.episodeId)).toEqual(['a']);
    expect(items[0].replace).toBe(true);
  });
  it('remove um segmento sem mexer nos outros', () => {
    const e = ep('a', [seg([['A', 1]]), seg([['B', 1]])]);
    expect(withoutSegment(e, 0).segments).toHaveLength(1);
    expect(e.segments).toHaveLength(2);
  });
});
