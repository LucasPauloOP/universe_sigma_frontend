import { Entity } from './models';
import { MONTHS, SEASON_MONTHS, WEEKDAYS, fmtDate, gameDayName, isoToLocalDate, localDateToIso } from './format';

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'boolean'
  | 'select'
  | 'ref'
  | 'refMulti'
  | 'date'
  | 'image'
  | 'color';

export interface Option {
  value: string | number;
  label: string;
}

export interface Field {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  /** select */
  options?: Option[];
  /** ref / refMulti: chave do recurso referenciado */
  ref?: string;
  min?: number;
  max?: number;
  default?: unknown;
  hint?: string;
  /** ocupa a linha inteira do formulário */
  full?: boolean;
  /** valor do formulário a partir do registro (ex.: brands -> brandIds) */
  fromEntity?: (e: Entity) => unknown;
  /** valor do formulário -> corpo do request */
  toBody?: (v: any) => unknown;
  /** só aparece quando retorna true (recebe os valores atuais) */
  showIf?: (values: Record<string, any>) => boolean;
}

export interface Column {
  key: string;
  label: string;
  type?: 'text' | 'bool' | 'image' | 'chips' | 'switch';
  render?: (e: Entity, name: (ref: string, id: string | null) => string) => string;
  /** valor usado na ordenação (padrão: render ou e[key]) */
  sortValue?: (e: Entity) => string | number;
}

export interface RowAction {
  icon: string;
  label: string;
  /** rota (navegação) */
  link?: (e: Entity) => unknown[];
  /** ação especial tratada pela tela de listagem */
  special?: 'wrestlerRecord' | 'titleHistory';
}

export interface Resource {
  key: string;
  singular: string;
  plural: string;
  icon: string;
  group: 'Roster' | 'Títulos' | 'Shows' | 'Torneios';
  fields: Field[];
  columns: Column[];
  /** nome para exibição em selects/chips */
  label: (e: Entity) => string;
  /** campos que viram filtros na listagem */
  filters?: string[];
  rowActions?: RowAction[];
  toolbar?: 'generateEpisodes';
}

const opts = (m: Record<string, string>): Option[] =>
  Object.entries(m).map(([value, label]) => ({ value, label }));

export const GENDER = opts({ M: 'Masculino', W: 'Feminino' });
export const CONTRACT = opts({
  FULL_TIME: 'Full time',
  PART_TIME: 'Part time',
  LEGEND: 'Lenda',
  FREE_AGENT: 'Free agent',
  MANAGER: 'Manager',
  GM: 'GM',
  CELEBRITY: 'Celebridade',
  VARIANT: 'Variante',
});
export const SHOW_KIND = opts({
  WEEKLY: 'Semanal',
  PLE: 'PLE / PPV',
  SPECIAL: 'Especial',
});
export const TEAM_KIND = opts({ TAG_TEAM: 'Dupla / Tag team', FACTION: 'Facção' });
export const EDIT_STATUS = opts({ COMPLETE: 'Completo', NEEDED: 'Precisa editar' });
export const EPISODE_STATUS = opts({ PLANNED: 'Planejado', DONE: 'Realizado' });
export const TOURNAMENT_FORMAT = opts({
  SINGLE_ELIMINATION: 'Eliminatória simples',
  ROUND_ROBIN: 'Pontos corridos (grupos)',
});
export const TOURNAMENT_STATUS = opts({
  PLANNED: 'Planejado',
  ONGOING: 'Em andamento',
  FINISHED: 'Finalizado',
});
export const SEGMENT_TYPE = opts({ MATCH: 'Luta', PROMO: 'Promo', OTHER: 'Outro' });
export const FINISH_TYPE = opts({
  PINFALL: 'Pinfall',
  SUBMISSION: 'Submission',
  COUNTOUT: 'Count out',
  DQ: 'Desqualificação',
  OTHER: 'Outro',
});

export const labelOfOption = (list: Option[], v: unknown): string =>
  list.find((o) => o.value === v)?.label ?? String(v ?? '');

// ───────────── helpers de campo ─────────────

