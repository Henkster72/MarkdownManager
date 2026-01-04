# Welcome to Markdown !

Markdown is an easy markup language used to format text. For a detailed video about what Markdown is, you can watch ['Learn Markdown in 30 minutes!'](https://www.youtube.com/watch?v=bTVIMt3XllM), or better yet, you can go through a [simple tutorial](https://www.markdowntutorial.com/nl/). ChatGPT and other LLMs work with Markdown by default (also in their output!). That makes it easy to copy and paste their content into this Markdown editor (In ChatGPT there is a copy icon (<span class="pi pi-copy"></span> by each response).


You can now **exactly** see how it will look on the site.

## MarkdownManager basics (after installation)

- Create a note: click `+MD` in the top bar, choose a folder, enter a title/slug, save.
- Open notes: use the left explorer; filter, sort, and click a note.
- Save: use the Save button or the shortcut below.
- Preview: HTML preview updates after saving.
- Format: use the toolbar buttons for headings, bold/italic/underline, lists, quote, table, and alignment. Alignment inserts `{: class="left|center|right" }`.
- Rename/delete: superuser-only buttons above the explorer for the current note.
- WPM mode: Publish sends Concept -> Processing; the state selector is superuser-only.
- HTML export/copy: superuser-only when enabled in Settings.
- Settings: use the gear icon for theme, metadata, WPM options, and shortcut modifier.

## Keyboard shortcuts

Shortcut modifier is configurable in Settings → Keyboard shortcuts.
`Mod` = Ctrl+Alt (Windows/Linux) or Ctrl+Command (Mac).

- Mod+S: Save
- Mod+H: Replace modal
- Mod+R: Repeat last formatting
- Mod+B: Bold
- Mod+I: Italic
- Mod+X: Strikethrough
- Mod+`: Inline code
- Mod+L or Mod+K: Link modal
- Mod+M: Image modal
- Mod+Q: Blockquote
- Mod+U: Bullet list
- Mod+O: Fenced code block
- Mod+/: Comment
- Mod+PageUp: Uppercase
- Mod+PageDown: Lowercase
- Mod++: Increase heading level
- Mod+-: Decrease heading level
- Mod+1..6: Set heading level

Below is an overview of the common Markdown formatting options, complete with example code and the name of each format:

#### 1. Headings

Markdown supports six levels of headings, indicated by the number of `#` symbols. They each have their own function. See the explanation under the headings.

# Heading 1
> Heading 1 (starting with `#`) is usually used once as the title of the document (see above).

## Heading 2
> Heading 2 (starting with `##`) is used as a subtitle

### Heading 3
> Heading 3 (starting with `###`) is normally used as a heading for paragraphs. These headings are used to automatically generate the table of contents at the top of the article, under the subtitle, if needed.

Here is what the other headings look like (the more # the smaller they get):
#### Heading 4
##### Heading 5
###### Heading 6
> Headings 4, 5 and 6 are a bit larger than normal text.

### 2. Paragraphs

Paragraphs are simply lines of text, separated by one or more blank lines.

This is a paragraph. It contains text written without preceding special characters.

### Paragraph heading
This is another paragraph with a paragraph heading (Heading 3 in this case).  

### 3. Bold text

Text can be bolded by surrounding it with double asterisks `**` or double underscores `__`.

**This text is bold.**  
__This text is also bold.__

### 4. Italic text

Text can be italicized by surrounding it with single asterisks `*` or single underscores `_`.

*This text is italic.*  
_This text is also italic._

### 5. Bold and Italic

Text can be both bold and italic by using triple asterisks `***` or triple underscores `___`.

***This text is bold and italic.***  
___This text is also bold and italic.___

### 6. Blockquotes

Blockquotes are made with the `>` symbol.
> This is a blockquote. It is often used to quote text.

### 7. Line&shy;breaks

Use two spaces at the end of a line or a backslash `\` to create a line&shy;break.  
This is a line with a line break at the end.  
This text appears on a new line.

Or use a backslash at the end of the line \
to create a line break.

> **Smart hyphen:**
> There is a special word ```"&shy;"``` to get a so-called "soft hyphen". It only appears when needed in a long word that has to be broken. Try it with extra long words. That can be very handy with long words in headings on a small screen like a mobile phone. (Above it is used with "Line&shy;breaks").

### 8. Numbered lists

Numbered lists are made with numbers followed by a dot.
1. First item
2. Second item
3. Third item

### 9. Bulleted lists

Bulleted lists are made with asterisks `*`, plus signs `+` or hyphens `-`.
- First item
- Second item
- Third item

* Another first item  
* Another second item

+ Another first item  
+ Another second item

### 10. Code blocks

Inline code is made with backticks `` ` ``. Code blocks are made with triple backticks \``` or by indenting lines with four spaces. So inline code: `print('Hello, World!')`

Code block:
```
print('Hello, World!')
```

Alternatively, you can use a code block with "\<code>" <code>like this</code>.

You can also use keyboard shortcuts with "\<kbd>" for example <kbd>ctrl+c</kbd> (as if they are keyboard keys).

### 11. Horizontal rules

Horizontal rules are made with three or more hyphens `---`, asterisks `***` or underscores `___`.
___

### 12. Links

Links are made with square brackets `[]` for the link text and parentheses `()` for the URL. For example with [OpenAI](https://www.openai.com) (*See the markdown for formatting*).

### 13. Images

Images look like links but start with an exclamation mark `!`.
![Dancing greengrocer](../static/images/groenteman.png "Greengrocer")

(*See the markdown for formatting*).

> **Special tricks**
> 1. Select words and use <kbd>Mod+PageUp</kbd> for ALL CAPS, or <kbd>Mod+PageDown</kbd> for lowercase. Ideal for texts from ChatGPT (which tends to use too many capital letters in its response).
> 2. You can use <kbd>Tab</kbd> after an HTML tag to produce the whole HTML tag, e.g. `span` and then <kbd>Tab</kbd> gives `<span></span>`.
> 3. Duplicate this tab in the browser and come back to this example to see how to format certain text with Markdown <span style="padding: 0.3rem; border: 2px solid #e5e7eb;border-radius: 5px;">MD</span>;).

### 14. Tables

Tables are made with pipe characters `|` and hyphens `-`. Colons `:` can be used to align columns.
| Heading 1 | Heading 2 | Heading 3 |
|:---------|:---------:|---------:|
| Left     | Center    | Right    |
| Row 1    | data | data |
| Row 2    | data | data |

### 15. Strikethrough

Strikethrough text is made with double tildes `~~`.
~~This text is struck through.~~

### 16. Footnotes

Footnotes are added using square brackets with a caret `^` inside.
Here is a sentence with a footnote.[^1]
Ideal for source references.

[^1]: This is the footnote made with the subject '16. Footnotes'. Here is again the link to the explanation video <a href="https://www.youtube.com/watch?v=bTVIMt3XllM" target="_blank" class="externlink">'Learn Markdown in 30 minutes!'</a>.

### 17. Definition lists

Definition lists can be used to define terms. Each term is followed by a double colon and its definition.

**Markdown**: A lightweight markup language with a simple syntax for text formatting.

**HTML**: The standard markup language for creating web pages.

### 18. Emojis

Emojis can be added with the colon `:` syntax, similar to the old way, as it is still used on GitHub: :smile: :heart: :+1: :walking:. You can view the [complete shortcut list of markdown emojis](https://gist.github.com/rxaviers/7360908). But you can also use the "modern" emojis like here 🤣 😎 👀.

### 19. HTML elements

HTML can be embedded directly in Markdown if more control is needed (to a certain extent). For example:
<strong>Bold with HTML</strong>  
<a href="https://www.example.com" target="_blank" class="externlink">Link with HTML to an external site</a>, or a **free** button with <a href="https://www.voorbeeldlink.com" target="_blank" class="default-button freebutton">Free offer</a>

Or a normal button with <a href="https://www.voorbeeldlink.com" target="_blank" class="default-button">Normal button</a>
or you can make a relatively small button with 
<a href="https://www.voorbeeldlink.com" target="_blank" class="default-button small-button">small button</a> in the text.

**Note**: Not all HTML will look good. Ask the web designer when certain HTML doesn't look right.

(*See the Markdown for the HTML code*) 

### 20. Escaping characters

Use the backslash `\` to escape special Markdown characters.
\*This text is not italic\* (it is probably rarely needed).
