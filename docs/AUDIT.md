# Audit projektu Althistory — zpráva a návrh

*Datum: červenec 2026 · Rozsah: kompletní zdrojový kód (`src/`, ~7 000 řádků TS/TSX), build a deploy konfigurace*

---

## Shrnutí

Projekt je v překvapivě dobré kondici. Architektura postavená na **čistém reduceru** (`src/logic/gameReducer.ts`) — stejný kód řídí lokální hot-seat hru i online hru přes Firestore transakce — je největší silnou stránkou celého projektu a ideálním základem jak pro automatické testy, tak pro AI protihráče. UX je nadprůměrné (fázový průvodce, nápovědy, potvrzovací dialogy, undo, QR sdílení).

Audit ale odhalil **jednu kritickou díru v mechanice** (pohyb jednotek nevaliduje cestu — lze „přeskočit" řeku i nepřátele), dvě další chyby střední závažnosti a řadu drobností. Odpověď na otázku AI protihráče zní: **ano, jde to, a díky architektuře poměrně snadno** — detailní návrh je v kapitole 4.

| Oblast | Hodnocení |
|---|---|
| Herní mechanika | Funkční s výhradami — 1 kritická chyba, 2 střední, několik drobných |
| Uživatelská vstřícnost | Nadprůměrná; pár konkrétních slabin (tichá odmítnutí akcí, chybí kombat log) |
| Kvalita kódu | Dobrý návrh jádra; slabá typová disciplína (`any`), nulové testy, dvojí UI = dvojí údržba |
| Bezpečnost | Firestore bez autentizace a pravidel — pro hru mezi přáteli OK, jinak riziko |
| AI protihráč | Realizovatelný bez zásahu do pravidel, odhad ~300–500 řádků |

---

## 1) Mechanika — funguje vše, jak má?

### Co funguje dobře

- **Reducer + akce**: všech 12 typů akcí (`DISTRIBUTE`, `MOVE`, `ATTACK`, …) prochází jediným čistým reducerem, který běží identicky u všech klientů i uvnitř Firestore transakce (`applyAction` v `src/logic/firebaseService.ts:124`). Konkurenční zápisy více velitelů se tak nemohou navzájem přepsat.
- **Role a sekce**: generál implicitně velí sekcím bez vlastního velitele (`controlsSection`, `gameReducer.ts:90`) — pravidla elegantně škálují od 1 do 4 hráčů na stranu. Jednotky na hranici sekcí (liché řádky) patří do obou sekcí.
- **Undo**: snapshoty per-fáze (`pushUndo`) správně klonují hexy (které reducer mutuje) a útoky (hod kostkou) záměrně vratné nejsou.
- **Objektivy**: jednotlivá políčka i skupiny (`any`/`majority`/`all`), dočasné vs. trvalé, generátor slovního popisu cílů (`victoryGoals.ts`) včetně českého skloňování.
- **LOS**: vzorkování linie s pravidlem „pohled podél hrany je volný" a hřebenové pravidlo pro kopce (`areOnSameRidge`).
- **Logistické omezení**: 5.+ zdroj do sekce stojí 2 ze skladu, vizuálně odlišen.

### Nalezené problémy

#### 🔴 KRITICKÉ — `MOVE` nevaliduje cestu, jednotky mohou „teleportovat"

`gameReducer.ts:394-455`. Reducer při pohybu kontroluje pouze:
vzdálenost vzdušnou čarou (`getDistance`) ≤ zbývající pohyb, neprůchodnost **cílového** pole a pravidla entry/exit-adjacent. **Nevolá `getReachableHexes`** — nekontroluje, že mezi startem a cílem existuje průchozí cesta.

UI sice zvýrazňuje dosažitelná pole, ale `handleHexClick` v `GameView.tsx:304-313` pošle `moveUnit` na **libovolné** prázdné kliknuté pole. Důsledky:

- jednotka s pohybem 2+ přeskočí řeku širokou 1 pole (řeka je `no-move`),
- projde skrz nepřátelské (i vlastní) jednotky,
- projde skrz les/město („stop" terén) bez zastavení, pokud cílí za něj.

Zneužitelné v lokální i online hře (reducer je jediná autorita a tuto kontrolu nemá). **Oprava**: v `MOVE` ověřit `getReachableHexes(fHex.q, fHex.r, limit, …).includes(\`${tq},${tr}\`)` — funkce už existuje v `src/logic/hexGrid.ts:97` a používá správnou kategorii jednotky i vlastníka; volitelně navíc v UI ignorovat kliky mimo zvýrazněná pole.

#### 🟠 VYSOKÉ — ústup ignoruje neprůchodný terén

`RESOLVE_RETREAT` (`gameReducer.ts:623-624`) kontroluje jen vzdálenost 1, obsazenost a směr ústupu; `getRetreatHexes` (`useGameLogic.ts:96-102`) totéž. Ani jedno nevolá `isImpassableForUnit` → jednotka může ustoupit **do řeky** nebo do terénu neprůchodného pro svou kategorii/stranu. Oprava je na dvou místech jeden řádek (filtr přes `isImpassableForUnit`).

#### 🟠 STŘEDNÍ — nečistý reducer × `React.StrictMode` (koroze stavu v dev módu)

Reducer po mělké kopii gridu (`{ ...state.grid }`) **mutuje sdílené hex objekty in-place** (`fromHex.unitId = undefined` v MOVE, ATTACK, RESOLVE_RETREAT, RESOLVE_TAKE_GROUND, DESTROY_OVERLAY) a navíc volá `Math.random` (`rollDice`). `main.tsx` zapíná `React.StrictMode`, který v dev režimu volá updater `setLocalState(prev => reducer(prev, action, rules))` (`useGameLogic.ts:33`) **dvakrát**:

- druhé volání běží nad gridem zmutovaným prvním voláním — např. u smrtícího útoku druhé volání nenajde hex cíle (`unitId` už je `undefined`) a vrátí stav beze změny, ale mutace gridu zůstala → „duch" jednotky (existuje v `units`, není na mapě),
- kostky se hodí dvakrát (zobrazený výsledek nemusí odpovídat prvnímu hodu).

Produkční build (StrictMode se v produkci nedvojí) ani online hra (transakce nad čerstvým snapshotem z Firestore) postižené **nejsou** — je to ale časovaná bomba pro vývoj a testování. **Oprava**: klonovat hexy, kterých se změna týká (`nGrid[key] = { ...nGrid[key], unitId: undefined }`), a hod kostkou přesunout mimo reducer (předat jako součást akce) — druhé je důležité i pro budoucí server-side validaci.

#### 🟡 NÍZKÉ

- **`MOVE` počítá vítěze ze zastaralých jednotek** — `computeWinner(state.scenario, state.units, nVP)` na `gameReducer.ts:454` používá `state.units` místo `newUnits`. Dnes bez následku (pohyb jednotky neničí), ale nekonzistentní se zbytkem reduceru.
- **Zaseknutelný `pendingCombat`** — `DISMISS_COMBAT` smí jen hráč aktivního týmu (`gameReducer.ts:560`). Když se útočníkova strana odpojí hned po útoku, obránce overlay nezavře a `hasPendingCombat` blokuje veškeré další akce. Řešení: povolit dismiss oběma týmům, nebo timeout na serverovém čase.
- **Mrtvé pole `maxSectionResources`** — je v typech (`types/game.ts:113`), v editoru i ve scénářích, ale reducer ho nikde nevynucuje. Buď vynutit v `DISTRIBUTE`, nebo odstranit.
- **Katalogy pravidel se načítají jen při mountu** (`GameView.tsx:195-215`). Když někdo změní typy jednotek/terénů v Nastavení uprostřed online hry, klienti počítají s různými pravidly. Řešení: zmrazit kopii katalogů do dokumentu hry při jejím založení.
- **Deploy workflow běží jen na větvi `memoir-44-clone-implementation-v2-…`** a PR se nebuildí — chyba typu „nezkompiluje se" projde review bez povšimnutí. Doporučuji přidat CI job `npm run build` na pull requesty.

#### 🔒 Bezpečnost a férovost online hry

- `src/firebase.ts` obsahuje konfiguraci napevno (u Firebase web aplikací normální), ale projekt **nemá žádnou autentizaci** a Firestore pravidla jsou zjevně otevřená: kdokoli, kdo zná projekt ID, může přepsat stav libovolné hry i **globální katalogy** — `unitTypes`, `terrainTypes`, `scenarios` jsou sdílené všemi návštěvníky aplikace a Nastavení (Customization) do nich zapisuje přímo. Jeden hráč si tak nechtěně (nebo záměrně) změní pravidla všem.
- `applyAction` důvěřuje klientovi — podvržený klient může zapsat libovolný stav.

Pro hru v okruhu přátel je to přijatelný kompromis. Pokud má být hra veřejnější: anonymní Firebase Auth + security rules (zápis do `games` jen pro držitele seatu, katalogy jen pro adminy) a výhledově Cloud Function jako autorita nad reducerem.

---

## 2) Uživatelská vstřícnost a intuitivnost

### Silné stránky

- **Fázový pruh A→B→C→D** s fajfkami, kontextovou nápovědou pro každou fázi a detailním popisem na hover — nový hráč se rychle zorientuje.
- **Potvrzovací dialog před koncem fáze** s výčtem nevyužitých možností („Sklad: 3", „Jednotky k útoku: 2") — brání omylům, ale nenutí.
- **Hover tooltipy** terénu, overlayů a jednotek; **karta vybrané jednotky** se stavem, dostřelem a akcemi; legenda jednotek ve hře.
- **Undo** pro rozdělování zdrojů a pohyb (s korektním omezením na otevřenou fázi).
- **Online onboarding**: lobby s výběrem role, QR kód, kopírování odkazu, „Pokračovat v online hře" v menu, indikace „VÁŠ TAH / NA TAHU: …".
- **Konzistentní čeština** včetně skloňování, jednotný vizuální jazyk „polní mapy" + přepínatelné klasické téma.

### Slabiny a doporučení

1. **Tichá odmítnutí akcí.** Když reducer akci odmítne (klik na nedosažitelné pole, jednotka bez zdrojů…), nestane se nic a hráč neví proč. Po opravě kritické chyby č. 1 to bude ještě viditelnější (kliky mimo zvýrazněná pole přestanou „fungovat"). Doporučení: krátký toast/zatřesení s důvodem („Mimo dosah", „Bez zdrojů").
2. **Chybí kombat log.** Animace kostek zmizí po 2,5 s — kdo se zrovna nedíval (typicky u online hry), výsledek už nedohledá. Doporučení: rolovatelný log tahu (kdo na koho, kostky, zásahy, vlajky, ústupy). Je to i předpoklad pro férovou online hru a ladění AI.
3. **Není vidět, které jednotky už jednaly.** Ve fázi pohybu/útoku by pomohla vizuální známka (ztlumení, fajfka) u jednotek, které už akci vyčerpaly — teď to hráč zjišťuje klikáním.
4. **Dotyková zařízení**: klíčové informace (terén, popisy fází, cíle) jsou jen na hover — na mobilu/tabletu se k nim hráč nedostane. Doporučení: tap = tooltip, nebo informační panel.
5. **Chybové stavy sítě**: při výpadku Firestore visí „Načítám bitevní pole…" donekonečna, bez hlášky a bez retry.
6. **Dvě kompletní UI témata** (`GameView` + `ClassicGameView`, 2× menu, 2× lobby, 2× editor, 2× customizace ≈ 2 600 řádků duplicity) — každá nová funkce se musí psát dvakrát a témata se postupně rozjedou. Doporučení: jedna sada komponent + theme tokeny (barvy/fonty přes CSS proměnné), nebo klasické téma zamknout jako „legacy".
7. Drobné: auto-dismiss kostek po 2,5 s je pro nové hráče rychlý (zvážit klik-pro-zavření + delší timeout); overlay „Ustupte!" zakrývá střed mapy, tlačítko „Vyřešit" ho sice zmenší, ale výchozí stav by mohl být kompaktní.

---

## 3) Doporučení — co dál (prioritizovaně)

| Priorita | Úkol | Pracnost |
|---|---|---|
| **P1** | Opravit validaci pohybu v `MOVE` (použít `getReachableHexes`) | malá |
| **P1** | Opravit ústup do neprůchodného terénu (`RESOLVE_RETREAT` + `getRetreatHexes`) | malá |
| **P1** | Zčistit reducer: klonovat mutované hexy, hod kostkou předávat v akci | malá–střední |
| **P2** | Unit testy reduceru (Vitest) — čistý reducer je ideální kandidát; testy pohybu, útoku, ústupu, objektivů, undo | střední |
| **P2** | CI: `npm run build` (+ testy) na pull requesty | malá |
| **P3** | Kombat log + toast při odmítnuté akci + indikace „hotových" jednotek | střední |
| **P3** | Ošetření výpadků sítě (chybová hláška, retry) | malá |
| **P4** | Anonymní Firebase Auth + Firestore security rules; katalogy pravidel zmrazit do dokumentu hry | střední |
| **P5** | Sjednotit dvě UI témata nad společnou logikou (theme tokeny) | velká |
| **P6** | AI protihráč (viz kapitola 4) | střední–velká |

Pořadí P1 → P2 není náhodné: testy reduceru napsané po opravách zafixují správné chování a stanou se regresní sítí pro všechno další — včetně AI.

---

## 4) Návrh: AI protihráč pro sólo hru

### Je to rozumně proveditelné?

**Ano — a právě tahle architektura je na to stavěná.** Celá hra se řídí čistou funkcí `reducer(state, action, rules)` a UI je jen generátor akcí. AI protihráč je proto **jen další generátor akcí**: funkce, která dostane aktuální `GameState` a vrátí další `Action` za svou stranu. Není potřeba měnit reducer, pravidla ani ukládání — AI hraje přesně tím samým „ovladačem" jako člověk, takže z principu nemůže podvádět.

Dokázal bych ji napsat: odhad **~300–500 řádků** čistého TypeScriptu bez závislostí, viz návrh níže.

### Architektura

```
src/logic/ai.ts
  chooseAiAction(state: GameState, rules: Rules, aiPlayerId: PlayerId): Action | null
```

- Čistá, synchronní funkce. Vrací **vždy jednu** další akci; `null` znamená „nemám co dělat" → volající pošle `NEXT_PHASE`/`END_TURN`.
- Krokování po jedné akci je klíčové pro UX: člověk vidí každý pohyb a hod kostek zvlášť, existující animace i `hasPendingCombat` gating fungují beze změny.

**Integrace (lokální hra):**

1. `MainMenu` / karta scénáře: přepínač „Hrát proti počítači" (+ volba obtížnosti) → `GameView` dostane `aiPlayerId='player2'`.
2. `useGameLogic` dostane `aiPlayerId` a přidá jeden `useEffect`:

```ts
useEffect(() => {
  if (!aiPlayerId || !gameState || gameState.winner) return;
  const aiMustAct =
    gameState.activePlayerId === aiPlayerId            // AI je na tahu
    || pendingRetreatOwnedBy(gameState, aiPlayerId)    // AI ustupuje po útoku člověka
    || pendingTakeGroundOwnedBy(gameState, aiPlayerId);
  if (!aiMustAct) return;
  const t = setTimeout(() => {
    const action = chooseAiAction(gameState, rules, aiPlayerId);
    dispatch(action ?? nextStepAction(gameState));     // NEXT_PHASE / END_TURN
  }, 650);                                             // čitelné tempo
  return () => clearTimeout(t);
}, [gameState, aiPlayerId]);
```

Důležitý detail: AI musí reagovat **i během tahu člověka** — když člověk zaútočí a padnou vlajky, `pendingRetreat` řeší vlastník bránící se jednotky, tedy AI.

3. Online hra zůstává beze změny (AI jen lokálně); později lze AI „posadit na seat" i v online hře, protože mluví stejnými akcemi.

### Heuristiky po fázích (obtížnost „normální")

Všechny stavební kameny už v projektu existují — AI je jen skóruje:

| Fáze | Strategie | Využité existující funkce |
|---|---|---|
| A) Zdroje do sekcí | Rozděl sklad úměrně počtu vlastních jednotek a blízkosti nepřátel/objektivů v sekci; při logistickém omezení nepřekračuj 4 | `getUnitSections`, `getDistance` |
| B) Zdroje jednotkám | Nejdřív jednotky, které mohou hned útočit; pak jednotky u objektivů; 2 kostky hrotu útoku | `getTargetableUnits` |
| C) Pohyb | Pro každou jednotku ohodnoť dosažitelná pole: +obsazení objektivu, +dostane se na dostřel, +obranný bonus terénu, −vstup do dostřelu přesily; dělostřelectvo nehýbat, když může střílet | `getReachableHexes`, `getDiceCount`, `checkLOS` |
| D) Útok | Vyber dvojici (útočník, cíl) s max. očekávanými zásahy = `getDiceCount × P(zásah)`; P podle kategorie cíle: pěchota 3/6, tank 2/6, dělostřelectvo 1/6; bonus za šanci dorazit oslabenou jednotku (VP!) | `getTargetableUnits`, `getDiceCount` |
| Ústup | Vyber pole minimalizující počet nepřátel na dostřel; vzít ztrátu jen při držení objektivu a dostatku figurek | `getRetreatHexes`, `getDiceCount` |
| Take ground | Ano, pokud cílové pole je objektiv nebo má lepší obranu; jinak ne | terénní modifikátory |

**Obtížnosti** pak vzniknou levně: *lehká* = náhodný výběr z legálních akcí, *normální* = greedy heuristika výše, *těžká* = totéž + 1-ply lookahead u pohybu (simulace přes existující čistý reducer — další benefit čisté architektury).

### Postup implementace (návrh na samostatnou session)

1. **Předpoklad**: nejdřív opravit kritickou chybu pohybu (kap. 1) — jinak se AI ladí na děravých pravidlech; ideálně mít i základní testy reduceru.
2. `src/logic/ai.ts` — výběr akcí po fázích (viz tabulka), ~300 řádků.
3. `useGameLogic` — `aiPlayerId` parametr + efekt výše, ~30 řádků.
4. `MainMenu`/`ClassicMainMenu` — přepínač „Proti počítači", ~20 řádků na téma.
5. Testy: simulace celé hry AI vs. AI přes reducer (stovky partií za sekundu) — skvělá kontrola, že hra vždy doběhne do konce a neuvázne.

---

*Zpracoval: automatizovaný audit kódu (Claude Code), na základě revize všech souborů v `src/`, konfigurace Vite/Tailwind a GitHub Actions workflow.*
