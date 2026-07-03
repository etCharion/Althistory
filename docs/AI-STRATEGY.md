# Herní strategie AI protihráče

*Doktrína, kterou se řídí počítačový protihráč (`src/logic/ai.ts` a spol.).
Cílem není neporazitelná AI, ale protivník, jehož tahy působí věrohodně a
smysluplně — jako velitel, který má plán a počítá každý zdroj.*

---

## 1. Principy návrhu

1. **AI nikdy nepodvádí.** Hraje výhradně přes stejné akce (`Action`) a stejný
   reducer jako člověk. Vidí jen to, co je ve stavu hry (hra nemá skrytou
   informaci, takže to není omezení). Každý návrh tahu je legální — vynucují
   to testy simulující celé partie.
2. **Jedna akce za rozhodnutí.** `chooseAiAction(state, rules, aiPlayerId)`
   vrací vždy jen jednu následující akci (`null` = „v této situaci nerozhoduji
   já"). Člověk tak vidí každý přesun a každý hod kostkami zvlášť, stejným
   tempem jako u lidského soupeře.
3. **Deterministické rozhodování, náhodné jen kostky.** Stejná situace vede ke
   stejnému rozhodnutí (remízy řeší stabilní pořadí jednotek). Nepředvídatelnost
   hry obstarají kostky — ne rozmarnost velitele.
4. **Zdroj je jednotka měny, akce je zboží.** Každý zdroj koupí právě jednu
   akci (pohyb, nebo útok) a na konci tahu propadá. AI proto nikdy nehodnotí
   „kdo by měl dostat zásoby", ale „která konkrétní akce má nejvyšší výnos".
   Sekce si zdroje nekupují — soutěží o ně svými nejlepšími akcemi.
5. **Doktrína = kód.** Každé pravidlo v tomto dokumentu odpovídá konkrétní
   heuristice a vahám (`BASE_WEIGHTS` v `aiPosture.ts`). Kdo chce AI ladit,
   mění váhy — ne strukturu.

## 2. Plánovač výnosu zdrojů (zásobování)

*Implementace: `src/logic/aiPlanner.ts` (`planTurn`). Řídí obě distribuční
fáze: rozdělení skladu do sekcí i příděl jednotkám.*

Ekonomika, ze které plánovač vychází:

- příjem přichází každý tah do centrálního skladu; co se nerozdělí, propadá,
- sekční zásoby, které se nepřidělí jednotkám, propadají; zdroje jednotek na
  konci tahu propadají — **hromadění nemá žádnou hodnotu**,
- jednotka unese max. 2 zdroje; první pohyb stojí 1, útok stojí 1 — dva zdroje
  tedy znamenají pohyb + útok,
- při zapnutém logistickém omezení stojí 5. a každý další zdroj do téže sekce
  ze skladu 2 místo 1.

### Mini-plány

Pro každou jednotku plánovač vygeneruje kandidátní plány a ohodnotí je
hodnotovou funkcí (§3) jako čistý zisk proti nečinnosti:

| plán | cena | příklad hodnoty |
|---|---|---|
| útok z místa | 1 | očekávané poškození + dorážka + vytlačení z objektivu |
| pohyb | 1 | vstup na objektiv, lepší pozice, stažení do krytu, přiblížení |
| pohyb + útok | 2 | manévr na dostřel a palba (respektuje limity střelby po pohybu) |
| nic | 0 | 0 |

### Greedy alokace podle mezního výnosu

Zdroje se přidělují po jednom: v každém kroku dostane zdroj ta jednotka, jejíž
**další** zdroj má nejvyšší poměr přínos / cena ze skladu. Důsledky:

- **první zdroj** jednotky má hodnotu jejího nejlepšího 1-zdrojového plánu,
- **druhý zdroj** se poměřuje výhradně proti plánu pohyb+útok — přepočtená
  hodnota jednozdrojového plánu druhou akci nekoupí; stojící střelec druhý
  zdroj nedostane, protože dvakrát střílet nelze,
- **pár**: jednotka, jejíž hodnota je až v kombinaci pohyb+útok (samotný pohyb
  za zdroj nestojí), soutěží rovnou o dva zdroje za cenu obou,
- **logistická přirážka je laťka, ne strop**: nadlimitní zdroj do sekce musí
  svou hodnotou obhájit dvojnásobnou cenu — dorážka na vítěznou medaili
  projde, běžný přesun ne,
- zdroje, pro které žádná akce nestojí, AI nechá propadnout — nepředstírá
  činnost bezcílným přešlapováním.

### Interakce plánů

Plány nejsou nezávislé, proto si vybrané plány „zamlouvají" účinky:

- **virtuální poškození**: očekávané zásahy vybraných útoků se sčítají u cíle;
  koncentrace palby tak správně dostane bonus za dorážku u přírůstku, který
  práh překročí, dorážka se nezapočítá dvakrát a na virtuálně mrtvý cíl se
  neplýtvá dalšími zdroji,
- **rezervace polí**: cílové pole vybraného pohybu si další plány neberou.

Co plánovač záměrně **nehodnotí**: zdroj u posádky objektivu nemá žádnou
vlastní obrannou hodnotu (zásahy odebírají figurky, zdroje je nepohlcují).
Posádka dostane zdroj, jen když z pozice skutečně střílí nebo má jiný plán.

## 3. Jedna hodnotová funkce (manévr a palba)

*Implementace: `src/logic/aiEval.ts` (`bestAttackFrom`, `positionScore`,
`dangerAt`). Stejné ohodnocení používá plánovač (§2), pohybová fáze i výběr
cílů palby v `ai.ts`.*

```
hodnota akce = očekávané poškození
             + dorážka (KILL, poloviční za „skoro dorážku“)
             + koncentrace palby na poškozené cíle (FOCUS)
             + vytlačování z objektivu (PUSH_OFF_OBJ)
             + vstup na objektiv (OBJ_CAPTURE) − opuštění drženého (OBJ_LEAVE)
             + přiblížení k atraktoru (APPROACH)
             − hrozba nepřátelské palby (DANGER, sníženo krytím COVER)
             − cena zdroje (RESOURCE_COST) a logistická přirážka (§2)
```

Poznámky k jednotlivým členům:

- **Palba**: očekávané poškození = kostky (dle terénu a vzdálenosti) × šance
  na zásah kategorie cíle (pěchota ½, tank ⅓, dělo ⅙), omezené zbývajícími
  figurkami cíle — nadbytek je plýtvání. Zohledňuje limit střelby po pohybu
  (`canShootAfterMovingMax`), „stop" terén (ruší útok, drát ne) i přednost
  sousedních nepřátel. Cíl, který lze pravděpodobně zničit, má absolutní
  prioritu — zničená jednotka je vítězný bod; cíle na objektivech mají bonus
  (i neúspěšný útok může vlajkou vynutit ústup).
- **Přiblížení**: není-li co střílet, jednotka se posouvá k nejbližšímu
  „atraktoru" (nekontrolovaný objektiv, jinak nejbližší nepřítel). Tím se
  zaručuje, že se AI vždy tlačí do hry a nevznikne pasivní pat.
- **Krytí a riziko**: pole se hodnotí podle hrozby nepřátelské palby v příštím
  kole škálované křehkostí jednotky; terénní obranný bonus hrozbu snižuje.
  Oslabené jednotky jsou opatrnější (jsou snadná medaile pro soupeře).
- **Setrvačnost**: pohyb se koná, jen když nové pole překoná stání o práh
  (`MOVE_MARGIN`) — jednotka s jediným zdrojem a cílem v dostřelu zásadně
  střílí, nestěhuje se.
- **Dělostřelecká doktrína**: dělo se nehýbe, pokud má na co střílet (pohyb =
  ztráta salvy), drží si odstup od nepřítele a couvá, přiblíží-li se protivník
  na dotyk.
- Pěchota stojící na ostnatém drátu bez jiného cíle drát odstraní; na drát se
  bez důvodu nevstupuje.

## 4. Ústupová disciplína

Když po vlajkách rozhoduje o ústupu vlastní jednotky (i během tahu člověka):

- **Nikdy dobrovolně nezemře**: hrozí-li setrváním zničení a existuje volné
  pole, ustoupí.
- **Drží klíčové pozice**: zdravá jednotka (zbývají ≥ 2 figurky) na drženém
  objektivu raději vezme ztrátu, než by objektiv vyklidila. Ochotu držet
  moduluje globální postoj i sekční postoj (§14).
- Jinak ustoupí na pole s nejmenší hrozbou (a nejlepším krytím).

## 5. Obsazování pozic (take ground)

Po zničení souseda AI postoupí, pokud:

- uvolněné pole je **objektiv** (vždy), nebo
- nabízí **stejné či lepší krytí** a jednotka je zdravá a nevstupuje do
  zjevné přesily.

Jinak zůstane — bezhlavé pronásledování je nejsnadnější cesta, jak darovat VP.

## 6. Architektura modulů

```
src/logic/aiEval.ts     hodnotová funkce akcí (§3): bestAttackFrom, positionScore, dangerAt
src/logic/aiPlanner.ts  plánovač výnosu zdrojů (§2): planTurn – mini-plány, greedy alokace
src/logic/aiPosture.ts  situační postoje (část II): globální filtr + sekční postoje, BASE_WEIGHTS
src/logic/ai.ts         rozhodovací kostra: jedna akce za rozhodnutí, fáze, ústupy, take ground
```

Vše jsou čisté funkce stavu — žádná paměť mezi rozhodnutími. Plánovač se
přepočítává při každém rozhodnutí; během distribučních fází se deska nemění,
takže výstup je stabilní a rozdané zdroje odpovídají zamýšleným plánům.

## 7. Parametry a ladění

Všechny váhy jsou konstanty `BASE_WEIGHTS` v `src/logic/aiPosture.ts` (hodnota
zabití, váha objektivů, přiblížení, rizika, práh pro pohyb…). Testy
(`ai.test.ts`, `aiPlanner.test.ts`, `aiPosture.test.ts`) ověřují jednak
jednotlivá doktrinální rozhodnutí (dorážení, koncentrace palby, logistická
laťka, ústup, držení objektivu…), jednak celé partie AI vs. AI: každá navržená
akce musí být legální a hra musí skončit vítězem.

## 8. Vědomá omezení a možná rozšíření

- Greedy 1 tah dopředu — AI neplánuje vícetahové kombinace ani nepředvídá
  soupeřovy tahy; hodnoty útoků jsou očekávané (kostky rozhodnou jinak).
- Greedy alokace podle mezního výnosu je aproximace batohu — u vzájemně se
  vylučujících kombinací nemusí najít globální optimum, je ale deterministická,
  čitelná a levná.
- Díky čistému reduceru lze později doplnit 1-ply lookahead (simulace vlastního
  tahu reducerem) jako „těžkou" obtížnost; „lehká" = náhodný výběr z legálních
  akcí. Současná implementace odpovídá „normální".
- AI zatím hraje jen v lokální hře; protože mluví stejnými akcemi jako lidský
  klient, lze ji později posadit i na seat v online hře.

---

# Část II — Situační postoje

*Dvě vrstvy nad základní doktrínou: **globální postoj** (strategický filtr —
nálada celé armády podle role, skóre a poměru sil) a **sekční postoje**
(levá/střed/pravá se chovají podle místní situace). Implementace:
`src/logic/aiPosture.ts`, napojení v `src/logic/ai.ts`, odznak v liště tahu
počítače, testy v `aiPosture.test.ts` a `aiPlanner.test.ts`.*

## 10. Princip: jedna doktrína, více postojů

Základní chování (část I) zůstává — mění se jen **váhy a několik
behaviorálních přepínačů**. Postoj je tedy „nálada" téhož velitele, ne jiný
algoritmus. To má tři výhody:

1. žádné nové riziko nelegálních tahů (rozhodovací kostra je stejná),
2. každý postoj je čitelný — hráč pozná, že se AI zakopala nebo že zaútočila
   vabank, což je přesně ta věrohodnost, o kterou jde,
3. ladí se tabulkou, ne kódem.

Postoje se vyhodnocují **deterministicky z aktuálního stavu hry** (žádná paměť
mezi tahy — AI zůstává čistou funkcí). Vstupy se mění po tazích, ne po akcích,
takže postoj přirozeně drží celý tah a nepřeskakuje.

## 11. Vstupy situačního hodnocení

| Vstup | Výpočet | Hodnoty |
|---|---|---|
| **Role v bitvě** `role` | Z rozestavení scénáře (stabilní celou hru): kolik objektivů získatelných pro AI drží na začátku soupeř/nikdo vs. kolik jich AI musí bránit; + kdo má převahu sil na startu. Scénář „dobij most" → AI s mostem je *obránce*, druhá strana *útočník*; bez objektivů → *střetná bitva*. | útočník / obránce / střetná |
| **Bodová situace** `score` | `myNeed = VP_k_výhře − mojeVP`, `enemyNeed` totéž pro soupeře. Porovnání potřeb, ne absolutních bodů. | vedu / vyrovnáno / prohrávám / **kritické** (`enemyNeed ≤ 2` a menší než `myNeed`) |
| **Poměr sil** `force` | Součet figurek × hodnota typu (tank 1.3, dělo 1.2, pěchota 1.0), můj / soupeřův. Pásma s hysterezí, aby postoj nekmital na hranici. | převaha (≥ 1.3) / vyrovnané / slabší (≤ 0.75) |
| **Fáze hry** `turn` | Číslo tahu. | otevření (1.–2. tah) / střed / — |

## 12. Katalog globálních postojů

Multiplikátory se vztahují k základním vahám `BASE_WEIGHTS` z části I. Postoj
mění chování zásobování nepřímo — tytéž váhy, kterými plánovač (§2) hodnotí
akce, takže např. obranný postoj přirozeně přesune zdroje k palebným pozicím
a posádkám (jejich akce mají vyšší hodnotu), útočný k manévru.

### ⚔️ ÚTOK (ofenzíva)
*Kdy: role útočník a neprohrávám kriticky; nebo vyrovnaná střetná bitva s převahou.*
Tempo a zábor prostoru: APPROACH ×1.4, OBJ_CAPTURE ×1.3, PUSH_OFF_OBJ ×1.5,
DANGER ×0.8, MOVE_MARGIN 0.3. Take-ground: standardní pravidla. Ústup:
standardní.

### 🛡️ OBRANA (pevná obrana)
*Kdy: role obránce a nemám důvod vylézt (neprohrávám, síly vyrovnané či slabší).*
Drž linii a nech soupeře krvácet: APPROACH ×0.5 (jednotky se nehrnou vpřed,
ale objektivy vlastní poloviny stále přitahují), COVER ×1.6, HOLD_OBJ ×1.4,
DANGER ×1.3, MOVE_MARGIN 0.6. Take-ground: **jen objektivy** (nevylézat ze
zákopů za ustupujícím nepřítelem). Ústup: ochotnější (ztráta jednotky = VP
soupeři; pozice ano, životy ne — kromě objektivů).

### 🗡️ VÝPAD (protiútok)
*Kdy: role obránce, ale získal jsem lokální převahu (force = převaha), nebo
soupeř oslabil útok (vedu na body v obranné roli).*
Dočasně útočné chování s důrazem na zničení oslabených sil: jako ÚTOK, navíc
KILL ×1.3 a FOCUS ×1.5 — cíl výpadu je dorazit, ne dobýt. Take-ground:
standardní. Jakmile převaha pomine, hodnocení samo sklouzne zpět do OBRANY.

### 🏰 KONSOLIDACE (udržet vedení)
*Kdy: vedu na body a nemám drtivou převahu sil.*
Neriskovat — soupeř potřebuje moje jednotky a objektivy, tak mu je nedám:
APPROACH ×0.3, DANGER ×1.5, HOLD_OBJ ×1.5, MOVE_MARGIN 0.7. Střílí se na vše
v dostřelu (útok nic neriskuje), ale nepostupuje se. Take-ground: **nikdy**
kromě objektivu. Ústup: maximálně konzervativní k životům.

### 🔥 VABANK (zoufalý útok)
*Kdy: kritické skóre — soupeři chybí ≤ 2 VP a mně víc; nebo prohrávám a jsem
výrazně slabší (vyhrát může už jen risk).*
Opatrnost už nemá cenu: DANGER ×0.3, APPROACH ×1.8, OBJ_CAPTURE ×2, KILL ×1.5,
MOVE_MARGIN 0.1. Take-ground: vždy (na drát ale ne — past zůstává pastí).
Ústup: spíše držet pozice a brát ztráty (ustupující jednotka nestřílí a čas
došel).

### Modifikátor OTEVŘENÍ (1.–2. tah)
Nezávisle na postoji: DANGER minimálně ×1.0 (žádné riskování v prvním tahu),
preferuj obsazení výhodného terénu a středových objektivů. Zabraňuje tomu,
aby VABANK v prvním tahu poslal jednotky osamoceně přes celou mapu.

## 13. Rozhodovací matice

Vyhodnocuje se shora dolů, první shoda platí:

| # | Podmínka | Postoj |
|---|---|---|
| 1 | `score = kritické` (soupeř ≤ 2 VP od výhry, já dál) | **VABANK** |
| 2 | `score = prohrávám` a `force = slabší` | **VABANK** |
| 3 | `score = vedu` a `force ≠ převaha` | **KONSOLIDACE** |
| 4 | `score = vedu` a `force = převaha` | role útočník → **ÚTOK**, jinak **VÝPAD** |
| 5 | role obránce a `force = převaha` | **VÝPAD** |
| 6 | role obránce | **OBRANA** |
| 7 | role útočník | **ÚTOK** |
| 8 | střetná bitva | `force ≥ vyrovnané` → **ÚTOK**, jinak **OBRANA** |

Hystereze: pásma `force` mají mrtvou zónu (převaha ≥ 1.3, konec převahy až
pod 1.15), aby jedna zničená figurka nepřepínala postoj tam a zpět.

## 14. Sekční postoje

*V Memoir stylu se často zároveň brání jeden bok a tlačí středem — jedna
nálada pro celou armádu na to nestačí. Implementace: `sectionStances` +
`applyStance` v `aiPosture.ts`.*

Sekční postoj se odvozuje z **místní situace** (poměr sil v sekci, objektivy,
palebné příležitosti) a jen dolaďuje váhy jednotek dané sekce — násobí se
navrch globálního postoje. **Zdroje sekcím nepřiděluje** (o ty soutěží
konkrétní akce v plánovači §2); „přesun tlaku" do jiné sekce tedy vzniká
z ekonomiky sám, sekční postoj ho jen pojmenovává a dolaďuje riziko.

Vyhodnocuje se shora dolů, první shoda platí (sekce bez vlastních jednotek
postoj nemá):

| # | Podmínka v sekci | Postoj | Efekt na jednotky sekce |
|---|---|---|---|
| 1 | získatelný objektiv nebo oslabený nepřítel, a místní síly ≥ soupeř | **PRŮLOM** | APPROACH ×1.2, MOVE_MARGIN ×0.75 — tlačit vpřed |
| 2 | držím tu objektiv | **DRŽET** | HOLD_OBJ ×1.3, OBJ_LEAVE ×1.3, ochota brát ztráty ×1.2 |
| 3 | místní síly ≤ 0.6 × soupeř | **ZDRŽOVAT** | DANGER ×1.3, APPROACH ×0.6, ochota brát ztráty ×0.7 — couvat do krytu, nedarovat medaili |
| 4 | aspoň jedna jednotka může střílet z místa | **PALEBNÁ ZÁKLADNA** | MOVE_MARGIN ×1.3, COVER ×1.2 — stát a pálit |
| 5 | jinak | **PŘESUN TLAKU** | beze změny vah; zdroje si vysoutěží jiné sekce |

**UI**: odznak u indikace tahu počítače zobrazuje globální postoj a nápadné
sekční postoje („Obrana · průlom ve středu · drží vlevo") — hráč vidí záměr,
což výrazně přidává na věrohodnosti a usnadňuje ladění.

## 15. Testy postojů a plánovače

1. **Jednotkové testy matice** (§13) — každá řádka, hystereze na hranici pásem
   (`aiPosture.test.ts`).
2. **Plánovač** (`aiPlanner.test.ts`) — zdroj jde za nejlepší konkrétní akcí,
   ne za obecným skóre sekce; druhý zdroj jen za skutečnou druhou akci;
   posádka bez cíle nedostane zdroj před střelcem s dorážkou; koncentrace
   palby bez dvojího započtení dorážky; logistická přirážka jako laťka.
3. **Sekční postoje** — dvoukřídlý scénář dává různé postoje v sekcích;
   zdržující sekce couvá ochotněji, držící drží víc.
4. **Simulace** (`ai.test.ts`) — partie AI vs. AI doběhnou k vítězi jen
   legálními akcemi, jednotky nikdy nepřekročí limit zdrojů.

## 16. Možná další rozšíření (mimo tento plán)

- **Osobnosti generálů**: statický multiplikátor nad postoji (agresivní /
  metodický / opatrný) volitelný u scénáře — dvě partie proti „jinému
  generálovi" pak mají jiný charakter i při stejné mapě.
- **Vazba na obtížnost**: lehká = bez postojů, normální = postoje, těžká =
  postoje + 1-ply lookahead.
- **Roli v bitvě** lze později přepsat polem scénáře (`aiDoctrine` v editoru:
  „braň most za každou cenu"), automatické odvození je jen výchozí.
