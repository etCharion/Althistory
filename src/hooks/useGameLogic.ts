import { useState, useMemo, useEffect, useCallback } from 'react';
import { getNeighbors, getReachableHexes, getTargetableUnits, isImpassableForUnit, blocksRetreatInto } from '../logic/hexGrid';
import { newDiceSeed } from '../logic/dice';
import { chooseAiAction } from '../logic/ai';
import { subscribeToGame, applyAction, createGameIfMissing } from '../logic/firebaseService';
import { saveLocalGame, loadLocalGame } from '../logic/localGameStorage';
import { reducer, createInitialGameState, isGeneral } from '../logic/gameReducer';
import type { Action, Rules } from '../logic/gameReducer';

// Zvýraznění poslední akce AI na mapě: jednotka + odkud + kam (viz GameView).
export type AiActionHighlight = { kind: 'move' | 'attack' | 'assign'; unitId: string; from: string; to: string } | null;
// Záznam akce AI pro zpětné (čistě vizuální) prohlížení tahu počítače.
// `units`/`grid` je snímek herního stavu TĚSNĚ PŘED touto akcí – reducer je
// čistý (nikdy nemutuje), takže stačí uložit reference. Při prohlížení kroku
// se hrací deska vykreslí z tohoto snímku: jednotka je vidět tam, kde stála,
// zničené jednotky se znovu objeví a barevně se označí, co s nimi AI provedla.
export type AiLogEntry = { id: number; kind: 'move' | 'attack' | 'assign'; unitId: string; from: string; to: string; label: string; units: Record<string, any>; grid: Record<string, any> };

const SECTION_LABEL: Record<string, string> = { left: 'Levá', center: 'Střed', right: 'Pravá' };

