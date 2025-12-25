# Willkommen bei Markdown !

Markdown ist eine einfache Auszeichnungssprache, die zum Formatieren von Text verwendet wird. Für ein ausführliches Video darüber, was Markdown ist, kannst du ['Learn Markdown in 30 minutes!'](https://www.youtube.com/watch?v=bTVIMt3XllM) ansehen, oder besser noch, du kannst ein [einfaches Tutorial](https://www.markdowntutorial.com/nl/) durchlaufen. ChatGPT und andere LLMs arbeiten standardmäßig mit Markdown (auch in ihren Ausgaben!). Das macht es einfach, ihre Inhalte in diesen Markdown-Editor zu kopieren und einzufügen (in ChatGPT gibt es ein Kopiersymbol (<span class="pi pi-copy"></span>) bei jeder Antwort).


Du kannst jetzt **genau** sehen, wie es auf der Website aussehen wird.

Unten findest du einen Überblick über die gängigen Markdown-Formatierungsoptionen, komplett mit Beispielcode und dem Namen jedes Formats:

#### 1. Überschriften

Markdown unterstützt sechs Ebenen von Überschriften, die durch die Anzahl der `#`-Symbole angegeben werden. Sie haben jeweils ihre eigene Funktion. Siehe die Erklärung unter den Überschriften.

# Überschrift 1
> Überschrift 1 (beginnt mit `#`) wird normalerweise einmal als Titel des Dokuments verwendet (siehe oben).

## Überschrift 2
> Überschrift 2 (beginnt mit `##`) wird als Untertitel verwendet

### Überschrift 3
> Überschrift 3 (beginnt mit `###`) wird normalerweise als Überschrift für Absätze verwendet. Diese Überschriften werden verwendet, um das Inhaltsverzeichnis oben im Artikel unter dem Untertitel automatisch zu erzeugen, falls nötig.

Hier siehst du, wie die anderen Überschriften aussehen (je mehr #, desto kleiner werden sie):
#### Überschrift 4
##### Überschrift 5
###### Überschrift 6
> Überschriften 4, 5 und 6 sind etwas größer als normaler Text.

### 2. Absätze

Absätze sind einfach Textzeilen, getrennt durch eine oder mehrere Leerzeilen.

Dies ist ein Absatz. Er enthält Text, der ohne vorangestellte Sonderzeichen geschrieben ist.

### Absatzüberschrift
Dies ist ein weiterer Absatz mit einer Absatzüberschrift (in diesem Fall Überschrift 3).  

### 3. Fetter Text

Text kann fett dargestellt werden, indem man ihn mit doppelten Sternchen `**` oder doppelten Unterstrichen `__` umgibt.

**Dieser Text ist fett.**  
__Dieser Text ist ebenfalls fett.__

### 4. Kursiver Text

Text kann kursiv dargestellt werden, indem man ihn mit einzelnen Sternchen `*` oder einzelnen Unterstrichen `_` umgibt.

*Dieser Text ist kursiv.*  
_Dieser Text ist ebenfalls kursiv._

### 5. Fett und kursiv

Text kann sowohl fett als auch kursiv sein, indem man dreifache Sternchen `***` oder dreifache Unterstriche `___` verwendet.

***Dieser Text ist fett und kursiv.***  
___Dieser Text ist ebenfalls fett und kursiv.___

### 6. Blockzitate

Blockzitate werden mit dem Symbol `>` erstellt.
> Dies ist ein Blockzitat. Es wird oft verwendet, um Text zu zitieren.

### 7. Zeilen&shy;umbrüche

Verwende zwei Leerzeichen am Ende einer Zeile oder einen Backslash `\`, um einen Zeilen&shy;umbruch zu erzeugen.  
Dies ist eine Zeile mit einem Zeilenumbruch am Ende.  
Dieser Text erscheint in einer neuen Zeile.

Oder verwende einen Backslash am Ende der Zeile \
um einen Zeilenumbruch zu erzeugen.

> **Weicher Trennstrich:**
> Es gibt ein spezielles Wort ```"&shy;"``` um einen sogenannten "weichen Trennstrich" zu erhalten. Er erscheint nur, wenn er in einem langen Wort benötigt wird, das getrennt werden muss. Probiere es mit extra langen Wörtern. Das kann sehr praktisch sein bei langen Wörtern in Überschriften auf einem kleinen Bildschirm wie einem Handy. (Oben ist er mit "Zeilen&shy;umbrüche" verwendet).

### 8. Nummerierte Listen

Nummerierte Listen werden mit Zahlen gefolgt von einem Punkt erstellt.
1. Erstes Element
2. Zweites Element
3. Drittes Element

### 9. Aufzählungen

Aufzählungen werden mit Sternchen `*`, Pluszeichen `+` oder Bindestrichen `-` erstellt.
- Erstes Element
- Zweites Element
- Drittes Element

* Ein weiteres erstes Element  
* Ein weiteres zweites Element

+ Ein weiteres erstes Element  
+ Ein weiteres zweites Element

### 10. Codeblöcke

Inline-Code wird mit Backticks `` ` `` erstellt. Codeblöcke werden mit dreifachen Backticks \``` oder durch Einrücken von Zeilen mit vier Leerzeichen erstellt. Also Inline-Code: `print('Hallo, Welt!')`

Codeblock:
```
print('Hallo, Welt!')
```

Alternativ kannst du einen Codeblock mit "\<code>" <code>wie hier</code> verwenden.

Du kannst auch Tastenkürzel mit "\<kbd>" verwenden, zum Beispiel <kbd>ctrl+c</kbd> (als ob es Tastaturtasten wären).

### 11. Horizontale Linien

Horizontale Linien werden mit drei oder mehr Bindestrichen `---`, Sternchen `***` oder Unterstrichen `___` erstellt.
___

### 12. Links

Links werden mit eckigen Klammern `[]` für den Linktext und runden Klammern `()` für die URL erstellt. Zum Beispiel mit [OpenAI](https://www.openai.com) (*Siehe das Markdown für die Formatierung*).

### 13. Bilder

Bilder sehen aus wie Links, beginnen aber mit einem Ausrufezeichen `!`.
![Tanzender Gemüsehändler](../static/images/groenteman.png "Gemüsehändler")

(*Siehe das Markdown für die Formatierung*).

> **Spezielle Tricks**
> 1. Wenn du im Markdown Wörter auswählst und dann <kbd>ctrl-shift- +</kbd> drückst, werden sie ALLES GROSS, und <kbd>ctrl-shift- -</kbd> macht sie klein. Ideal für Texte von ChatGPT (das dazu neigt, in seiner Antwort zu viele Großbuchstaben zu verwenden).
> 2. Du kannst <kbd>Tab</kbd> nach einem HTML-Tag verwenden, um das ganze HTML-Tag zu erzeugen, z. B. `span` und dann <kbd>Tab</kbd> ergibt `<span></span>`.
> 3. Dupliziere diesen Tab im Browser und komme zu diesem Beispiel zurück, um zu sehen, wie man bestimmten Text mit Markdown formatiert <span style="padding: 0.3rem; border: 2px solid #e5e7eb;border-radius: 5px;">MD</span>;).

### 14. Tabellen

Tabellen werden mit senkrechten Strichen `|` und Bindestrichen `-` erstellt. Doppelpunkte `:` können verwendet werden, um Spalten auszurichten.
| Überschrift 1 | Überschrift 2 | Überschrift 3 |
|:---------|:---------:|---------:|
| Links        | Mitte         | Rechts        |
| Zeile 1      | Daten | Daten |
| Zeile 2      | Daten | Daten |

### 15. Durchgestrichener Text

Durchgestrichener Text wird mit doppelten Tilden `~~` erstellt.
~~Dieser Text ist durchgestrichen.~~

### 16. Fußnoten

Fußnoten werden mit eckigen Klammern mit einem Caret `^` darin hinzugefügt.
Hier ist ein Satz mit einer Fußnote.[^1]
Ideal für Quellenangaben.

[^1]: Dies ist die Fußnote mit dem Thema '16. Fußnoten'. Hier noch einmal der Link zum Erklärungsvideo <a href="https://www.youtube.com/watch?v=bTVIMt3XllM" target="_blank" class="externlink">'Learn Markdown in 30 minutes!'</a>.

### 17. Definitionslisten

Definitionslisten können verwendet werden, um Begriffe zu definieren. Jeder Begriff wird von einem doppelten Doppelpunkt und seiner Definition gefolgt.

**Markdown**: Eine leichtgewichtige Auszeichnungssprache mit einer einfachen Syntax zur Textformatierung.

**HTML**: Die Standard-Auszeichnungssprache zum Erstellen von Webseiten.

### 18. Emojis

Emojis können mit der Doppelpunkt-`:`-Syntax hinzugefügt werden, ähnlich wie früher, wie sie noch auf GitHub verwendet wird: :smile: :heart: :+1: :walking:. Du kannst die [vollständige Shortcut-Liste der Markdown-Emojis](https://gist.github.com/rxaviers/7360908) ansehen. Aber du kannst auch die "modernen" Emojis wie hier verwenden 🤣 😎 👀.

### 19. HTML-Elemente

HTML kann direkt in Markdown eingebettet werden, wenn mehr Kontrolle nötig ist (bis zu einem gewissen Grad). Zum Beispiel:
<strong>Fett mit HTML</strong>  
<a href="https://www.example.com" target="_blank" class="externlink">Link mit HTML zu einer externen Seite</a>, oder ein **kostenloser** Button mit <a href="https://www.voorbeeldlink.com" target="_blank" class="default-button freebutton">Kostenloses Angebot</a>

Oder ein normaler Button mit <a href="https://www.voorbeeldlink.com" target="_blank" class="default-button">Normaler Button</a>
oder du kannst einen relativ kleinen Button machen mit 
<a href="https://www.voorbeeldlink.com" target="_blank" class="default-button small-button">kleiner Button</a> im Text.

**Hinweis**: Nicht jedes HTML sieht gut aus. Frag den Webdesigner, wenn bestimmtes HTML nicht richtig aussieht.

(*Siehe das Markdown für den HTML-Code*) 

### 20. Zeichen escapen

Verwende den Backslash `\`, um spezielle Markdown-Zeichen zu escapen.
\*Dieser Text ist nicht kursiv\* (ist wahrscheinlich selten nötig).
