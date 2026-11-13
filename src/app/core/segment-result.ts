/**
 * Uma luta só pode ser marcada como realizada com resultado: vencedor (ou lado vencedor)
 * e como terminou, ou empate. Mesma regra do backend (services/segmentResult.js).
 */
export interface ResultInput {
  type: string | null | undefined;
  isDone: boolean;
  isDraw: boolean;
  finishType: string | null | undefined;
  participants: { side: number; isWinner: boolean }[];
}

export function resultProblem(s: ResultInput): string | null {
  if (!s.isDone || s.type !== 'MATCH') return null;
  if (!s.participants.length) return 'Informe os participantes para marcar como realizada.';
  const winners = s.participants.filter((p) => p.isWinner);
  if (s.isDraw) return winners.length ? 'Uma luta empatada não pode ter vencedor.' : null;
  if (!winners.length) return 'Marque o vencedor (ou o lado vencedor), ou marque empate.';
  if (new Set(winners.map((p) => p.side)).size > 1) return 'Os vencedores precisam ser do mesmo lado.';
  if (!s.finishType) return 'Informe como a luta terminou.';
  return null;
}