export function useGameLogic(scenario, unitTypes, terrainTypes, overlayTypes, gameId?: string, clientId: string = 'local', aiPlayerId: 'player1' | 'player2' | null = null, aiRun: boolean = true, aiSpeed: number = 1, resume: boolean = false) {
  const rules: Rules = useMemo(() => ({ unitTypes, terrainTypes, overlayTypes }), [unitTypes, terrainTypes, overlayTypes]);

  // Local (hot-seat / vs AI) games keep their state in React and are mirrored to
  // localStorage so they survive an exit or reload; online games mirror Firestore.
  // `resume` říká, že se má navázat na uloženou místní hru místo nové partie.
  const initLocalState = () => {
    if (gameId || !scenario) return null;
    if (resume) {
      const saved = loadLocalGame();
      if (saved) return saved.state;
    }
    return createInitialGameState(scenario);
  };
  const [localState, setLocalState] = useState<any>(initLocalState);
  const [remoteState, setRemoteState] = useState<any>(null);

  // Initialise local state once a scenario is available (local games only).
  useEffect(() => {
    if (!gameId && scenario && !localState) setLocalState(initLocalState());
  }, [scenario, gameId, localState]);

  // Zrcadlení místní hry do localStorage po každé změně stavu (viz
  // localGameStorage). Online hry se ukládají do Firestore, ty přeskakujeme.
  useEffect(() => {
    if (gameId || !localState) return;
    saveLocalGame(localState, aiPlayerId);
  }, [localState, gameId, aiPlayerId]);

  // Online: make sure the shared document exists, then subscribe to it.
  useEffect(() => {
    if (!gameId) return;
    if (scenario) createGameIfMissing(gameId, scenario);
    const unsubscribe = subscribeToGame(gameId, (remote) => setRemoteState(remote));
    return () => unsubscribe();
  }, [gameId, scenario]);

  const gameState = gameId ? remoteState : localState;

  // Poslední pohyb/útok AI – GameView z něj zvýrazňuje jednotku a políčka.
  const [aiLastAction, setAiLastAction] = useState<AiActionHighlight>(null);
  const clearAiHighlight = useCallback(() => setAiLastAction(null), []);

  // Log akcí AI (pohyby, útoky, ústupy, obsazení pozic) pro zpětné vizuální
  // prohlížení. Maže se na začátku dalšího tahu počítače – hráč si tak může
  // celý minulý tah AI projít krok za krokem.
  const [aiLog, setAiLog] = useState<AiLogEntry[]>([]);
  const aiActive = !!aiPlayerId && gameState?.activePlayerId === aiPlayerId;
  useEffect(() => {
    if (aiActive) setAiLog([]);
  }, [aiActive]);

  const dispatch = useCallback((action: Action) => {
    // Akce člověka ruší zvýraznění posledního tahu AI.
    if ((action as any).clientId !== 'ai') setAiLastAction(null);
    if (gameId) {
      applyAction(gameId, action, rules);
    } else {
      setLocalState((prev) => (prev ? reducer(prev, action, rules) : prev));
    }
  }, [gameId, rules]);

  // ---- AI protihráč (jen lokální hra) ----
  // Po každé změně stavu se AI zeptáme na jednu další akci; provede se se
  // zpožděním (škálovaným zvolenou rychlostí), aby tah počítače působil
  // čitelným tempem. Vlastní tah AI startuje až na pokyn hráče (`aiRun`);
  // ústupy a obsazování pozic během tahu člověka řeší AI vždy hned, protože
  // jsou součástí hráčova souboje. Kostky nechává na stole déle (zavře je až
  // po doběhnutí animace – v UI to obvykle stihne dřív jeho vlastní časovač).
  useEffect(() => {
    if (!aiPlayerId || gameId || !gameState || gameState.winner) return;
    if (!unitTypes?.length || !terrainTypes?.length) return;
    if (gameState.activePlayerId === aiPlayerId && !aiRun) return; // čeká na „Spustit tah"
    const action = chooseAiAction(gameState, rules, aiPlayerId, { clientId: 'ai' });
    if (!action) return;
    const base = action.type === 'DISMISS_COMBAT' ? 2600
      : action.type === 'ATTACK' ? 900
      : (action.type === 'DISTRIBUTE' || action.type === 'ASSIGN_RESOURCE') ? 400
      : 700;
    const delay = action.type === 'DISMISS_COMBAT' ? base : Math.round(base * aiSpeed);
    const t = setTimeout(() => {
      // Zvýraznění: pohyby (vč. ústupu a obsazení pozice) a útoky; ostatní
      // akce zvýraznění ruší, ať na mapě nestraší z minulé fáze. Tytéž akce
      // se zapisují do logu pro zpětné prohlížení tahu.
      const hexOf = (uid: string) => {
        const h: any = Object.values(gameState.grid).find((x: any) => x.unitId === uid);
        return h ? `${h.q},${h.r}` : '';
      };
      const typeName = (uid: string) => {
        const u: any = (gameState.units as any)[uid];
        return unitTypes.find((t: any) => t.id === u?.typeId)?.name || 'Jednotka';
      };
      // Snímek stavu před akcí – stav je immutable, takže stačí uložit reference.
      const beforeUnits = gameState.units;
      const beforeGrid = gameState.grid;
      const record = (kind: 'move' | 'attack' | 'assign', unitId: string, from: string, to: string, label: string) => {
        setAiLastAction({ kind, unitId, from, to });
        setAiLog(prev => [...prev, { id: prev.length, kind, unitId, from, to, label, units: beforeUnits, grid: beforeGrid }]);
      };
      if (action.type === 'ASSIGN_RESOURCE') {
        const uid = (action as any).unitId;
        const at = hexOf(uid);
        const sec = (action as any).sectionId;
        record('assign', uid, '', at, sec ? `Zdroj: ${typeName(uid)} (${SECTION_LABEL[sec] || sec})` : `Zdroj: ${typeName(uid)}`);
      } else if (action.type === 'MOVE') {
        record('move', (action as any).unitId, hexOf((action as any).unitId), `${(action as any).q},${(action as any).r}`, `Pohyb: ${typeName((action as any).unitId)}`);
      } else if (action.type === 'RESOLVE_RETREAT') {
        const from = hexOf((action as any).unitId);
        const to = `${(action as any).q},${(action as any).r}`;
        record('move', (action as any).unitId, from, to, from === to ? `Ztráta při ústupu: ${typeName((action as any).unitId)}` : `Ústup: ${typeName((action as any).unitId)}`);
      } else if (action.type === 'RESOLVE_TAKE_GROUND') {
        record('move', (action as any).unitId, hexOf((action as any).unitId), `${(action as any).q},${(action as any).r}`, `Obsazení pozice: ${typeName((action as any).unitId)}`);
      } else if (action.type === 'ATTACK') {
        record('attack', (action as any).attackerId, hexOf((action as any).attackerId), hexOf((action as any).targetId), `Útok: ${typeName((action as any).attackerId)} → ${typeName((action as any).targetId)}`);
      } else if (action.type !== 'DISMISS_COMBAT') {
        setAiLastAction(null);
      }
      dispatch(action);
    }, delay);
    return () => clearTimeout(t);
  }, [gameState, aiPlayerId, gameId, rules, dispatch, aiRun, aiSpeed]);

  // ---- Action creators (thin wrappers around dispatch) ----
  const distributeResource = (_pid, sec, amount: number | 'max' = 1) => dispatch({ type: 'DISTRIBUTE', clientId, section: sec, amount });
  // Sloučený režim: klik na jednotku přesune zdroj ze skladu rovnou na ni.
  const distributeToUnit = (uid, sectionId?) => dispatch({ type: 'DISTRIBUTE_TO_UNIT', clientId, unitId: uid, sectionId });
  const nextPhase = (skipUnitPhase = false) => dispatch({ type: 'NEXT_PHASE', clientId, skipUnitPhase });
  const endTurn = () => dispatch({ type: 'END_TURN', clientId });
  const assignResourceToUnit = (uid, sectionId?) => dispatch({ type: 'ASSIGN_RESOURCE', clientId, unitId: uid, sectionId });
  const moveUnit = (uid, q, r) => dispatch({ type: 'MOVE', clientId, unitId: uid, q, r });
  // Seed hodu kostkami vzniká tady (mimo reducer), aby byl reducer deterministický.
  const attackUnit = (aid, tid) => dispatch({ type: 'ATTACK', clientId, attackerId: aid, targetId: tid, seed: newDiceSeed() });
  const destroyOverlay = (uid) => dispatch({ type: 'DESTROY_OVERLAY', clientId, unitId: uid });
  const retreatUnit = (uid, q, r) => dispatch({ type: 'RESOLVE_RETREAT', clientId, unitId: uid, q, r });
  const takeGround = (uid, q, r) => dispatch({ type: 'RESOLVE_TAKE_GROUND', clientId, unitId: uid, q, r });
  const cancelTakeGround = () => dispatch({ type: 'CANCEL_TAKE_GROUND', clientId });
  const dismissCombat = () => dispatch({ type: 'DISMISS_COMBAT', clientId });
  const undoLastAction = () => dispatch({ type: 'UNDO', clientId });

  // Whether the most recent reversible action (resource distribution / move) can
  // still be undone in the current open phase.
  const canUndo = () => {
    if (!gameState) return false;
    const stack = gameState.undoStack || [];
    if (stack.length === 0) return false;
    return stack[stack.length - 1].phase === gameState.phase && !gameState.pendingCombat && !gameState.pendingRetreat && !gameState.pendingTakeGround;
  };

  // ---- Shared combat state (mirrors Firestore so every player sees it) ----
  const combatResult = gameState?.pendingCombat || null;
  const retreatingUnitId = gameState?.pendingRetreat || null;
  const takeGroundOption = gameState?.pendingTakeGround || null;

  // ---- Read-only derivations used by the view ----
  const getUnitHex = (uid) => (gameState ? Object.values(gameState.grid).find((h: any) => h.unitId === uid) || null : null);

  const getSelectedReachable = (uid) => {
    if (!gameState) return [];
    const unit = gameState.units[uid]; if (!unit) return [];
    const hex = getUnitHex(uid); if (!hex) return [];
    const utype = unitTypes.find(u => u.id === unit.typeId);
    const limit = utype.movement - unit.movementUsed;
    if (limit <= 0 || (!unit.hasMoved && unit.resources <= 0)) return [];
    const category = utype?.category || (utype?.id === 'tank' ? 'tank' : (utype?.id === 'artillery' ? 'artillery' : 'infantry'));
    return getReachableHexes((hex as any).q, (hex as any).r, limit, gameState.grid, terrainTypes, overlayTypes, { unitCategory: category, ownerId: unit.ownerId });
  };

  const getSelectedTargetable = (uid) => {
    if (!gameState) return [];
    const unit = gameState.units[uid]; if (!unit) return [];
    const hex = getUnitHex(uid); if (!hex) return [];
    const utype = unitTypes.find(u => u.id === unit.typeId);
    // overrunReady = bonusový útok (Armor Overrun), který obchází limit útoku i zdroj.
    if (!unit.overrunReady && (unit.resources <= 0 || unit.hasAttacked)) return [];
    const category = utype?.category || (utype?.id === 'tank' ? 'tank' : (utype?.id === 'artillery' ? 'artillery' : 'infantry'));
    if (category === 'artillery' && (unit.movementUsed > 0 || unit.hasMoved)) return [];
    return getTargetableUnits((hex as any).q, (hex as any).r, utype, gameState, terrainTypes, overlayTypes);
  };

  const getRetreatHexes = (uid) => {
    if (!gameState) return [];
    const unit = gameState.units[uid];
    const fH = getUnitHex(uid);
    if (!unit || !fH) return [];
    const utype = unitTypes.find(ut => ut.id === unit.typeId);
    const category = utype?.category || (utype?.id === 'tank' ? 'tank' : (utype?.id === 'artillery' ? 'artillery' : 'infantry'));
    const neighbors = getNeighbors((fH as any).q, (fH as any).r);
    const valid = neighbors.filter(n => {
      const hex = gameState.grid[`${n.q},${n.r}`];
      if (!hex || hex.unitId) return false;
      // Do neprůchodného terénu (řeka apod.) ani na pole se zákazem ústupu
      // (moře) nelze ustoupit – stejná kontrola jako v reduceru (RESOLVE_RETREAT).
      if (isImpassableForUnit(hex, terrainTypes, overlayTypes, category, unit.ownerId)) return false;
      if (blocksRetreatInto(hex, terrainTypes, overlayTypes)) return false;
      if (unit.ownerId === 'player1') return n.r > (fH as any).r;
      if (unit.ownerId === 'player2') return n.r < (fH as any).r;
      return false;
    }).map(n => `${n.q},${n.r}`);
    valid.push(`${(fH as any).q},${(fH as any).r}`);
    return valid;
  };

  const getUnusedActions = () => {
    if (!gameState) return [];
    const activeP = gameState.activePlayerId;
    const reasons: string[] = [];
    if (gameState.phase === 'distribution-sections') {
      if (gameState.centralWarehouse[activeP] > 0) reasons.push(`Sklad: ${gameState.centralWarehouse[activeP]}`);
    } else if (gameState.phase === 'distribution-units') {
      const res = gameState.sectionResources[activeP];
      const parts: string[] = [];
      if (res.left > 0) parts.push(`L: ${res.left}`);
      if (res.center > 0) parts.push(`C: ${res.center}`);
      if (res.right > 0) parts.push(`R: ${res.right}`);
      if (parts.length > 0) reasons.push(`Sekce: ${parts.join(', ')}`);
    } else if (gameState.phase === 'movement') {
      const movable = Object.values(gameState.units).filter((u: any) => {
        if (u.ownerId !== activeP) return false;
        const utype = unitTypes.find(ut => ut.id === u.typeId);
        const canStart = !u.hasMoved && u.resources > 0;
        const canContinue = u.hasMoved && u.movementUsed < (utype?.movement || 0);
        return canStart || canContinue;
      });
      if (movable.length > 0) reasons.push(`Jednotky k pohybu: ${movable.length}`);
    } else if (gameState.phase === 'attack') {
      const attackable = Object.values(gameState.units).filter((u: any) => {
        const utype = unitTypes.find(ut => ut.id === u.typeId);
        if (u.ownerId !== activeP || (!u.overrunReady && (u.resources <= 0 || u.hasAttacked))) return false;
        const category = utype?.category || (utype?.id === 'tank' ? 'tank' : (utype?.id === 'artillery' ? 'artillery' : 'infantry'));
        if (category === 'artillery' && (u.movementUsed > 0 || u.hasMoved)) return false;
        const hex = getUnitHex(u.id);
        if (!hex) return false;
        if ((hex as any).overlayTypeId === 'wire' && category === 'infantry') return true;
        return getTargetableUnits((hex as any).q, (hex as any).r, utype, gameState, terrainTypes, overlayTypes).length > 0;
      });
      if (attackable.length > 0) reasons.push(`Jednotky k útoku: ${attackable.length}`);
    }
    return reasons;
  };

  const hasAvailableActions = () => getUnusedActions().length > 0;

  // Fáze útoku je jediná, ze které se už nedá nic vrátit – jakmile aktivnímu
  // hráči nezbývá žádný útok a žádný souboj nečeká na vyřešení, tah skončí
  // automaticky. Ostatní fáze ukončuje hráč vždy sám tlačítkem (kvůli undo).
  useEffect(() => {
    if (!gameState || gameState.winner || gameState.phase !== 'attack') return;
    if (gameState.activePlayerId === aiPlayerId) return; // tah AI řídí smyčka výše
    if (gameState.pendingCombat || gameState.pendingRetreat || gameState.pendingTakeGround) return;
    if (!isGeneral(gameState, clientId, gameState.activePlayerId)) return;
    if (hasAvailableActions()) return;
    const t = setTimeout(() => dispatch({ type: 'END_TURN', clientId }), 900);
    return () => clearTimeout(t);
  }, [gameState, aiPlayerId, clientId, dispatch]);

  return {
    gameState, combatResult, retreatingUnitId, takeGroundOption,
    dismissCombat, cancelTakeGround, takeGround, destroyOverlay,
    distributeResource, distributeToUnit, nextPhase, endTurn, assignResourceToUnit, moveUnit, attackUnit, retreatUnit,
    undoLastAction, canUndo,
    getSelectedReachable, getSelectedTargetable, getRetreatHexes, getUnitHex, hasAvailableActions, getUnusedActions,
    aiLastAction, clearAiHighlight, aiLog
  };
}
