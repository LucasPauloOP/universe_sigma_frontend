/** Planejamento de cards com IA: tipos e mapeamentos puros (prévia → payload da API). */

export interface SuggestedParticipant {
  wrestlerId: string;
  side: number;
  isWinner: boolean;
  wrestlerName?: string;
}

export interface SuggestedSegment {
  type: 'MATCH' | 'PROMO' | 'OTHER';
  matchTypeId?: string | null;
  titleId?: string | null;
  cardDivisionId?: string | null;
  stakes: 'NONE' | 'RANKING' | 'CONTENDER';
  isMainEvent: boolean;
  isDone: boolean;
  titleChanged: boolean;
  startsRivalry?: boolean;
  endsRivalry?: boolean;
  rivalryId?: string | null;
  notes?: string | null;
  participants: SuggestedParticipant[];
}

export interface SuggestedEpisode {
  episodeId: string;
  label: string;
  showName: string | null;
  date: string;
  segments: SuggestedSegment[];
  warnings: string[];
  error?: string;
}

export interface RangeJob {
  id: string;
  status: 'running' | 'done' | 'error' | 'cancelled';
  total: number;
  done: number;
  current: string | null;
  error: string | null;
  episodes: SuggestedEpisode[];
}

/** Lados da luta já agrupados e ordenados: [[nomes do lado 1], [nomes do lado 2]...]. */
export function sidesOf(s: Pick<SuggestedSegment, 'participants'>): string[][] {
  const bySide = new Map<number, string[]>();
  for (const p of s.participants) bySide.set(p.side, [...(bySide.get(p.side) ?? []), p.wrestlerName ?? '?']);
  return [...bySide.entries()].sort((a, b) => a[0] - b[0]).map(([, names]) => names);
}

/** Segmento sem os campos só de exibição (o que a API aceita em POST /episodes/:id/segments). */
export function toApiSegment(s: SuggestedSegment) {
  return {
    ...s,
    participants: s.participants.map(({ wrestlerId, side, isWinner }) => ({ wrestlerId, side, isWinner }))
  };
}

/** Itens do POST episodes/segments/bulk: só os episódios marcados e com segmentos. */
export function toBulkItems(episodes: SuggestedEpisode[], selected: Set<string>, replace: boolean) {
  return episodes
    .filter((e) => selected.has(e.episodeId) && e.segments.length)
    .map((e) => ({ episodeId: e.episodeId, replace, segments: e.segments.map(toApiSegment) }));
}

/** Remove um segmento da prévia (mantém um só main event se ele sair). */
export function withoutSegment(e: SuggestedEpisode, index: number): SuggestedEpisode {
  return { ...e, segments: e.segments.filter((_, i) => i !== index) };
}
