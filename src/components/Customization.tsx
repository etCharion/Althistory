import React, { useState, useEffect, useRef } from 'react';
import NatoSymbol from './NatoSymbol';
import { getAllUnitTypes, getAllTerrainTypes, getAllCountries, getAllCampaigns, getAllScenarios, getAllOverlayTypes, saveUnitType, deleteUnitType, saveTerrainType, deleteTerrainType, saveOverlayType, deleteOverlayType, saveCountry, deleteCountry, saveCampaign, deleteCampaign, deleteScenario, getScenarioCountryNames } from '../data/typeUtils';

// --- Design tokens (field / new look). Mirror hodnot z designového handoffu. ---
const C = {
  paper: '#efe4c9', card: '#fffdf7', card2: '#faf4e6',
  ally: '#1c3f6b', allySoft: '#2f6db0', axis: '#7c2018', army: '#2c7d42', ink: '#16202e',
  tanBorder: '#e0d4af', tanBorderSoft: '#d3c39c', tanText: '#6b6450', tanDeep: '#8a7a52', tanLine: '#d8cba6', amber: '#b06a1e'
};

type Opt = readonly [string, string];
const CATS: readonly Opt[] = [['infantry', 'Pěchota'], ['tank', 'Tank'], ['artillery', 'Dělostřelectvo']];
const MOVE: readonly Opt[] = [['none', 'Žádné'], ['stop', 'Zastavit'], ['no-move', 'Neprůchodné']];
const MS: readonly Opt[] = [['outline', 'Obrys'], ['x', 'Křížky'], ['sandbags', 'Pytle (hnědé)'], ['bunker', 'Pytle (šedé)'], ['wire', 'Drát']];
const SIDE: readonly Opt[] = [['', 'Žádnou'], ['player1', 'Spojenci'], ['player2', 'Osa']];

// Kompletní katalog NATO symbolů (zachováno beze změny – všech 26 typů).
const NATO_SYMBOLS = [
  { id: 'infantry', name: 'Pěchota' },
  { id: 'tank', name: 'Tank' },
  { id: 'artillery', name: 'Dělostřelectvo' },
  { id: 'sof', name: 'SOF (Speciální síly)' },
  { id: 'engineers', name: 'Ženisté' },
  { id: 'mortar', name: 'Minomet' },
  { id: 'hmg', name: 'Těžký kulomet' },
  { id: 'anti-tank', name: 'Protitanková jednotka' },
  { id: 'sniper', name: 'Odstřelovač' },
  { id: 'tank-destroyer', name: 'Stíhač tanků' },
  { id: 'elite-tank', name: 'Elitní tank' },
  { id: 'flame-tank', name: 'Plamenometný tank' },
  { id: 'mobile-artillery', name: 'Mobilní dělostřelectvo' },
  { id: 'rocket-artillery', name: 'Raketové dělostřelectvo' },
  { id: 'long-range-artillery', name: 'Dalekonosné dělostřelectvo' },
  { id: 'anti-aircraft', name: 'Protiletadlové dělo' },
  { id: 'partisans', name: 'Partyzáni' },
  { id: 'half-track', name: 'Polopás' },
  { id: 'mobile-infantry', name: 'Mobilní pěchota' },
  { id: 'command-vehicle', name: 'Řídicí vůz' },
  { id: 'supply', name: 'Zásobování' },
  { id: 'ambulance', name: 'Sanitka' },
  { id: 'cavalry', name: 'Kavalérie' },
  { id: 'mountain', name: 'Horské jednotky' },
  { id: 'landing', name: 'Vyloďovací jednotky' },
  { id: 'paratroopers', name: 'Parašutisté' }
];

// ---------------------------------------------------------------------------
// Znovupoužitelné ovládací prvky (pixel-přesně dle handoffu, inline styly)
// ---------------------------------------------------------------------------
const Lbl: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label style={{ display: 'block', font: '700 10px/1.3 Barlow,sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', color: C.tanText, marginBottom: 5 }}>{children}</label>
);

const Field: React.FC<{ label: string; style?: React.CSSProperties; children: React.ReactNode }> = ({ label, style, children }) => (
  <div style={style}><Lbl>{label}</Lbl>{children}</div>
);

const NatoPreview: React.FC<{ type: string; size: number }> = ({ type, size }) => (
  <svg viewBox="-20 -15 40 30" width={size} height={size * 0.72} style={{ display: 'block' }}>
    <NatoSymbol type={type} owner="player1" />
  </svg>
);

const Stepper: React.FC<{ value: number; onChange: (v: number) => void; min?: number; max?: number; w?: number; sign?: boolean }> = ({ value, onChange, min = -9, max = 9, w = 40, sign }) => {
  const disp = sign && value > 0 ? '+' + value : String(value);
  const btn = (txt: string, d: number) => (
    <button type="button" onClick={() => onChange(Math.max(min, Math.min(max, value + d)))} style={{ width: 26, height: 30, border: 'none', background: 'transparent', color: C.ally, fontSize: 16, fontWeight: 700, cursor: 'pointer', lineHeight: 1 }}>{txt}</button>
  );
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', border: `1.5px solid ${C.tanBorder}`, borderRadius: 8, background: '#fff', overflow: 'hidden' }}>
      {btn('−', -1)}
      <span style={{ minWidth: w, textAlign: 'center', fontWeight: 700, fontSize: 14, fontVariantNumeric: 'tabular-nums', color: value > 0 ? C.army : (value < 0 ? C.axis : C.ink), borderLeft: `1px solid ${C.tanLine}`, borderRight: `1px solid ${C.tanLine}`, padding: '0 2px', lineHeight: '30px' }}>{disp}</span>
      {btn('+', 1)}
    </div>
  );
};

