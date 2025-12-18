<?php

function url_encode_path($path) {
    $path = str_replace("\\", "/", (string)$path);
    $segments = explode('/', $path);
    $segments = array_map('rawurlencode', $segments);
    return implode('/', $segments);
}

function is_external_url($url) {
    $url = (string)$url;
    if ($url === '') return false;
    if (str_starts_with($url, '//')) return true;
    return (bool)preg_match('~^[a-z][a-z0-9+.-]*:~i', $url);
}

function html_preview_sanitize_dir_name($name, $fallback) {
    $name = is_string($name) ? trim($name) : '';
    if ($name === '') return $fallback;
    if (strpos($name, '..') !== false) return $fallback;
    $name = str_replace("\\", "/", $name);
    $name = trim($name, "/");
    if ($name === '' || strpos($name, '/') !== false) return $fallback;
    if (!preg_match('/^[A-Za-z0-9._\\-\\p{L}\\p{N}]+$/u', $name)) return $fallback;
    return $name;
}

function html_preview_images_dir() {
    static $cache = null;
    if ($cache !== null) return $cache;
    $raw = function_exists('env_str') ? env_str('IMAGES_DIR', 'images') : 'images';
    $cache = html_preview_sanitize_dir_name($raw, 'images');
    return $cache;
}

function resolve_rel_url_from_md($url, $mdPath) {
    $url = (string)$url;
    if ($url === '' || $mdPath === null || $mdPath === '') return $url;
    if (is_external_url($url) || str_starts_with($url, '/') || str_starts_with($url, '#')) return $url;

    $suffixPos = null;
    $qPos = strpos($url, '?');
    $hPos = strpos($url, '#');
    if ($qPos !== false && $hPos !== false) $suffixPos = min($qPos, $hPos);
    else if ($qPos !== false) $suffixPos = $qPos;
    else if ($hPos !== false) $suffixPos = $hPos;
    $base = ($suffixPos === null) ? $url : substr($url, 0, $suffixPos);
    $suffix = ($suffixPos === null) ? '' : substr($url, $suffixPos);

    $base = str_replace("\\", "/", $base);
    if ($base === '') return $url;

    // Reserved project-root folders (e.g. images/) should not be resolved relative to the markdown file directory.
    $imagesDir = html_preview_images_dir();
    if ($imagesDir !== '' && str_starts_with($base, $imagesDir . '/')) {
        return url_encode_path($base) . $suffix;
    }

    $mdDir = dirname($mdPath);
    if ($mdDir === '.' || $mdDir === '') return url_encode_path($base) . $suffix;

    $baseParts = array_values(array_filter(explode('/', trim($mdDir, '/')), fn($p) => $p !== ''));
    $relParts = explode('/', $base);
    $out = $baseParts;
    foreach ($relParts as $p) {
        if ($p === '' || $p === '.') continue;
        if ($p === '..') {
            if (empty($out)) return $url; // don't allow escaping project root
            array_pop($out);
            continue;
        }
        $out[] = $p;
    }

    return url_encode_path(implode('/', $out)) . $suffix;
}

function resolve_rel_href_from_md_link($url, $mdPath) {
    $url = (string)$url;
    if ($url === '' || $mdPath === null || $mdPath === '') return $url;
    if (is_external_url($url) || str_starts_with($url, '/') || str_starts_with($url, '#')) return $url;

    $qPos = strpos($url, '?');
    $hPos = strpos($url, '#');

    $baseEnd = null;
    if ($qPos !== false && $hPos !== false) $baseEnd = min($qPos, $hPos);
    else if ($qPos !== false) $baseEnd = $qPos;
    else if ($hPos !== false) $baseEnd = $hPos;

    $base = ($baseEnd === null) ? $url : substr($url, 0, $baseEnd);
    $suffix = ($baseEnd === null) ? '' : substr($url, $baseEnd);

    $base = str_replace("\\", "/", $base);
    if ($base === '') return $url;

    $mdDir = dirname($mdPath);
    $out = [];
    if ($mdDir !== '.' && $mdDir !== '') {
        $out = array_values(array_filter(explode('/', trim($mdDir, '/')), fn($p) => $p !== ''));
    }

    $relParts = explode('/', $base);
    foreach ($relParts as $p) {
        if ($p === '' || $p === '.') continue;
        if ($p === '..') {
            if (empty($out)) return $url; // don't allow escaping project root
            array_pop($out);
            continue;
        }
        $out[] = $p;
    }

    $resolved = implode('/', $out);
    if ($resolved === '') return $url;

    // If it points to a markdown file, route through the app (works in subfolder installs like /md/).
    if (preg_match('/\\.md$/i', $resolved)) {
        $href = 'index.php?file=' . rawurlencode($resolved);
        if ($suffix !== '') {
            if ($suffix[0] === '?') $href .= '&' . substr($suffix, 1);
            else $href .= $suffix; // includes #fragment
        }
        return $href;
    }

    return url_encode_path($resolved) . $suffix;
}

