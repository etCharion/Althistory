import {
  collection,
  getDocs,
  getDoc,
  setDoc,
  doc,
  onSnapshot,
  query,
  limit,
  deleteDoc
} from "firebase/firestore";
import { db } from "../firebase";
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

export async function seedDatabase() {
  console.log("Starting database seed...");
  await seedIfEmpty("unitTypes", DEFAULT_UNIT_TYPES);
  await seedIfEmpty("terrainTypes", DEFAULT_TERRAIN_TYPES);
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
  await setDoc(doc(db, collectionName, data.id), data);
}

export async function deleteFromFirestore(collectionName: string, id: string) {
  await deleteDoc(doc(db, collectionName, id));
}

// Game State specific functions
export async function saveGameState(gameId: string, gameState: any) {
  await setDoc(doc(db, "games", gameId), {
    ...gameState,
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
