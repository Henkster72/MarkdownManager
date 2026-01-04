# Welkom bij Markdown !

Markdown is een makkelijke opmaaktaal die gebruikt wordt om tekst te formatteren. Voor een uitgebreide video over wat Markdown is, kun je ['Learn Markdown in 30 minutes!'](https://www.youtube.com/watch?v=bTVIMt3XllM) bekijken, of beter nog, je kunt een [simpele tutorial doorlopen](https://www.markdowntutorial.com/nl/). ChatGPT en andere LLM's werken standaard met Markdown (ook in hun output!). Dat maakt het makkelijk om de inhoud ervan te kopiëren en plakken in deze Markdowneditor (Bij ChatGPT staat een kopieericoon (<span class="pi pi-copy"></span> bij elke response).


Je kunt nu **precies** zien hoe het op de site er uitgaat zien.

## MarkdownManager basis (na installatie)

- Maak een notitie: klik `+MD` in de bovenbalk, kies een map, voer een titel/slug in, sla op.
- Notities openen: gebruik links de verkenner; filter, sorteer en klik op een notitie.
- Opslaan: gebruik de Opslaan-knop of de sneltoets hieronder.
- Voorbeeld: het HTML-voorbeeld ververst na opslaan.
- Opmaak: gebruik de knoppen voor koppen, vet/cursief/onderstreep, lijsten, citaat, tabel en uitlijning. Uitlijning voegt `{: class="left|center|right" }` toe.
- Hernoemen/verwijderen: alleen superuser, knoppen boven de verkenner voor de huidige notitie.
- WPM-modus: Publiceer zet Concept -> Verwerking; de statuskeuze is alleen voor superuser.
- HTML export/kopie: alleen superuser wanneer ingeschakeld in Instellingen.
- Instellingen: gebruik het tandwiel voor thema, metadata, WPM-opties en sneltoets-modifier.

## Sneltoetsen

Sneltoets-modifier is instelbaar in Instellingen → Sneltoetsen.
`Mod` = Ctrl+Alt (Windows/Linux) of Ctrl+Command (Mac).

- Mod+S: Opslaan
- Mod+H: Vervang-venster
- Mod+R: Laatste opmaak herhalen
- Mod+B: Vet
- Mod+I: Cursief
- Mod+X: Doorhalen
- Mod+`: Inline code
- Mod+L of Mod+K: Link-venster
- Mod+M: Afbeelding-venster
- Mod+Q: Citaatblok
- Mod+U: Ongenummerde lijst
- Mod+O: Codeblok
- Mod+/: Commentaar
- Mod+PageUp: Hoofdletters
- Mod+PageDown: Kleine letters
- Mod++: Kopniveau omhoog
- Mod+-: Kopniveau omlaag
- Mod+1..6: Kopniveau instellen

Hieronder volgt een overzicht van de gangbare Markdown-opmaakopties, compleet met voorbeeldcode en de naam van elk formaat:

#### 1. Koppen

Markdown ondersteunt zes niveaus van koppen, aangeduid door het aantal `#`-symbolen. Ze hebben allemaal hun eigen functie. Zie de uitleg onder de kopjes. 

# Kop 1
> Kop 1 (beginnend met `#`) wordt meestal eenmalig gebruikt als titel van het document (zie hierboven).

## Kop 2
> Kop 2 (beginnend met `##`) wordt gebruikt als subtitel

### Kop 3
> Kop 3 (beginnend met `###`) wordt normaal gesproken gebruikt als kop voor alinea's. Deze koppen worden gebruikt om de inhoudsopgave automatisch te genereren bovenin het artikel, onder de subtitel, mocht dat nodig zijn.

Zo zien de andere koppen eruit (hoe meer # hoe kleiner ze worden):
#### Kop 4
##### Kop 5
###### Kop 6
> Koppen 4, 5 en 6 zijn ietsjes groter dan normale tekst.

### 2. Alinea's

Alinea's zijn simpelweg regels tekst, gescheiden door een of meer lege regels.

Dit is een alinea. Het bevat tekst die geschreven is zonder voorafgaande speciale tekens.

### Alineakop
Dit is een andere alinea met een alinea kop (Kop 3 in dit geval).  

### 3. Vette tekst

Tekst kan vetgedrukt worden door deze te omringen met dubbele asterisken `**` of dubbele underscores `__`.

**Deze tekst is vet.**  
__Deze tekst is ook vet.__

### 4. Cursieve tekst

Tekst kan cursief gemaakt worden door deze te omringen met enkele asterisken `*` of enkele underscores `_`.

*Deze tekst is cursief.*  
_Deze tekst is ook cursief._

### 5. Vet en Cursief

Tekst kan zowel vet als cursief worden gemaakt door gebruik te maken van drievoudige asterisken `***` of drievoudige underscores `___`.

***Deze tekst is vet en cursief.***  
___Deze tekst is ook vet en cursief.___

### 6. Citaatblokken

Citaatblokken worden gemaakt met het `>`-symbool.
> Dit is een citaatblok. Het wordt vaak gebruikt om tekst te citeren.

### 7. Regel&shy;afbrekingen

Gebruik twee spaties aan het einde van een regel of een backslash `\` om een regel&shy;afbreking te maken.  
Dit is een regel met een regelafbreking aan het einde.  
Deze tekst verschijnt op een nieuwe regel.

Of gebruik een backslash aan het einde van de regel \
om een regelafbreking te maken.

> **Slim koppelteken:**
> Er is een speciaal woord ```"&shy;"``` om een zogenaamd "zacht koppelteken" te krijgen. Het verschijnt alleen wanneer dat nodig is bij een lang woord dat afgebroken moet worden. Probeer het met extra lange woorden. Dat kan heel handig zijn met lange woorden in koppen op een kleine schermpje zoals een mobieltje.  (Hierboven is het gebruikt met "Regel­afbrekingen").

### 8. Genummerde lijsten

Genummerde lijsten worden gemaakt met nummers gevolgd door een punt.
1. Eerste item
2. Tweede item
3. Derde item

### 9. Ongenummerde lijsten

Ongenummerde lijsten worden gemaakt met asterisken `*`, plustekens `+` of streepjes `-`.
- Eerste item
- Tweede item
- Derde item

* Nog een eerste item  
* Nog een tweede item

+ Nog een eerste item  
+ Nog een tweede item

### 10. Codeblokken

Inline code wordt gemaakt met backticks `` ` ``. Codeblokken worden gemaakt met drievoudige backticks \``` of door regels in te springen met vier spaties. Dus inline code: `print('Hallo, Wereld!')`

Codeblok:
```
print('Hallo, Wereld!')
```

Als alternatief kun je een codeblok gebruiken met "\<code>" <code>zoals dit</code>.

Ook kun je sneltoetsen gebruiken met "\<kbd>" bijvoorbeeld <kbd>ctrl+c</kbd> (alsof het toetsenbordtoetsen zijn).

### 11. Horizontale regels

Horizontale regels worden gemaakt met drie of meer streepjes `---`, asterisken `***` of underscores `___`.
___

### 12. Links

Links worden gemaakt met vierkante haakjes `[]` voor de linktekst en haakjes `()` voor de URL. Bijvoorbeeld met [OpenAI](https://www.openai.com) (*Zie de markdown voor opmaak*).

### 13. Afbeeldingen

Afbeeldingen lijken op links maar beginnen met een uitroepteken `!`.
![Dansende groenteman](../static/images/groenteman.png "Groenteman")

(*Zie de markdown voor opmaak*).

> **Speciale truukjes** 
> 1. Selecteer woorden en gebruik <kbd>Mod+PageUp</kbd> voor HOOFDLETTERS, of <kbd>Mod+PageDown</kbd> voor kleine letters. Ideaal voor teksten van ChatGPT (die de neiging heeft om overbodig veel hoofdletters te gebruiken in zijn response).
> 2. Je kunt met <kbd>Tab</kbd> achter een HTML tag, meteen de hele html tag produceren zoals `span` en dan <kbd>Tab</kbd>, geeft `<span></span>`.
> 3. Dupliceer dit tabblad in de browser en kom naar dit voorbeeld terug om te kijken hoe je bepaalde tekst formatteert met Markdown <span style="padding: 0.3rem; border: 2px solid #e5e7eb;border-radius: 5px;">MD</span>;).

### 14. Tabellen

Tabellen worden gemaakt met pijptekens `|` en streepjes `-`. Dubbele punten `:` kunnen worden gebruikt om kolommen uit te lijnen.
| Kop 1   | Kop 2    | Kop 3    |
|:--------|:--------:|---------:|
| Links   | Midden   | Rechts   |
| Rij 1   | data | data |
| Rij 2   | data | data |

### 15. Doorhalen

Doorhaalde tekst wordt gemaakt met dubbele tildes `~~`.
~~Deze tekst is doorgestreept.~~ 

### 16. Voetnoten

Voetnoten worden toegevoegd met behulp van vierkante haakjes met een dakje `^` erin.
Hier is een zin met een voetnoot.[^1]
Ideaal voor bronverwijzingen.

[^1]: Dit is de voetnoot gemaakt met het onderwerp '16. Voetnoten'. Hier staat nog een keer de link naar de uitleg video <a href="https://www.youtube.com/watch?v=bTVIMt3XllM" target="_blank" class="externlink">'Learn Markdown in 30 minutes!'</a>.

### 17. Definitielijsten

Definitielijsten kunnen worden gebruikt om termen te definiëren. Elke term wordt gevolgd door een dubbele punt en de definitie ervan.

**Markdown**: Een lichtgewichte opmaaktaal met een eenvoudige syntaxis voor tekstopmaak.

**HTML**: De standaard opmaaktaal voor het maken van webpagina's.

### 18. Emoji's

Emoji's kunnen worden toegevoegd met de dubbele punt `:` syntaxis, vergelijkbaar met de oude manier van doen, zoals het nog op GitHub wordt gebruikt: :smile: :heart: :+1: :walking:. Je kunt hier de [complete shortcut lijst van markdown emoji's](https://gist.github.com/rxaviers/7360908) bekijken. Maar je kunt ook de "moderne" emoji's gebruiken zoals hier 🤣 😎 👀. 

### 19. HTML-elementen

HTML kan direct in Markdown worden ingesloten als er meer controle nodig is (tot bepaalde hoogte). Bijvoorbeeld:
<strong>Vet met HTML</strong>  
<a href="https://www.example.com" target="_blank" class="externlink">Link met HTML naar een externe site</a>, of een **gratis** button met <a href="https://www.voorbeeldlink.com" target="_blank" class="default-button freebutton">Gratis aanbod</a>

Of een normale button met <a href="https://www.voorbeeldlink.com" target="_blank" class="default-button">Normale button</a>
of je kunt een relatieve kleine button maken met 
<a href="https://www.voorbeeldlink.com" target="_blank" class="default-button small-button">kleine button</a> in de tekst.

**Let op**: Niet alle HTML gaat er goed uitzien. Vraag de webdesigner wanneer bepaalde HTML er niet goed uitziet.
 
(*Zie de Markdown voor de HTML code*) 

### 20. Escapen van tekens

Gebruik de backslash `\` om speciale Markdown-tekens te escapen.
\*Deze tekst is niet cursief\* (waarschijnlijk is het zelden nodig).
