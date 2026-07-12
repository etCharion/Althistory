import {
  collection,
  getDocs,
  getDoc,
  setDoc,
  doc,
  onSnapshot,
  query,
  limit,
  deleteDoc,
  runTransaction
} from "firebase/firestore";
import { db } from "../firebase";
import { reducer, createInitialGameState } from "./gameReducer";
import type { Action, Rules } from "./gameReducer";
import type { PlayerId, Role } from "../types/game";
import {
  DEFAULT_UNIT_TYPES,
  DEFAULT_TERRAIN_TYPES,
  DEFAULT_OVERLAY_TYPES,
  DEFAULT_COUNTRIES
} from "../data/defaults";
import { DEFAULT_SCENARIO } from "../data/defaultScenario";

// Helper to seed data if collection is empty
async function seedIfEmpty(collectionName: string, defaultData: any[]) {
  console.log(`Checking collection ${collectionName}...`);
  try {
    const colRef = collection(db, collectionName);
    const snapshot = await getDocs(query(colRef, limit(1)));

    if (snapshot.empty) {
      console.log(`Seeding ${collectionName}...`);
      for (const item of defaultData) {
        await setDoc(doc(db, collectionName, item.id), item);
      }
      console.log(`Seeding ${collectionName} done.`);
    } else {
      console.log(`Collection ${collectionName} already has data.`);
    }
  } catch (error) {
    console.error(`Error seeding ${collectionName}:`, error);
  }
}

// Doplní do kolekce vestavěné dokumenty, které v ní chybí – nic existujícího
// nepřepisuje (uživatelské úpravy zůstávají). Díky tomu se nové vestavěné
// typy terénu objeví i v databázích osetých dříve, kdy seedIfEmpty už nic
// nedělá. Pozor: smazaný vestavěný typ se při dalším startu obnoví.
async function seedMissing(collectionName: string, defaultData: any[]) {
  try {
    for (const item of defaultData) {
      const ref = doc(db, collectionName, item.id);
      const snapshot = await getDoc(ref);
      if (!snapshot.exists()) {
        console.log(`Seeding missing ${collectionName}/${item.id}...`);
        await setDoc(ref, item);
      }
    }
  } catch (error) {
    console.error(`Error seeding missing ${collectionName}:`, error);
  }
}

export async function seedDatabase() {
  console.log("Starting database seed...");
  await seedIfEmpty("unitTypes", DEFAULT_UNIT_TYPES);
  await seedMissing("terrainTypes", DEFAULT_TERRAIN_TYPES);
  await seedIfEmpty("overlayTypes", DEFAULT_OVERLAY_TYPES);
  await seedIfEmpty("countries", DEFAULT_COUNTRIES);
  await seedIfEmpty("scenarios", [DEFAULT_SCENARIO]);
  // Campaigns are empty by default, so no seeding needed unless specified
}

// Fetching functions
export async function getFirestoreData(collectionName: string) {
  const colRef = collection(db, collectionName);
  const snapshot = await getDocs(colRef);
  return snapshot.docs.map(doc => doc.data());
}

// Saving functions for Customization / Admin
export async function saveToFirestore(collectionName: string, data: any) {
  const sanitized = sanitizeData(data);
  await setDoc(doc(db, collectionName, data.id), sanitized);
}

export async function deleteFromFirestore(collectionName: string, id: string) {
  await deleteDoc(doc(db, collectionName, id));
}

// Helper to remove undefined values for Firestore
function sanitizeData(data: any): any {
  if (data === undefined) return null;
  if (data === null || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitizeData);
  const sanitized: any = {};
  for (const key in data) {
    if (data[key] !== undefined) {
      sanitized[key] = sanitizeData(data[key]);
    }
  }
  return sanitized;
}

// Game State specific functions
export async function saveGameState(gameId: string, gameState: any) {
  const sanitized = sanitizeData(gameState);
  await setDoc(doc(db, "games", gameId), {
    ...sanitized,
    updatedAt: new Date().toISOString()
  });
}

export function subscribeToGame(gameId: string, callback: (data: any) => void) {
  return onSnapshot(doc(db, "games", gameId), (doc) => {
    if (doc.exists()) {
      callback(doc.data());
    }
  });
}

export async function getGameState(gameId: string) {
  const docRef = doc(db, "games", gameId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? docSnap.data() : null;
}

// Create the shared game document (with empty seats) if it doesn't exist yet.
// Called by the first client that has the scenario in hand.
export async function createGameIfMissing(gameId: string, scenario: any) {
  const ref = doc(db, "games", gameId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists()) return;
    const initial = createInitialGameState(scenario, { online: true });
    tx.set(ref, { ...sanitizeData(initial), updatedAt: new Date().toISOString() });
  });
}

// Apply a single game action atomically so concurrent commanders never clobber
// each other's writes. The pure reducer runs inside the transaction.
export async function applyAction(gameId: string, action: Action, rules: Rules) {
  const ref = doc(db, "games", gameId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const next = reducer(snap.data() as any, action, rules);
    tx.set(ref, { ...sanitizeData(next), updatedAt: new Date().toISOString() });
  });
}

// Seat management. A client holds at most one seat per game; claiming a new seat
// releases any seat that client previously held.
export async function claimSeat(gameId: string, team: PlayerId, role: Role, clientId: string) {
  const ref = doc(db, "games", gameId);
  let ok = false;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data: any = snap.data();
    const seats = data.seats || { player1: {}, player2: {} };
    // Reject if the target seat is taken by someone else.
    if (seats[team]?.[role] && seats[team][role] !== clientId) { ok = false; return; }
    // Release any seat currently held by this client.
    (['player1', 'player2'] as PlayerId[]).forEach((t) => {
      const teamSeats = seats[t] || {};
      Object.keys(teamSeats).forEach((r) => { if (teamSeats[r] === clientId) delete teamSeats[r]; });
      seats[t] = teamSeats;
    });
    seats[team] = { ...(seats[team] || {}), [role]: clientId };
    tx.set(ref, { ...data, seats: sanitizeData(seats), updatedAt: new Date().toISOString() });
    ok = true;
  });
  return ok;
}

// Uloží/aktualizuje WhatsApp kontakt hráče do herního dokumentu.
export async function saveContact(gameId: string, team: PlayerId, phone: string | null) {
  await setDoc(doc(db, "games", gameId), { contacts: { [team]: phone } }, { merge: true });
}

export async function releaseSeat(gameId: string, clientId: string) {
  const ref = doc(db, "games", gameId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data: any = snap.data();
    const seats = data.seats || { player1: {}, player2: {} };
    (['player1', 'player2'] as PlayerId[]).forEach((t) => {
      const teamSeats = seats[t] || {};
      Object.keys(teamSeats).forEach((r) => { if (teamSeats[r] === clientId) delete teamSeats[r]; });
      seats[t] = teamSeats;
    });
    tx.set(ref, { ...data, seats: sanitizeData(seats), updatedAt: new Date().toISOString() });
  });
}
