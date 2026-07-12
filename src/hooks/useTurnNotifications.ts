import { useCallback, useEffect, useRef, useState } from 'react';
import { isTurnHandoverToMe } from '../logic/notifications';

const STORAGE_KEY = 'turnNotificationsEnabled';

type Params = {
  gameState: any;
  online: boolean;
  myTeam: 'player1' | 'player2' | null;
  spectator: boolean;
  gameId?: string;
};

// Upozornění prohlížeče na to, že jsem na tahu (online hry). Sleduje předání
// tahu (activePlayerId) a při přechodu na mě – pokud je karta na pozadí –
// pošle notifikaci a orazítkuje title stránky.
export function useTurnNotifications({ gameState, online, myTeam, spectator, gameId }: Params) {
  const supported = typeof window !== 'undefined' && 'Notification' in window;
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === '1';
  });
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    supported ? Notification.permission : 'denied'
  );

  const toggle = useCallback(async () => {
    if (!supported) return;
    if (enabled) {
      setEnabled(false);
      localStorage.setItem(STORAGE_KEY, '0');
      return;
    }
    let perm = Notification.permission;
    if (perm === 'default') {
      perm = await Notification.requestPermission();
      setPermission(perm);
    }
    if (perm === 'granted') {
      setEnabled(true);
      localStorage.setItem(STORAGE_KEY, '1');
    }
  }, [enabled, supported]);

  const nextActive: string | null = gameState?.activePlayerId ?? null;
  const winner = gameState?.winner ?? null;

  // Předchozí aktivní strana napříč aktualizacemi stavu hry – aktualizuje se
  // vždy, i když jsou notifikace vypnuté, aby detekce fungovala hned po zapnutí.
  const prevActiveRef = useRef<string | null | undefined>(undefined);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      prevActiveRef.current = nextActive;
      return;
    }
    const prevActive = prevActiveRef.current;
    prevActiveRef.current = nextActive;

    if (!online || spectator || !enabled || !supported || permission !== 'granted') return;
    if (!isTurnHandoverToMe(prevActive, nextActive, myTeam, winner)) return;
    if (!(document.hidden || !document.hasFocus())) return;

    try {
      const notification = new Notification('Jsi na tahu!', {
        body: `${gameState?.scenario?.name || 'Althistory'} · ${gameState?.currentTurn}. kolo`,
        tag: 'turn-' + gameId,
      });
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch {
      // Některé (zejména Android) prohlížeče vyhazují při konstrukci Notification.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextActive, winner]);

  // Dokud je karta na pozadí a jsem na tahu, orazítkuje title stránky.
  const originalTitleRef = useRef<string | null>(null);
  useEffect(() => {
    const isMyTurnNow = online && !spectator && !!myTeam && nextActive === myTeam && !winner;
    const restore = () => {
      if (originalTitleRef.current !== null) {
        document.title = originalTitleRef.current;
        originalTitleRef.current = null;
      }
    };
    if (!isMyTurnNow) {
      restore();
      return;
    }
    const applyTitle = () => {
      if (document.hidden) {
        if (originalTitleRef.current === null) originalTitleRef.current = document.title;
        document.title = `🔔 Jsi na tahu! · ${originalTitleRef.current}`;
      } else {
        restore();
      }
    };
    applyTitle();
    document.addEventListener('visibilitychange', applyTitle);
    return () => {
      document.removeEventListener('visibilitychange', applyTitle);
      restore();
    };
  }, [online, spectator, myTeam, nextActive, winner]);

  return { supported, enabled, permission, toggle };
}
