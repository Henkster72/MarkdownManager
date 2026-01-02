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

function normalize_md_link_url($url) {
    $url = trim((string)$url);
    if ($url === '') return $url;
    if (is_external_url($url) || str_starts_with($url, '/') || str_starts_with($url, '#')) return $url;

    // Treat bare domains as external links and add https://
    if (preg_match('~^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\\.[A-Za-z0-9-]{1,63})+(?=$|[/?#])~', $url)) {
        return 'https://' . $url;
    }

    return $url;
}

function html_preview_sanitize_dir_name($name, $fallback) {
    $name = is_string($name) ? trim($name) : '';
    if ($name === '') return $fallback;
    $name = str_replace("\\", "/", $name);
    if (preg_match('~^[a-z][a-z0-9+.-]*:~i', $name) || str_starts_with($name, '//')) return $fallback;
    if (str_starts_with($name, './')) $name = substr($name, 2);
    $isAbs = str_starts_with($name, '/');
    $parts = array_values(array_filter(explode('/', $name), fn($p) => $p !== ''));
    if (empty($parts)) return $fallback;
    $safe = [];
    foreach ($parts as $p) {
        if ($p === '.' || $p === '..') {
            $safe[] = $p;
            continue;
        }
        if (!preg_match('/^[A-Za-z0-9._\\-\\p{L}\\p{N}]+$/u', $p)) return $fallback;
        $safe[] = $p;
    }
    $clean = implode('/', $safe);
    if ($clean === '') return $fallback;
    if ($isAbs && strpos($clean, '..') !== false) return $fallback;
    return $isAbs ? '/' . $clean : $clean;
}

function html_preview_images_dir() {
    static $cache = null;
    if ($cache !== null) return $cache;
    $raw = function_exists('env_str') ? env_str('IMAGES_DIR', 'images') : 'images';
    $cache = html_preview_sanitize_dir_name($raw, 'images');
    return $cache;
}

