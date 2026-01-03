# Bienvenue dans Markdown !

Markdown est un langage de balisage simple utilisé pour formater du texte. Pour une vidéo détaillée sur ce qu'est Markdown, vous pouvez regarder ['Learn Markdown in 30 minutes!'](https://www.youtube.com/watch?v=bTVIMt3XllM), ou mieux encore, vous pouvez suivre un [tutoriel simple](https://www.markdowntutorial.com/nl/). ChatGPT et d'autres LLM fonctionnent par défaut avec Markdown (également dans leurs sorties !). Cela facilite la copie et le collage de leur contenu dans cet éditeur Markdown (dans ChatGPT, il y a une icône de copie (<span class="pi pi-copy"></span>) pour chaque réponse).


Vous pouvez maintenant **exactement** voir à quoi cela ressemblera sur le site.

## Bases de MarkdownManager (apres installation)

- Creer une note : cliquez sur `+MD` dans la barre du haut, choisissez un dossier, entrez un titre/slug, enregistrez.
- Ouvrir des notes : utilisez l'explorateur a gauche ; filtrez, triez et cliquez sur une note.
- Enregistrer : bouton Enregistrer ou raccourci.
- Apercu : l'apercu HTML se met a jour apres l'enregistrement.
- Mise en forme : utilisez la barre d'outils pour titres, gras/italique/souligne, listes, citation, tableau et alignement. L'alignement ajoute `{: class="left|center|right" }`.
- Renommer/supprimer : superuser uniquement, boutons au-dessus de l'explorateur pour la note courante.
- Mode WPM : Publier passe Concept -> Traitement ; le selecteur d'etat est superuser uniquement.
- Export/copie HTML : superuser uniquement si active dans les reglages.
- Reglages : roue dentee pour theme, metadonnees, options WPM et modificateur de raccourcis.

## Raccourcis clavier

Le modificateur est configurable dans Reglages → Raccourcis clavier.
`Mod` = Ctrl+Alt (Windows/Linux) ou Ctrl+Command (Mac).

- Mod+S : Enregistrer
- Mod+H : Remplacer
- Mod+B : Gras
- Mod+I : Italique
- Mod+X : Barre
- Mod+` : Code inline
- Mod+L ou Mod+K : Lien
- Mod+M : Image
- Mod+Q : Citation
- Mod+U : Liste a puces
- Mod+O : Bloc de code
- Mod+/ : Commentaire
- Mod+PageUp : Majuscules
- Mod+PageDown : Minuscules
- Mod++ : Augmenter le niveau de titre
- Mod+- : Diminuer le niveau de titre
- Mod+1..6 : Definir le niveau de titre

Ci-dessous se trouve un aperçu des options de mise en forme Markdown courantes, avec du code d'exemple et le nom de chaque format :

#### 1. Titres

Markdown prend en charge six niveaux de titres, indiqués par le nombre de symboles `#`. Ils ont chacun leur propre fonction. Voir l'explication sous les titres.

# Titre 1
> Titre 1 (commençant par `#`) est généralement utilisé une seule fois comme titre du document (voir ci-dessus).

## Titre 2
> Titre 2 (commençant par `##`) est utilisé comme sous-titre

### Titre 3
> Titre 3 (commençant par `###`) est normalement utilisé comme titre de paragraphes. Ces titres sont utilisés pour générer automatiquement la table des matières en haut de l'article, sous le sous-titre, si nécessaire.

