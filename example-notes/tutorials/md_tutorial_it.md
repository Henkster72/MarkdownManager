# Benvenuto in Markdown !

Markdown e un linguaggio di markup semplice usato per formattare testo. Per un video dettagliato su cos e Markdown, puoi guardare ['Learn Markdown in 30 minutes!'](https://www.youtube.com/watch?v=bTVIMt3XllM), o meglio ancora, puoi seguire un [tutorial semplice](https://www.markdowntutorial.com/nl/). ChatGPT e altri LLM lavorano con Markdown di default (anche nelle loro risposte). Questo rende facile copiare e incollare i contenuti in questo editor Markdown (in ChatGPT c'e una icona copia (<span class="pi pi-copy"></span>) per ogni risposta).


Ora puoi vedere **esattamente** come apparira sul sito.

## Fondamenti di MarkdownManager (dopo l'installazione)

- Crea una nota: clicca `+MD` nella barra in alto, scegli una cartella, inserisci titolo/slug, salva.
- Apri note: usa l'esploratore a sinistra; filtra, ordina e clicca una nota.
- Salva: bottone Salva o scorciatoia.
- Anteprima: l'anteprima HTML si aggiorna dopo il salvataggio.
- Formattazione: usa i bottoni per titoli, grassetto/corsivo/sottolineato, liste, citazione, tabella e allineamento. L'allineamento aggiunge `{: class="left|center|right" }`.
- Rinomina/elimina: solo superuser, bottoni sopra l'esploratore per la nota corrente.
- Modalita WPM: Pubblica passa Concept -> Processing; il selettore di stato e solo superuser.
- Export/copia HTML: solo superuser quando abilitato in Impostazioni.
- Impostazioni: usa l'icona ingranaggio per tema, metadati, opzioni WPM e modificatore scorciatoie.

## Scorciatoie da tastiera

Il modificatore si configura in Impostazioni -> Scorciatoie da tastiera.
`Mod` = Ctrl+Alt (Windows/Linux) o Ctrl+Command (Mac).

- Mod+S: Salva
- Mod+H: Sostituisci
- Mod+B: Grassetto
- Mod+I: Corsivo
- Mod+X: Barrato
- Mod+`: Codice inline
- Mod+L o Mod+K: Link
- Mod+M: Immagine
- Mod+Q: Citazione
- Mod+U: Lista puntata
- Mod+O: Blocco di codice
- Mod+/: Commento
- Mod+PageUp: Maiuscole
- Mod+PageDown: Minuscole
- Mod++: Aumenta livello titolo
- Mod+-: Riduci livello titolo
- Mod+1..6: Imposta livello titolo

Di seguito trovi una panoramica delle opzioni comuni di formattazione Markdown, con codice di esempio e il nome di ogni formato:

#### 1. Titoli

Markdown supporta sei livelli di titoli, indicati dal numero di simboli `#`. Ognuno ha la sua funzione. Vedi la spiegazione sotto i titoli.

# Titolo 1
> Titolo 1 (inizia con `#`) di solito si usa una sola volta come titolo del documento (vedi sopra).

## Titolo 2
> Titolo 2 (inizia con `##`) si usa come sottotitolo

### Titolo 3
> Titolo 3 (inizia con `###`) si usa normalmente come titolo di paragrafo. Questi titoli generano automaticamente il sommario in alto, sotto il sottotitolo, se necessario.

Ecco come appaiono gli altri titoli (piu #, piu piccoli):
#### Titolo 4
##### Titolo 5
###### Titolo 6
> I titoli 4, 5 e 6 sono un po piu grandi del testo normale.

### 2. Paragrafi

I paragrafi sono semplicemente righe di testo, separate da una o piu righe vuote.

Questo e un paragrafo. Contiene testo scritto senza caratteri speciali iniziali.

### Titolo del paragrafo
Questo e un altro paragrafo con un titolo di paragrafo (Titolo 3 in questo caso).  

### 3. Testo in grassetto

Il testo puo diventare grassetto circondandolo con doppio asterisco `**` o doppio underscore `__`.

**Questo testo e in grassetto.**  
__Questo testo e anche in grassetto.__

### 4. Testo in corsivo

Il testo puo diventare corsivo circondandolo con un solo asterisco `*` o un solo underscore `_`.

*Questo testo e in corsivo.*  
_Questo testo e anche in corsivo._

### 5. Grassetto e corsivo

Il testo puo essere sia grassetto che corsivo usando triplo asterisco `***` o triplo underscore `___`.

***Questo testo e in grassetto e corsivo.***  
___Questo testo e anche in grassetto e corsivo.___

### 6. Citazioni

Le citazioni si creano con il simbolo `>`.
> Questa e una citazione. Si usa spesso per citare testo.

### 7. Interruzioni di linea

Usa due spazi alla fine di una linea o un backslash `\` per creare un salto di linea.  
Questa e una linea con un salto alla fine.  
Questo testo appare su una nuova linea.

Oppure usa un backslash alla fine della linea \
per creare un salto di linea.

> **Trattino morbido:**
> Esiste una parola speciale ```"&shy;"``` per ottenere un "trattino morbido". Compare solo quando serve spezzare una parola lunga. Provalo con parole molto lunghe. Puo essere utile nei titoli su schermi piccoli come un cellulare. (Sopra e usato con "Interruzioni di linea").

### 8. Liste numerate

Le liste numerate si fanno con numeri seguiti da un punto.
1. Primo elemento
2. Secondo elemento
3. Terzo elemento

### 9. Liste puntate

Le liste puntate si fanno con asterischi `*`, segni `+` o trattini `-`.
- Primo elemento
- Secondo elemento
- Terzo elemento

* Un altro primo elemento  
* Un altro secondo elemento

+ Un altro primo elemento  
+ Un altro secondo elemento

### 10. Blocchi di codice

Il codice inline si fa con backtick `` ` ``. I blocchi di codice si fanno con triple backtick \``` o indentando le righe con quattro spazi. Quindi inline: `print('Hello, World!')`

Blocco di codice:
```
print('Hello, World!')
```

In alternativa, puoi usare un blocco con "\<code>" <code>cosi</code>.

Puoi anche usare scorciatoie con "\<kbd>" per esempio <kbd>ctrl+c</kbd> (come se fossero tasti).

### 11. Linee orizzontali

Le linee orizzontali si fanno con tre o piu trattini `---`, asterischi `***` o underscore `___`.
___

### 12. Link

I link si fanno con parentesi quadre `[]` per il testo e parentesi `()` per la URL. Per esempio [OpenAI](https://www.openai.com) (*vedi il markdown per il formato*).

### 13. Immagini

Le immagini sono come i link ma iniziano con un punto esclamativo `!`.
![Dancing greengrocer](../static/images/groenteman.png "Greengrocer")

(*Vedi il markdown per il formato*).

> **Trucchi speciali**
> 1. Seleziona parole e usa <kbd>Mod+PageUp</kbd> per MAIUSCOLE, o <kbd>Mod+PageDown</kbd> per minuscole. Ideale per testi di ChatGPT (che tende a usare troppe maiuscole nelle risposte).
> 2. Puoi usare <kbd>Tab</kbd> dopo un tag HTML per completare il tag, per esempio `span` e poi <kbd>Tab</kbd> produce `<span></span>`.
> 3. Duplica questa scheda del browser e torna a questo esempio per vedere come formattare testo con Markdown <span style="padding: 0.3rem; border: 2px solid #e5e7eb;border-radius: 5px;">MD</span>.

### 14. Tabelle

Le tabelle si fanno con barre `|` e trattini `-`. I due punti `:` possono essere usati per allineare le colonne.
| Titolo 1 | Titolo 2 | Titolo 3 |
|:---------|:---------:|---------:|
| Sinistra | Centro | Destra |
| Riga 1 | dato | dato |
| Riga 2 | dato | dato |

### 15. Testo barrato

Il testo barrato si fa con doppia tilde `~~`.
~~Questo testo e barrato.~~

### 16. Note a pie di pagina

Le note a pie di pagina si aggiungono usando parentesi quadre con un caret `^`.
Ecco una frase con nota a pie di pagina.[^1]
Ideale per riferimenti alle fonti.

[^1]: Questa e la nota a pie di pagina creata con il tema '16. Note a pie di pagina'. Ecco di nuovo il link al video di spiegazione <a href="https://www.youtube.com/watch?v=bTVIMt3XllM" target="_blank" class="externlink">'Learn Markdown in 30 minutes!'</a>.

### 17. Liste di definizioni

Le liste di definizioni possono essere usate per definire termini. Ogni termine e seguito da due punti e la sua definizione.

**Markdown**: Un linguaggio di markup leggero con sintassi semplice per formattare testo.

**HTML**: Il linguaggio di markup standard per creare pagine web.

### 18. Emoji

Le emoji possono essere aggiunte con la sintassi a due punti `:`, come su GitHub: :smile: :heart: :+1: :walking:. Puoi vedere la [lista completa delle scorciatoie emoji](https://gist.github.com/rxaviers/7360908).

### 19. Elementi HTML

HTML puo essere incorporato direttamente in Markdown se serve piu controllo (in parte). Per esempio:
<strong>Grassetto con HTML</strong>  
<a href="https://www.example.com" target="_blank" class="externlink">Link HTML a un sito esterno</a>, o un bottone **gratis** con <a href="https://www.voorbeeldlink.com" target="_blank" class="default-button freebutton">Offerta gratis</a>

Oppure un bottone normale con <a href="https://www.voorbeeldlink.com" target="_blank" class="default-button">Bottone normale</a>
oppure puoi creare un bottone piu piccolo con 
<a href="https://www.voorbeeldlink.com" target="_blank" class="default-button small-button">bottone piccolo</a> nel testo.

**Nota**: Non tutto l'HTML apparira bene. Chiedi al web designer quando qualcosa non appare bene.

(*Vedi il Markdown per il codice HTML*) 

### 20. Escape dei caratteri

Usa il backslash `\` per fare escape dei caratteri speciali Markdown.
\*Questo testo non e corsivo\* (probabilmente raro).
