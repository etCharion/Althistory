import {
  getFirestoreData,
  saveToFirestore,
  deleteFromFirestore,
  seedDatabase
} from '../logic/firebaseService';

// We call seedDatabase once when the module is loaded or on first fetch
let seedingPromise: Promise<void> | null = null;
async function ensureSeeded() {
  if (seedingPromise) return seedingPromise;

  seedingPromise = seedDatabase();
  return seedingPromise;
}

export async function getAllUnitTypes() {
  await ensureSeeded();
  return getFirestoreData('unitTypes');
}

export async function getAllTerrainTypes() {
  await ensureSeeded();
  return getFirestoreData('terrainTypes');
}

export async function getAllOverlayTypes() {
  await ensureSeeded();
  return getFirestoreData('overlayTypes');
}

export async function getAllCountries() {
  await ensureSeeded();
  return getFirestoreData('countries');
}

export async function getAllCampaigns() {
  await ensureSeeded();
  return getFirestoreData('campaigns');
}

export async function getAllScenarios() {
  await ensureSeeded();
  return getFirestoreData('scenarios');
}

// Helper functions for saving (used in Customization/Editor)
export async function saveUnitType(data: any) { await saveToFirestore('unitTypes', data); }
export async function deleteUnitType(id: string) { await deleteFromFirestore('unitTypes', id); }

export async function saveTerrainType(data: any) { await saveToFirestore('terrainTypes', data); }
export async function deleteTerrainType(id: string) { await deleteFromFirestore('terrainTypes', id); }

export async function saveOverlayType(data: any) { await saveToFirestore('overlayTypes', data); }
export async function deleteOverlayType(id: string) { await deleteFromFirestore('overlayTypes', id); }

export async function saveCountry(data: any) { await saveToFirestore('countries', data); }
export async function deleteCountry(id: string) { await deleteFromFirestore('countries', id); }

export async function saveCampaign(data: any) { await saveToFirestore('campaigns', data); }
export async function deleteCampaign(id: string) { await deleteFromFirestore('campaigns', id); }

export async function saveScenario(data: any) { await saveToFirestore('scenarios', data); }
export async function deleteScenario(id: string) { await deleteFromFirestore('scenarios', id); }

// Returns the list of country ids associated with a scenario, supporting both
// the legacy single `countryId` field and the new `countryIds` array.
export function getScenarioCountryIds(s: any): string[] {
  if (Array.isArray(s?.countryIds) && s.countryIds.length > 0) return s.countryIds;
  return s?.countryId ? [s.countryId] : [];
}

// Resolves a scenario's country ids to a comma-separated list of names.
export function getScenarioCountryNames(s: any, countries: any[]): string {
  return getScenarioCountryIds(s)
    .map(id => countries.find(c => c.id === id)?.name || id)
    .filter(Boolean)
    .join(', ');
}