function md_join_classes(...$classes) {
    $out = [];
    foreach ($classes as $c) {
        $c = trim((string)$c);
        if ($c !== '') $out[] = $c;
    }
    return implode(' ', $out);
}

function md_render_profile($profile) {
    $profile = is_string($profile) ? strtolower(trim($profile)) : 'edit';
    if ($profile !== 'view' && $profile !== 'edit') $profile = 'edit';

    $profiles = [
        'view' => [
            'bold_repl' => '<strong class="font-semibold text-neutral-900 dark:text-neutral-100">$1</strong>',
            'italic_repl' => '<em class="italic text-neutral-600 dark:text-neutral-300">$1</em>',
            'link_class' => 'underline text-blue-600 dark:text-blue-400 hover:opacity-80',
            'inline_code_class' => 'bg-neutral-800 text-neutral-100 px-1.5 py-0.5 rounded text-[0.8em]',

            'p_class' => 'leading-relaxed my-4 text-neutral-700 dark:text-neutral-300',
            'hr_html' => '<hr>',

            'ul_class' => '',
            'ol_class' => '',
            'li_class' => '',

            'codeblock_pre_class' => 'rounded-xl bg-neutral-900 text-neutral-100 p-4 overflow-x-auto text-sm ring-1 ring-neutral-700/50',

            'table_class' => '',
            'th_class' => '',
            'td_class' => '',

            'heading_classes' => [
                1 => "text-3xl font-bold mt-10 mb-4 text-neutral-900 dark:text-neutral-100 text-center",
                2 => "text-2xl font-semibold mt-8 mb-3 text-neutral-900 dark:text-neutral-100",
                3 => "text-xl font-semibold mt-6 mb-2 text-neutral-900 dark:text-neutral-100",
                4 => "text-lg font-semibold mt-4 mb-2 text-neutral-800 dark:text-neutral-200",
                5 => "text-base font-semibold mt-3 mb-2 text-neutral-800 dark:text-neutral-200",
                6 => "text-sm font-semibold mt-3 mb-2 uppercase tracking-wide text-neutral-600 dark:text-neutral-400",
            ],
        ],
        'edit' => [
            'bold_repl' => '<strong class="md-strong">$1</strong>',
            'italic_repl' => '<em class="md-em">$1</em>',
            'link_class' => 'md-link',
            'inline_code_class' => 'md-code-inline',

            'p_class' => 'md-p',
            'hr_html' => '<hr class="md-hr">',

            'ul_class' => 'md-list',
            'ol_class' => 'md-olist',
            'li_class' => 'md-li',

            'codeblock_pre_class' => 'md-codeblock',

            'table_class' => 'md-table',
            'th_class' => 'md-th',
            'td_class' => 'md-td',

            'heading_classes' => [
                1 => "md-h1",
                2 => "md-h2",
                3 => "md-h3",
                4 => "md-h4",
                5 => "md-h5",
                6 => "md-h6",
            ],
        ],
    ];

    return $profiles[$profile];
}

