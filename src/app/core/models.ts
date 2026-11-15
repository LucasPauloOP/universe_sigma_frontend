export interface Page<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}

export interface Universe {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  refreshToken?: string;
  user: User;
  universe?: Universe;
}

/** Registro genérico vindo da API. Campos específicos são lidos por colchetes. */
export interface Entity {
  id: string;
  [key: string]: any;
}

export interface Wrestler extends Entity {
  name: string;
  imageUrl: string | null;
}

export interface Participant {
  id?: string;
  wrestlerId: string;
  side: number;
  isWinner: boolean;
  wrestler?: Wrestler;
}

export interface Segment extends Entity {
  episodeId: string;
  position: number;
  type: 'MATCH' | 'PROMO' | 'OTHER';
  matchTypeId: string | null;
  titleId: string | null;
  titleChanged: boolean;
  isMainEvent: boolean;
  finishType: string | null;
  isDone: boolean;
  isDraw: boolean;
  notes: string | null;
  stakes: 'NONE' | 'RANKING' | 'CONTENDER';
  cardDivisionId: string | null;
  cardDivision?: Entity | null;
  rankingApplied?: boolean;
  startsRivalry?: boolean;
  endsRivalry?: boolean;
  rivalryApplied?: boolean;
  rivalryId?: string | null;
  rivalry?: { id: string; name: string; isActive: boolean; winnerSide: number | null } | null;
  tournamentMatch?: (Entity & { round: number; slot: number; groupName: string | null; tournament: Entity }) | null;
  matchType?: Entity | null;
  title?: Entity | null;
  participants: Participant[];
}

export interface EpisodeCard extends Entity {
  show: Entity;
  seasonId: string;
  month: number;
  week: number | null;
  status: 'UNPLANNED' | 'PLANNED' | 'DONE';
  segments: Segment[];
}

export interface Entrant extends Entity {
  tournamentId: string;
  seed: number | null;
  startRound?: number;
  wrestlerId: string | null;
  teamId: string | null;
  wrestler?: Wrestler | null;
  team?: Entity | null;
}

export interface TournamentMatch extends Entity {
  round: number;
  slot: number;
  groupName: string | null;
  entrantAId: string | null;
  entrantBId: string | null;
  winnerId: string | null;
  segmentId: string | null;
  matchTypeId: string | null;
  matchType?: Entity | null;
  extras?: { position: number; entrantId: string; entrant: Entrant }[];
  entrantA: Entrant | null;
  entrantB: Entrant | null;
  winner: Entrant | null;
  segment?: (Entity & { isDone?: boolean; episode?: Entity & { show?: Entity } }) | null;
}

export interface Bracket {
  tournament: Entity;
  entrants: Entrant[];
  matches: TournamentMatch[];
}

export interface ReignStat {
  id: string;
  startDate: string;
  endDate: string | null;
  days: number;
  current: boolean;
}

export interface HolderStat {
  key: string;
  name: string;
  imageUrl: string | null;
  baselineReigns: number;
  baselineDays: number;
  baselineNote: string | null;
  universeReigns: number;
  universeDays: number;
  reigns: number;
  days: number;
  longestDays: number | null;
  isCurrent: boolean;
  reignList: ReignStat[];
}

export interface TitleStats {
  asOf: string;
  titles: { title: Entity; holders: HolderStat[] }[];
}

export interface DivisionEntry {
  id: string;
  position: number;
  wrestlerId: string | null;
  teamId: string | null;
  wrestler?: Wrestler | null;
  team?: Entity | null;
}

export interface Champion {
  wrestlerId: string | null;
  teamId: string | null;
  name: string;
  imageUrl: string | null;
  /** só para dupla/facção campeã */
  kind?: string | null;
  members?: string[];
}

export interface CardDivision extends Entity {
  name: string;
  gender: 'M' | 'W' | null;
  titleId: string | null;
  brands: { brandId: string; brand: Entity }[];
  title?: Entity | null;
  entries: DivisionEntry[];
  champions: Champion[];
  championSince: string | null;
}
