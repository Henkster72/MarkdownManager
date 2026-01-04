# Bienvenido a Markdown !

Markdown es un lenguaje de marcado facil usado para dar formato al texto. Para un video detallado sobre que es Markdown, puedes ver ['Learn Markdown in 30 minutes!'](https://www.youtube.com/watch?v=bTVIMt3XllM), o mejor aun, puedes seguir un [tutorial simple](https://www.markdowntutorial.com/nl/). ChatGPT y otros LLM trabajan con Markdown por defecto (tambien en sus salidas). Esto facilita copiar y pegar su contenido en este editor Markdown (en ChatGPT hay un icono de copiar (<span class="pi pi-copy"></span>) en cada respuesta).


Ahora puedes ver **exactamente** como se vera en el sitio.

## MarkdownManager basico (despues de la instalacion)

- Crear una nota: haz clic en `+MD` en la barra superior, elige una carpeta, ingresa un titulo/slug, guarda.
- Abrir notas: usa el explorador a la izquierda; filtra, ordena y haz clic en una nota.
- Guardar: boton Guardar o atajo.
- Vista previa: la vista HTML se actualiza despues de guardar.
- Formato: usa los botones de la barra para titulos, negrita/cursiva/subrayado, listas, cita, tabla y alineacion. La alineacion agrega `{: class="left|center|right" }`.
- Renombrar/eliminar: solo superusuario, botones arriba del explorador para la nota actual.
- Modo WPM: Publicar pasa Concept -> Processing; el selector de estado es solo superusuario.
- Exportar/copiar HTML: solo superusuario cuando esta habilitado en Ajustes.
- Ajustes: usa el icono de engranaje para tema, metadatos, opciones WPM y modificador de atajos.

## Atajos de teclado

El modificador se configura en Ajustes -> Atajos de teclado.
`Mod` = Ctrl+Alt (Windows/Linux) o Ctrl+Command (Mac).

- Mod+S: Guardar
- Mod+H: Reemplazar
- Mod+R: Repetir el último formato
- Mod+B: Negrita
- Mod+I: Cursiva
- Mod+X: Tachado
- Mod+`: Codigo inline
- Mod+L o Mod+K: Enlace
- Mod+M: Imagen
- Mod+Q: Cita
- Mod+U: Lista con vinetas
- Mod+O: Bloque de codigo
- Mod+/: Comentario
- Mod+PageUp: Mayusculas
- Mod+PageDown: Minusculas
- Mod++: Subir nivel de titulo
- Mod+-: Bajar nivel de titulo
- Mod+1..6: Definir nivel de titulo

A continuacion hay un resumen de las opciones comunes de formato Markdown, con codigo de ejemplo y el nombre de cada formato:

#### 1. Titulos

Markdown soporta seis niveles de titulos, indicados por el numero de simbolos `#`. Cada uno tiene su propia funcion. Ver la explicacion bajo los titulos.

# Titulo 1
> Titulo 1 (comienza con `#`) se usa normalmente una sola vez como el titulo del documento (ver arriba).

## Titulo 2
> Titulo 2 (comienza con `##`) se usa como subtitulo

### Titulo 3
> Titulo 3 (comienza con `###`) se usa normalmente como titulo de parrafos. Estos titulos se usan para generar automaticamente la tabla de contenidos arriba del articulo, bajo el subtitulo, si es necesario.

Asi se ven los otros titulos (cuantos mas #, mas pequenos):
#### Titulo 4
##### Titulo 5
###### Titulo 6
> Titulos 4, 5 y 6 son un poco mas grandes que el texto normal.

### 2. Parrafos

Los parrafos son lineas de texto, separadas por una o mas lineas en blanco.

Este es un parrafo. Contiene texto escrito sin caracteres especiales al inicio.

### Titulo de parrafo
Este es otro parrafo con un titulo de parrafo (Titulo 3 en este caso).  

### 3. Texto en negrita

El texto puede ponerse en negrita rodeandolo con doble asterisco `**` o doble guion bajo `__`.

**Este texto esta en negrita.**  
__Este texto tambien esta en negrita.__

### 4. Texto en cursiva

El texto puede ponerse en cursiva rodeandolo con un solo asterisco `*` o un solo guion bajo `_`.

*Este texto esta en cursiva.*  
_Este texto tambien esta en cursiva._

### 5. Negrita y cursiva

El texto puede estar en negrita y cursiva usando triple asterisco `***` o triple guion bajo `___`.

***Este texto esta en negrita y cursiva.***  
___Este texto tambien esta en negrita y cursiva.___

### 6. Citas en bloque

Las citas en bloque se crean con el simbolo `>`.
> Esta es una cita. Se usa a menudo para citar texto.

### 7. Saltos de linea

Usa dos espacios al final de una linea o una barra invertida `\` para crear un salto de linea.  
Esta es una linea con salto al final.  
Este texto aparece en una nueva linea.

O usa una barra invertida al final de la linea \
para crear un salto de linea.

> **Guion suave:**
> Hay una palabra especial ```"&shy;"``` para crear un "guion suave". Solo aparece cuando se necesita partir una palabra larga. Prueba con palabras muy largas. Es muy util en titulos de pantallas pequenas como un movil. (Arriba se usa con "Saltos de linea").

### 8. Listas numeradas

Las listas numeradas se hacen con numeros seguidos de un punto.
1. Primer item
2. Segundo item
3. Tercer item

### 9. Listas con vinetas

Las listas con vinetas se hacen con asteriscos `*`, signos `+` o guiones `-`.
- Primer item
- Segundo item
- Tercer item

* Otro primer item  
* Otro segundo item

+ Otro primer item  
+ Otro segundo item

### 10. Bloques de codigo

El codigo inline se hace con backticks `` ` ``. Los bloques de codigo se hacen con triple backtick \``` o indentando lineas con cuatro espacios. Asi inline: `print('Hola, Mundo!')`

Bloque de codigo:
```
print('Hola, Mundo!')
```

Alternativamente, puedes usar un bloque con "\<code>" <code>asi</code>.

Tambien puedes usar atajos con "\<kbd>" por ejemplo <kbd>ctrl+c</kbd> (como si fueran teclas del teclado).

### 11. Reglas horizontales

Las reglas horizontales se hacen con tres o mas guiones `---`, asteriscos `***` o guiones bajos `___`.
___

### 12. Enlaces

Los enlaces se hacen con corchetes `[]` para el texto y parentesis `()` para la URL. Por ejemplo [OpenAI](https://www.openai.com) (*ver el markdown para el formato*).

### 13. Imagenes

Las imagenes se parecen a los enlaces pero comienzan con un signo de exclamacion `!`.
![Dancing greengrocer](../static/images/groenteman.png "Greengrocer")

(*Ver el markdown para el formato*).

> **Trucos especiales**
> 1. Selecciona palabras y usa <kbd>Mod+PageUp</kbd> para MAYUSCULAS, o <kbd>Mod+PageDown</kbd> para minusculas. Ideal para textos de ChatGPT (que tiende a usar demasiadas mayusculas en su respuesta).
> 2. Puedes usar <kbd>Tab</kbd> despues de una etiqueta HTML para completar la etiqueta, por ejemplo `span` y luego <kbd>Tab</kbd> da `<span></span>`.
> 3. Duplica esta pestana del navegador y vuelve a este ejemplo para ver como formatear texto con Markdown <span style="padding: 0.3rem; border: 2px solid #e5e7eb;border-radius: 5px;">MD</span>.

### 14. Tablas

Las tablas se hacen con barras `|` y guiones `-`. Los dos puntos `:` se pueden usar para alinear columnas.
| Encabezado 1 | Encabezado 2 | Encabezado 3 |
|:---------|:---------:|---------:|
| Izquierda | Centro | Derecha |
| Fila 1 | dato | dato |
| Fila 2 | dato | dato |

### 15. Tachado

El texto tachado se hace con doble tilde `~~`.
~~Este texto esta tachado.~~

### 16. Notas al pie

Las notas al pie se agregan con corchetes y un caret `^`.
Aqui hay una frase con nota al pie.[^1]
Ideal para referencias de fuentes.

[^1]: Esta es la nota al pie creada con el tema '16. Notas al pie'. Aqui esta otra vez el enlace al video de explicacion <a href="https://www.youtube.com/watch?v=bTVIMt3XllM" target="_blank" class="externlink">'Learn Markdown in 30 minutes!'</a>.

### 17. Listas de definicion

Las listas de definicion pueden usarse para definir terminos. Cada termino va seguido por dos puntos y su definicion.

**Markdown**: Un lenguaje de marcado ligero con una sintaxis simple para formato de texto.

**HTML**: El lenguaje de marcado estandar para crear paginas web.

### 18. Emojis

Los emojis se pueden agregar con la sintaxis de dos puntos `:`, similar a GitHub: :smile: :heart: :+1: :walking:. Puedes ver la [lista completa de atajos de emojis](https://gist.github.com/rxaviers/7360908).

### 19. Elementos HTML

HTML se puede insertar directamente en Markdown si necesitas mas control (hasta cierto punto). Por ejemplo:
<strong>Negrita con HTML</strong>  
<a href="https://www.example.com" target="_blank" class="externlink">Enlace HTML a un sitio externo</a>, o un boton **gratis** con <a href="https://www.voorbeeldlink.com" target="_blank" class="default-button freebutton">Oferta gratis</a>

O un boton normal con <a href="https://www.voorbeeldlink.com" target="_blank" class="default-button">Boton normal</a>
o puedes hacer un boton pequeno con 
<a href="https://www.voorbeeldlink.com" target="_blank" class="default-button small-button">boton pequeno</a> en el texto.

**Nota**: No todo HTML se vera bien. Consulta al disenador web cuando algo no se vea correcto.

(*Ver el Markdown para el codigo HTML*) 

### 20. Escapar caracteres

Usa la barra invertida `\` para escapar caracteres especiales de Markdown.
\*Este texto no esta en cursiva\* (probablemente se use pocas veces).