Voici à quoi ressemblent les autres titres (plus il y a de #, plus ils sont petits) :
#### Titre 4
##### Titre 5
###### Titre 6
> Les titres 4, 5 et 6 sont un peu plus grands que le texte normal.

### 2. Paragraphes

Les paragraphes sont simplement des lignes de texte, séparées par une ou plusieurs lignes vides.

Ceci est un paragraphe. Il contient du texte écrit sans caractères spéciaux au début.

### Titre de paragraphe
Ceci est un autre paragraphe avec un titre de paragraphe (Titre 3 dans ce cas).  

### 3. Texte en gras

Le texte peut être mis en gras en l'entourant de doubles astérisques `**` ou de doubles underscores `__`.

**Ce texte est en gras.**  
__Ce texte est aussi en gras.__

### 4. Texte en italique

Le texte peut être mis en italique en l'entourant d'astérisques simples `*` ou d'underscores simples `_`.

*Ce texte est en italique.*  
_Ce texte est aussi en italique._

### 5. Gras et italique

Le texte peut être à la fois en gras et en italique en utilisant des triples astérisques `***` ou des triples underscores `___`.

***Ce texte est en gras et italique.***  
___Ce texte est aussi en gras et italique.___

### 6. Citations

Les citations sont faites avec le symbole `>`.
> Ceci est une citation. Elle est souvent utilisée pour citer un texte.

### 7. Retours&shy;ligne

Utilisez deux espaces à la fin d'une ligne ou une barre oblique inverse `\` pour créer un retour&shy;ligne.  
Ceci est une ligne avec un retour à la ligne à la fin.  
Ce texte apparaît sur une nouvelle ligne.

Ou utilisez une barre oblique inverse à la fin de la ligne \
pour créer un retour à la ligne.

> **Trait d'union intelligent :**
> Il existe un mot spécial ```"&shy;"``` pour obtenir ce qu'on appelle un "trait d'union doux". Il n'apparaît que lorsqu'il est nécessaire dans un mot long qui doit être coupé. Essayez-le avec des mots très longs. Cela peut être très pratique avec des mots longs dans des titres sur un petit écran comme un téléphone portable. (Ci-dessus il est utilisé avec "Retours&shy;ligne").

### 8. Listes numérotées

Les listes numérotées sont faites avec des nombres suivis d'un point.
1. Premier élément
2. Deuxième élément
3. Troisième élément

### 9. Listes à puces

Les listes à puces sont faites avec des astérisques `*`, des signes plus `+` ou des tirets `-`.
- Premier élément
- Deuxième élément
- Troisième élément

* Un autre premier élément  
* Un autre deuxième élément

+ Un autre premier élément  
+ Un autre deuxième élément

### 10. Blocs de code

Le code en ligne est créé avec des backticks `` ` ``. Les blocs de code sont créés avec des triples backticks \``` ou en indentant les lignes avec quatre espaces. Donc code en ligne : `print('Bonjour, monde!')`

Bloc de code :
```
print('Bonjour, monde!')
```

Sinon, vous pouvez utiliser un bloc de code avec "\<code>" <code>comme ceci</code>.

Vous pouvez aussi utiliser des raccourcis clavier avec "\<kbd>" par exemple <kbd>ctrl+c</kbd> (comme s'il s'agissait de touches du clavier).

### 11. Lignes horizontales

Les lignes horizontales sont faites avec trois tirets ou plus `---`, des astérisques `***` ou des underscores `___`.
___

### 12. Liens

Les liens sont faits avec des crochets `[]` pour le texte du lien et des parenthèses `()` pour l'URL. Par exemple avec [OpenAI](https://www.openai.com) (*Voir le markdown pour le formatage*).

### 13. Images

Les images ressemblent aux liens mais commencent par un point d'exclamation `!`.
![Marchand de légumes dansant](../static/images/groenteman.png "Marchand de légumes")

(*Voir le markdown pour le formatage*).

> **Astuces spéciales**
> 1. Selectionnez des mots et utilisez <kbd>Mod+PageUp</kbd> pour EN MAJUSCULES, ou <kbd>Mod+PageDown</kbd> pour les minuscules. Ideal pour les textes de ChatGPT (qui a tendance a utiliser trop de majuscules dans sa reponse).
> 2. Vous pouvez utiliser <kbd>Tab</kbd> après une balise HTML pour produire la balise HTML complète, par ex. `span` puis <kbd>Tab</kbd> donne `<span></span>`.
> 3. Dupliquez cet onglet dans le navigateur et revenez à cet exemple pour voir comment formater certains textes avec Markdown <span style="padding: 0.3rem; border: 2px solid #e5e7eb;border-radius: 5px;">MD</span>;).

### 14. Tableaux

Les tableaux sont faits avec des barres verticales `|` et des tirets `-`. Les deux-points `:` peuvent être utilisés pour aligner les colonnes.
| Titre 1 | Titre 2 | Titre 3 |
|:---------|:---------:|---------:|
| Gauche   | Centre    | Droite   |
| Ligne 1  | data | data |
| Ligne 2  | data | data |

### 15. Texte barré

Le texte barré est fait avec des doubles tildes `~~`.
~~Ce texte est barré.~~

### 16. Notes de bas de page

Les notes de bas de page sont ajoutées en utilisant des crochets avec un caret `^` à l'intérieur.
Voici une phrase avec une note de bas de page.[^1]
Idéal pour les références de source.

[^1]: Ceci est la note de bas de page faite avec le sujet '16. Notes de bas de page'. Voici à nouveau le lien vers la vidéo d'explication <a href="https://www.youtube.com/watch?v=bTVIMt3XllM" target="_blank" class="externlink">'Learn Markdown in 30 minutes!'</a>.

### 17. Listes de définition

Les listes de définition peuvent être utilisées pour définir des termes. Chaque terme est suivi d'un double deux-points et de sa définition.

**Markdown**: Un langage de balisage léger avec une syntaxe simple pour la mise en forme du texte.

**HTML**: Le langage de balisage standard pour créer des pages web.

### 18. Emojis

Les emojis peuvent être ajoutés avec la syntaxe des deux-points `:`, similaire à l'ancienne façon, comme elle est encore utilisée sur GitHub: :smile: :heart: :+1: :walking:. Vous pouvez consulter la [liste complète des raccourcis d'emojis markdown](https://gist.github.com/rxaviers/7360908). Mais vous pouvez aussi utiliser les emojis "modernes" comme ici 🤣 😎 👀.

### 19. Éléments HTML

Le HTML peut être intégré directement dans Markdown si plus de contrôle est nécessaire (dans une certaine mesure). Par exemple :
<strong>Gras avec HTML</strong>  
<a href="https://www.example.com" target="_blank" class="externlink">Lien avec HTML vers un site externe</a>, ou un bouton **gratuit** avec <a href="https://www.voorbeeldlink.com" target="_blank" class="default-button freebutton">Offre gratuite</a>

Ou un bouton normal avec <a href="https://www.voorbeeldlink.com" target="_blank" class="default-button">Bouton normal</a>
ou vous pouvez faire un bouton relativement petit avec 
<a href="https://www.voorbeeldlink.com" target="_blank" class="default-button small-button">petit bouton</a> dans le texte.

**Note**: Tout le HTML n'aura pas un bon rendu. Demandez au webdesigner quand certains éléments HTML ne rendent pas bien.

(*Voir le Markdown pour le code HTML*) 

### 20. Échapper les caractères

Utilisez la barre oblique inverse `\` pour échapper les caractères spéciaux Markdown.
\*Ce texte n'est pas en italique\* (c'est probablement rarement nécessaire).