const name = (extra: Partial<Field> = {}): Field => ({
  key: 'name', label: 'Nome', type: 'text', required: true, ...extra,
});
const description: Field = { key: 'description', label: 'Descrição', type: 'textarea', full: true };
const isActive: Field = { key: 'isActive', label: 'Ativo', type: 'boolean', default: true };
const image: Field = { key: 'imageUrl', label: 'Imagem', type: 'image', full: true };
const byName = (e: Entity) => e['name'] as string;

const lookup = (
  key: string, singular: string, plural: string, icon: string,
): Resource => ({
  key, singular, plural, icon, group: 'Roster',
  fields: [name(), description, isActive],
  columns: [
    { key: 'name', label: 'Nome' },
    { key: 'description', label: 'Descrição' },
    { key: 'isActive', label: 'Ativo', type: 'bool' },
  ],
  label: byName,
});

const ids = (list: Entity[] | undefined, key: string) =>
  (list ?? []).map((x) => x[key] as string);

const dateField = (key: string, label: string, required = false): Field => ({
  key, label, type: 'date', required,
  fromEntity: (e) => isoToLocalDate(e[key]),
  toBody: (v: Date | null) => localDateToIso(v),
});

const episodeLabel = (e: Entity) => {
  const show = (e['show']?.name as string) ?? 'Episódio';
  const m = MONTHS[(e['month'] as number) - 1] ?? '';
  const night = e['night'] ? ` · Noite ${e['night']}` : '';
  return e['title'] ? `${e['title']} (${m})` : `${show} — ${m}${e['week'] ? ' S' + e['week'] : ''}${night}`;
};

// ───────────── recursos ─────────────