function wrap_mathjax_currency_symbols($tex) {
    $tex = (string)$tex;
    if ($tex === '' || strpos($tex, '€') === false) return $tex;

    $len = strlen($tex);
    $out = '';
    $inText = false;
    $textDepth = 0;
    $euroBytes = "€";
    $euroLen = strlen($euroBytes);

    for ($i = 0; $i < $len; ) {
        if (!$inText && substr($tex, $i, 6) === '\\text{') {
            $inText = true;
            $textDepth = 1;
            $out .= '\\text{';
            $i += 6;
            continue;
        }

        if ($euroLen > 0 && substr($tex, $i, $euroLen) === $euroBytes) {
            $out .= $inText ? $euroBytes : '\\text{€}';
            $i += $euroLen;
            continue;
        }

        $ch = $tex[$i];
        if ($inText) {
            if ($ch === '{' && ($i === 0 || $tex[$i - 1] !== '\\')) {
                $textDepth++;
            } else if ($ch === '}' && ($i === 0 || $tex[$i - 1] !== '\\')) {
                $textDepth--;
                if ($textDepth <= 0) {
                    $inText = false;
                    $textDepth = 0;
                }
            }
        }

        $out .= $ch;
        $i++;
    }

    return $out;
}

function fix_mathjax_currency_in_math_delimiters($text) {
    $replace = static function($m) {
        $open  = $m[1];
        $inner = $m[2];
        $close = $m[3];

        $inner = wrap_mathjax_currency_symbols($inner);

        return $open . $inner . $close;
    };

    // \( ... \)
    $text = preg_replace_callback('/(\\\\\\()(.+?)(\\\\\\))/s', $replace, $text);
    // \[ ... \]
    $text = preg_replace_callback('/(\\\\\\[)(.+?)(\\\\\\])/s', $replace, $text);
    return $text;
}

function inline_md($text, $mdPath = null, $profile = 'edit') {
    $p = md_render_profile($profile);

    // Protect inline code spans from further processing (and MathJax fixes).
    $codeSpans = [];
    $text = preg_replace_callback('/`([^`]+)`/', function($m) use (&$codeSpans){
        $key = '@@MD_CODE_' . count($codeSpans) . '@@';
        $codeSpans[$key] = $m[1];
        return $key;
    }, $text);

    $text = fix_mathjax_currency_in_math_delimiters($text);

    $text = htmlspecialchars($text, ENT_QUOTES, 'UTF-8');

    // ![alt](url "title")
    $text = preg_replace_callback(
        '/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]+)")?\)/',
        function($m) use ($mdPath){
            $alt = $m[1];
            $urlRaw = html_entity_decode($m[2], ENT_QUOTES, 'UTF-8');
            $urlResolved = resolve_rel_url_from_md($urlRaw, $mdPath);
            $urlEsc = htmlspecialchars($urlResolved, ENT_QUOTES, 'UTF-8');
            $titleAttr = isset($m[3]) ? ' title="'.$m[3].'"' : '';
            return '<img class="md-img" src="'.$urlEsc.'" alt="'.$alt.'" loading="lazy" decoding="async"'.$titleAttr.'>';
        },
        $text
    );

    // **bold**
    $text = preg_replace('/\*\*([^*]+)\*\*/', $p['bold_repl'], $text);
    // *italic*
    $text = preg_replace('/\*([^*]+)\*/', $p['italic_repl'], $text);

    // [text](url)
    $linkClass = $p['link_class'];
    $text = preg_replace_callback(
        '/\[([^\]]+)\]\(([^)]+)\)/',
        function($m) use ($mdPath, $linkClass){
            $label = $m[1];
            $urlRaw = html_entity_decode($m[2], ENT_QUOTES, 'UTF-8');
            $urlResolved = resolve_rel_href_from_md_link($urlRaw, $mdPath);
            $urlEsc = htmlspecialchars($urlResolved, ENT_QUOTES, 'UTF-8');
            return '<a class="'.$linkClass.'" href="'.
                   $urlEsc.
                   '" target="_blank" rel="noopener noreferrer">'.$label.'</a>';
        },
        $text
    );

    // Restore protected inline code spans.
    if (!empty($codeSpans)) {
        foreach ($codeSpans as $key => $raw) {
            $keyEsc = htmlspecialchars($key, ENT_QUOTES, 'UTF-8');
            $rawEsc = htmlspecialchars($raw, ENT_QUOTES, 'UTF-8');
            $text = str_replace(
                $keyEsc,
                '<code class="'.$p['inline_code_class'].'">'.$rawEsc.'</code>',
                $text
            );
        }
    }

    return $text;
}