const Toggle: React.FC<{ on: boolean; set: (v: boolean) => void }> = ({ on, set }) => (
  <button type="button" onClick={() => set(!on)} aria-pressed={on} style={{ position: 'relative', width: 38, height: 22, borderRadius: 999, border: 'none', cursor: 'pointer', background: on ? C.army : '#cdc7bb', transition: 'background .15s', flex: 'none' }}>
    <span style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 18, height: 18, borderRadius: 999, background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.3)', transition: 'left .15s' }} />
  </button>
);

const ToggleField: React.FC<{ label: string; on: boolean; set: (v: boolean) => void }> = ({ label, on, set }) => (
  <label onClick={() => set(!on)} style={{ display: 'inline-flex', alignItems: 'center', gap: 9, cursor: 'pointer', padding: '6px 10px 6px 6px', border: `1.5px solid ${on ? C.army : C.tanBorder}`, background: on ? 'rgba(44,125,66,.08)' : '#fff', borderRadius: 9 }}>
    <Toggle on={on} set={set} />
    <span style={{ font: '700 11px/1.2 Barlow,sans-serif', letterSpacing: '.03em', textTransform: 'uppercase', color: C.ink }}>{label}</span>
  </label>
);

const Segmented: React.FC<{ value: string; options: readonly Opt[]; set: (v: string) => void }> = ({ value, options, set }) => (
  <div style={{ display: 'inline-flex', gap: 4, padding: 4, background: '#f1e9d4', border: `1.5px solid ${C.tanBorder}`, borderRadius: 10, flexWrap: 'wrap' }}>
    {options.map(([v, label]) => {
      const a = value === v;
      return (
        <button key={String(v)} type="button" onClick={() => set(v)} style={{ border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: 7, font: '700 11px/1 Barlow,sans-serif', letterSpacing: '.03em', textTransform: 'uppercase', color: a ? '#fff' : C.tanText, background: a ? C.ally : 'transparent', boxShadow: a ? '0 1px 3px rgba(0,0,0,.2)' : 'none', transition: '.12s', whiteSpace: 'nowrap' }}>{label}</button>
      );
    })}
  </div>
);

const Chips: React.FC<{ selected: string[]; set: (v: string[]) => void }> = ({ selected, set }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
    {CATS.map(([v, label]) => {
      const a = selected.includes(v);
      return (
        <button key={v} type="button" onClick={() => set(a ? selected.filter(x => x !== v) : [...selected, v])} style={{ cursor: 'pointer', padding: '6px 12px', borderRadius: 999, font: '700 11px/1 Barlow,sans-serif', letterSpacing: '.03em', textTransform: 'uppercase', border: `1.5px solid ${a ? C.axis : C.tanBorder}`, background: a ? C.axis : '#fff', color: a ? '#fff' : C.tanText, transition: '.12s' }}>{label}</button>
      );
    })}
  </div>
);

const ColorInput: React.FC<{ color: string; set: (v: string) => void }> = ({ color, set }) => (
  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
    <input type="color" value={color || '#cccccc'} onChange={e => set(e.target.value)} style={{ width: 38, height: 32, padding: 2, border: `1.5px solid ${C.tanBorder}`, borderRadius: 8, background: '#fff', cursor: 'pointer' }} />
    <input value={color || ''} onChange={e => set(e.target.value)} style={{ width: 96, border: `1.5px solid ${C.tanBorder}`, borderRadius: 8, padding: '7px 9px', font: '600 12px/1 monospace', color: C.ink, outline: 'none', background: '#fff' }} />
  </div>
);

const TextInput: React.FC<{ value: string; set: (v: string) => void; big?: boolean }> = ({ value, set, big }) => (
  <input value={value} onChange={e => set(e.target.value)} style={{ width: '100%', border: `1.5px solid ${C.tanBorder}`, borderRadius: 9, padding: big ? '9px 12px' : '8px 11px', font: big ? '700 17px/1.2 "Barlow Condensed",sans-serif' : '600 13px/1.3 Barlow,sans-serif', letterSpacing: big ? '.02em' : '0', textTransform: big ? 'uppercase' : 'none', color: C.ink, outline: 'none', background: '#fff' }} />
);

const TextArea: React.FC<{ value: string; set: (v: string) => void }> = ({ value, set }) => (
  <textarea value={value} onChange={e => set(e.target.value)} rows={2} style={{ width: '100%', border: `1.5px solid ${C.tanBorder}`, borderRadius: 9, padding: '9px 11px', font: '500 13px/1.4 Barlow,sans-serif', color: C.ink, outline: 'none', resize: 'vertical', background: '#fff' }} />
);

const SectionHead: React.FC<{ title: string; accent: string; right?: React.ReactNode }> = ({ title, accent, right }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 13 }}>
    <span style={{ width: 5, height: 16, borderRadius: 3, background: accent, flex: 'none' }} />
    <h4 style={{ margin: 0, font: '700 12.5px/1 "Barlow Condensed",sans-serif', letterSpacing: '.09em', textTransform: 'uppercase', color: C.ally, whiteSpace: 'nowrap' }}>{title}</h4>
    <span style={{ flex: 1, height: 1, background: C.tanLine }} />
    {right || null}
  </div>
);

