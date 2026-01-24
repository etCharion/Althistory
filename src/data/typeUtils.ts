import { DEFAULT_UNIT_TYPES, DEFAULT_TERRAIN_TYPES } from './defaults';
export function getAllUnitTypes() { const s = localStorage.getItem('customUnitTypes'); return s ? JSON.parse(s) : DEFAULT_UNIT_TYPES; }
export function getAllTerrainTypes() { const s = localStorage.getItem('customTerrainTypes'); return s ? JSON.parse(s) : DEFAULT_TERRAIN_TYPES; }