function html_preview_expand_image_token($url) {
    $url = trim((string)$url);
    if ($url === '') return $url;
    if (!preg_match('/^\\{\\{\\s*([^}]+?)\\s*\\}\\}$/', $url, $m)) return $url;

    $rawName = trim((string)($m[1] ?? ''));
    if ($rawName === '') return $url;

    $rawName = str_replace("\\", "/", $rawName);
    $parts = array_values(array_filter(explode('/', $rawName), fn($p) => $p !== '' && $p !== '.'));
    $safe = [];
    foreach ($parts as $p) {
        if ($p === '..') continue;
        $safe[] = $p;
    }
    $safePath = implode('/', $safe);
    if ($safePath === '') return $url;

    $imagesDir = html_preview_images_dir();
    return $imagesDir !== '' ? ($imagesDir . '/' . $safePath) : $safePath;
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
    $url = normalize_md_link_url($url);
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

function mdw_page_picture_src($url) {
    $url = trim((string)$url);
    if ($url === '') return '';
    $url = html_preview_expand_image_token($url);
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

    $imagesDir = html_preview_images_dir();
    if ($imagesDir !== '' && !str_starts_with($base, $imagesDir . '/')) {
        $base = rtrim($imagesDir, '/') . '/' . ltrim($base, '/');
    }

    return url_encode_path($base) . $suffix;
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

function mdw_extract_footnotes($text) {
    $text = str_replace(["\r\n", "\r"], "\n", (string)$text);
    $lines = explode("\n", $text);
    $out = [];
    $footnotes = [];
    $in_codeblock = false;

    foreach ($lines as $line) {
        if (preg_match('/^\s*```/', $line)) {
            $out[] = $line;
            $in_codeblock = !$in_codeblock;
            continue;
        }

        if (!$in_codeblock && preg_match('/^\s*\[(\^?)([A-Za-z0-9_-]+)\]:\s*(.+)$/', $line, $m)) {
            $isCaret = ($m[1] ?? '') === '^';
            $label = (string)($m[2] ?? '');
            $rest = trim((string)($m[3] ?? ''));
            if ($label !== '' && $rest !== '' && !isset($footnotes[$label])) {
                $isLikelyUrl = !$isCaret && preg_match('~^(https?://|/|\\./|\\.\\./|#)~i', $rest);
                if ($isLikelyUrl) {
                    $url = $rest;
                    $title = '';
                    if (preg_match('/^(.+?)\s+"([^"]+)"\s*$/s', $rest, $tm)) {
                        $url = trim((string)$tm[1]);
                        $title = trim((string)$tm[2]);
                    }
                    $footnotes[$label] = [
                        'type' => 'link',
                        'url' => $url,
                        'title' => $title,
                    ];
                } else {
                    $footnotes[$label] = [
                        'type' => 'text',
                        'text' => $rest,
                    ];
                }
            }
            continue;
        }

        $out[] = $line;
    }

    return [implode("\n", $out), $footnotes];
}

function mdw_collect_footnote_refs($text) {
    $text = str_replace(["\r\n", "\r"], "\n", (string)$text);
    $lines = explode("\n", $text);
    $order = [];
    $seen = [];
    $labels = [];
    $in_codeblock = false;

    foreach ($lines as $line) {
        if (preg_match('/^\s*```/', $line)) {
            $in_codeblock = !$in_codeblock;
            continue;
        }
        if ($in_codeblock) continue;

        if (preg_match_all('/\[([^\]]+)\]\[(\d+)\]/', $line, $m, PREG_SET_ORDER)) {
            foreach ($m as $match) {
                $label = trim((string)($match[1] ?? ''));
                $num = (string)($match[2] ?? '');
                if ($num === '') continue;
                if (!isset($labels[$num]) && $label !== '') $labels[$num] = $label;
                if (isset($seen[$num])) continue;
                $seen[$num] = true;
                $order[] = $num;
            }
        }

        if (preg_match_all('/\[\^([A-Za-z0-9_-]+)\]/', $line, $m, PREG_SET_ORDER)) {
            foreach ($m as $match) {
                $num = (string)($match[1] ?? '');
                if ($num === '') continue;
                if (isset($seen[$num])) continue;
                $seen[$num] = true;
                $order[] = $num;
            }
        }
    }

    return ['order' => $order, 'labels' => $labels];
}

function inline_md($text, $mdPath = null, $profile = 'edit', $context = []) {
    $p = md_render_profile($profile);
    $footnotes = (is_array($context) && isset($context['footnotes']) && is_array($context['footnotes']))
        ? $context['footnotes']
        : [];

    // Protect inline code spans from further processing (and MathJax fixes).
    $codeSpans = [];
    $text = preg_replace_callback('/`([^`]+)`/', function($m) use (&$codeSpans){
        $key = '@@MD_CODE_' . count($codeSpans) . '@@';
        $codeSpans[$key] = $m[1];
        return $key;
    }, $text);

    // Preserve basic inline HTML tags so they don't get escaped.
    $rawHtmlTags = [];
    $allowedTags = ['a','span','strong','em','code','kbd','br','hr','u','s','del','sup','sub','small','mark'];
    $text = preg_replace_callback('/(?<!\\\\)<\\s*(\\/)?\\s*([A-Za-z][A-Za-z0-9:-]*)\\b([^>]*)>/', function($m) use (&$rawHtmlTags, $allowedTags){
        $tag = strtolower((string)$m[2]);
        if (!in_array($tag, $allowedTags, true)) return $m[0];
        $key = '@@MD_HTML_' . count($rawHtmlTags) . '@@';
        $rawHtmlTags[$key] = '<' . ($m[1] ? '/' : '') . $m[2] . $m[3] . '>';
        return $key;
    }, $text);

    $text = fix_mathjax_currency_in_math_delimiters($text);

    $text = htmlspecialchars($text, ENT_QUOTES, 'UTF-8');

    // ![alt](url "title")
    $text = preg_replace_callback(
        '/!\[([^\]]*)\]\((?<img>(?:[^()]+|\((?&img)\))*)\)/',
        function($m) use ($mdPath){
            $alt = $m[1];
            $innerRaw = html_entity_decode($m[2], ENT_QUOTES, 'UTF-8');
            $urlRaw = $innerRaw;
            $titleRaw = '';
            if (preg_match('/^(.+?)\\s+"([^"]+)"\\s*$/s', $innerRaw, $tm)) {
                $urlRaw = $tm[1];
                $titleRaw = $tm[2];
            }
            $urlRaw = html_preview_expand_image_token($urlRaw);
            $urlResolved = resolve_rel_url_from_md($urlRaw, $mdPath);
            $urlEsc = htmlspecialchars($urlResolved, ENT_QUOTES, 'UTF-8');
            $titleRaw = trim((string)$titleRaw);
            $titleAttr = $titleRaw !== '' ? ' title="'.htmlspecialchars($titleRaw, ENT_QUOTES, 'UTF-8').'"' : '';
            return '<img class="md-img" src="'.$urlEsc.'" alt="'.$alt.'" loading="lazy" decoding="async"'.$titleAttr.'>';
        },
        $text
    );

    // ~~strikethrough~~
    $text = preg_replace('/~~([^~]+)~~/', '<del class="md-del">$1</del>', $text);
    // **bold**
    $text = preg_replace('/\*\*([^*]+)\*\*/', $p['bold_repl'], $text);
    // *italic*
    $text = preg_replace('/\*([^*]+)\*/', $p['italic_repl'], $text);

    // [text](url) {: class="foo bar"}
    $linkClass = $p['link_class'];
    $text = preg_replace_callback(
        "/\\[([^\\]]+)\\]\\((?<url>(?:[^()]+|\\((?&url)\\))*)\\)(?:\\s*\\{:\\s*class\\s*=\\s*(?:\"([^\"]+)\"|&quot;([^&]+)&quot;|&#039;([^']+)&#039;)\\s*\\})?/i",
        function($m) use ($mdPath, $linkClass){
            $label = $m[1];
            $urlRaw = html_entity_decode($m[2], ENT_QUOTES, 'UTF-8');
            $urlResolved = resolve_rel_href_from_md_link($urlRaw, $mdPath);
            $urlEsc = htmlspecialchars($urlResolved, ENT_QUOTES, 'UTF-8');

            $rawClass = '';
            if (isset($m[3]) && $m[3] !== '') $rawClass = $m[3];
            else if (isset($m[4]) && $m[4] !== '') $rawClass = $m[4];
            else if (isset($m[5]) && $m[5] !== '') $rawClass = $m[5];
            $rawClass = html_entity_decode($rawClass, ENT_QUOTES, 'UTF-8');
            $rawClass = preg_replace('/[^A-Za-z0-9_\\-\\s]+/', '', (string)$rawClass);
            $rawClass = trim(preg_replace('/\\s+/', ' ', $rawClass));

            $classAttr = md_join_classes($linkClass, $rawClass);
            $classAttr = $classAttr !== '' ? ' class="'.$classAttr.'"' : '';

            return '<a'.$classAttr.' href="'.
                   $urlEsc.
                   '" target="_blank" rel="noopener noreferrer">'.$label.'</a>';
        },
        $text
    );

    // [text][1] (numeric footnotes)
    $text = preg_replace_callback(
        "/\\[([^\\]]+)\\]\\[(\\d+)\\]/",
        function($m) use ($mdPath, $footnotes){
            $labelEsc = $m[1];
            $key = (string)($m[2] ?? '');
            if (!isset($footnotes[$key])) return $m[0];

            $labelRaw = html_entity_decode($labelEsc, ENT_QUOTES, 'UTF-8');
            $labelRaw = trim($labelRaw);
            $titleRaw = trim((string)($footnotes[$key]['title'] ?? ''));
            $urlRaw = trim((string)($footnotes[$key]['url'] ?? ''));

            $hover = $labelRaw !== '' ? $labelRaw : ($titleRaw !== '' ? $titleRaw : $urlRaw);
            $titleAttr = $hover !== '' ? ' title="'.htmlspecialchars($hover, ENT_QUOTES, 'UTF-8').'"' : '';
            $numEsc = htmlspecialchars($key, ENT_QUOTES, 'UTF-8');

            return '<sup class="md-footnote"><a class="md-footnote-ref" href="#fn-'.$numEsc.'"'.$titleAttr.'>'.$numEsc.'</a></sup>';
        },
        $text
    );

    // [^1] (caret footnotes)
    $text = preg_replace_callback(
        "/\\[\\^([A-Za-z0-9_-]+)\\]/",
        function($m) use ($footnotes){
            $key = (string)($m[1] ?? '');
            if ($key === '' || !isset($footnotes[$key])) return $m[0];
            $fn = $footnotes[$key];
            $hover = '';
            $type = isset($fn['type']) ? (string)$fn['type'] : '';
            if ($type === 'link') {
                $titleRaw = trim((string)($fn['title'] ?? ''));
                $urlRaw = trim((string)($fn['url'] ?? ''));
                $hover = $titleRaw !== '' ? $titleRaw : $urlRaw;
            } else {
                $textRaw = trim((string)($fn['text'] ?? ''));
                $hover = trim(strip_tags($textRaw));
            }
            $titleAttr = $hover !== '' ? ' title="'.htmlspecialchars($hover, ENT_QUOTES, 'UTF-8').'"' : '';
            $numEsc = htmlspecialchars($key, ENT_QUOTES, 'UTF-8');
            return '<sup class="md-footnote"><a class="md-footnote-ref" href="#fn-'.$numEsc.'"'.$titleAttr.'>'.$numEsc.'</a></sup>';
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

    // Restore preserved HTML tags.
    if (!empty($rawHtmlTags)) {
        foreach ($rawHtmlTags as $key => $raw) {
            $keyEsc = htmlspecialchars($key, ENT_QUOTES, 'UTF-8');
            $text = str_replace($keyEsc, $raw, $text);
        }
    }

    return $text;
}

function mdw_extract_html_comments($text) {
    $text = str_replace(["\r\n", "\r"], "\n", (string)$text);
    $lines = explode("\n", $text);
    $comments = [];
    $out = [];
    $in_codeblock = false;
    $in_comment = false;
    $buffer = '';

    foreach ($lines as $line) {
        if (preg_match('/^\s*```/', $line)) {
            $out[] = $line;
            $in_codeblock = !$in_codeblock;
            continue;
        }

        if ($in_codeblock) {
            $out[] = $line;
            continue;
        }

        $line_out = '';
        $pos = 0;
        $len = strlen($line);
        while ($pos < $len) {
            if ($in_comment) {
                $end = strpos($line, '-->', $pos);
                if ($end === false) {
                    $buffer .= substr($line, $pos) . "\n";
                    $pos = $len;
                    break;
                }
                $buffer .= substr($line, $pos, $end - $pos);
                $comments[] = $buffer;
                $token = '@@MDW_COMMENT_' . (count($comments) - 1) . '@@';
                $line_out .= $token;
                $buffer = '';
                $in_comment = false;
                $pos = $end + 3;
                continue;
            }

            $start = strpos($line, '<!--', $pos);
            if ($start === false) {
                $line_out .= substr($line, $pos);
                $pos = $len;
                break;
            }
            $line_out .= substr($line, $pos, $start - $pos);
            $pos = $start + 4;
            $in_comment = true;
        }

        $out[] = $line_out;
    }

    if ($in_comment) {
        return [$text, []];
    }

    return [implode("\n", $out), $comments];
}

function mdw_restore_html_comments($html, $comments) {
    if (!$comments || !is_array($comments)) return $html;
    foreach ($comments as $i => $comment) {
        $token = '@@MDW_COMMENT_' . $i . '@@';
        $html = str_replace($token, '<!--' . $comment . '-->', $html);
    }
    return $html;
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

/* Hidden metadata lines at top of markdown (not rendered) */
function mdw_hidden_meta_match($line, &$keyOut = null, &$valueOut = null) {
    $line = (string)$line;

    // Be robust to copy/paste whitespace oddities.
    $line = str_replace("\xC2\xA0", ' ', $line); // NBSP
    $line = preg_replace('/[\x{200B}\x{FEFF}]/u', '', $line); // ZWSP/BOM

    // Match `{key: value}` or legacy `_key: value_`, tolerate extra delimiters.
    $m = null;
    if (preg_match('/^\s*\{+\s*([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*?)\s*\}+\s*$/u', $line, $mm)) {
        $m = $mm;
    } else if (preg_match('/^\s*_+([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*?)\s*_*\s*$/u', $line, $mm)) {
        $m = $mm;
    } else {
        return false;
    }

    $key = strtolower(trim((string)($m[1] ?? '')));
    if ($key === '') return false;

    $allowed = function_exists('mdw_metadata_allowed_keys') ? mdw_metadata_allowed_keys() : [];
    if (empty($allowed)) $allowed = ['date' => true];
    if (!isset($allowed[$key])) return false;

    $keyOut = $key;
    $valueOut = trim((string)($m[2] ?? ''));
    return true;
}

function mdw_hidden_meta_extract_and_remove_all($raw, &$metaOut = null) {
    $raw = str_replace(["\r\n", "\r"], "\n", (string)$raw);
    $lines = explode("\n", $raw);
    if (!$lines) {
        $metaOut = [];
        return '';
    }

    $meta = [];
    $out = [];
    $bufferedLeading = [];
    $inMeta = true;
    $seenMeta = false;

    // Strip BOM on the very first line if present.
    if (isset($lines[0])) {
        $lines[0] = preg_replace('/^\xEF\xBB\xBF/', '', $lines[0]);
    }
    foreach ($lines as $line) {
        if ($inMeta) {
            $k = null;
            $v = null;
            if (mdw_hidden_meta_match($line, $k, $v)) {
                $meta[$k] = $v;
                $seenMeta = true;
                continue;
            }
            if (!$seenMeta && trim((string)$line) === '') {
                $bufferedLeading[] = $line;
                continue;
            }
            $inMeta = false;
            if (!empty($bufferedLeading)) {
                foreach ($bufferedLeading as $buffered) {
                    $out[] = $buffered;
                }
                $bufferedLeading = [];
            }
        }
        $out[] = $line;
    }

    if ($inMeta && !empty($bufferedLeading)) {
        foreach ($bufferedLeading as $buffered) {
            $out[] = $buffered;
        }
    }

    $metaOut = $meta;
    return implode("\n", $out);
}

function mdw_hidden_meta_render_line($key, $value) {
    $key = (string)$key;
    $value = trim((string)$value);
    if ($value === '') return null;
    return '{' . $key . ': ' . $value . '}';
}

function mdw_toc_is_token_line($line) {
    $line = str_replace("\xC2\xA0", ' ', (string)$line);
    $line = preg_replace('/[\x{200B}\x{FEFF}]/u', '', $line);
    $trim = trim($line);
    if ($trim === '') return false;
    return strtoupper($trim) === '{TOC}';
}

function mdw_toc_normalize_id($id) {
    $id = trim((string)$id);
    if ($id === '') return '';
    $id = ltrim($id, '#');
    $id = preg_replace('/\s+/', '-', $id);
    return $id;
}

function mdw_toc_extract_id_attr($attrs) {
    $attrs = (string)$attrs;
    if ($attrs === '') return '';
    if (!preg_match('/\bid\s*=\s*(?:"([^"]*)"|\'([^\']*)\'|([^\s>]+))/i', $attrs, $m)) return '';
    $id = '';
    if (isset($m[1]) && $m[1] !== '') $id = $m[1];
    else if (isset($m[2]) && $m[2] !== '') $id = $m[2];
    else if (isset($m[3]) && $m[3] !== '') $id = $m[3];
    return mdw_toc_normalize_id($id);
}

function mdw_toc_collect_h3($text) {
    $lines = explode("\n", str_replace(["\r\n", "\r"], "\n", (string)$text));
    $items = [];
    $inFence = false;
    $tocActive = false;
    foreach ($lines as $line) {
        if (preg_match('/^\s*```/', $line)) {
            $inFence = !$inFence;
            continue;
        }
        if ($inFence) continue;
        if (mdw_toc_is_token_line($line)) {
            $tocActive = true;
            continue;
        }
        if (!$tocActive) continue;

        if (preg_match('/^\s*<h([1-6])\b([^>]*)>(.*?)<\/h\\1>\s*$/i', $line, $m)) {
            $level = (int)$m[1];
            if ($level === 3) {
                $id = mdw_toc_extract_id_attr($m[2] ?? '');
                $label = trim(strip_tags((string)($m[3] ?? '')));
                $items[] = ['text' => $label, 'id' => $id];
            }
            continue;
        }

        if (preg_match('/^(#{1,6})\s+(.*)$/', $line, $m)) {
            if (strlen($m[1]) === 3) {
                $items[] = ['text' => trim((string)$m[2]), 'id' => ''];
            }
        }
    }
    return $items;
}

function mdw_toc_has_token($text) {
    $lines = explode("\n", str_replace(["\r\n", "\r"], "\n", (string)$text));
    $inFence = false;
    foreach ($lines as $line) {
        if (preg_match('/^\s*```/', $line)) {
            $inFence = !$inFence;
            continue;
        }
        if ($inFence) continue;
        if (mdw_toc_is_token_line($line)) return true;
    }
    return false;
}

function mdw_toc_assign_ids($items) {
    $used = [];
    $out = [];
    foreach ($items as $item) {
        $id = mdw_toc_normalize_id($item['id'] ?? '');
        if ($id !== '' && !isset($used[$id])) {
            $used[$id] = true;
            $item['id'] = $id;
        } else {
            $item['id'] = '';
        }
        $out[] = $item;
    }

    $next = 1;
    foreach ($out as &$item) {
        if ($item['id'] !== '') continue;
        while (isset($used[(string)$next])) $next++;
        $item['id'] = (string)$next;
        $used[$item['id']] = true;
        $next++;
    }
    unset($item);

    return $out;
}

function mdw_html_is_allowed_tag($tag) {
    $tag = strtolower((string)$tag);
    if ($tag === '') return false;
    static $allowed = null;
    if ($allowed === null) {
        $allowed = [
            'div' => true, 'section' => true, 'article' => true, 'aside' => true, 'header' => true, 'footer' => true,
            'nav' => true, 'p' => true, 'ul' => true, 'ol' => true, 'li' => true, 'blockquote' => true,
            'table' => true, 'thead' => true, 'tbody' => true, 'tfoot' => true, 'tr' => true, 'td' => true,
            'th' => true, 'figure' => true, 'figcaption' => true, 'img' => true, 'a' => true, 'span' => true,
            'strong' => true, 'em' => true, 'br' => true, 'hr' => true, 'pre' => true, 'code' => true,
            'details' => true, 'summary' => true,
            'h1' => true, 'h2' => true, 'h3' => true, 'h4' => true, 'h5' => true, 'h6' => true,
        ];
    }
    return isset($allowed[$tag]);
}

function mdw_html_is_self_closing_tag($tag) {
    $tag = strtolower((string)$tag);
    return in_array($tag, ['img','br','hr','meta','link','input'], true);
}

function mdw_html_block_tag_from_line($line) {
    $trim = trim((string)$line);
    if ($trim === '') return '';
    if (!preg_match('/^<([A-Za-z][A-Za-z0-9:-]*)\\b[^>]*>/i', $trim, $m)) return '';
    if (preg_match('/^<\\//', $trim)) return '';
    $tag = strtolower((string)$m[1]);
    if (!mdw_html_is_allowed_tag($tag)) return '';
    if (preg_match('/^h[1-6]$/', $tag)) return '';
    return $tag;
}

function mdw_html_tag_balance_delta($line, $tag) {
    if ($tag === '') return 0;
    $tag = preg_quote((string)$tag, '/');
    $open = preg_match_all('/<'.$tag.'\\b(?![^>]*\\/\\s*>)/i', (string)$line, $m);
    $close = preg_match_all('/<\\/'.$tag.'\\b/i', (string)$line, $m2);
    return (int)$open - (int)$close;
}

function mdw_html_set_attr($attrs, $name, $value) {
    $attrs = trim((string)$attrs);
    $name = preg_quote((string)$name, '/');
    $attrs = preg_replace('/\\s+'.$name.'\\s*=\\s*(\"[^\"]*\"|\\\'[^\\\']*\\\'|[^\\s>]+)/i', '', $attrs);
    $attrs = trim($attrs);
    $safeValue = htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8');
    $attrs .= ($attrs !== '' ? ' ' : '') . preg_replace('/\\\\/', '', $name) . '="' . $safeValue . '"';
    return trim($attrs);
}

function mdw_html_add_class($attrs, $class) {
    $class = trim((string)$class);
    if ($class === '') return trim((string)$attrs);
    $attrs = (string)$attrs;
    $existing = '';
    if (preg_match('/\\bclass\\s*=\\s*(\"([^\"]*)\"|\\\'([^\\\']*)\\\'|([^\\s>]+))/i', $attrs, $m)) {
        $existing = (string)($m[2] ?? $m[3] ?? $m[4] ?? '');
    }
    $classes = preg_split('/\\s+/', trim($existing)) ?: [];
    if (!in_array($class, $classes, true)) {
        $classes[] = $class;
    }
    $new = trim(implode(' ', array_filter($classes)));
    return mdw_html_set_attr($attrs, 'class', $new);
}

function mdw_html_render_heading_line($line, $profile, $context, $mdPath, $tocRequested, $tocActive, $tocItems, &$tocIndex) {
    if (!preg_match('/^\\s*<h([1-6])\\b([^>]*)>(.*?)<\\/h\\1>\\s*$/i', (string)$line, $m)) return null;
    $level = (int)$m[1];
    $attrs = (string)($m[2] ?? '');
    $content = (string)($m[3] ?? '');

    $p = md_render_profile($profile);
    $clsMap = $p['heading_classes'] ?? [];
    $cls = $clsMap[$level] ?? ($profile === 'view' ? "font-bold mt-4 mb-2" : "md-heading");
    $attrs = mdw_html_add_class($attrs, $cls);

    if ($tocRequested && $tocActive && $level === 3 && isset($tocItems[$tocIndex])) {
        $attrs = mdw_html_set_attr($attrs, 'id', (string)$tocItems[$tocIndex]['id']);
        $tocIndex++;
    }

    $attrs = trim($attrs);
    $attrs = $attrs !== '' ? ' ' . $attrs : '';
    return '<h' . $level . $attrs . '>' . inline_md($content, $mdPath, $profile, $context) . '</h' . $level . '>';
}

function mdw_toc_render_html($items, $profile, $context, $mdPath = null) {
    $p = md_render_profile($profile);
    $ulClass = md_join_classes($p['ul_class'] ?? '', 'md-toc');
    $liClass = md_join_classes($p['li_class'] ?? '', 'md-toc-item');
    $ulAttr = $ulClass ? ' class="'.htmlspecialchars($ulClass, ENT_QUOTES, 'UTF-8').'"' : '';
    $liAttr = $liClass ? ' class="'.htmlspecialchars($liClass, ENT_QUOTES, 'UTF-8').'"' : '';

    $out = [];
    $out[] = '<!-- Table of contents -->';
    $out[] = '<div class="md-toc-wrap" data-mdw-toc="1">';
    $out[] = '<ul'.$ulAttr.'>';
    foreach ($items as $item) {
        $label = strip_tags((string)($item['text'] ?? ''));
        $label = htmlspecialchars($label, ENT_QUOTES, 'UTF-8');
        $id = htmlspecialchars((string)($item['id'] ?? ''), ENT_QUOTES, 'UTF-8');
        if ($id === '') continue;
        $out[] = '<li'.$liAttr.'><a href="#'.$id.'">'.$label.'</a></li>';
    }
    $out[] = '</ul>';
    $out[] = '</div>';
    return implode("\n", $out);
}

function mdw_metadata_config_path() {
    $raw = function_exists('env_str') ? (string)env_str('METADATA_CONFIG_FILE', 'metadata_config.json') : 'metadata_config.json';
    $raw = trim($raw);
    if ($raw === '') $raw = 'metadata_config.json';
    if (str_starts_with($raw, '/')) return $raw;
    if (preg_match('/^[A-Za-z]:[\\\\\\/]/', $raw)) return $raw;
    if (str_starts_with($raw, './')) $raw = substr($raw, 2);
    return __DIR__ . '/' . ltrim($raw, "/\\");
}

function mdw_metadata_default_config() {
    return [
        '_meta' => ['version' => 1],
        '_auth' => [
            'user_hash' => '',
            'superuser_hash' => '',
        ],
        '_settings' => [
            'publisher_mode' => false,
            'publisher_default_author' => '',
            'publisher_require_h2' => true,
            'allow_user_delete' => true,
            'copy_buttons_enabled' => true,
            'copy_include_meta' => true,
            'copy_html_mode' => 'dry',
            'post_date_format' => 'mdy_short',
            'post_date_align' => 'left',
            // Global (cross-device) UI defaults, used when publisher_mode is enabled.
            'ui_language' => '',
            'ui_theme' => '', // 'dark' | 'light' | ''
            'theme_preset' => 'default',
            'app_title' => '',
        ],
        'fields' => [
            'date' => ['label' => 'Date', 'markdown_visible' => true, 'html_visible' => false],
        ],
    ];
}

function mdw_metadata_normalize_config($cfg) {
    $def = mdw_metadata_default_config();
    $out = $def;

    if (!is_array($cfg)) return $out;
    $inAuth = isset($cfg['_auth']) && is_array($cfg['_auth']) ? $cfg['_auth'] : [];
    $userHash = isset($inAuth['user_hash']) ? trim((string)$inAuth['user_hash']) : '';
    $superHash = isset($inAuth['superuser_hash']) ? trim((string)$inAuth['superuser_hash']) : '';
    $out['_auth'] = [
        'user_hash' => $userHash,
        'superuser_hash' => $superHash,
    ];
    $inSettings = isset($cfg['_settings']) && is_array($cfg['_settings']) ? $cfg['_settings'] : [];
    $publisherMode = !empty($inSettings['publisher_mode']);
    $publisherDefaultAuthor = isset($inSettings['publisher_default_author']) ? trim((string)$inSettings['publisher_default_author']) : '';
    $publisherRequireH2 = !array_key_exists('publisher_require_h2', $inSettings) ? true : (bool)$inSettings['publisher_require_h2'];
    $allowUserDelete = !array_key_exists('allow_user_delete', $inSettings) ? true : (bool)$inSettings['allow_user_delete'];
    $copyButtonsEnabled = !array_key_exists('copy_buttons_enabled', $inSettings) ? true : (bool)$inSettings['copy_buttons_enabled'];
    $copyIncludeMeta = !array_key_exists('copy_include_meta', $inSettings) ? true : (bool)$inSettings['copy_include_meta'];
    $copyHtmlMode = isset($inSettings['copy_html_mode']) ? trim((string)$inSettings['copy_html_mode']) : 'dry';
    if (!in_array($copyHtmlMode, ['dry', 'medium', 'wet'], true)) $copyHtmlMode = 'dry';
    $postDateFormat = isset($inSettings['post_date_format']) ? trim((string)$inSettings['post_date_format']) : 'mdy_short';
    if (!in_array($postDateFormat, ['mdy_short', 'dmy_long'], true)) $postDateFormat = 'mdy_short';
    $postDateAlign = isset($inSettings['post_date_align']) ? trim((string)$inSettings['post_date_align']) : 'left';
    if (!in_array($postDateAlign, ['left', 'center', 'right'], true)) $postDateAlign = 'left';
    $uiLanguage = isset($inSettings['ui_language']) ? trim((string)$inSettings['ui_language']) : '';
    if ($uiLanguage !== '' && !preg_match('/^[a-z]{2}(-[A-Za-z0-9]+)?$/', $uiLanguage)) $uiLanguage = '';
    $uiTheme = isset($inSettings['ui_theme']) ? strtolower(trim((string)$inSettings['ui_theme'])) : '';
    if ($uiTheme !== 'dark' && $uiTheme !== 'light') $uiTheme = '';
    $themePreset = isset($inSettings['theme_preset']) ? trim((string)$inSettings['theme_preset']) : 'default';
    if ($themePreset === '') $themePreset = 'default';
    $appTitle = isset($inSettings['app_title']) ? trim((string)$inSettings['app_title']) : '';
    $out['_settings'] = [
        'publisher_mode' => (bool)$publisherMode,
        'publisher_default_author' => $publisherDefaultAuthor,
        'publisher_require_h2' => (bool)$publisherRequireH2,
        'allow_user_delete' => (bool)$allowUserDelete,
        'copy_buttons_enabled' => (bool)$copyButtonsEnabled,
        'copy_include_meta' => (bool)$copyIncludeMeta,
        'copy_html_mode' => $copyHtmlMode,
        'post_date_format' => $postDateFormat,
        'post_date_align' => $postDateAlign,
        'ui_language' => $uiLanguage,
        'ui_theme' => $uiTheme,
        'theme_preset' => $themePreset,
        'app_title' => $appTitle,
    ];

    $fields = isset($cfg['fields']) && is_array($cfg['fields']) ? $cfg['fields'] : [];
    foreach ($out['fields'] as $k => $v) {
        $in = isset($fields[$k]) && is_array($fields[$k]) ? $fields[$k] : [];
        $label = isset($in['label']) && is_string($in['label']) && trim($in['label']) !== ''
            ? trim($in['label'])
            : (string)($v['label'] ?? $k);
        $mdVis = isset($in['markdown_visible']) ? (bool)$in['markdown_visible'] : (bool)($v['markdown_visible'] ?? true);
        $htmlVis = isset($in['html_visible']) ? (bool)$in['html_visible'] : (bool)($v['html_visible'] ?? false);
        if (!$mdVis) $htmlVis = false;
        $out['fields'][$k] = [
            'label' => $label,
            'markdown_visible' => $mdVis,
            'html_visible' => $htmlVis,
        ];
    }

    return $out;
}

function mdw_metadata_publisher_config_path() {
    $raw = function_exists('env_str') ? (string)env_str('METADATA_PUBLISHER_CONFIG_FILE', 'metadata_publisher_config.json') : 'metadata_publisher_config.json';
    $raw = trim($raw);
    if ($raw === '') $raw = 'metadata_publisher_config.json';
    if (str_starts_with($raw, '/')) return $raw;
    if (preg_match('/^[A-Za-z]:[\\\\\\/]/', $raw)) return $raw;
    if (str_starts_with($raw, './')) $raw = substr($raw, 2);
    return __DIR__ . '/' . ltrim($raw, "/\\");
}

function mdw_metadata_default_publisher_config() {
    return [
        '_meta' => ['version' => 1],
        'fields' => [
            'author' => ['label' => 'Author', 'markdown_visible' => true, 'html_visible' => false],
            'creationdate' => ['label' => 'Created', 'markdown_visible' => true, 'html_visible' => false],
            'changedate' => ['label' => 'Updated', 'markdown_visible' => true, 'html_visible' => false],
            'publishstate' => ['label' => 'Publish state', 'markdown_visible' => true, 'html_visible' => false],

            'extends' => ['label' => 'Extends', 'markdown_visible' => true, 'html_visible' => false],
            'page_title' => ['label' => 'Page title', 'markdown_visible' => true, 'html_visible' => true],
            'page_subtitle' => ['label' => 'Page subtitle', 'markdown_visible' => true, 'html_visible' => true],
            'post_date' => ['label' => 'Post date', 'markdown_visible' => true, 'html_visible' => true],
            'page_picture' => ['label' => 'Page picture', 'markdown_visible' => true, 'html_visible' => true],
            'active_page' => ['label' => 'Active page', 'markdown_visible' => true, 'html_visible' => false],
            'cta' => ['label' => 'CTA', 'markdown_visible' => true, 'html_visible' => false],
            'blurmenu' => ['label' => 'Blur menu', 'markdown_visible' => true, 'html_visible' => false],
            'sociallinks' => ['label' => 'Social links', 'markdown_visible' => true, 'html_visible' => false],
            'blog' => ['label' => 'Blog', 'markdown_visible' => true, 'html_visible' => false],
        ],
        'html_map' => [
            'page_title' => ['prefix' => '<h1>', 'postfix' => '</h1>', 'omit_meta' => true],
            'page_subtitle' => ['prefix' => '<h2>', 'postfix' => '</h2>', 'omit_meta' => true],
        ],
    ];
}

function mdw_metadata_normalize_publisher_config($cfg) {
    $def = mdw_metadata_default_publisher_config();
    $out = $def;

    if (!is_array($cfg)) return $out;
    $fields = isset($cfg['fields']) && is_array($cfg['fields']) ? $cfg['fields'] : [];
    foreach ($out['fields'] as $k => $v) {
        $in = isset($fields[$k]) && is_array($fields[$k]) ? $fields[$k] : [];
        $label = isset($in['label']) && is_string($in['label']) && trim($in['label']) !== ''
            ? trim($in['label'])
            : (string)($v['label'] ?? $k);
        $mdVis = isset($in['markdown_visible']) ? (bool)$in['markdown_visible'] : (bool)($v['markdown_visible'] ?? true);
        $htmlVis = isset($in['html_visible']) ? (bool)$in['html_visible'] : (bool)($v['html_visible'] ?? false);
        if (!$mdVis) $htmlVis = false;
        $out['fields'][$k] = [
            'label' => $label,
            'markdown_visible' => $mdVis,
            'html_visible' => $htmlVis,
        ];
    }

    $defMap = (isset($def['html_map']) && is_array($def['html_map'])) ? $def['html_map'] : [];
    $inMap = (isset($cfg['html_map']) && is_array($cfg['html_map'])) ? $cfg['html_map'] : [];
    $mapOut = [];

    $normalizeMapSpec = function($spec, $fallback = []) {
        $spec = is_array($spec) ? $spec : [];
        $fallback = is_array($fallback) ? $fallback : [];
        $prefix = array_key_exists('prefix', $spec) ? (string)$spec['prefix'] : (string)($fallback['prefix'] ?? '');
        $postfix = array_key_exists('postfix', $spec) ? (string)$spec['postfix'] : (string)($fallback['postfix'] ?? '');
        $omitMeta = array_key_exists('omit_meta', $spec) ? (bool)$spec['omit_meta'] : (bool)($fallback['omit_meta'] ?? false);
        $enabled = array_key_exists('enabled', $spec) ? (bool)$spec['enabled'] : (bool)($fallback['enabled'] ?? true);
        return ['prefix' => $prefix, 'postfix' => $postfix, 'omit_meta' => $omitMeta, 'enabled' => $enabled];
    };

    foreach ($defMap as $k => $spec) {
        if (!is_string($k) || $k === '') continue;
        $kk = strtolower($k);
        $mapOut[$kk] = $normalizeMapSpec($spec, []);
    }
    foreach ($inMap as $k => $spec) {
        if (!is_string($k) || $k === '') continue;
        $kk = strtolower($k);
        $mapOut[$kk] = $normalizeMapSpec($spec, $mapOut[$kk] ?? []);
    }

    $out['html_map'] = $mapOut;
    return $out;
}

function mdw_metadata_load_publisher_config() {
    static $cache = null;
    if ($cache !== null) return $cache;

    $path = mdw_metadata_publisher_config_path();
    $def = mdw_metadata_default_publisher_config();
    if (!is_file($path)) {
        $cache = $def;
        return $cache;
    }
    $raw = @file_get_contents($path);
    $j = json_decode((string)$raw, true);
    $cache = mdw_metadata_normalize_publisher_config($j);
    return $cache;
}

function mdw_metadata_save_publisher_config($cfg) {
    $norm = mdw_metadata_normalize_publisher_config($cfg);
    $path = mdw_metadata_publisher_config_path();
    $pathNorm = str_replace("\\", "/", (string)$path);
    $rootNorm = str_replace("\\", "/", (string)__DIR__);
    $shortPath = (str_starts_with($pathNorm, rtrim($rootNorm, '/') . '/'))
        ? substr($pathNorm, strlen(rtrim($rootNorm, '/')) + 1)
        : basename($pathNorm);
    $dir = dirname($path);
    if (!is_dir($dir)) return [false, 'Config directory does not exist.'];
    if (!is_writable($dir)) return [false, 'Config directory not writable: ' . basename($dir)];
    if (is_file($path) && !is_writable($path)) return [false, 'Config file not writable: ' . $shortPath];
    $json = json_encode($norm, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if (!is_string($json) || $json === '') return [false, 'Could not encode config JSON.'];
    if (@file_put_contents($path, $json . "\n", LOCK_EX) === false) {
        $err = error_get_last();
        $msg = 'Could not write config file: ' . $shortPath;
        if ($err && !empty($err['message'])) $msg .= ' (' . $err['message'] . ')';
        return [false, $msg];
    }
    @chmod($path, 0664);
    $GLOBALS['__mdw_metadata_publisher_cache_bust'] = microtime(true);
    return [true, 'ok'];
}

function mdw_metadata_all_field_configs($publisherMode = null) {
    $cfg = mdw_metadata_load_config();
    $baseFields = isset($cfg['fields']) && is_array($cfg['fields']) ? $cfg['fields'] : [];

    if ($publisherMode === null) {
        $s = mdw_metadata_settings();
        $publisherMode = !empty($s['publisher_mode']);
    }

    if (!$publisherMode) return $baseFields;
    $pcfg = mdw_metadata_load_publisher_config();
    $pubFields = isset($pcfg['fields']) && is_array($pcfg['fields']) ? $pcfg['fields'] : [];
    // Publisher fields can override base fields if needed.
    return array_merge($baseFields, $pubFields);
}

function mdw_metadata_allowed_keys() {
    static $allowed = null;
    if (is_array($allowed)) return $allowed;

    $a = [];
    $cfg = mdw_metadata_load_config();
    $fields = isset($cfg['fields']) && is_array($cfg['fields']) ? $cfg['fields'] : [];
    foreach ($fields as $k => $_v) {
        if (!is_string($k) || $k === '') continue;
        $a[strtolower($k)] = true;
    }

    $pcfg = mdw_metadata_load_publisher_config();
    $pfields = isset($pcfg['fields']) && is_array($pcfg['fields']) ? $pcfg['fields'] : [];
    foreach ($pfields as $k => $_v) {
        if (!is_string($k) || $k === '') continue;
        $a[strtolower($k)] = true;
    }

    $allowed = $a;
    return $allowed;
}

function mdw_metadata_settings() {
    $cfg = mdw_metadata_load_config();
    $s = isset($cfg['_settings']) && is_array($cfg['_settings']) ? $cfg['_settings'] : [];
    $out = [
        'publisher_mode' => !empty($s['publisher_mode']),
        'publisher_default_author' => isset($s['publisher_default_author']) ? trim((string)$s['publisher_default_author']) : '',
        'publisher_require_h2' => !array_key_exists('publisher_require_h2', $s) ? true : (bool)$s['publisher_require_h2'],
        'allow_user_delete' => !array_key_exists('allow_user_delete', $s) ? true : (bool)$s['allow_user_delete'],
        'copy_buttons_enabled' => !array_key_exists('copy_buttons_enabled', $s) ? true : (bool)$s['copy_buttons_enabled'],
        'copy_include_meta' => !array_key_exists('copy_include_meta', $s) ? true : (bool)$s['copy_include_meta'],
        'copy_html_mode' => isset($s['copy_html_mode']) ? trim((string)$s['copy_html_mode']) : 'dry',
        'post_date_format' => isset($s['post_date_format']) ? trim((string)$s['post_date_format']) : 'mdy_short',
        'post_date_align' => isset($s['post_date_align']) ? trim((string)$s['post_date_align']) : 'left',
        'ui_language' => isset($s['ui_language']) ? trim((string)$s['ui_language']) : '',
        'ui_theme' => isset($s['ui_theme']) ? strtolower(trim((string)$s['ui_theme'])) : '',
        'theme_preset' => isset($s['theme_preset']) ? trim((string)$s['theme_preset']) : 'default',
        'app_title' => isset($s['app_title']) ? trim((string)$s['app_title']) : '',
    ];
    if (!in_array($out['post_date_format'], ['mdy_short', 'dmy_long'], true)) $out['post_date_format'] = 'mdy_short';
    if (!in_array($out['post_date_align'], ['left', 'center', 'right'], true)) $out['post_date_align'] = 'left';
    if (!in_array($out['copy_html_mode'], ['dry', 'medium', 'wet'], true)) $out['copy_html_mode'] = 'dry';
    if ($out['ui_language'] !== '' && !preg_match('/^[a-z]{2}(-[A-Za-z0-9]+)?$/', $out['ui_language'])) $out['ui_language'] = '';
    if ($out['ui_theme'] !== 'dark' && $out['ui_theme'] !== 'light') $out['ui_theme'] = '';
    if ($out['theme_preset'] === '') $out['theme_preset'] = 'default';
    return $out;
}

function mdw_parse_date_parts($raw) {
    $raw = trim((string)$raw);
    if ($raw === '') return null;
    if (preg_match('/^(\\d{4})[\\-\\/\\._](\\d{1,2})[\\-\\/\\._](\\d{1,2})/', $raw, $m)) {
        return [(int)$m[1], (int)$m[2], (int)$m[3]];
    }
    if (preg_match('/^(\\d{1,2})[\\-\\/\\._](\\d{1,2})[\\-\\/\\._](\\d{4})/', $raw, $m)) {
        return [(int)$m[3], (int)$m[2], (int)$m[1]];
    }
    if (preg_match('/^(\\d{2})[\\-\\/\\._](\\d{1,2})[\\-\\/\\._](\\d{1,2})/', $raw, $m)) {
        $yy = (int)$m[1];
        $year = $yy < 70 ? (2000 + $yy) : (1900 + $yy);
        return [$year, (int)$m[2], (int)$m[3]];
    }
    $ts = strtotime($raw);
    if ($ts === false) return null;
    return [(int)date('Y', $ts), (int)date('n', $ts), (int)date('j', $ts)];
}

function mdw_post_date_months($lang) {
    $lang = strtolower(trim((string)$lang));
    $lang = $lang !== '' ? substr($lang, 0, 2) : 'en';
    $map = [
        'en' => [
            'short' => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            'long' => ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
        ],
        'nl' => [
            'short' => ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'],
            'long' => ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'],
        ],
        'de' => [
            'short' => ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'],
            'long' => ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
        ],
        'fr' => [
            'short' => ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'],
            'long' => ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
        ],
        'pt' => [
            'short' => ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'],
            'long' => ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'],
        ],
    ];
    if (!isset($map[$lang])) $lang = 'en';
    return $map[$lang];
}

function mdw_format_post_date_value($raw, $format, $lang = null) {
    $parts = mdw_parse_date_parts($raw);
    if (!$parts) return (string)$raw;
    [$year, $month, $day] = $parts;
    if ($month < 1 || $month > 12) return (string)$raw;
    $lang = $lang !== null ? (string)$lang : (string)($GLOBALS['MDW_I18N_LANG'] ?? 'en');
    $months = mdw_post_date_months($lang);
    $format = in_array($format, ['mdy_short', 'dmy_long'], true) ? $format : 'mdy_short';
    if ($format === 'dmy_long') {
        $label = $months['long'][$month - 1] ?? '';
        if ($label === '') return (string)$raw;
        if (strtolower(substr((string)$lang, 0, 2)) === 'de') {
            return sprintf('%d. %s %d', $day, $label, $year);
        }
        return sprintf('%d %s %d', $day, $label, $year);
    }
    $label = $months['short'][$month - 1] ?? '';
    if ($label === '') return (string)$raw;
    return sprintf('%s %d, %d', $label, $day, $year);
}

function mdw_attr_list_parse_line($line) {
    $line = trim((string)$line);
    if ($line === '') return null;
    if (!preg_match_all('/\\{:\\s*[^}]+\\}/', $line, $m)) return null;
    $stripped = trim(preg_replace('/\\{:\\s*[^}]+\\}/', '', $line));
    if ($stripped !== '') return null;
    $attrs = ['class' => '', 'style' => ''];
    foreach ($m[0] as $chunk) {
        if (!preg_match('/\\{:\\s*([^}]+)\\}/', $chunk, $cm)) continue;
        $inner = (string)$cm[1];
        if (!preg_match_all('/\\b(class|style)\\s*=\\s*(\"([^\"]*)\"|\\\'([^\\\']*)\\\'|([^\\s]+))/i', $inner, $am, PREG_SET_ORDER)) {
            continue;
        }
        foreach ($am as $match) {
            $key = strtolower((string)($match[1] ?? ''));
            $val = $match[3] ?? ($match[4] ?? ($match[5] ?? ''));
            $val = html_entity_decode((string)$val, ENT_QUOTES, 'UTF-8');
            if ($key === 'class') {
                $val = preg_replace('/[^A-Za-z0-9_\\-\\s]+/', '', $val);
                $val = trim(preg_replace('/\\s+/', ' ', $val));
                if ($val !== '') {
                    $attrs['class'] = trim($attrs['class'] . ' ' . $val);
                }
            } else if ($key === 'style') {
                $val = preg_replace('/[^A-Za-z0-9_\\-\\s:;,#.%()]/', '', $val);
                $val = trim($val);
                if ($val !== '') {
                    $attrs['style'] = trim($attrs['style'] . '; ' . $val);
                }
            }
        }
    }
    $out = [];
    if (isset($attrs['class']) && $attrs['class'] !== '') $out['class'] = $attrs['class'];
    if (isset($attrs['style']) && $attrs['style'] !== '') $out['style'] = trim($attrs['style'], '; ');
    return $out ?: null;
}

function mdw_apply_attr_list_to_html($html, $attrs) {
    if (!is_string($html) || !$attrs || !is_array($attrs)) return $html;
    if (!preg_match('/^<([A-Za-z][A-Za-z0-9:-]*)([^>]*)>/', $html, $m)) return $html;
    $tag = $m[1];
    $attrStr = (string)($m[2] ?? '');

    if (isset($attrs['class']) && $attrs['class'] !== '') {
        if (preg_match('/\\bclass\\s*=\\s*\"([^\"]*)\"/i', $attrStr, $cm)) {
            $merged = trim(preg_replace('/\\s+/', ' ', trim($cm[1]) . ' ' . $attrs['class']));
            $attrStr = preg_replace('/\\bclass\\s*=\\s*\"[^\"]*\"/i', ' class="'.htmlspecialchars($merged, ENT_QUOTES, 'UTF-8').'"', $attrStr, 1);
        } else {
            $attrStr .= ' class="'.htmlspecialchars($attrs['class'], ENT_QUOTES, 'UTF-8').'"';
        }
    }
    if (isset($attrs['style']) && $attrs['style'] !== '') {
        if (preg_match('/\\bstyle\\s*=\\s*\"([^\"]*)\"/i', $attrStr, $sm)) {
            $existing = trim((string)$sm[1]);
            $extra = trim((string)$attrs['style']);
            $merged = $existing !== '' ? rtrim($existing, ';') . '; ' . $extra : $extra;
            $attrStr = preg_replace('/\\bstyle\\s*=\\s*\"[^\"]*\"/i', ' style="'.htmlspecialchars($merged, ENT_QUOTES, 'UTF-8').'"', $attrStr, 1);
        } else {
            $attrStr .= ' style="'.htmlspecialchars($attrs['style'], ENT_QUOTES, 'UTF-8').'"';
        }
    }

    $newTag = '<' . $tag . $attrStr . '>';
    return $newTag . substr($html, strlen($m[0]));
}

function mdw_merge_attr_list($base, $extra) {
    if (!$base) return $extra;
    if (!$extra) return $base;
    $out = $base;
    if (isset($extra['class']) && $extra['class'] !== '') {
        $out['class'] = trim(($out['class'] ?? '') . ' ' . $extra['class']);
    }
    if (isset($extra['style']) && $extra['style'] !== '') {
        $existing = trim((string)($out['style'] ?? ''));
        $extraStyle = trim((string)$extra['style']);
        if ($existing !== '' && $extraStyle !== '') {
            $out['style'] = rtrim($existing, ';') . '; ' . $extraStyle;
        } else if ($extraStyle !== '') {
            $out['style'] = $extraStyle;
        }
    }
    return $out;
}

function mdw_apply_attr_list_to_last_html(&$html, $attrs) {
    if (!$attrs || !is_array($attrs) || !is_array($html)) return false;
    for ($i = count($html) - 1; $i >= 0; $i--) {
        $entry = $html[$i];
        if (!is_string($entry)) continue;
        $trim = trim($entry);
        if ($trim === '' || $trim[0] !== '<') continue;
        if (preg_match('/^<\\//', $trim)) continue;
        if (!preg_match('/^<([A-Za-z][A-Za-z0-9:-]*)(\\s|>)/', $trim)) continue;
        $html[$i] = mdw_apply_attr_list_to_html($entry, $attrs);
        return true;
    }
    return false;
}

function mdw_attr_list_extract_classes($line) {
    $line = trim((string)$line);
    if ($line === '') return null;
    if (!preg_match_all('/\\{:\\s*[^}]+\\}/', $line, $m)) return null;
    $stripped = trim(preg_replace('/\\{:\\s*[^}]+\\}/', '', $line));
    if ($stripped !== '') return null;
    $classes = [];
    foreach ($m[0] as $chunk) {
        if (!preg_match('/\\bclass\\s*=\\s*(\"([^\"]*)\"|\\\'([^\\\']*)\\\'|([^\\s]+))/i', $chunk, $cm)) continue;
        $val = $cm[2] ?? ($cm[3] ?? ($cm[4] ?? ''));
        $val = html_entity_decode((string)$val, ENT_QUOTES, 'UTF-8');
        $val = preg_replace('/[^A-Za-z0-9_\\-\\s]+/', '', $val);
        $val = trim(preg_replace('/\\s+/', ' ', $val));
        if ($val !== '') $classes[] = $val;
    }
    return $classes;
}

function mdw_auth_hash_password($password) {
    $password = (string)$password;
    if ($password === '') return '';
    return hash('sha256', $password);
}

function mdw_auth_config() {
    $cfg = mdw_metadata_load_config();
    $auth = isset($cfg['_auth']) && is_array($cfg['_auth']) ? $cfg['_auth'] : [];
    return [
        'user_hash' => isset($auth['user_hash']) ? trim((string)$auth['user_hash']) : '',
        'superuser_hash' => isset($auth['superuser_hash']) ? trim((string)$auth['superuser_hash']) : '',
    ];
}

function mdw_auth_has_role($role) {
    $auth = mdw_auth_config();
    if ($role === 'superuser') return $auth['superuser_hash'] !== '';
    if ($role === 'user') return $auth['user_hash'] !== '';
    return false;
}

function mdw_auth_verify_token($role, $token) {
    $token = (string)$token;
    if ($token === '') return false;
    $auth = mdw_auth_config();
    if ($role === 'superuser' && $auth['superuser_hash'] !== '') {
        return hash_equals($auth['superuser_hash'], $token);
    }
    if ($role === 'user' && $auth['user_hash'] !== '') {
        return hash_equals($auth['user_hash'], $token);
    }
    return false;
}

function mdw_publisher_mode_enabled() {
    $s = mdw_metadata_settings();
    return !empty($s['publisher_mode']);
}

function mdw_md_has_h2($raw) {
    $raw = str_replace(["\r\n", "\r"], "\n", (string)$raw);
    $lines = explode("\n", $raw);
    $inFence = false;
    $inMeta = true;
    $seenMeta = false;
    foreach ($lines as $line) {
        if ($inMeta) {
            $k = null; $v = null;
            if (function_exists('mdw_hidden_meta_match') && mdw_hidden_meta_match($line, $k, $v)) {
                $seenMeta = true;
                continue;
            }
            if (!$seenMeta && trim((string)$line) === '') {
                continue;
            }
            $inMeta = false;
        }

        if (preg_match('/^\s*```/', $line)) {
            $inFence = !$inFence;
            continue;
        }
        if ($inFence) continue;
        if (preg_match('/^\s*##\s+\S/', $line)) return true;
    }
    return false;
}

function mdw_publisher_normalize_publishstate($raw) {
    $v = trim((string)$raw);
    if ($v === '') return 'Concept';
    $l = strtolower($v);
    $l = preg_replace('/\s+/', ' ', $l);
    if ($l === 'concept') return 'Concept';
    if ($l === 'processing' || $l === 'in progress' || $l === 'in-progress') return 'Processing';
    if ($l === 'to publish' || $l === 'topublish' || $l === 'to-publish') return 'Processing';
    if ($l === 'published') return 'Published';
    return $v;
}

function mdw_metadata_load_config() {
    static $cache = null;
    if ($cache !== null) return $cache;

    $path = mdw_metadata_config_path();
    $def = mdw_metadata_default_config();
    if (!is_file($path)) {
        $cache = $def;
        return $cache;
    }
    $raw = @file_get_contents($path);
    $j = json_decode((string)$raw, true);
    $cache = mdw_metadata_normalize_config($j);
    return $cache;
}

function mdw_metadata_save_config($cfg) {
    $norm = mdw_metadata_normalize_config($cfg);
    $path = mdw_metadata_config_path();
    $pathNorm = str_replace("\\", "/", (string)$path);
    $rootNorm = str_replace("\\", "/", (string)__DIR__);
    $shortPath = (str_starts_with($pathNorm, rtrim($rootNorm, '/') . '/'))
        ? substr($pathNorm, strlen(rtrim($rootNorm, '/')) + 1)
        : basename($pathNorm);
    $dir = dirname($path);
    if (!is_dir($dir)) return [false, 'Config directory does not exist.'];
    if (!is_writable($dir)) return [false, 'Config directory not writable: ' . basename($dir)];
    if (is_file($path) && !is_writable($path)) return [false, 'Config file not writable: ' . $shortPath];
    $json = json_encode($norm, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if (!is_string($json) || $json === '') return [false, 'Could not encode config JSON.'];
    if (@file_put_contents($path, $json . "\n", LOCK_EX) === false) {
        $err = error_get_last();
        $msg = 'Could not write config file: ' . $shortPath;
        if ($err && !empty($err['message'])) $msg .= ' (' . $err['message'] . ')';
        return [false, $msg];
    }
    @chmod($path, 0664);
    // Reset cache so the new settings apply immediately.
    $GLOBALS['__mdw_metadata_cache_bust'] = microtime(true);
    return [true, 'ok'];
}

function mdw_hidden_meta_ensure_block($raw, $mdPath = null, $opts = []) {
    $meta = [];
    $body = mdw_hidden_meta_extract_and_remove_all($raw, $meta);

    $now = date('Y-m-d H:i');
    $today = date('y-m-d');

    $settings = (isset($opts['settings']) && is_array($opts['settings'])) ? $opts['settings'] : mdw_metadata_settings();
    $publisherMode = !empty($settings['publisher_mode']);
    $publisherDefaultAuthor = isset($settings['publisher_default_author']) ? trim((string)$settings['publisher_default_author']) : '';

    if (!empty($opts['set'])) {
        foreach ((array)$opts['set'] as $k => $v) {
            $kk = strtolower((string)$k);
            if ($kk === 'publishstate') $kk = 'publishstate';
            $meta[$kk] = (string)$v;
        }
    }

    if (!isset($meta['date']) || trim((string)$meta['date']) === '') {
        $fileDate = null;
        if (is_string($mdPath) && $mdPath !== '') {
            $base = basename(str_replace("\\", "/", $mdPath));
            if (preg_match('/^(\d{2}-\d{2}-\d{2})-/', $base, $m)) {
                $fileDate = $m[1];
            }
        }
        $meta['date'] = $fileDate ?: $today;
    }

    if ($publisherMode) {
        if (!isset($meta['creationdate']) || trim((string)$meta['creationdate']) === '') {
            $meta['creationdate'] = $now;
        }
        $meta['changedate'] = $now;

        if (!isset($meta['publishstate']) || trim((string)$meta['publishstate']) === '') {
            $meta['publishstate'] = 'Concept';
        }
        $meta['publishstate'] = mdw_publisher_normalize_publishstate($meta['publishstate'] ?? '');
        if (!isset($meta['author']) || trim((string)$meta['author']) === '') {
            if ($publisherDefaultAuthor !== '') {
                $meta['author'] = $publisherDefaultAuthor;
            }
        }
    } else {
        // If these fields already exist, keep them but do not inject new ones.
        if (isset($meta['changedate']) && trim((string)$meta['changedate']) !== '') {
            // Do not auto-update changedate outside publisher mode.
        }
    }

    $baseCfg = mdw_metadata_load_config();
    $baseFields = isset($baseCfg['fields']) && is_array($baseCfg['fields']) ? $baseCfg['fields'] : [];
    $pubCfg = mdw_metadata_load_publisher_config();
    $pubFields = isset($pubCfg['fields']) && is_array($pubCfg['fields']) ? $pubCfg['fields'] : [];

    $order = [];
    foreach (array_keys($baseFields) as $k) {
        $k = strtolower((string)$k);
        if ($k !== '' && !in_array($k, $order, true)) $order[] = $k;
    }
    // Stable publisher order.
    $publisherOrder = ['extends','page_title','page_subtitle','post_date','page_picture','active_page','cta','blurmenu','sociallinks','blog','author','creationdate','changedate','publishstate'];
    foreach ($publisherOrder as $k) {
        if (!isset($pubFields[$k])) continue;
        if (!$publisherMode && !array_key_exists($k, $meta)) continue;
        if (!in_array($k, $order, true)) $order[] = $k;
    }
    // Preserve any extra known keys present in file.
    foreach (array_keys($meta) as $k) {
        $k = strtolower((string)$k);
        if ($k === '') continue;
        if (!isset($baseFields[$k]) && !isset($pubFields[$k])) continue;
        if (!in_array($k, $order, true)) $order[] = $k;
    }

    $outLines = [];
    foreach ($order as $k) {
        if (!isset($meta[$k])) continue;
        $line = mdw_hidden_meta_render_line($k, $meta[$k]);
        if ($line !== null) $outLines[] = $line;
    }

    $body = ltrim((string)$body, "\n");
    if ($body !== '') {
        $outLines[] = '';
        $outLines[] = $body;
    }

    return implode("\n", $outLines);
}

/* BLOCK MARKDOWN -> HTML */
function md_to_html($text, $mdPath = null, $profile = 'edit', $context = null) {
    $p = md_render_profile($profile);

    $meta = [];
    $body = mdw_hidden_meta_extract_and_remove_all($text, $meta);
    $settings = mdw_metadata_settings();
    $publisherMode = !empty($settings['publisher_mode']);
    $cfg = mdw_metadata_load_config();
    $pcfg = mdw_metadata_load_publisher_config();

    $text = str_replace(["\r\n","\r"], "\n", $body);
    [$text, $comments] = mdw_extract_html_comments($text);
    $context = is_array($context) ? $context : [];
    [$text, $localFootnotes] = mdw_extract_footnotes($text);
    $footnotes = (isset($context['footnotes']) && is_array($context['footnotes'])) ? $context['footnotes'] : [];
    foreach ($localFootnotes as $k => $v) {
        if (!isset($footnotes[$k])) $footnotes[$k] = $v;
    }
    $context['footnotes'] = $footnotes;

    $tocRequested = mdw_toc_has_token($text);
    $tocItems = $tocRequested ? mdw_toc_assign_ids(mdw_toc_collect_h3($text)) : [];
    $tocIndex = 0;
    $tocActive = false;

    $lines = explode("\n",$text);
    $footnoteInfo = mdw_collect_footnote_refs($text);
    $footnoteRefs = (is_array($footnoteInfo) && isset($footnoteInfo['order']) && is_array($footnoteInfo['order']))
        ? $footnoteInfo['order']
        : [];
    $footnoteLabels = (is_array($footnoteInfo) && isset($footnoteInfo['labels']) && is_array($footnoteInfo['labels']))
        ? $footnoteInfo['labels']
        : [];

    $html = [];
    $in_codeblock = false;
    $codeblock_type = null;
    $listStack = [];
    $inHtmlBlock = false;
    $htmlBlockTag = '';
    $htmlBlockDepth = 0;

    // Render metadata block (optional, based on config).
    $baseFields = isset($cfg['fields']) && is_array($cfg['fields']) ? $cfg['fields'] : [];
    $pubFields = ($publisherMode && isset($pcfg['fields']) && is_array($pcfg['fields'])) ? $pcfg['fields'] : [];
    $metaFields = array_merge($baseFields, $pubFields);
    $metaShown = [];
    $order = [];
    foreach (array_keys($baseFields) as $k) $order[] = $k;
    foreach (['extends','page_title','page_subtitle','post_date','page_picture','active_page','cta','blurmenu','sociallinks','blog','author','creationdate','changedate','publishstate'] as $k) {
        if (!isset($pubFields[$k])) continue;
        $order[] = $k;
    }
    $order = array_values(array_unique(array_map(fn($x) => strtolower((string)$x), $order)));

    $pagePictureHtml = '';
    $pictureInserted = false;
    if ($publisherMode) {
        $pictureValue = isset($meta['page_picture']) ? trim((string)$meta['page_picture']) : '';
        if ($pictureValue !== '') {
            $f = isset($metaFields['page_picture']) && is_array($metaFields['page_picture']) ? $metaFields['page_picture'] : null;
            $mdVis = $f ? (bool)($f['markdown_visible'] ?? true) : true;
            $htmlVis = $f ? (bool)($f['html_visible'] ?? false) : false;
            if (!$mdVis) $htmlVis = false;
            if ($htmlVis) {
                $titleText = isset($meta['page_title']) ? trim((string)$meta['page_title']) : '';
                $src = mdw_page_picture_src($pictureValue);
                if ($src !== '') {
                    $pagePictureHtml = '<img class="md-img" src="' . htmlspecialchars($src, ENT_QUOTES, 'UTF-8') . '" alt="' . htmlspecialchars($titleText, ENT_QUOTES, 'UTF-8') . '" loading="lazy" decoding="async">';
                }
            }
        }
    }

    $mappedMetaKeys = [];
    if ($publisherMode) {
        $htmlMap = (isset($pcfg['html_map']) && is_array($pcfg['html_map'])) ? $pcfg['html_map'] : [];
        if (!empty($htmlMap)) {
            foreach ($order as $k) {
                if (!isset($meta[$k])) continue;
                $spec = (isset($htmlMap[$k]) && is_array($htmlMap[$k])) ? $htmlMap[$k] : null;
                if (!$spec) continue;
                if (array_key_exists('enabled', $spec) && !$spec['enabled']) continue;
                $v = trim((string)$meta[$k]);
                if ($v === '') continue;
                if ($k === 'post_date') {
                    $v = mdw_format_post_date_value($v, $settings['post_date_format'] ?? 'mdy_short');
                }
                $f = isset($metaFields[$k]) && is_array($metaFields[$k]) ? $metaFields[$k] : null;
                $mdVis = $f ? (bool)($f['markdown_visible'] ?? true) : true;
                $htmlVis = $f ? (bool)($f['html_visible'] ?? false) : false;
                if (!$mdVis) $htmlVis = false;
                if (!$htmlVis) continue;
                $prefix = isset($spec['prefix']) ? (string)$spec['prefix'] : '';
                $postfix = isset($spec['postfix']) ? (string)$spec['postfix'] : '';
                $html[] = $prefix . htmlspecialchars($v, ENT_QUOTES, 'UTF-8') . $postfix;
                if (!empty($spec['omit_meta'])) {
                    $mappedMetaKeys[$k] = true;
                }
                if ($k === 'page_title' && $pagePictureHtml !== '') {
                    $html[] = $pagePictureHtml;
                    $mappedMetaKeys['page_picture'] = true;
                    $pictureInserted = true;
                }
            }
        }
    }

    if ($pagePictureHtml !== '' && !$pictureInserted) {
        $html[] = $pagePictureHtml;
        $mappedMetaKeys['page_picture'] = true;
    }

    foreach ($order as $k) {
        if (!isset($meta[$k])) continue;
        $v = trim((string)$meta[$k]);
        if ($v === '') continue;
        if (isset($mappedMetaKeys[$k])) continue;
        if ($k === 'post_date') {
            $v = mdw_format_post_date_value($v, $settings['post_date_format'] ?? 'mdy_short');
        }
        $f = isset($metaFields[$k]) && is_array($metaFields[$k]) ? $metaFields[$k] : null;
        $mdVis = $f ? (bool)($f['markdown_visible'] ?? true) : true;
        $htmlVis = $f ? (bool)($f['html_visible'] ?? false) : false;
        if (!$mdVis) $htmlVis = false;
        if (!$htmlVis) continue;
        $label = $f && isset($f['label']) ? (string)$f['label'] : $k;
        $isPostDate = ($k === 'post_date');
        $metaShown[] = [
            'k' => $k,
            'label' => $label,
            'value' => $v,
            'no_label' => $isPostDate,
            'align' => $isPostDate ? ($settings['post_date_align'] ?? 'left') : null,
        ];
    }

    if (!empty($metaShown)) {
        $html[] = '<dl class="md-meta">';
        foreach ($metaShown as $it) {
            $valEsc = htmlspecialchars((string)$it['value'], ENT_QUOTES, 'UTF-8');
            if (!empty($it['no_label'])) {
                $align = in_array((string)$it['align'], ['left', 'center', 'right'], true) ? (string)$it['align'] : 'left';
                $html[] = '<div class="md-meta-row meta-post-date meta-align-' . $align . '"><dd>' . $valEsc . '</dd></div>';
                continue;
            }
            $labelEsc = htmlspecialchars((string)$it['label'], ENT_QUOTES, 'UTF-8');
            $html[] = '<div class="md-meta-row"><dt>' . $labelEsc . '</dt><dd>' . $valEsc . '</dd></div>';
        }
        $html[] = '</dl>';
    }

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
	                if ($codeblock_type === 'mermaid') {
	                    $html[] = "</pre>";
	                } else {
	                    $html[] = "</code></pre>";
	                }
	                $in_codeblock = false;
	                $codeblock_type = null;
	            } else {
	                $in_codeblock = true;
	                $lang = trim((string)($m[1] ?? ''));
	                if (strtolower($lang) === 'mermaid') {
	                    $codeblock_type = 'mermaid';
	                    $preCls = md_join_classes('mermaid', $p['codeblock_pre_class'] ?? '');
	                    $preAttr = $preCls ? ' class="'.htmlspecialchars($preCls, ENT_QUOTES, 'UTF-8').'"' : ' class="mermaid"';
	                    $html[] = '<pre'.$preAttr.'>';
	                } else {
	                    $codeblock_type = 'code';
	                    $langEsc = $lang ? htmlspecialchars($lang, ENT_QUOTES, 'UTF-8') : '';
	                    $langAttr = $lang ? ' class="language-'.$langEsc.'"' : '';
	                    $langDataAttr = $lang ? ' data-lang="'.$langEsc.'"' : '';
	                    $preCls = htmlspecialchars($p['codeblock_pre_class'] ?? '', ENT_QUOTES, 'UTF-8');
	                    $preAttr = $preCls ? ' class="'.$preCls.'"' : '';
	                    $html[] = '<pre'.$preAttr.$langDataAttr.'><code'.$langAttr.'>';
	                }
	            }
	            continue;
	        }

        if ($in_codeblock) {
            $html[] = htmlspecialchars($line, ENT_QUOTES, 'UTF-8');
            continue;
        }

        $trim = trim($line);
        if ($trim !== '' && preg_match('/^<iframe\\b[^>]*><\\/iframe>$/i', $trim)) {
            $src = '';
            if (preg_match('/\\ssrc="([^"]+)"/i', $trim, $sm)) {
                $src = $sm[1];
            }
            if ($src !== '' && preg_match('~^https?://(?:www\\.)?youtube\\.com/embed/|^https?://(?:www\\.)?youtu\\.be/~i', $src)) {
                $classes = [];
                $consume = 0;
                for ($j = $i + 1; $j < $count && $consume < 2; $j++) {
                    $found = mdw_attr_list_extract_classes($lines[$j]);
                    if ($found === null || empty($found)) break;
                    foreach ($found as $cls) {
                        $classes[] = $cls;
                    }
                    $consume++;
                }

                $iframeClass = '';
                $wrapperClass = '';
                foreach ($classes as $cls) {
                    if (stripos($cls, 'ytframe-wrapper') !== false) {
                        $wrapperClass = $cls;
                    } else if ($iframeClass === '') {
                        $iframeClass = $cls;
                    } else if ($wrapperClass === '') {
                        $wrapperClass = $cls;
                    }
                }
                if ($iframeClass === '') $iframeClass = 'lazyload ytframe';
                if ($wrapperClass === '') $wrapperClass = 'ytframe-wrapper';

                $closeAllLists();
                $srcEsc = htmlspecialchars($src, ENT_QUOTES, 'UTF-8');
                $iframeClassEsc = htmlspecialchars(trim($iframeClass), ENT_QUOTES, 'UTF-8');
                $wrapperClassEsc = htmlspecialchars(trim($wrapperClass), ENT_QUOTES, 'UTF-8');
                $html[] = '<div class="'.$wrapperClassEsc.'"><iframe class="'.$iframeClassEsc.'" src="'.$srcEsc.'" frameborder="0" allowfullscreen></iframe></div>';
                $i += $consume;
                continue;
            }
        }

        $attrLine = mdw_attr_list_parse_line($line);
        if ($attrLine) {
            mdw_apply_attr_list_to_last_html($html, $attrLine);
            continue;
        }

        if ($tocRequested && mdw_toc_is_token_line($line)) {
            $closeAllLists();
            $html[] = mdw_toc_render_html($tocItems, $profile, $context, $mdPath);
            $tocActive = true;
            continue;
        }

        if ($inHtmlBlock) {
            $headingHtml = mdw_html_render_heading_line($line, $profile, $context, $mdPath, $tocRequested, $tocActive, $tocItems, $tocIndex);
            if ($headingHtml !== null) {
                $html[] = $headingHtml;
            } else {
                $html[] = $line;
            }
            $htmlBlockDepth += mdw_html_tag_balance_delta($line, $htmlBlockTag);
            if ($htmlBlockDepth <= 0) {
                $inHtmlBlock = false;
                $htmlBlockTag = '';
                $htmlBlockDepth = 0;
            }
            continue;
        }

        $headingHtml = mdw_html_render_heading_line($line, $profile, $context, $mdPath, $tocRequested, $tocActive, $tocItems, $tocIndex);
        if ($headingHtml !== null) {
            $closeAllLists();
            $html[] = $headingHtml;
            continue;
        }

        $blockTag = mdw_html_block_tag_from_line($line);
        if ($blockTag !== '') {
            $closeAllLists();
            $html[] = $line;
            if (!mdw_html_is_self_closing_tag($blockTag)) {
                $delta = mdw_html_tag_balance_delta($line, $blockTag);
                if ($delta > 0) {
                    $inHtmlBlock = true;
                    $htmlBlockTag = $blockTag;
                    $htmlBlockDepth = $delta;
                }
            }
            continue;
        }

        if (preg_match('/^\s*<\/([A-Za-z][A-Za-z0-9:-]*)\b[^>]*>\s*$/', $line, $m)) {
            $tag = strtolower((string)$m[1]);
            if (mdw_html_is_allowed_tag($tag)) {
                $closeAllLists();
                $html[] = $line;
                continue;
            }
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
            $bqAttrs = null;
            while (!empty($bq)) {
                $parsed = mdw_attr_list_parse_line($bq[count($bq) - 1]);
                if (!$parsed) break;
                array_pop($bq);
                $bqAttrs = mdw_merge_attr_list($bqAttrs, $parsed);
            }
            $inner = implode("\n", $bq);
            $bqHtml = '<blockquote>' . "\n" . md_to_html($inner, $mdPath, $profile, $context) . "\n" . '</blockquote>';
            if ($bqAttrs) {
                $bqHtml = mdw_apply_attr_list_to_html($bqHtml, $bqAttrs);
            }
            $html[] = $bqHtml;
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
                $table[] = '<th'.$thAttr.'>' . inline_md($txt, $mdPath, $profile, $context) . '</th>';
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
                    $table[] = '<td'.$tdAttr.'>' . inline_md($txt, $mdPath, $profile, $context) . '</td>';
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

            $idAttr = '';
            if ($tocRequested && $tocActive && $level === 3 && isset($tocItems[$tocIndex])) {
                $idAttr = ' id="' . htmlspecialchars((string)$tocItems[$tocIndex]['id'], ENT_QUOTES, 'UTF-8') . '"';
                $tocIndex++;
            }

            $html[] = "<$tag$idAttr$clsAttr>".inline_md($content, $mdPath, $profile, $context)."</$tag>";
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
            $html[] = '<li'.$liAttr.'>' . inline_md($content, $mdPath, $profile, $context);
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
            $html[]='<p'.$pAttr.'>'.inline_md($line, $mdPath, $profile, $context).'</p>';
        }
    }

    $closeAllLists();
    if ($in_codeblock) {
        $html[] = ($codeblock_type === 'mermaid') ? '</pre>' : '</code></pre>';
    }

    if (!empty($footnoteRefs)) {
        $items = [];
        foreach ($footnoteRefs as $num) {
            if (!isset($footnotes[$num])) continue;
            $numEsc = htmlspecialchars((string)$num, ENT_QUOTES, 'UTF-8');
            $fn = $footnotes[$num];
            $type = isset($fn['type']) ? (string)$fn['type'] : '';

            if ($type === 'text') {
                $textRaw = trim((string)($fn['text'] ?? ''));
                if ($textRaw === '') continue;
                $textHtml = inline_md($textRaw, $mdPath, $profile, $context);
                $items[] = '<li id="fn-'.$numEsc.'" class="md-footnote-item"><span class="md-footnote-label">['.$numEsc.']:</span> <span class="md-footnote-text">'.$textHtml.'</span></li>';
                continue;
            }

            $urlRaw = trim((string)($fn['url'] ?? ''));
            if ($urlRaw === '') continue;
            $titleRaw = trim((string)($fn['title'] ?? ''));
            $labelRaw = isset($footnoteLabels[$num]) ? trim((string)$footnoteLabels[$num]) : '';
            $linkText = $titleRaw !== '' ? $titleRaw : ($labelRaw !== '' ? $labelRaw : $urlRaw);

            $urlResolved = resolve_rel_href_from_md_link($urlRaw, $mdPath);
            $urlEsc = htmlspecialchars($urlResolved, ENT_QUOTES, 'UTF-8');
            $linkEsc = htmlspecialchars($linkText, ENT_QUOTES, 'UTF-8');
            $items[] = '<li id="fn-'.$numEsc.'" class="md-footnote-item"><span class="md-footnote-label">['.$numEsc.']:</span> <a class="externlink" href="'.
                $urlEsc.
                '" target="_blank" rel="noopener noreferrer">'.$linkEsc.'</a></li>';
        }
        if (!empty($items)) {
            $html[] = '<ol class="md-footnotes">' . implode("\n", $items) . '</ol>';
        }
    }

    $output = implode("\n",$html);
    return mdw_restore_html_comments($output, $comments);
}

/* TITLE FROM MD */
function extract_title($raw){
    $raw = str_replace(["\r\n","\r"], "\n", $raw);
    foreach (explode("\n",$raw) as $l){
        if (preg_match('/^#\s+(.*)$/',$l,$m)) return trim($m[1]);
    }
    $inMeta = true;
    $seenMeta = false;
    foreach (explode("\n",$raw) as $l){
        if ($inMeta) {
            $k = null; $v = null;
            if (mdw_hidden_meta_match($l, $k, $v)) {
                $seenMeta = true;
                continue;
            }
            if (!$seenMeta && trim((string)$l) === '') {
                continue;
            }
            $inMeta = false;
        }
        if (trim($l)!=='') return trim($l);
    }
    return "Untitled";
}