function split_md_table_row($line) {
    $line = trim($line);
    if ($line === '') return [];

    if (str_starts_with($line, '|')) $line = substr($line, 1);
    if (str_ends_with($line, '|')) $line = substr($line, 0, -1);

    $cells = preg_split('/(?<!\\\\)\|/', $line);
    $out = [];
    foreach ($cells as $c) {
        $c = str_replace('\\|', '|', $c);
        $out[] = trim($c);
    }
    return $out;
}

function is_md_table_separator($line) {
    $line = trim($line);
    if ($line === '') return false;
    if (strpos($line, '|') === false) return false;
    return (bool)preg_match('/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/', $line);
}

function md_table_align_from_spec($spec) {
    $spec = trim($spec);
    $left = str_starts_with($spec, ':');
    $right = str_ends_with($spec, ':');
    if ($left && $right) return 'center';
    if ($right) return 'right';
    return 'left';
}

function md_indent_width($ws) {
    $ws = str_replace("\t", "    ", (string)$ws);
    return strlen($ws);
}

function md_line_indent($line) {
    if (!preg_match('/^(\s*)/', (string)$line, $m)) return 0;
    return md_indent_width($m[1] ?? '');
}

function is_mathjax_display_open_line($line) {
    return (bool)preg_match('/^\s*\\\\\[\s*$/', (string)$line);
}

function is_mathjax_display_close_line($line) {
    return (bool)preg_match('/^\s*\\\\\]\s*$/', (string)$line);
}

