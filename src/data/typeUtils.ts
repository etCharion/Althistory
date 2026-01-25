import { DEFAULT_UNIT_TYPES, DEFAULT_TERRAIN_TYPES, DEFAULT_OVERLAY_TYPES, DEFAULT_COUNTRIES } from './defaults';
import { DEFAULT_SCENARIO } from './defaultScenario';

export function getAllUnitTypes() { const s = localStorage.getItem('customUnitTypes'); return s ? JSON.parse(s) : DEFAULT_UNIT_TYPES; }
export function getAllTerrainTypes() { const s = localStorage.getItem('customTerrainTypes'); return s ? JSON.parse(s) : DEFAULT_TERRAIN_TYPES; }
export function getAllOverlayTypes() { return DEFAULT_OVERLAY_TYPES; }
export function getAllCountries() { const s = localStorage.getItem('customCountries'); return s ? JSON.parse(s) : DEFAULT_COUNTRIES; }
export function getAllCampaigns() { const s = localStorage.getItem('customCampaigns'); return s ? JSON.parse(s) : []; }
export function getAllScenarios() {
  const s = localStorage.getItem('scenarios');
  return s ? JSON.parse(s) : [DEFAULT_SCENARIO];
}