const DiceMatrix: React.FC<{ rows: [string, string | null, string | null][]; item: any; up: (patch: any) => void }> = ({ rows, item, up }) => {
  const hcell = (t: string, c: string) => (
    <div style={{ font: '700 10px/1.2 Barlow,sans-serif', letterSpacing: '.05em', textTransform: 'uppercase', color: c, textAlign: 'center', paddingBottom: 2 }}>{t}</div>
  );
  return (
    <div style={{ background: '#fff', border: `1.5px solid ${C.tanBorder}`, borderRadius: 11, padding: '12px 14px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 8, alignItems: 'end', paddingBottom: 6, borderBottom: `1px solid ${C.tanLine}`, marginBottom: 8 }}>
        <div />{hcell('Obrana', C.army)}{hcell('Útok', C.axis)}
      </div>
      {rows.map(([label, dk, ak]) => (
        <div key={label} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 8, alignItems: 'center', padding: '4px 0' }}>
          <span style={{ font: '600 12.5px/1.2 Barlow,sans-serif', color: C.ink }}>{label}</span>
          {dk
            ? <div style={{ display: 'flex', justifyContent: 'center' }}><Stepper value={item[dk] || 0} onChange={v => up({ [dk]: v })} sign /></div>
            : <div style={{ textAlign: 'center', color: C.tanBorderSoft, fontSize: 13 }}>—</div>}
          {ak
            ? <div style={{ display: 'flex', justifyContent: 'center' }}><Stepper value={item[ak] || 0} onChange={v => up({ [ak]: v })} sign /></div>
            : <div style={{ textAlign: 'center', color: C.tanBorderSoft, fontSize: 13 }}>—</div>}
        </div>
      ))}
    </div>
  );
};

// Skloňování počtu (1 / 2–4 / 5+)
const plural = (n: number, forms: [string, string, string]) => (n === 1 ? forms[0] : (n >= 2 && n <= 4 ? forms[1] : forms[2]));

const ENTITY_WORDS: Record<string, [string, string, string]> = {
  terrains: ['typ terénu', 'typy terénu', 'typů terénu'],
  overlays: ['překážka', 'překážky', 'překážek'],
  units: ['jednotka', 'jednotky', 'jednotek'],
  countries: ['země', 'země', 'zemí'],
  campaigns: ['kampaň', 'kampaně', 'kampaní'],
  scenarios: ['scénář', 'scénáře', 'scénářů'],
};

const TABS: Opt[] = [
  ['scenarios', 'Scénáře'], ['units', 'Jednotky'], ['terrains', 'Terén'],
  ['overlays', 'Překážky'], ['countries', 'Země'], ['campaigns', 'Kampaně'],
];

