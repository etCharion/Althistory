# Herní strategie AI protihráče

*Doktrína, kterou se řídí počítačový protihráč (`src/logic/ai.ts`). Cílem není
neporazitelná AI, ale protivník, jehož tahy působí věrohodně a smysluplně —
jako velitel, který má plán.*

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
4. **Doktrína = kód.** Každé pravidlo v tomto dokumentu odpovídá konkrétní
   heuristice a vahám v `ai.ts` (konstanty `W` na začátku souboru). Kdo chce
   AI ladit, mění váhy — ne strukturu.

## 2. Velení: těžiště útoku (Schwerpunkt)

Skutečný štáb nerozprostírá síly rovnoměrně — určí těžiště a tam koncentruje
zásoby. AI proto každé kolo hodnotí tři sekce (levá / střed / pravá) podle:

- **vlastní síly** v sekci (kolik jednotek tam může zdroje využít),
- **hodnoty cílů** — neobsazené či soupeřovy objektivy v sekci,
- **tlaku nepřítele** — nepřátelské jednotky v sekci (tam bude potřeba bránit).

**Zásobovací pravidlo:**

1. *Rezerva*: každá sekce s vlastními jednotkami dostane nejdřív 1 zdroj
   (žádná část fronty nezůstane úplně bez zásob).
2. *Těžiště*: zbytek skladu jde postupně do sekce s nejvyšším skóre, dokud má
   jednotky schopné zdroje pojmout (kapacita = 2 na jednotku).
3. *Logistika*: při zapnutém logistickém omezení AI nepřekračuje 4 zdroje na
   sekci, dokud existuje jiná potřebná sekce (nadlimitní zdroj stojí dvojnásobek).
4. Zdroje, které nemá kdo využít, AI nechá propadnout — nehromadí nesmyslně.

## 3. Zásobování jednotek

Zdroj je zároveň palivo (pohyb), munice (útok) i vesta (pohlcuje zásahy).
Pořadí přídělu:

1. jednotky, které **mohou hned střílet** (mají cíl v dostřelu) a nemají zdroj,
2. jednotky **v kontaktu s nepřítelem** (blízko fronty) — druhý zdroj jako
   rezerva na manévr + štít,
3. **posádky objektivů** — zdroj navíc znamená, že první zásah je neshodí,
4. dělostřelectvo s výhledem na cíle (vytrvalá palba každé kolo).

Osamocené jednotky s 1 figurkou daleko od boje dostávají zdroje jako poslední.

## 4. Manévr

Pro každou jednotku AI ohodnotí všechna dosažitelná pole (stejné BFS jako
pravidla) plus možnost zůstat stát:

- **Palebná pozice**: kolik očekávaného poškození jednotka z pole způsobí
  (kostky × šance na zásah podle kategorie cíle: pěchota ½, tank ⅓, dělo ⅙).
  Respektuje se limit střelby po pohybu (`canShootAfterMovingMax`) i to, že
  vstup do lesa/města útok ruší.
- **Cíle**: vstup na neobsazený objektiv má vysokou prioritu (okamžitý VP);
  opustit držený dočasný objektiv je penalizované.
- **Přiblížení**: není-li co střílet, jednotka se posouvá k nejbližšímu
  „atraktoru" (nekontrolovaný objektiv, jinak nejbližší nepřítel). Tím se
  zaručuje, že se AI vždy tlačí do hry a nevznikne pasivní pat.
- **Krytí a riziko**: pole se hodnotí podle hrozby nepřátelské palby v příštím
  kole (kdo na něj dostřelí / dojede) škálované křehkostí jednotky; terénní
  obranný bonus hrozbu snižuje. Oslabené jednotky jsou opatrnější.
- **Hospodaření**: první pohyb jednotky stojí zdroj — jednotka s jediným
  zdrojem, která může střílet, zásadně nestěhuje (útok má přednost před
  přesunem). Pohyb se koná jen, když nové pole znatelně překoná současné.

**Dělostřelecká doktrína:** dělo se nehýbe, pokud má na co střílet (pohyb =
ztráta salvy). Přesouvá se jen bez cílů, drží si odstup od nepřítele a couvá,
přiblíží-li se protivník na dotyk.

## 5. Palba

Výběr cíle (globálně přes všechny své jednotky, ne po jedné):

1. **Dorážení**: cíl, který lze pravděpodobně zničit (očekávané zásahy ≥ jeho
   figurky + zdroje), má absolutní prioritu — zničená jednotka je vítězný bod.
2. **Koncentrace palby**: už poškozené cíle mají přednost před čerstvými.
3. **Vytlačování**: cíle stojící na objektivech mají bonus (i neúspěšný útok
   může vlajkou vynutit ústup a uvolnit objektiv).
