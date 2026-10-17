import { randomInt } from 'node:crypto';

export function makeCard(squareIds: string[]): (string | null)[] {
  if (squareIds.length !== 24 || new Set(squareIds).size !== 24) throw new Error('A card version must contain exactly 24 distinct squares.');
  const cells = [...squareIds];
  for (let i = cells.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [cells[i], cells[j]] = [cells[j]!, cells[i]!];
  }
  const result: (string | null)[] = cells;
  result.splice(12, 0, null);
  return result;
}

export function scoreCard(claimedPositions: number[]) {
  const claimed = new Set(claimedPositions.filter(p => Number.isInteger(p) && p >= 0 && p < 25 && p !== 12));
  const marked = new Set([...claimed, 12]);
  const lines: number[][] = [];
  for (let i = 0; i < 5; i++) {
    lines.push(Array.from({ length: 5 }, (_, n) => i * 5 + n));
    lines.push(Array.from({ length: 5 }, (_, n) => n * 5 + i));
  }
  lines.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]);
  return { claimedCount: claimed.size, lineCount: lines.filter(line => line.every(p => marked.has(p))).length, blackout: claimed.size === 24 };
}