export const RESOURCES: Record<string, Resource> = {
  wrestlers: {
    key: 'wrestlers', singular: 'Lutador', plural: 'Lutadores', icon: 'user', group: 'Roster',
    label: byName,
    filters: ['gender', 'contractType', 'isActive', 'isInjured', 'inTagDivision', 'editStatus', 'alignmentId', 'divisionId', 'weightClassId'],
    rowActions: [{ icon: 'chart-bar', label: 'Retrospecto', special: 'wrestlerRecord' }],
    columns: [
      { key: 'imageUrl', label: '', type: 'image' },
      { key: 'name', label: 'Nome' },
      { key: 'gender', label: 'Gênero', render: (e) => labelOfOption(GENDER, e['gender']) },
      { key: 'contractType', label: 'Contrato', render: (e) => labelOfOption(CONTRACT, e['contractType']) },
      { key: 'overall', label: 'OVR' },
      { key: 'brands', label: 'Brands', type: 'chips', render: (e) => (e['brands'] ?? []).map((b: Entity) => b['brand']?.name).join('|') },
      { key: 'alignmentId', label: 'Alinhamento', render: (e) => e['alignment']?.name ?? '', sortValue: (e) => e['alignment']?.name ?? '' },
      { key: 'isInjured', label: 'Lesionado', type: 'bool' },
      { key: 'isActive', label: 'Ativo', type: 'bool' },
    ],
    fields: [
      name(), { key: 'gender', label: 'Gênero', type: 'select', required: true, options: GENDER },
      { key: 'contractType', label: 'Contrato', type: 'select', options: CONTRACT, default: 'FULL_TIME' },
      { key: 'overall', label: 'Overall', type: 'number', min: 0, max: 100 },
      { key: 'brandIds', label: 'Brands', type: 'refMulti', ref: 'brands', full: true, default: [], fromEntity: (e) => (e['brands'] ?? []).map((b: Entity) => b['brandId']) },
      { key: 'alignmentId', label: 'Alinhamento', type: 'ref', ref: 'alignments' },
      { key: 'divisionId', label: 'Categoria', type: 'ref', ref: 'divisions' },
      { key: 'weightClassId', label: 'Categoria de peso', type: 'ref', ref: 'weight-classes' },
      { key: 'editStatus', label: 'Edição', type: 'select', options: EDIT_STATUS, default: 'COMPLETE' },
      { key: 'finisher', label: 'Finisher', type: 'text' },
      { key: 'signature', label: 'Signature', type: 'text' },
      { key: 'hometown', label: 'Cidade natal', type: 'text' },
      { key: 'hasContract', label: 'Contrato ativo', type: 'boolean', default: false },
      { key: 'isActive', label: 'Ativo no universe', type: 'boolean', default: true },
      { key: 'isInjured', label: 'Lesionado', type: 'boolean', default: false },
      { key: 'inTagDivision', label: 'Divisão de tag', type: 'boolean', default: false },
      { key: 'isCustomCharacter', label: 'Personagem criado (CAW)', type: 'boolean', default: false },
      image,
      { key: 'notes', label: 'Notas', type: 'textarea', full: true },
    ],
  },

  teams: {
    key: 'teams', singular: 'Dupla / Facção', plural: 'Duplas e Facções', icon: 'users', group: 'Roster',
    label: byName, filters: ['kind'],
    columns: [
      { key: 'imageUrl', label: '', type: 'image' },
      { key: 'name', label: 'Nome' },
      { key: 'kind', label: 'Tipo', render: (e) => labelOfOption(TEAM_KIND, e['kind']) },
      { key: 'members', label: 'Integrantes', type: 'chips', render: (e) => (e['members'] ?? []).map((m: Entity) => m['wrestler']?.name).join('|') },
    ],
    fields: [
      name(), { key: 'kind', label: 'Tipo', type: 'select', options: TEAM_KIND, default: 'TAG_TEAM' },
      { key: 'memberIds', label: 'Integrantes', type: 'refMulti', ref: 'wrestlers', full: true, default: [], fromEntity: (e) => (e['members'] ?? []).map((m: Entity) => m['wrestlerId']) },
      image,
    ],
  },

  brands: {
    key: 'brands', singular: 'Brand', plural: 'Brands', icon: 'desktop', group: 'Roster',
    label: byName,
    columns: [
      { key: 'imageUrl', label: '', type: 'image' },
      { key: 'name', label: 'Nome' },
      { key: 'gm', label: 'GM' },
      { key: 'color', label: 'Cor' },
      { key: 'isActive', label: 'Ativa', type: 'switch' },
    ],
    fields: [
      name(), { key: 'gm', label: 'GM', type: 'text' },
      { key: 'color', label: 'Cor', type: 'color' },
      { ...isActive, label: 'Brand ativa', hint: 'Desativar também desativa os shows dela e apaga os episódios' },
      description, image,
    ],
  },

  rivalries: {
    key: 'rivalries', singular: 'Rivalidade', plural: 'Rivalidades', icon: 'bolt', group: 'Roster',
    label: byName, filters: ['isActive'],
    columns: [
      { key: 'name', label: 'Nome' },
      { key: 'members', label: 'Envolvidos', type: 'chips', render: (e) => (e['members'] ?? []).map((m: Entity) => m['wrestler']?.name).join('|') },
      { key: 'startDate', label: 'Início', render: (e) => fmtDate(e['startDate']), sortValue: (e) => e['startDate'] ?? '' },
      { key: 'endDate', label: 'Fim', render: (e) => fmtDate(e['endDate']), sortValue: (e) => e['endDate'] ?? '' },
      { key: 'isActive', label: 'Ativa', type: 'bool' },
    ],
    fields: [
      name(),
      { key: 'wrestlerIds', label: 'Envolvidos', type: 'refMulti', ref: 'wrestlers', full: true, default: [], fromEntity: (e) => (e['members'] ?? []).map((m: Entity) => m['wrestlerId']) },
      dateField('startDate', 'Início'), dateField('endDate', 'Fim'),
      { ...isActive, label: 'Ativa' }, description,
    ],
  },

  'card-divisions': {
    key: 'card-divisions', singular: 'Divisão', plural: 'Cadastro de divisões', icon: 'sliders-v', group: 'Roster',
    label: (e) => `${e['brand']?.name ? e['brand'].name + ' — ' : ''}${e['name']}`,
    filters: ['brandId', 'isActive'],
    columns: [
      { key: 'brandId', label: 'Brand', render: (e) => e['brand']?.name ?? '', sortValue: (e) => e['brand']?.name ?? '' },
      { key: 'name', label: 'Divisão' },
      { key: 'titleId', label: 'Título', render: (e) => e['title']?.name ?? '—', sortValue: (e) => e['title']?.name ?? '' },
      { key: 'entries', label: 'Colocados', render: (e) => String((e['entries'] ?? []).length), sortValue: (e) => (e['entries'] ?? []).length },
      { key: 'order', label: 'Ordem' },
      { key: 'isActive', label: 'Ativa', type: 'bool' },
    ],
    fields: [
      name({ label: 'Nome (ex.: Main Card, Mid Card, Tags)' }),
      { key: 'brandId', label: 'Brand', type: 'ref', ref: 'brands' },
      { key: 'titleId', label: 'Título que a divisão disputa', type: 'ref', ref: 'titles', hint: 'O campeão deste título fica acima do ranking' },
      { key: 'order', label: 'Ordem de exibição', type: 'number', min: 0, default: 0 },
      { ...isActive, label: 'Divisão ativa' },
    ],
  },

  alignments: lookup('alignments', 'Alinhamento', 'Alinhamentos', 'sliders-h'),
  divisions: lookup('divisions', 'Categoria', 'Categorias', 'th-large'),
  'weight-classes': lookup('weight-classes', 'Categoria de peso', 'Categorias de peso', 'chart-bar'),

  titles: {
    key: 'titles', singular: 'Título', plural: 'Títulos', icon: 'trophy', group: 'Títulos',
    label: byName, filters: ['brandId', 'gender', 'isTag', 'isActive'],
    rowActions: [{ icon: 'history', label: 'Histórico de reinados', special: 'titleHistory' }],
    columns: [
      { key: 'imageUrl', label: '', type: 'image' },
      { key: 'name', label: 'Nome' },
      { key: 'brandId', label: 'Brand', render: (e) => e['brand']?.name ?? '', sortValue: (e) => e['brand']?.name ?? '' },
      { key: 'gender', label: 'Gênero', render: (e) => (e['gender'] ? labelOfOption(GENDER, e['gender']) : '') },
      { key: 'isTag', label: 'Tag', type: 'bool' },
      { key: 'isActive', label: 'Ativo', type: 'bool' },
    ],
    fields: [
      name(), { key: 'brandId', label: 'Brand', type: 'ref', ref: 'brands' },
      { key: 'gender', label: 'Gênero', type: 'select', options: GENDER },
      { key: 'isTag', label: 'Título de duplas', type: 'boolean', default: false },
      isActive, image,
    ],
  },

  'title-reigns': {
    key: 'title-reigns', singular: 'Reinado', plural: 'Reinados', icon: 'crown', group: 'Títulos',
    label: (e) => `${e['title']?.name ?? 'Título'} — ${fmtDate(e['startDate'])}`,
    filters: ['titleId'],
    columns: [
      { key: 'titleId', label: 'Título', render: (e) => e['title']?.name ?? '', sortValue: (e) => e['title']?.name ?? '' },
      { key: 'holders', label: 'Campeões', type: 'chips', render: (e) => (e['holders'] ?? []).map((h: Entity) => h['wrestler']?.name ?? h['team']?.name).join('|') },
      { key: 'startDate', label: 'Início', render: (e) => fmtDate(e['startDate']), sortValue: (e) => e['startDate'] ?? '' },
      { key: 'endDate', label: 'Fim', render: (e) => (e['endDate'] ? fmtDate(e['endDate']) : 'Atual'), sortValue: (e) => e['endDate'] ?? '9999' },
    ],
    fields: [
      { key: 'titleId', label: 'Título', type: 'ref', ref: 'titles', required: true },
      dateField('startDate', 'Início', true),
      dateField('endDate', 'Fim (vazio = campeão atual)'),
      {
        key: 'wrestlerHolderIds', label: 'Lutadores campeões', type: 'refMulti', ref: 'wrestlers', full: true, default: [],
        fromEntity: (e) => (e['holders'] ?? []).filter((h: Entity) => h['wrestlerId']).map((h: Entity) => h['wrestlerId']),
      },
      {
        key: 'teamHolderIds', label: 'Duplas campeãs', type: 'refMulti', ref: 'teams', full: true, default: [],
        fromEntity: (e) => (e['holders'] ?? []).filter((h: Entity) => h['teamId']).map((h: Entity) => h['teamId']),
      },
    ],
  },

  'title-baselines': {
    key: 'title-baselines', singular: 'Histórico de reinados', plural: 'Histórico anterior', icon: 'history', group: 'Títulos',
    label: (e) => `${e['wrestler']?.name ?? e['team']?.name ?? '?'} — ${e['title']?.name ?? ''}`,
    filters: ['titleId'],
    columns: [
      { key: 'titleId', label: 'Título', render: (e) => e['title']?.name ?? '', sortValue: (e) => e['title']?.name ?? '' },
      { key: 'holder', label: 'Campeão', render: (e) => e['wrestler']?.name ?? e['team']?.name ?? '', sortValue: (e) => e['wrestler']?.name ?? e['team']?.name ?? '' },
      { key: 'reigns', label: 'Reinados' },
      { key: 'days', label: 'Dias' },
      { key: 'note', label: 'Nota' },
    ],
    fields: [
      { key: 'titleId', label: 'Título', type: 'ref', ref: 'titles', required: true },
      { key: 'wrestlerId', label: 'Lutador', type: 'ref', ref: 'wrestlers', hint: 'Informe o lutador OU a dupla' },
      { key: 'teamId', label: 'Dupla / facção', type: 'ref', ref: 'teams' },
      { key: 'reigns', label: 'Vezes campeão (antes do universe)', type: 'number', required: true, min: 0, default: 0 },
      { key: 'days', label: 'Total de dias com o cinturão', type: 'number', required: true, min: 0, default: 0 },
      { key: 'note', label: 'Nota', type: 'text', full: true },
    ],
  },

  seasons: {
    key: 'seasons', singular: 'Temporada', plural: 'Temporadas', icon: 'calendar', group: 'Shows',
    label: (e) => (e['name'] ? `${e['name']}` : `Temporada ${e['number']}`),
    columns: [
      { key: 'number', label: 'Nº' },
      { key: 'name', label: 'Nome' },
      { key: 'startMonth', label: 'Universe começa em', render: (e) => MONTHS[(e['startMonth'] ?? 5) - 1] },
      { key: 'startDate', label: 'Início', render: (e) => fmtDate(e['startDate']), sortValue: (e) => e['startDate'] ?? '' },
    ],
    fields: [
      { key: 'number', label: 'Número', type: 'number', required: true, min: 1 },
      { key: 'name', label: 'Nome', type: 'text' },
      {
        key: 'startMonth', label: 'Em que mês o universe começa nesta temporada?', type: 'select', required: true, default: 5, full: true,
        options: SEASON_MONTHS.map((m) => ({ value: m, label: MONTHS[m - 1] })),
        hint: 'A temporada vai de maio a abril. Os episódios dos meses anteriores ao escolhido ficam de fora e o próximo episódio a jogar é calculado a partir dele.',
      },
      dateField('startDate', 'Início'),
    ],
  },

  shows: {
    key: 'shows', singular: 'Show', plural: 'Shows', icon: 'video', group: 'Shows',
    label: byName, filters: ['brandId', 'kind'],
    columns: [
      { key: 'imageUrl', label: '', type: 'image' },
      { key: 'name', label: 'Nome' },
      { key: 'kind', label: 'Tipo', render: (e) => labelOfOption(SHOW_KIND, e['kind']) },
      { key: 'brandId', label: 'Brand', render: (e) => e['brand']?.name ?? '', sortValue: (e) => e['brand']?.name ?? '' },
      { key: 'weekday', label: 'Dia', render: (e) => (e['weekday'] == null ? '' : WEEKDAYS[e['weekday']]) },
      { key: 'ppvMonth', label: 'Mês do PLE', render: (e) => (e['ppvMonth'] ? `${MONTHS[e['ppvMonth'] - 1]}${e['ppvWeek'] ? ' · semana ' + e['ppvWeek'] : ''}` : '') },
      { key: 'nights', label: 'Noites', render: (e) => (e['kind'] !== 'WEEKLY' && e['nights'] > 1 ? `${e['nights']} noites` : '') },
      { key: 'isActive', label: 'Ativo', type: 'switch' },
    ],
    fields: [
      name(), { key: 'kind', label: 'Tipo', type: 'select', required: true, options: SHOW_KIND, default: 'WEEKLY' },
      { key: 'brandId', label: 'Brand', type: 'ref', ref: 'brands' },
      { key: 'weekday', label: 'Dia da semana em que acontece', type: 'select', options: WEEKDAYS.map((label, value) => ({ value, label })), hint: 'Define a data dos episódios: semana 2 = a 2ª ocorrência desse dia no mês. Vazio: semanal = segunda, PLE = sábado.' },
      { key: 'ppvMonth', label: 'Mês do PLE', type: 'select', options: MONTHS.map((label, i) => ({ value: i + 1, label })), showIf: (v) => v['kind'] !== 'WEEKLY' },
      { key: 'ppvWeek', label: 'Semana do PLE', type: 'select', options: [1, 2, 3, 4].map((n) => ({ value: n, label: `Semana ${n}` })), showIf: (v) => v['kind'] !== 'WEEKLY' },
      { key: 'nights', label: 'Noites', type: 'select', required: true, default: 1, options: [{ value: 1, label: '1 noite' }, { value: 2, label: '2 noites (Noite 1 e Noite 2)' }], showIf: (v) => v['kind'] !== 'WEEKLY', hint: 'Cada noite vira um episódio com o seu próprio card (use “Gerar episódios”).' },
      { ...isActive, label: 'Show ativo', hint: 'Desativar apaga todos os episódios do show' },
      image,
    ],
  },

  episodes: {
    key: 'episodes', singular: 'Episódio', plural: 'Episódios', icon: 'calendar-plus', group: 'Shows',
    label: episodeLabel, filters: ['showId', 'seasonId', 'month', 'status'],
    toolbar: 'generateEpisodes',
    rowActions: [{ icon: 'list', label: 'Abrir card', link: (e) => ['/episodes', e.id, 'card'] }],
    columns: [
      { key: 'showId', label: 'Show', render: (e) => e['show']?.name ?? '', sortValue: (e) => e['show']?.name ?? '' },
      { key: 'title', label: 'Título' },
      { key: 'seasonId', label: 'Temporada', render: (e, n) => n('seasons', e['seasonId']) },
      { key: 'month', label: 'Mês', render: (e) => MONTHS[e['month'] - 1] ?? '', sortValue: (e) => e['month'] },
      { key: 'week', label: 'Semana' },
      { key: 'night', label: 'Noite', render: (e) => (e['night'] ? `Noite ${e['night']}` : '') },
      { key: 'day', label: 'Dia', render: (e) => gameDayName(e as never), sortValue: (e) => e['date'] ?? '' },
      { key: 'status', label: 'Status', render: (e) => labelOfOption(EPISODE_STATUS, e['status']) },
    ],
    fields: [
      { key: 'showId', label: 'Show', type: 'ref', ref: 'shows', required: true },
      { key: 'seasonId', label: 'Temporada', type: 'ref', ref: 'seasons', required: true },
      { key: 'title', label: 'Título', type: 'text' },
      { key: 'month', label: 'Mês', type: 'select', required: true, options: MONTHS.map((label, i) => ({ value: i + 1, label })) },
      { key: 'week', label: 'Semana do mês (1 a 4)', type: 'number', min: 1, max: 4, hint: 'Ex.: semana 2 de agosto. Não precisa de data exata.' },
      { key: 'night', label: 'Noite (só PLE em duas noites)', type: 'select', options: [{ value: 1, label: 'Noite 1' }, { value: 2, label: 'Noite 2' }] },
      { ...dateField('airDate', 'Data (opcional)'), hint: 'Normalmente deixe vazio: o dia vem do dia da semana do show e da semana do mês (todo mês tem 4 semanas).' },
      // vazio = calculada pelo dia da semana do show + semana do mês
      { key: 'status', label: 'Status', type: 'select', options: EPISODE_STATUS, default: 'PLANNED' },
      image,
      { key: 'notes', label: 'Notas', type: 'textarea', full: true },
    ],
  },

  'match-types': {
    key: 'match-types', singular: 'Tipo de luta', plural: 'Tipos de luta', icon: 'tag', group: 'Shows',
    label: byName,
    columns: [{ key: 'name', label: 'Nome' }],
    fields: [name()],
  },

  tournaments: {
    key: 'tournaments', singular: 'Torneio', plural: 'Torneios', icon: 'sitemap', group: 'Torneios',
    label: byName, filters: ['seasonId', 'status', 'format'],
    rowActions: [{ icon: 'share-alt', label: 'Abrir chave', link: (e) => ['/tournaments', e.id] }],
    columns: [
      { key: 'imageUrl', label: '', type: 'image' },
      { key: 'name', label: 'Nome' },
      { key: 'format', label: 'Formato', render: (e) => labelOfOption(TOURNAMENT_FORMAT, e['format']) },
      { key: 'size', label: 'Vagas' },
      { key: 'isTag', label: 'Duplas', type: 'bool' },
      { key: 'status', label: 'Status', render: (e) => labelOfOption(TOURNAMENT_STATUS, e['status']) },
      { key: 'entrants', label: 'Inscritos', render: (e) => String(e['_count']?.entrants ?? 0), sortValue: (e) => e['_count']?.entrants ?? 0 },
    ],
    fields: [
      name(), { key: 'format', label: 'Formato', type: 'select', options: TOURNAMENT_FORMAT, default: 'SINGLE_ELIMINATION' },
      { key: 'size', label: 'Vagas', type: 'number', required: true, min: 2, max: 64, default: 8 },
      { key: 'seasonId', label: 'Temporada', type: 'ref', ref: 'seasons' },
      { key: 'status', label: 'Status', type: 'select', options: TOURNAMENT_STATUS, default: 'PLANNED' },
      { key: 'isTag', label: 'Torneio de duplas', type: 'boolean', default: false },
      dateField('startDate', 'Início'), dateField('endDate', 'Fim'),
      image,
      { key: 'notes', label: 'Notas', type: 'textarea', full: true },
    ],
  },
};

