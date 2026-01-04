# Bem-vindo ao Markdown !

Markdown é uma linguagem de marcação fácil usada para formatar texto. Para um vídeo detalhado sobre o que é Markdown, você pode assistir ['Learn Markdown in 30 minutes!'](https://www.youtube.com/watch?v=bTVIMt3XllM), ou melhor ainda, você pode seguir um [tutorial simples](https://www.markdowntutorial.com/nl/). ChatGPT e outros LLMs trabalham com Markdown por padrão (também nas respostas!). Isso facilita copiar e colar o conteúdo deles neste editor de Markdown (no ChatGPT há um ícone de copiar (<span class="pi pi-copy"></span>) em cada resposta).


Agora você pode **exatamente** ver como ficará no site.

## Fundamentos do MarkdownManager (apos a instalacao)

- Criar uma nota: clique em `+MD` na barra superior, escolha uma pasta, informe titulo/slug, salve.
- Abrir notas: use o explorador a esquerda; filtre, ordene e clique em uma nota.
- Salvar: botao Salvar ou atalho.
- Preview: o preview HTML atualiza apos salvar.
- Formatacao: use os botoes para titulos, negrito/italico/sublinhado, listas, citacao, tabela e alinhamento. O alinhamento adiciona `{: class="left|center|right" }`.
- Renomear/excluir: apenas superusuario, botoes acima do explorador para a nota atual.
- Modo WPM: Publicar muda Concept -> Processing; seletor de estado apenas superusuario.
- Exportar/copiar HTML: apenas superusuario quando ativado nas configuracoes.
- Configuracoes: engrenagem para tema, metadados, opcoes WPM e modificador de atalhos.

## Atalhos de teclado

O modificador pode ser configurado em Configuracoes → Atalhos.
`Mod` = Ctrl+Alt (Windows/Linux) ou Ctrl+Command (Mac).

- Mod+S: Salvar
- Mod+H: Substituir
- Mod+R: Repetir a última formatação
- Mod+B: Negrito
- Mod+I: Italico
- Mod+X: Tachado
- Mod+`: Codigo inline
- Mod+L ou Mod+K: Link
- Mod+M: Imagem
- Mod+Q: Citacao
- Mod+U: Lista com marcadores
- Mod+O: Bloco de codigo
- Mod+/: Comentario
- Mod+PageUp: Maiusculas
- Mod+PageDown: Minusculas
- Mod++: Aumentar nivel de titulo
- Mod+-: Diminuir nivel de titulo
- Mod+1..6: Definir nivel de titulo

Abaixo está uma visão geral das opções comuns de formatação Markdown, completa com código de exemplo e o nome de cada formato:

#### 1. Títulos

Markdown suporta seis níveis de títulos, indicados pelo número de símbolos `#`. Cada um tem sua própria função. Veja a explicação abaixo dos títulos.

# Título 1
> Título 1 (começando com `#`) geralmente é usado uma vez como o título do documento (veja acima).

## Título 2
> Título 2 (começando com `##`) é usado como subtítulo

### Título 3
> Título 3 (começando com `###`) normalmente é usado como título de parágrafos. Esses títulos são usados para gerar automaticamente o índice no topo do artigo, abaixo do subtítulo, se necessário.

Aqui está como ficam os outros títulos (quanto mais #, menores eles ficam):
#### Título 4
##### Título 5
###### Título 6
> Títulos 4, 5 e 6 são um pouco maiores do que o texto normal.

### 2. Parágrafos

Parágrafos são simplesmente linhas de texto, separadas por uma ou mais linhas em branco.

Este é um parágrafo. Ele contém texto escrito sem caracteres especiais no início.

### Título de parágrafo
Este é outro parágrafo com um título de parágrafo (Título 3 neste caso).  

### 3. Texto em negrito

O texto pode ficar em negrito ao ser cercado por asteriscos duplos `**` ou underscores duplos `__`.

**Este texto está em negrito.**  
__Este texto também está em negrito.__

### 4. Texto em itálico

O texto pode ficar em itálico ao ser cercado por asteriscos simples `*` ou underscores simples `_`.

*Este texto está em itálico.*  
_Este texto também está em itálico._

### 5. Negrito e itálico

O texto pode ficar em negrito e itálico usando asteriscos triplos `***` ou underscores triplos `___`.

***Este texto está em negrito e itálico.***  
___Este texto também está em negrito e itálico.___

### 6. Citações em bloco

As citações em bloco são feitas com o símbolo `>`.
> Esta é uma citação em bloco. Ela é frequentemente usada para citar texto.

### 7. Quebra&shy;linhas

Use dois espaços no final de uma linha ou uma barra invertida `\` para criar uma quebra&shy;linha.  
Esta é uma linha com uma quebra de linha no final.  
Este texto aparece em uma nova linha.

Ou use uma barra invertida no final da linha \
para criar uma quebra de linha.

> **Hífen inteligente:**
> Existe uma palavra especial ```"&shy;"``` para obter um chamado "hífen suave". Ele só aparece quando necessário em uma palavra longa que precisa ser quebrada. Experimente com palavras muito longas. Isso pode ser muito útil com palavras longas em títulos em uma tela pequena como um celular. (Acima ele é usado com "Quebra&shy;linhas").

### 8. Listas numeradas

As listas numeradas são feitas com números seguidos de ponto.
1. Primeiro item
2. Segundo item
3. Terceiro item

### 9. Listas com marcadores

Listas com marcadores são feitas com asteriscos `*`, sinais de mais `+` ou hífens `-`.
- Primeiro item
- Segundo item
- Terceiro item

* Outro primeiro item  
* Outro segundo item

+ Outro primeiro item  
+ Outro segundo item

### 10. Blocos de código

O código inline é feito com backticks `` ` ``. Blocos de código são feitos com três backticks \``` ou recuando linhas com quatro espaços. Então, código inline: `print('Olá, Mundo!')`

Bloco de código:
```
print('Olá, Mundo!')
```

Alternativamente, você pode usar um bloco de código com "\<code>" <code>como este</code>.

Você também pode usar atalhos de teclado com "\<kbd>", por exemplo <kbd>ctrl+c</kbd> (como se fossem teclas do teclado).

### 11. Linhas horizontais

Linhas horizontais são feitas com três ou mais hífens `---`, asteriscos `***` ou underscores `___`.
___

### 12. Links

Links são feitos com colchetes `[]` para o texto do link e parênteses `()` para a URL. Por exemplo com [OpenAI](https://www.openai.com) (*Veja o markdown para a formatação*).

### 13. Imagens

As imagens parecem links, mas começam com um ponto de exclamação `!`.
![Verdureiro dançante](../static/images/groenteman.png "Verdureiro")

(*Veja o markdown para a formatação*).

> **Truques especiais**
> 1. Selecione palavras e use <kbd>Mod+PageUp</kbd> para MAIUSCULAS ou <kbd>Mod+PageDown</kbd> para minusculas. Ideal para textos do ChatGPT (que tende a usar muitas letras maiusculas na resposta).
> 2. Você pode usar <kbd>Tab</kbd> após uma tag HTML para gerar a tag HTML inteira, por exemplo `span` e depois <kbd>Tab</kbd> gera `<span></span>`.
> 3. Duplique esta aba no navegador e volte a este exemplo para ver como formatar certo texto com Markdown <span style="padding: 0.3rem; border: 2px solid #e5e7eb;border-radius: 5px;">MD</span>;).

### 14. Tabelas

Tabelas são feitas com barras verticais `|` e hífens `-`. Dois-pontos `:` podem ser usados para alinhar colunas.
| Título 1 | Título 2 | Título 3 |
|:---------|:---------:|---------:|
| Esquerda | Centro    | Direita  |
| Linha 1  | dados | dados |
| Linha 2  | dados | dados |

### 15. Texto riscado

Texto riscado é feito com tildes duplos `~~`.
~~Este texto está riscado.~~

### 16. Notas de rodapé

Notas de rodapé são adicionadas usando colchetes com um acento circunflexo `^` dentro.
Aqui está uma frase com uma nota de rodapé.[^1]
Ideal para referências de fonte.

[^1]: Esta é a nota de rodapé feita com o assunto '16. Notas de rodapé'. Aqui está novamente o link para o vídeo de explicação <a href="https://www.youtube.com/watch?v=bTVIMt3XllM" target="_blank" class="externlink">'Learn Markdown in 30 minutes!'</a>.

### 17. Listas de definição

Listas de definição podem ser usadas para definir termos. Cada termo é seguido por dois pontos duplos e sua definição.

**Markdown**: Uma linguagem de marcação leve com uma sintaxe simples para formatação de texto.

**HTML**: A linguagem de marcação padrão para criar páginas web.

### 18. Emojis

Emojis podem ser adicionados com a sintaxe de dois pontos `:`, semelhante ao jeito antigo, como ainda é usado no GitHub: :smile: :heart: :+1: :walking:. Você pode ver a [lista completa de atalhos de emojis do markdown](https://gist.github.com/rxaviers/7360908). Mas você também pode usar os emojis "modernos" como aqui 🤣 😎 👀.

### 19. Elementos HTML

HTML pode ser incorporado diretamente no Markdown se mais controle for necessário (até certo ponto). Por exemplo:
<strong>Negrito com HTML</strong>  
<a href="https://www.example.com" target="_blank" class="externlink">Link com HTML para um site externo</a>, ou um botão **gratuito** com <a href="https://www.voorbeeldlink.com" target="_blank" class="default-button freebutton">Oferta gratuita</a>

Ou um botão normal com <a href="https://www.voorbeeldlink.com" target="_blank" class="default-button">Botão normal</a>
ou você pode fazer um botão relativamente pequeno com 
<a href="https://www.voorbeeldlink.com" target="_blank" class="default-button small-button">botão pequeno</a> no texto.

**Nota**: Nem todo HTML ficará bonito. Pergunte ao webdesigner quando algum HTML não ficar bom.

(*Veja o Markdown para o código HTML*) 

### 20. Escapar caracteres

Use a barra invertida `\` para escapar caracteres especiais do Markdown.
\*Este texto não está em itálico\* (provavelmente é raramente necessário).