4. Jinak prostě nejvyšší očekávané poškození (kostky dle terénu × šance).

Pěchota stojící na ostnatém drátu bez jiného cíle drát odstraní.

## 6. Ústupová disciplína

Když po vlajkách rozhoduje o ústupu vlastní jednotky (i během tahu člověka):

- **Nikdy dobrovolně nezemře**: hrozí-li setrváním zničení a existuje volné
  pole, ustoupí.
- **Drží klíčové pozice**: zdravá jednotka (zbývá ≥ 2 „životy") na drženém
  objektivu raději vezme ztrátu, než by objektiv vyklidila.
- Jinak ustoupí na pole s nejmenší hrozbou (a nejlepším krytím).

## 7. Obsazování pozic (take ground)

Po zničení souseda AI postoupí, pokud:

- uvolněné pole je **objektiv** (vždy), nebo
- nabízí **stejné či lepší krytí** a jednotka je zdravá a nevstupuje do
  zjevné přesily.

Jinak zůstane — bezhlavé pronásledování je nejsnadnější cesta, jak darovat VP.

## 8. Parametry a ladění

Všechny váhy jsou konstanty `W` na začátku `src/logic/ai.ts` (hodnota zabití,
váha objektivů, přiblížení, rizika, práh pro pohyb…). Testy v `ai.test.ts`
ověřují jednak jednotlivá doktrinální rozhodnutí (dorážení, ústup, držení
objektivu…), jednak celé partie AI vs. AI: každá navržená akce musí být
legální a hra musí skončit vítězem.

## 9. Vědomá omezení a možná rozšíření

- Greedy 1 tah dopředu — AI neplánuje víceúhlé kombinace ani nepředvídá
  soupeřovy tahy. Díky čistému reduceru lze později doplnit 1-ply lookahead
  (simulace vlastního tahu reducerem) jako „těžkou" obtížnost.
- Obtížnosti: „lehká" = náhodný výběr z legálních akcí, „těžká" = lookahead;
  současná implementace odpovídá „normální".
- AI zatím hraje jen v lokální hře; protože mluví stejnými akcemi jako lidský
  klient, lze ji později posadit i na seat v online hře.

---

# Část II — Situační postoje ✅ *implementováno*

*Systém **postojů (postur)** — variant strategie, mezi kterými AI přepíná
podle typu bitvy, vývoje skóre a poměru sil. Útočník se chová jinak než
obránce, prohrávající jinak než vedoucí. Implementace: `src/logic/aiPosture.ts`
(hodnocení situace, matice, katalog vah), napojení v `src/logic/ai.ts`, odznak
aktuálního postoje v liště tahu počítače, testy v `aiPosture.test.ts`.*

## 10. Princip: jedna doktrína, více postojů

Základní chování (Část I) zůstává — mění se jen **váhy `W` a několik
behaviorálních přepínačů**. Postoj je tedy „nálada" téhož velitele, ne jiný
algoritmus. To má tři výhody:

1. žádné nové riziko nelegálních tahů (rozhodovací kostra je stejná),
2. každý postoj je čitelný — hráč pozná, že se AI zakopala nebo že zaútočila
   vabank, což je přesně ta věrohodnost, o kterou jde,
3. ladí se tabulkou, ne kódem.

Postoj se vyhodnocuje **deterministicky z aktuálního stavu hry** (žádná paměť
mezi tahy — AI zůstává čistou funkcí). Vstupy se mění po tazích, ne po akcích,
takže postoj přirozeně drží celý tah a nepřeskakuje.

## 11. Vstupy situačního hodnocení

| Vstup | Výpočet | Hodnoty |
|---|---|---|
| **Role v bitvě** `role` | Z rozestavení scénáře (stabilní celou hru): kolik objektivů získatelných pro AI drží na začátku soupeř/nikdo vs. kolik jich AI musí bránit; + kdo má převahu sil na startu. Scénář „dobij most" → AI s mostem je *obránce*, druhá strana *útočník*; bez objektivů → *střetná bitva*. | útočník / obránce / střetná |
| **Bodová situace** `score` | `myNeed = VP_k_výhře − mojeVP`, `enemyNeed` totéž pro soupeře. Porovnání potřeb, ne absolutních bodů. | vedu / vyrovnáno / prohrávám / **kritické** (`enemyNeed ≤ 2` a menší než `myNeed`) |
| **Poměr sil** `force` | Součet (figurky + zdroje) × hodnota typu (tank 1.3, dělo 1.2, pěchota 1.0), můj / soupeřův. Pásma s hysterezí, aby postoj nekmital na hranici. | převaha (≥ 1.3) / vyrovnané / slabší (≤ 0.75) |
| **Fáze hry** `turn` | Číslo tahu. | otevření (1.–2. tah) / střed / — |

## 12. Katalog postojů

Multiplikátory se vztahují k základním vahám `W` z Části I.

### ⚔️ ÚTOK (ofenzíva)
*Kdy: role útočník a neprohrávám kriticky; nebo vyrovnaná střetná bitva s převahou.*
Tempo a zábor prostoru: APPROACH ×1.4, OBJ_CAPTURE ×1.3, PUSH_OFF_OBJ ×1.5,
DANGER ×0.8, MOVE_MARGIN 0.3. Zásobování: těžiště dostává víc (koncentrace).
Take-ground: standardní pravidla. Ústup: standardní.

### 🛡️ OBRANA (pevná obrana)
*Kdy: role obránce a nemám důvod vylézt (neprohrávám, síly vyrovnané či slabší).*
Drž linii a nech soupeře krvácet: APPROACH ×0.5 (jednotky se nehrnou vpřed,
ale objektivy vlastní poloviny stále přitahují), COVER ×1.6, HOLD_OBJ ×1.4,
DANGER ×1.3, MOVE_MARGIN 0.6. Zásobování: dělostřelectvo a posádky objektivů
přednostně. Take-ground: **jen objektivy** (nevylézat ze zákopů za ustupujícím
nepřítelem). Ústup: ochotnější (ztráta jednotky = VP soupeři; pozice ano,
životy ne — kromě objektivů).

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
MOVE_MARGIN 0.1. Take-ground: vždy (i na drát ne — past zůstává pastí).
Ústup: spíše držet pozice a brát ztráty (ustupující jednotka nestřílí a čas
došel). Zásobování: vše do těžiště, žádné rezervy.

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

## 14. Architektura implementace

```
src/logic/aiPosture.ts
  assessSituation(state, rules, ai): Situation   // role, score, force, turn
  selectPosture(sit): Posture                    // tabulka z §13
  type Posture = {
    id: 'utok' | 'obrana' | 'vypad' | 'konsolidace' | 'vabank';
    weights: typeof W;                // přenásobené váhy
    takeGround: 'standard' | 'objectivesOnly' | 'always';
    retreatHoldFactor: number;        // ochota brát ztráty místo ústupu
    supplyFocusShare: number;         // míra koncentrace zásob do těžiště
  };
```

- `chooseAiAction` na začátku spočte postoj a předá ho pod-rozhodovačům;
  konstantu `W` nahradí `posture.weights` (mechanická náhrada, beze změny
  logiky). Vše zůstává čisté a deterministické.
- **UI**: volitelný odznak u indikace tahu („Počítač táhne… · Obrana"), ať
  hráč vidí záměr — výrazně přidává na věrohodnosti a usnadňuje ladění.
- **Roli v bitvě** lze později přepsat polem scénáře (`aiDoctrine` v editoru:
  „braň most za každou cenu"), automatické odvození je jen výchozí.

## 15. Testovací plán

1. **Jednotkové testy matice** — každá řádka §13 (syntetické stavy → očekávaný
   postoj), hystereze na hranici pásem.
2. **Behaviorální dvojice** — tatáž pozice, jiná situace ⇒ jiné rozhodnutí:
   vedoucí AI odmítne riskantní take-ground, prohrávající ho vezme; obránce
   s převahou vyrazí (VÝPAD), bez převahy drží linii.
3. **Simulační matice** — všechny dvojice postojů proti sobě (vynucené
   postoje): každá partie doběhne, žádná nelegální akce; VABANK musí proti
   KONSOLIDACI vykazovat vyšší rozptyl výsledků (riziko funguje).
4. **Regrese Části I** — stávajících 63 testů beze změny (výchozí postoj se
   chová jako dnešní doktrína).

## 16. Možná další rozšíření (mimo tento plán)

- **Osobnosti generálů**: statický multiplikátor nad postoji (agresivní /
  metodický / opatrný) volitelný u scénáře — dvě partie proti „jinému
  generálovi" pak mají jiný charakter i při stejné mapě.
- **Sekční postoje**: držet levé křídlo, tlačit středem — dnešní těžiště
  zásobování rozšířené i na manévr.
- **Vazba na obtížnost**: lehká = bez postojů (dnešní stav), normální =
  postoje, těžká = postoje + 1-ply lookahead.

*Odhad pracnosti: ~200–300 řádků (`aiPosture.ts` + úpravy `ai.ts`) + testy;
riziko nízké — mění se jen váhy, ne rozhodovací kostra.*
