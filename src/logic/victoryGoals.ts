import { axialToOffset } from './hexGrid';
import type { Scenario, Hex } from '../types/game';

// České skloňování slova „bod" podle počtu.
function vpWord(n: number): string {
  const a = Math.abs(n);
  if (a === 1) return 'bod';
  if (a >= 2 && a <= 4) return 'body';
  return 'bodů';
}

function pointsPhrase(n: number): string {
  return `${n} ${vpWord(n)}`;
}

function forWhom(validFor: any, p1: string, p2: string): string {
  if (validFor === 'player1') return `pro stranu ${p1}`;
  if (validFor === 'player2') return `pro stranu ${p2}`;
  return 'pro obě strany';
}

// Lidsky čitelné umístění políčka – přednostně jeho popisek, jinak souřadnice
// v podobě [sloupec, řádek] (číslováno od 1).
function hexLocation(h: Hex): string {
  if (h.label && h.label.trim()) return `„${h.label.trim()}"`;
  const { col, row } = axialToOffset(h.q, h.r);
  return `pole [${col + 1}, ${row + 1}]`;
}

// Vygeneruje slovní popis cílů vítězství ze scénáře – z bodů potřebných k výhře
// a z objektivů rozmístěných na mapě (initialHexes). Skupinové objektivy se
// popíšou podle své podmínky, samostatné jako jednotlivá políčka.
export function generateVictoryGoals(scenario: Partial<Scenario>): string {
  const p1 = scenario?.player1?.name || 'Spojenci';
  const p2 = scenario?.player2?.name || 'Osa';
  const vp = scenario?.victoryPointsToWin ?? 0;
  const hexes = (scenario?.initialHexes || []).filter((h) => h.objective);

  const lines: string[] = [];
  lines.push(`Vítězí strana, která jako první získá ${pointsPhrase(vp)}.`);

  // Objektivy seskupíme podle groupId; samostatné necháme bokem.
  const groups = new Map<string, { obj: any; hexes: Hex[] }>();
  const singles: Hex[] = [];
  for (const h of hexes) {
    const obj = h.objective as any;
    if (obj.groupId) {
      if (!groups.has(obj.groupId)) groups.set(obj.groupId, { obj, hexes: [] });
      groups.get(obj.groupId)!.hexes.push(h);
    } else {
      singles.push(h);
    }
  }

  if (hexes.length > 0) {
    lines.push('');
    lines.push('Cíle na mapě:');
    for (const h of singles) {
      const o = h.objective as any;
      const name = o.name && o.name.trim() ? o.name.trim() : 'Cíl';
      const typeNote = o.type === 'temporary' ? ', dočasný' : '';
      lines.push(`• ${name}: obsaď a udrž ${hexLocation(h)} – ${pointsPhrase(o.points)} ${forWhom(o.validFor, p1, p2)}${typeNote}.`);
    }
    for (const { obj, hexes: ghexes } of groups.values()) {
      const name = obj.name && obj.name.trim() ? obj.name.trim() : 'Cíl';
      const cond = obj.condition === 'any'
        ? 'alespoň jedno políčko'
        : obj.condition === 'majority'
          ? 'většinu políček'
          : 'všechna políčka';
      const typeNote = obj.type === 'temporary' ? ', dočasný' : '';
      const labels = ghexes
        .map((h) => (h.label && h.label.trim() ? h.label.trim() : null))
        .filter(Boolean);
      const labelNote = labels.length ? ` (${labels.join(', ')})` : '';
      lines.push(`• ${name}: ovládni ${cond} oblasti${labelNote} z ${ghexes.length} políček – ${pointsPhrase(obj.points)} ${forWhom(obj.validFor, p1, p2)}${typeNote}.`);
    }
  }

  lines.push('');
  lines.push('Každá zničená nepřátelská jednotka znamená 1 bod. Pokud soupeř přijde o všechny jednotky, prohrává.');

  return lines.join('\n');
}
