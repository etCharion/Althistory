// Ukládání rozehrané místní hry (hot-seat i hra proti počítači) do localStorage.
// Online hry žijí ve Firestore; místní hry se dosud nikam neukládaly a po
// odchodu z partie nebo obnovení stránky se ztratily. Držíme jediný „slot" –
// stejně jako `lastGameId` u online hry – takže rozehraná místní hra se dá
// kdykoli obnovit z hlavního menu.

const KEY = 'althistory-local-game';

export type SavedLocalGame = {
  // Kompletní herní stav z reduceru (obsahuje i `scenario`).
  state: any;
  // Které straně velí počítač; null = hra dvou hráčů na jednom zařízení.
  aiPlayerId: 'player1' | 'player2' | null;
  savedAt: string;
};

// Ukládání je „best-effort": localStorage může být plné nebo nedostupné
// (privátní režim), což nesmí shodit probíhající hru.
export function saveLocalGame(state: any, aiPlayerId: 'player1' | 'player2' | null): void {
  try {
    const payload: SavedLocalGame = { state, aiPlayerId, savedAt: new Date().toISOString() };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch (e) {
    console.warn('Nepodařilo se uložit místní hru:', e);
  }
}

export function loadLocalGame(): SavedLocalGame | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedLocalGame;
    // Bez scénáře se hra nedá obnovit – poškozený záznam ignorujeme.
    if (!parsed?.state?.scenario) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearLocalGame(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* localStorage nedostupné – nic k čištění */
  }
}
