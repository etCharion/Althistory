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