export const GROUPS: Resource['group'][] = ['Roster', 'Títulos', 'Shows', 'Torneios'];

/** Corpo do request a partir dos valores do formulário. */
export function buildBody(
  res: Resource,
  values: Record<string, any>,
  original?: Entity,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const f of res.fields) {
    if (f.showIf && !f.showIf(values)) {
      // campo escondido: limpa o valor ao editar
      if (original) body[f.key] = null;
      continue;
    }
    let v = values[f.key];
    // imageUrl vem da API como URL assinada temporária: só reenvia se mudou.
    if (f.type === 'image' && original && v === original[f.key]) continue;
    if (f.toBody) v = f.toBody(v);
    if (v === '' || v === undefined) v = null;
    if (f.type === 'number' && v !== null) v = Number(v);
    // criação: não manda nulos (deixa o default do backend agir)
    if (!original && v === null) continue;
    body[f.key] = v;
  }
  // titleReign: junta lutadores e duplas em `holders`
  if (res.key === 'title-reigns') {
    body['holders'] = [
      ...((values['wrestlerHolderIds'] ?? []) as string[]).map((wrestlerId) => ({ wrestlerId })),
      ...((values['teamHolderIds'] ?? []) as string[]).map((teamId) => ({ teamId })),
    ];
    delete body['wrestlerHolderIds'];
    delete body['teamHolderIds'];
  }
  return body;
}
