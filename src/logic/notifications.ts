// Čisté pomocné funkce pro upozornění na tah: normalizace telefonních čísel
// pro WhatsApp click-to-chat odkazy a detekci předání tahu druhému hráči.

// Odstraní mezery, pomlčky, tečky a závorky, převede vedoucí "00" na
// mezinárodní tvar a doplní českou předvolbu k holému 9místnému číslu.
// Vrací řetězec samých číslic (bez "+", jak vyžaduje wa.me), nebo null,
// pokud vstup obsahuje jiné znaky než číslice/oddělovače, nebo výsledná
// délka neodpovídá platnému telefonnímu číslu (8–15 číslic).
export function normalizePhoneForWhatsApp(input: string): string | null {
  if (!input) return null;
  let s = input.replace(/[\s\-.()]/g, '');
  let hasCountryPrefix = false;
  if (s.startsWith('+')) {
    s = s.slice(1);
    hasCountryPrefix = true;
  } else if (s.startsWith('00')) {
    s = s.slice(2);
    hasCountryPrefix = true;
  }
  if (!/^\d+$/.test(s)) return null;
  if (!hasCountryPrefix && s.length === 9) {
    s = '420' + s;
  }
  if (s.length < 8 || s.length > 15) return null;
  return s;
}

// Sestaví click-to-chat odkaz na WhatsApp s předvyplněnou zprávou.
export function buildWhatsAppUrl(normalizedPhone: string, text: string): string {
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(text)}`;
}

// Česká zpráva pro soupeře s odkazem na rozehranou hru.
export function buildTurnMessage(scenarioName: string, gameUrl: string): string {
  return `Jsi na tahu ve hře „${scenarioName}“! Pokračuj zde: ${gameUrl}`;
}

// Pravda, jen když se aktivní strana skutečně změnila a tah teď připadl mně
// (a hra ještě neskončila).
export function isTurnHandoverToMe(
  prevActive: string | null | undefined,
  nextActive: string | null | undefined,
  myTeam: string | null,
  winner: unknown
): boolean {
  if (winner) return false;
  if (!myTeam) return false;
  if (prevActive === nextActive) return false;
  return nextActive === myTeam;
}