/* BLOCK MARKDOWN -> HTML */
function md_to_html($text, $mdPath = null, $profile = 'edit') {
    $p = md_render_profile($profile);

    $text = str_replace(["\r\n","\r"], "\n", $text);
    $lines = explode("\n",$text);

    $html = [];
    $in_codeblock = false;
    $listStack = [];

    $openList = function($tag, $indent) use (&$html, &$listStack, $p) {
        $listClass = $tag === 'ol' ? ($p['ol_class'] ?? '') : ($p['ul_class'] ?? '');
        $attr = $listClass ? ' class="'.htmlspecialchars($listClass, ENT_QUOTES, 'UTF-8').'"' : '';
        $html[] = "<$tag$attr>";
        $listStack[] = ['tag' => $tag, 'indent' => (int)$indent, 'liOpen' => false];
    };
    $closeOneList = function() use (&$html, &$listStack) {
        if (empty($listStack)) return;
        $top = &$listStack[count($listStack) - 1];
        if (!empty($top['liOpen'])) {
            $html[] = "</li>";
            $top['liOpen'] = false;
        }
        $tag = $top['tag'];
        array_pop($listStack);
        $html[] = "</$tag>";
    };
    $closeAllLists = function() use (&$listStack, $closeOneList) {
        while (!empty($listStack)) $closeOneList();
    };
    $closeToIndent = function($indent) use (&$listStack, $closeOneList) {
        while (!empty($listStack) && $listStack[count($listStack) - 1]['indent'] > $indent) {
            $closeOneList();
        }
    };

    $count = count($lines);
    for ($i = 0; $i < $count; $i++) {
        $line = $lines[$i];

        // ``` fenced code blocks (allow indentation, e.g. inside lists)
        if (preg_match('/^\s*```(.*)$/', $line, $m)) {
            $closeAllLists();
            if ($in_codeblock) {
                $html[] = "</code></pre>";
                $in_codeblock = false;
            } else {
                $in_codeblock = true;
                $lang = trim((string)($m[1] ?? ''));
                $langAttr = $lang ? ' class="language-'.htmlspecialchars($lang, ENT_QUOTES, 'UTF-8').'"' : '';
                $preCls = htmlspecialchars($p['codeblock_pre_class'] ?? '', ENT_QUOTES, 'UTF-8');
                $preAttr = $preCls ? ' class="'.$preCls.'"' : '';
                $html[] = '<pre'.$preAttr.'><code'.$langAttr.'>';
            }
            continue;
        }

        if ($in_codeblock) {
            $html[] = htmlspecialchars($line, ENT_QUOTES, 'UTF-8');
            continue;
        }

        // MathJax display blocks: \[ ... \] on their own lines (allow indentation, incl. inside list items)
        if (is_mathjax_display_open_line($line)) {
            $closeIndex = null;
            for ($j = $i + 1; $j < $count; $j++) {
                if (is_mathjax_display_close_line($lines[$j])) { $closeIndex = $j; break; }
            }

            if ($closeIndex !== null) {
                $innerLines = array_slice($lines, $i + 1, $closeIndex - $i - 1);
                $math = "\\[\n" . implode("\n", $innerLines) . "\n\\]";
                $math = fix_mathjax_currency_in_math_delimiters($math);
                $mathEsc = htmlspecialchars($math, ENT_QUOTES, 'UTF-8');

                $lineIndent = md_line_indent($line);
                $stayInLi = !empty($listStack)
                    && !empty($listStack[count($listStack) - 1]['liOpen'])
                    && $lineIndent > $listStack[count($listStack) - 1]['indent'];
                if (!$stayInLi) $closeAllLists();

                $html[] = '<div class="md-math-block">' . $mathEsc . '</div>';
                $i = $closeIndex;
                continue;
            }
        }

        // horizontal rule
        if (preg_match('/^\s*((\*|-|_)\s*){3,}$/', $line)) {
            $closeAllLists();
            $html[] = $p['hr_html'] ?? '<hr>';
            continue;
        }

        // blockquote
        if (preg_match('/^\s*>\s?(.*)$/', $line)) {
            $closeAllLists();

            $bq = [];
            while ($i < $count && preg_match('/^\s*>\s?(.*)$/', $lines[$i], $m)) {
                $bq[] = $m[1];
                $i++;
            }
            $i--;
            $inner = implode("\n", $bq);
            $html[] = '<blockquote>' . "\n" . md_to_html($inner, $mdPath, $profile) . "\n" . '</blockquote>';
            continue;
        }

        // tables (GFM-style)
        if (strpos($line, '|') !== false && ($i + 1) < $count && is_md_table_separator($lines[$i + 1])) {
            $closeAllLists();

            $headerCells = split_md_table_row($line);
            $alignCells = split_md_table_row($lines[$i + 1]);
            $colCount = max(count($headerCells), count($alignCells));
            if ($colCount < 1) { continue; }

            $align = [];
            for ($c = 0; $c < $colCount; $c++) {
                $align[$c] = md_table_align_from_spec($alignCells[$c] ?? '');
            }

            $rows = [];
            $i += 2;
            while ($i < $count) {
                $rowLine = $lines[$i];
                if (trim($rowLine) === '') break;
                if (strpos($rowLine, '|') === false) break;
                $cells = split_md_table_row($rowLine);
                $rows[] = $cells;
                $i++;
            }
            $i--;

            $tableClass = htmlspecialchars($p['table_class'] ?? '', ENT_QUOTES, 'UTF-8');
            $tableAttr = $tableClass ? ' class="'.$tableClass.'"' : '';

            $table = [];
            $table[] = '<table'.$tableAttr.'>';
            $table[] = '<thead><tr>';
            for ($c = 0; $c < $colCount; $c++) {
                $txt = $headerCells[$c] ?? '';
                $a = $align[$c];
                $thCls = md_join_classes($p['th_class'] ?? '', 'align-'.$a);
                $thAttr = $thCls ? ' class="'.htmlspecialchars($thCls, ENT_QUOTES, 'UTF-8').'"' : '';
                $table[] = '<th'.$thAttr.'>' . inline_md($txt, $mdPath, $profile) . '</th>';
            }
            $table[] = '</tr></thead>';
            $table[] = '<tbody>';
            foreach ($rows as $r) {
                $table[] = '<tr>';
                for ($c = 0; $c < $colCount; $c++) {
                    $txt = $r[$c] ?? '';
                    $a = $align[$c];
                    $tdCls = md_join_classes($p['td_class'] ?? '', 'align-'.$a);
                    $tdAttr = $tdCls ? ' class="'.htmlspecialchars($tdCls, ENT_QUOTES, 'UTF-8').'"' : '';
                    $table[] = '<td'.$tdAttr.'>' . inline_md($txt, $mdPath, $profile) . '</td>';
                }
                $table[] = '</tr>';
            }
            $table[] = '</tbody></table>';
            $html[] = implode("\n", $table);
            continue;
        }

        // headings
        if (preg_match('/^(#{1,6})\s+(.*)$/',$line,$m)) {
            $closeAllLists();

            $level   = strlen($m[1]);
            $content = $m[2];
            $tag     = "h$level";

            $clsMap = $p['heading_classes'] ?? [];
            $cls = $clsMap[$level] ?? ($profile === 'view' ? "font-bold mt-4 mb-2" : "md-heading");
            $clsAttr = $cls ? ' class="'.htmlspecialchars($cls, ENT_QUOTES, 'UTF-8').'"' : '';

            $html[] = "<$tag$clsAttr>".inline_md($content, $mdPath, $profile)."</$tag>";
            continue;
        }

        // list items (supports nesting via indentation)
        if (preg_match('/^(\s*)([-*])\s+(.*)$/', $line, $m) || preg_match('/^(\s*)(\d+)\.\s+(.*)$/', $line, $m)) {
            $isOrdered = is_numeric($m[2]);
            $tag = $isOrdered ? 'ol' : 'ul';
            $indent = md_indent_width($m[1] ?? '');
            $content = (string)($m[3] ?? '');

            if (!empty($listStack)) {
                $top = $listStack[count($listStack) - 1];
                if ($indent > $top['indent'] && empty($top['liOpen'])) {
                    $indent = $top['indent'];
                }
            }

            if (empty($listStack)) {
                $openList($tag, $indent);
            } else {
                if ($indent > $listStack[count($listStack) - 1]['indent']) {
                    $openList($tag, $indent);
                } else if ($indent < $listStack[count($listStack) - 1]['indent']) {
                    $closeToIndent($indent);
                }

                if (empty($listStack)) {
                    $openList($tag, $indent);
                } else if ($listStack[count($listStack) - 1]['indent'] === $indent && $listStack[count($listStack) - 1]['tag'] !== $tag) {
                    $closeOneList();
                    $openList($tag, $indent);
                } else if ($listStack[count($listStack) - 1]['indent'] !== $indent) {
                    $openList($tag, $indent);
                }
            }

            $topIndex = count($listStack) - 1;
            if (!empty($listStack[$topIndex]['liOpen'])) {
                $html[] = "</li>";
                $listStack[$topIndex]['liOpen'] = false;
            }

            $liClass = $p['li_class'] ?? '';
            $liAttr = $liClass ? ' class="'.htmlspecialchars($liClass, ENT_QUOTES, 'UTF-8').'"' : '';
            $html[] = '<li'.$liAttr.'>' . inline_md($content, $mdPath, $profile);
            $listStack[$topIndex]['liOpen'] = true;
            continue;
        }

        // normal paragraph / blank
        if (trim($line)==="") {
            $html[]="";
        } else {
            $lineIndent = md_line_indent($line);
            $stayInLi = !empty($listStack)
                && !empty($listStack[count($listStack) - 1]['liOpen'])
                && $lineIndent > $listStack[count($listStack) - 1]['indent'];
            if (!$stayInLi) $closeAllLists();

            $pClass = $p['p_class'] ?? '';
            $pAttr = $pClass ? ' class="'.htmlspecialchars($pClass, ENT_QUOTES, 'UTF-8').'"' : '';
            $html[]='<p'.$pAttr.'>'.inline_md($line, $mdPath, $profile).'</p>';
        }
    }

    $closeAllLists();
    if ($in_codeblock) $html[]="</code></pre>";

    return implode("\n",$html);
}

/* TITLE FROM MD */
function extract_title($raw){
    $raw = str_replace(["\r\n","\r"], "\n", $raw);
    foreach (explode("\n",$raw) as $l){
        if (preg_match('/^#\s+(.*)$/',$l,$m)) return trim($m[1]);
    }
    foreach (explode("\n",$raw) as $l){
        if (trim($l)!=='') return trim($l);
    }
    return "Untitled";
}
