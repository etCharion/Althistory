import { DEFAULT_UNIT_TYPES, DEFAULT_TERRAIN_TYPES, DEFAULT_OVERLAY_TYPES, DEFAULT_COUNTRIES } from './defaults';
import { DEFAULT_SCENARIO } from './defaultScenario';

function mergeWithDefaults(storageKey, defaults) {
  const s = localStorage.getItem(storageKey);
  if (!s) return defaults;
  const custom = JSON.parse(s);
  const merged = [...custom];
  defaults.forEach(d => {
    if (!merged.find(m => m.id === d.id)) merged.push(d);
  });
  return merged;
}

export function getAllUnitTypes() { return mergeWithDefaults('customUnitTypes', DEFAULT_UNIT_TYPES); }
export function getAllTerrainTypes() { return mergeWithDefaults('customTerrainTypes', DEFAULT_TERRAIN_TYPES); }
export function getAllOverlayTypes() { return mergeWithDefaults('customOverlayTypes', DEFAULT_OVERLAY_TYPES); }
export function getAllCountries() { const s = localStorage.getItem('customCountries'); return s ? JSON.parse(s) : DEFAULT_COUNTRIES; }
export function getAllCampaigns() { const s = localStorage.getItem('customCampaigns'); return s ? JSON.parse(s) : []; }
export function getAllScenarios() {
  const s = localStorage.getItem('scenarios');
  return s ? JSON.parse(s) : [DEFAULT_SCENARIO];
}