const Customization = ({ onBack, onEditScenario }) => {
  const [units, setUnits] = useState<any[]>([]);
  const [terrains, setTerrains] = useState<any[]>([]);
  const [overlays, setOverlays] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [scenarios, setScenarios] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('scenarios');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [symbolPickerId, setSymbolPickerId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const [u, t, o, c, cp, s] = await Promise.all([
        getAllUnitTypes(), getAllTerrainTypes(), getAllOverlayTypes(),
        getAllCountries(), getAllCampaigns(), getAllScenarios()
      ]);
      setUnits(u); setTerrains(t); setOverlays(o); setCountries(c); setCampaigns(cp); setScenarios(s);
    };
    load();
  }, []);

  // Debounced persistence: React state se aktualizuje synchronně (aby si
  // controlled inputy udržely pozici kurzoru), zápis do Firestore je debounced
  // per položka, aby se nezapisovalo na každý stisk klávesy.
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const debouncedSave = (key: string, save: () => Promise<void>) => {
    if (saveTimers.current[key]) clearTimeout(saveTimers.current[key]);
    saveTimers.current[key] = setTimeout(() => { save(); }, 500);
  };
  useEffect(() => () => { Object.values(saveTimers.current).forEach(clearTimeout); }, []);

  const updateUnit = (item: any) => { setUnits(prev => prev.map(u => u.id === item.id ? item : u)); debouncedSave(`unit-${item.id}`, () => saveUnitType(item)); };
  const updateTerrain = (item: any) => { setTerrains(prev => prev.map(t => t.id === item.id ? item : t)); debouncedSave(`terrain-${item.id}`, () => saveTerrainType(item)); };
  const updateOverlay = (item: any) => { setOverlays(prev => prev.map(o => o.id === item.id ? item : o)); debouncedSave(`overlay-${item.id}`, () => saveOverlayType(item)); };
  const updateCountry = (item: any) => { setCountries(prev => prev.map(c => c.id === item.id ? item : c)); debouncedSave(`country-${item.id}`, () => saveCountry(item)); };
  const updateCampaign = (item: any) => { setCampaigns(prev => prev.map(cp => cp.id === item.id ? item : cp)); debouncedSave(`campaign-${item.id}`, () => saveCampaign(item)); };

  const addUnit = async () => {
    const newUnit = { id: `unit-${Date.now()}`, name: 'Nová jednotka', movement: 2, shootingRange: [3, 2, 1], canShootAfterMovingMax: 1, maxFigures: 4, natoSymbol: 'infantry', category: 'infantry', description: '' };
    await saveUnitType(newUnit);
    setUnits(prev => [...prev, newUnit]);
    setExpandedId(newUnit.id);
  };

  const addTerrain = async () => {
    const newTerrain = { id: `terrain-${Date.now()}`, name: 'Nový terén', color: '#cccccc', blocksLOS: false, highGround: false, movementRestriction: 'none', allowAttackAfterStop: false, roadMovementBonus: 0, movementCap: 0, cannotAttackFrom: false, diceModifierDefenseInfantry: 0, diceModifierDefenseTank: 0, diceModifierAttackInfantry: 0, diceModifierAttackTank: 0, diceModifierAttackArtillery: 0, ignoreFlags: 0, impassableForCategories: [], noRetreatCategories: [], cannotLeaveCategories: [], noRetreatInto: false, impassableForPlayer: undefined, entryFromAdjacentOnly: false, exitToAdjacentOnly: false, description: '' };
    await saveTerrainType(newTerrain);
    setTerrains(prev => [...prev, newTerrain]);
    setExpandedId(newTerrain.id);
  };

  const addOverlay = async () => {
    const newOverlay = { id: `overlay-${Date.now()}`, name: 'Nová překážka', color: '#cccccc', mapStyle: 'outline', blocksLOS: false, movementRestriction: 'none', allowAttackAfterStop: false, roadMovementBonus: 0, movementCap: 0, cannotAttackFrom: false, diceModifierDefense: 0, diceModifierDefenseInfantry: 0, diceModifierDefenseTank: 0, diceModifierDefenseArtillery: 0, diceModifierAttackInfantry: 0, diceModifierAttackTank: 0, diceModifierAttackArtillery: 0, ignoreFlags: 0, onlyBonusForOwner: false, impassableForCategories: [], noRetreatCategories: [], cannotLeaveCategories: [], noRetreatInto: false, impassableForPlayer: undefined, entryFromAdjacentOnly: false, exitToAdjacentOnly: false, description: '' };
    await saveOverlayType(newOverlay);
    setOverlays(prev => [...prev, newOverlay]);
    setExpandedId(newOverlay.id);
  };

  const addCountry = async () => {
    const newCountry = { id: `country-${Date.now()}`, name: 'Nová země' };
    await saveCountry(newCountry);
    setCountries(prev => [...prev, newCountry]);
  };

  const addCampaign = async () => {
    const newCampaign = { id: `campaign-${Date.now()}`, name: 'Nová kampaň' };
    await saveCampaign(newCampaign);
    setCampaigns(prev => [...prev, newCampaign]);
  };

  const deleteItem = async (type: string, setter: any, list: any[], id: string) => {
    if (type === 'scenarios' && id === 'default-1') {
      alert('Výchozí scénář nelze smazat.');
      return;
    }
    if (!confirm('Opravdu smazat?')) return;

    if (type === 'units') await deleteUnitType(id);
    else if (type === 'terrains') await deleteTerrainType(id);
    else if (type === 'overlays') await deleteOverlayType(id);
    else if (type === 'countries') await deleteCountry(id);
    else if (type === 'campaigns') await deleteCampaign(id);
    else if (type === 'scenarios') await deleteScenario(id);

    setter(list.filter(item => item.id !== id));
  };

  const switchTab = (tab: string) => { setActiveTab(tab); setExpandedId(null); };
  const toggleExpand = (id: string) => setExpandedId(prev => (prev === id ? null : id));

  // -------------------------------------------------------------------------
  // Sekce polí uvnitř otevřené accordion položky
  // -------------------------------------------------------------------------
  const renderSectionVzhled = (entity: string, item: any, up: (p: any) => void) => (
    <div style={{ display: 'grid', gap: 14 }}>
      <Field label={'Název ' + (entity === 'overlays' ? 'překážky' : 'terénu')}>
        <TextInput value={item.name} set={v => up({ name: v })} big />
      </Field>
      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Field label="Barva na mapě"><ColorInput color={item.color} set={v => up({ color: v })} /></Field>
        {entity === 'overlays' && (
          <Field label="Vzhled na mapě"><Segmented value={item.mapStyle || 'outline'} options={MS} set={v => up({ mapStyle: v })} /></Field>
        )}
        <div>
          <Lbl>Viditelnost</Lbl>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <ToggleField label="Blokuje výhled" on={!!item.blocksLOS} set={v => up({ blocksLOS: v })} />
            {entity === 'terrains' && (
              <ToggleField label="Vyvýšenina (hřeben)" on={item.highGround ?? item.id === 'hill'} set={v => up({ highGround: v })} />
            )}
          </div>
        </div>
      </div>
      {entity === 'terrains' && (
        <p style={{ margin: 0, font: '500 11px/1.4 Barlow,sans-serif', color: C.tanText }}>Vyvýšenina: jednotky na témže souvislém hřebenu tohoto terénu na sebe vidí a neuplatňují obranný postih (kopce, hory).</p>
      )}
    </div>
  );

  const renderSectionSouboj = (entity: string, item: any, up: (p: any) => void) => {
    const rows: [string, string | null, string | null][] = entity === 'overlays'
      ? [['Vše', 'diceModifierDefense', null], ['Pěchota', 'diceModifierDefenseInfantry', 'diceModifierAttackInfantry'], ['Tank', 'diceModifierDefenseTank', 'diceModifierAttackTank'], ['Dělostřelectvo', 'diceModifierDefenseArtillery', 'diceModifierAttackArtillery']]
      : [['Pěchota', 'diceModifierDefenseInfantry', 'diceModifierAttackInfantry'], ['Tank', 'diceModifierDefenseTank', 'diceModifierAttackTank'], ['Dělostřelectvo', null, 'diceModifierAttackArtillery']];
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <DiceMatrix rows={rows} item={item} up={up} />
        <p style={{ margin: 0, font: '500 11px/1.4 Barlow,sans-serif', color: C.tanText }}>Kladné číslo = bonus (kostky navíc), záporné = postih. Nula = beze změny.</p>
        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Field label="Ignoruje vlajky ústupu"><Stepper value={item.ignoreFlags || 0} onChange={v => up({ ignoreFlags: v })} min={0} /></Field>
          {entity === 'overlays' && (
            <div>
              <Lbl>Rozsah bonusu</Lbl>
              <ToggleField label="Jen pro majitele" on={!!item.onlyBonusForOwner} set={v => up({ onlyBonusForOwner: v })} />
            </div>
          )}
          <div>
            <Lbl>Zákaz útoku</Lbl>
            <ToggleField label="Z pole nelze útočit" on={!!item.cannotAttackFrom} set={v => up({ cannotAttackFrom: v })} />
          </div>
        </div>
      </div>
    );
  };

  const renderSectionPohyb = (entity: string, item: any, up: (p: any) => void) => (
    <div style={{ display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Field label="Omezení pohybu"><Segmented value={item.movementRestriction || 'none'} options={MOVE} set={v => up({ movementRestriction: v })} /></Field>
        {item.movementRestriction === 'stop' && (
          <div>
            <Lbl>Po zastavení</Lbl>
            <ToggleField label="Lze útočit" on={!!item.allowAttackAfterStop} set={v => up({ allowAttackAfterStop: v })} />
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Field label="Bonus pohybu po cestě"><Stepper value={item.roadMovementBonus || 0} onChange={v => up({ roadMovementBonus: v })} min={0} max={3} sign /></Field>
        <Field label="Strop pohybu přes pole (0 = bez limitu)"><Stepper value={item.movementCap || 0} onChange={v => up({ movementCap: v })} min={0} max={9} /></Field>
      </div>
      <p style={{ margin: 0, font: '500 11px/1.4 Barlow,sans-serif', color: C.tanText }}>Bonus po cestě: jednotka, která na tomto typu pole začne, jede jen po něm a skončí na něm, má pohyb +N (síť cest). Strop pohybu: jakmile trasa vede přes toto pole, ujde jednotka celkem nejvýše N polí (např. pláž: 2).</p>
      <Field label="Neprůchodné pro jednotky"><Chips selected={item.impassableForCategories || []} set={v => up({ impassableForCategories: v })} /></Field>
      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Field label="Neprůchodné pro stranu"><Segmented value={item.impassableForPlayer || ''} options={SIDE} set={v => up({ impassableForPlayer: v || undefined })} /></Field>
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <ToggleField label="Vstup jen z vedlejšího pole" on={!!item.entryFromAdjacentOnly} set={v => up({ entryFromAdjacentOnly: v })} />
        <ToggleField label="Výstup jen na vedlejší pole" on={!!item.exitToAdjacentOnly} set={v => up({ exitToAdjacentOnly: v })} />
      </div>
    </div>
  );

  const renderSectionUstup = (item: any, up: (p: any) => void) => (
    <div style={{ display: 'grid', gap: 14 }}>
      <Field label="Zákaz ústupu z pole pro"><Chips selected={item.noRetreatCategories || []} set={v => up({ noRetreatCategories: v })} /></Field>
      <Field label="Zákaz vyjití (uvěznění) pro"><Chips selected={item.cannotLeaveCategories || []} set={v => up({ cannotLeaveCategories: v })} /></Field>
      <div>
        <Lbl>Cíl ústupu</Lbl>
        <ToggleField label="Nelze sem ustoupit" on={!!item.noRetreatInto} set={v => up({ noRetreatInto: v })} />
      </div>
      <p style={{ margin: 0, font: '500 11px/1.4 Barlow,sans-serif', color: C.tanText }}>Zákaz ústupu z pole: vlajky se místo ústupu mění ve ztráty. Nelze sem ustoupit: pole nesmí být cílem ústupu, i když je jinak průchozí (např. moře).</p>
    </div>
  );

  const renderUnitIdent = (item: any, up: (p: any) => void) => (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <Lbl>Symbol NATO</Lbl>
          <button type="button" onClick={() => setSymbolPickerId(item.id)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '8px 14px', border: `1.5px solid ${C.tanBorder}`, borderRadius: 10, background: '#fff', cursor: 'pointer' }}>
            <NatoPreview type={item.natoSymbol} size={52} />
            <span style={{ font: '700 8.5px/1 Barlow,sans-serif', letterSpacing: '.05em', textTransform: 'uppercase', color: C.allySoft }}>Změnit</span>
          </button>
        </div>
        <Field label="Název jednotky" style={{ flex: '1 1 180px' }}><TextInput value={item.name} set={v => up({ name: v })} big /></Field>
      </div>
      <Field label="Typ pro pravidla"><Segmented value={item.category || 'infantry'} options={CATS} set={v => up({ category: v })} /></Field>
    </div>
  );

  const renderUnitMove = (item: any, up: (p: any) => void) => (
    <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap' }}>
      <Field label="Pohyb (pole)"><Stepper value={item.movement || 0} onChange={v => up({ movement: v })} min={0} /></Field>
      <Field label="Max. figurek"><Stepper value={item.maxFigures || 0} onChange={v => up({ maxFigures: v })} min={1} /></Field>
      <Field label="Max. pohyb pro střelbu"><Stepper value={item.canShootAfterMovingMax || 0} onChange={v => up({ canShootAfterMovingMax: v })} min={0} /></Field>
    </div>
  );

  const renderUnitShoot = (item: any, up: (p: any) => void) => {
    const rng: number[] = item.shootingRange || [];
    const setAt = (i: number, v: number) => { const n = rng.slice(); n[i] = Math.max(0, v); up({ shootingRange: n }); };
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <p style={{ margin: 0, font: '500 11px/1.4 Barlow,sans-serif', color: C.tanText }}>Počet kostek podle vzdálenosti cíle (v polích).</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {rng.map((v, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span style={{ font: '700 10px/1 Barlow,sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', color: C.tanText }}>{(i + 1) + '. pole'}</span>
              <Stepper value={v} onChange={nv => setAt(i, nv)} min={0} w={30} />
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" onClick={() => up({ shootingRange: [...rng, 1] })} style={{ border: `1.5px solid ${C.army}`, color: C.army, background: '#fff', borderRadius: 8, width: 34, height: 34, fontSize: 18, cursor: 'pointer' }}>+</button>
            {rng.length > 1 && (
              <button type="button" onClick={() => up({ shootingRange: rng.slice(0, -1) })} style={{ border: `1.5px solid ${C.axis}`, color: C.axis, background: '#fff', borderRadius: 8, width: 34, height: 34, fontSize: 18, cursor: 'pointer' }}>−</button>
            )}
          </div>
        </div>
        <Field label="Popis" style={{ marginTop: 4 }}><TextArea value={item.description || ''} set={v => up({ description: v })} /></Field>
      </div>
    );
  };

  const sectionsFor = (entity: string, item: any, up: (p: any) => void) => {
    if (entity === 'units') {
      return [
        { key: 'ident', title: 'Identita', accent: C.ally, node: renderUnitIdent(item, up) },
        { key: 'move', title: 'Pohyb', accent: C.army, node: renderUnitMove(item, up) },
        { key: 'shoot', title: 'Střelba', accent: C.axis, node: renderUnitShoot(item, up) },
      ];
    }
    const s = [
      { key: 'vzhled', title: 'Vzhled', accent: C.ally, node: renderSectionVzhled(entity, item, up) },
      { key: 'souboj', title: 'Souboj — modifikátory kostek', accent: C.axis, node: renderSectionSouboj(entity, item, up) },
      { key: 'pohyb', title: 'Pohyb a průchodnost', accent: C.army, node: renderSectionPohyb(entity, item, up) },
      { key: 'ustup', title: 'Omezení ústupu', accent: C.amber, node: renderSectionUstup(item, up) },
    ];
    s.push({ key: 'popis', title: 'Popis', accent: C.tanDeep, node: <TextArea value={item.description || ''} set={v => up({ description: v })} /> });
    return s;
  };

  // Souhrnné štítky u sbalené položky
  const summaryChips = (entity: string, item: any): { txt: string; col: string }[] => {
    const out: { txt: string; col: string }[] = [];
    if (entity === 'units') {
      out.push({ txt: CATS.find(c => c[0] === item.category)?.[1] || '—', col: C.ally });
      out.push({ txt: 'Pohyb ' + item.movement, col: C.army });
      out.push({ txt: (item.shootingRange || []).join('·'), col: C.axis });
      return out;
    }
    const def = entity === 'overlays' ? (item.diceModifierDefense || 0) : Math.max(item.diceModifierDefenseInfantry || 0, item.diceModifierDefenseTank || 0);
    if (def) out.push({ txt: 'Obrana +' + def, col: C.army });
    if (item.movementRestriction && item.movementRestriction !== 'none') out.push({ txt: MOVE.find(m => m[0] === item.movementRestriction)![1], col: C.amber });
    if (item.roadMovementBonus > 0) out.push({ txt: 'Cesta +' + item.roadMovementBonus, col: C.army });
    if (item.movementCap > 0) out.push({ txt: 'Pohyb max ' + item.movementCap, col: C.amber });
    if (item.blocksLOS) out.push({ txt: 'Blokuje výhled', col: C.ally });
    if ((item.impassableForCategories || []).length) out.push({ txt: 'Neprůchodné', col: C.axis });
    if (item.cannotAttackFrom) out.push({ txt: 'Bez útoku', col: C.axis });
    if ((item.noRetreatCategories || []).length) out.push({ txt: 'Bez ústupu', col: C.amber });
    if (!out.length) out.push({ txt: 'Bez efektů', col: C.tanDeep });
    return out;
  };

  const swatch = (entity: string, item: any) => {
    if (entity === 'units') return <span style={{ flex: 'none' }}><NatoPreview type={item.natoSymbol} size={40} /></span>;
    return <span style={{ width: 30, height: 30, borderRadius: 8, background: item.color, border: '1.5px solid rgba(0,0,0,.15)', boxShadow: 'inset 0 1px 2px rgba(0,0,0,.2)', flex: 'none' }} />;
  };

  const entityLists: Record<string, [any[], any, (i: any) => void]> = {
    terrains: [terrains, setTerrains, updateTerrain],
    overlays: [overlays, setOverlays, updateOverlay],
    units: [units, setUnits, updateUnit],
  };

  const renderAccordion = (entity: string) => {
    const [items, , update] = entityLists[entity];
    return (
      <div style={{ display: 'grid', gap: 10 }}>
        {items.map(item => {
          const open = expandedId === item.id;
          const up = (patch: any) => update({ ...item, ...patch });
          return (
            <div key={item.id} style={{ border: `1.5px solid ${open ? C.ally : C.tanBorderSoft}`, borderRadius: 13, background: open ? C.card2 : '#fff', overflow: 'hidden', transition: '.15s' }}>
              <button type="button" onClick={() => toggleExpand(item.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 15px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                {swatch(entity, item)}
                <span style={{ font: '700 17px/1.1 "Barlow Condensed",sans-serif', letterSpacing: '.02em', textTransform: 'uppercase', color: C.ally, whiteSpace: 'nowrap' }}>{item.name}</span>
                <span style={{ flex: 1, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {open ? null : summaryChips(entity, item).map((c, i) => (
                    <span key={i} style={{ font: '600 9.5px/1 Barlow,sans-serif', letterSpacing: '.03em', textTransform: 'uppercase', color: c.col, border: `1px solid ${c.col}55`, borderRadius: 999, padding: '3px 8px', whiteSpace: 'nowrap' }}>{c.txt}</span>
                  ))}
                </span>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={C.tanDeep} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: '.15s', flex: 'none' }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {open && (
                <div style={{ padding: '2px 16px 16px', animation: 'fadeUp .25s ease' }}>
                  {sectionsFor(entity, item, up).map(s => (
                    <div key={s.key} style={{ marginTop: 16 }}>
                      <SectionHead title={s.title} accent={s.accent} />
                      {s.node}
                    </div>
                  ))}
                  <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${C.tanLine}`, display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => deleteItem(entity, entityLists[entity][1], items, item.id)} style={{ border: `1.5px solid ${C.axis}`, color: C.axis, background: '#fff', cursor: 'pointer', padding: '6px 12px', borderRadius: 8, font: '700 10px/1 Barlow,sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>Smazat typ</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Jednoduché seznamy (Země, Kampaně) – sladěné do nového vizuálu
  // -------------------------------------------------------------------------
  const renderNameList = (entity: 'countries' | 'campaigns') => {
    const [items, setter, update] = entity === 'countries'
      ? [countries, setCountries, updateCountry] as const
      : [campaigns, setCampaigns, updateCampaign] as const;
    return (
      <div style={{ display: 'grid', gap: 10 }}>
        {items.map(item => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, border: `1.5px solid ${C.tanBorderSoft}`, borderRadius: 11, background: '#fff', padding: '8px 12px' }}>
            <input value={item.name} onChange={e => update({ ...item, name: e.target.value })} style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', font: '700 15px/1.2 "Barlow Condensed",sans-serif', letterSpacing: '.02em', textTransform: 'uppercase', color: C.ally }} />
            <button type="button" onClick={() => deleteItem(entity, setter, items, item.id)} style={{ border: `1.5px solid ${C.axis}`, color: C.axis, background: '#fff', cursor: 'pointer', padding: '6px 12px', borderRadius: 8, font: '700 10px/1 Barlow,sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>Smazat</button>
          </div>
        ))}
        {items.length === 0 && <p style={{ margin: 0, font: '500 13px/1.4 Barlow,sans-serif', color: C.tanText, textAlign: 'center', padding: '8px 0' }}>Zatím nic. Přidejte novou položku tlačítkem výše.</p>}
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Scénáře – sladěná karta (zachovaná logika Upravit / Smazat)
  // -------------------------------------------------------------------------
  const renderScenarios = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 12 }}>
      {scenarios.map(s => (
        <div key={s.id} style={{ display: 'flex', flexDirection: 'column', border: `1.5px solid ${C.tanBorderSoft}`, borderRadius: 13, background: '#fff', padding: 14 }}>
          <h3 style={{ margin: '0 0 4px', font: '700 18px/1.1 "Barlow Condensed",sans-serif', letterSpacing: '.02em', textTransform: 'uppercase', color: C.ally }}>{s.name}</h3>
          <p style={{ margin: '0 0 10px', font: 'italic 500 12px/1.4 Barlow,sans-serif', color: C.tanText, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{s.description || 'Bez popisu.'}</p>
          <div style={{ display: 'grid', gap: 4, font: '600 12px/1.3 Barlow,sans-serif', color: C.ink }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span style={{ color: C.tanText }}>Rok:</span><span style={{ fontWeight: 700 }}>{s.year || '-'}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span style={{ color: C.tanText }}>Země:</span><span style={{ fontWeight: 700, textAlign: 'right' }}>{getScenarioCountryNames(s, countries) || '-'}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span style={{ color: C.tanText }}>Kampaň:</span><span style={{ fontWeight: 700 }}>{campaigns.find(c => c.id === s.campaignId)?.name || '-'}</span></div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${C.tanLine}` }}>
            <button type="button" onClick={() => onEditScenario(s)} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: C.army, color: '#fff', border: 'none', cursor: 'pointer', padding: '8px 12px', borderRadius: 8, font: '800 11px/1 "Barlow Condensed",sans-serif', letterSpacing: '.05em', textTransform: 'uppercase', boxShadow: '0 2px 6px rgba(44,125,66,.3)' }}>Upravit</button>
            {s.id !== 'default-1' && (
              <button type="button" onClick={() => deleteItem('scenarios', setScenarios, scenarios, s.id)} style={{ border: `1.5px solid ${C.axis}`, color: C.axis, background: '#fff', cursor: 'pointer', padding: '8px 12px', borderRadius: 8, font: '700 10px/1 Barlow,sans-serif', letterSpacing: '.04em', textTransform: 'uppercase' }}>Smazat</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  // Počet položek a případné tlačítko Přidat pro aktuální záložku
  const counts: Record<string, number> = { scenarios: scenarios.length, units: units.length, terrains: terrains.length, overlays: overlays.length, countries: countries.length, campaigns: campaigns.length };
  const addHandlers: Record<string, () => void> = { units: addUnit, terrains: addTerrain, overlays: addOverlay, countries: addCountry, campaigns: addCampaign };
  const n = counts[activeTab];

  return (
    <div className="custom-scrollbar" style={{ minHeight: '100vh', padding: '40px 24px 90px', display: 'flex', flexDirection: 'column', alignItems: 'center', overflowY: 'auto' }}>
      {/* Hlavička */}
      <div style={{ width: '100%', maxWidth: 760, margin: '0 auto 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, borderBottom: `2px solid ${C.ally}`, paddingBottom: 14 }}>
          <span style={{ display: 'inline-flex', width: 38, height: 38, alignItems: 'center', justifyContent: 'center', background: C.ally, color: '#fff', borderRadius: 9, flex: 'none' }}>
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>
          </span>
          <h1 style={{ margin: 0, flex: 1, font: '800 30px/1 "Barlow Condensed",sans-serif', letterSpacing: '.02em', textTransform: 'uppercase', color: C.ally }}>Administrace</h1>
          <button type="button" onClick={onBack} style={{ border: 'none', cursor: 'pointer', padding: '9px 18px', borderRadius: 9, font: '800 12.5px/1 "Barlow Condensed",sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', color: '#fff', background: C.ally, boxShadow: '0 2px 6px rgba(28,63,107,.3)', flex: 'none' }}>Zpět</button>
        </div>
      </div>

      {/* Panel */}
      <div className="custom-scrollbar" style={{ width: '100%', maxWidth: 760, background: C.card, border: `2px solid ${C.tanBorder}`, borderRadius: 16, padding: 22, boxShadow: '0 10px 30px rgba(60,45,20,.13)' }}>
        {/* Přepínač záložek */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {TABS.map(([k, label]) => {
            const active = activeTab === k;
            return (
              <button key={k} type="button" onClick={() => switchTab(k)} style={{ border: active ? 'none' : `1.5px solid ${C.ally}`, cursor: 'pointer', padding: '9px 16px', borderRadius: 9, font: '800 12.5px/1 "Barlow Condensed",sans-serif', letterSpacing: '.06em', textTransform: 'uppercase', color: active ? '#fff' : C.ally, background: active ? C.ally : 'rgba(255,255,255,.5)', boxShadow: active ? '0 2px 6px rgba(28,63,107,.3)' : 'none' }}>{label}</button>
            );
          })}
        </div>

        {/* Řádek s počtem + Přidat */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 12, borderBottom: `2px solid ${C.tanLine}` }}>
          <span style={{ font: '700 13px/1 Barlow,sans-serif', letterSpacing: '.04em', textTransform: 'uppercase', color: C.tanText }}>{n + ' ' + plural(n, ENTITY_WORDS[activeTab])}</span>
          {addHandlers[activeTab] && (
            <button type="button" onClick={addHandlers[activeTab]} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: C.army, color: '#fff', border: 'none', cursor: 'pointer', padding: '8px 15px', borderRadius: 9, font: '800 12px/1 "Barlow Condensed",sans-serif', letterSpacing: '.05em', textTransform: 'uppercase', boxShadow: '0 2px 6px rgba(44,125,66,.3)' }}>
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1={12} y1={5} x2={12} y2={19} /><line x1={5} y1={12} x2={19} y2={12} /></svg>
              Přidat
            </button>
          )}
        </div>

        {/* Obsah záložky */}
        {activeTab === 'scenarios' && renderScenarios()}
        {(activeTab === 'units' || activeTab === 'terrains' || activeTab === 'overlays') && renderAccordion(activeTab)}
        {activeTab === 'countries' && renderNameList('countries')}
        {activeTab === 'campaigns' && renderNameList('campaigns')}
      </div>

      {/* Modál – katalog NATO symbolů */}
      {symbolPickerId && (() => {
        const unit = units.find(u => u.id === symbolPickerId);
        if (!unit) return null;
        const close = () => setSymbolPickerId(null);
        return (
          <div onClick={close} style={{ position: 'fixed', inset: 0, background: 'rgba(22,32,46,.72)', backdropFilter: 'blur(3px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div onClick={e => e.stopPropagation()} className="custom-scrollbar" style={{ width: 'min(680px,94vw)', maxHeight: '80vh', overflow: 'auto', background: C.card, border: `2px solid ${C.tanBorder}`, borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,.4)', animation: 'fadeUp .2s ease' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: `2px solid ${C.tanLine}`, position: 'sticky', top: 0, background: C.card }}>
                <h3 style={{ margin: 0, font: '800 20px/1 "Barlow Condensed",sans-serif', letterSpacing: '.03em', textTransform: 'uppercase', color: C.ally }}>Katalog symbolů NATO</h3>
                <button type="button" onClick={close} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: C.tanText, fontSize: 24, lineHeight: 1 }}>×</button>
              </div>
              <div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 12 }}>
                {NATO_SYMBOLS.map(sym => {
                  const a = unit.natoSymbol === sym.id;
                  return (
                    <button key={sym.id} type="button" onClick={() => { updateUnit({ ...unit, natoSymbol: sym.id }); close(); }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '12px 8px', border: `2px solid ${a ? C.ally : C.tanBorderSoft}`, background: a ? 'rgba(28,63,107,.08)' : '#fff', borderRadius: 11, cursor: 'pointer' }}>
                      <NatoPreview type={sym.id} size={52} />
                      <span style={{ font: '700 10px/1.2 Barlow,sans-serif', letterSpacing: '.03em', textTransform: 'uppercase', color: C.ink, textAlign: 'center' }}>{sym.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default Customization;
