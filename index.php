<?php
/*******************************
 * Markdownmanager edit v0.1
 * - shortcuts (links.csv)
 * - theme toggle
 * - subdir grouping
 * - newest-first sort by yy-mm-dd- prefix
 * - subdirs sorted A→Z
 * - client-side filter
 * - unicode-safe paths + rawurlencode
 * - markdown rendering in view mode
 *******************************/

session_start();

/* CONFIG */
$LINKS_CSV        = __DIR__ . '/links.csv';
$SECRET_MDS_FILE  = __DIR__ . '/secret_mds.txt';
// Zet dit in een aparte config of ENV als je netjes wilt zijn:
$SECRET_MDS_PASSWORD = 'secretpwd';

if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(16));
}
$CSRF_TOKEN = $_SESSION['csrf_token'];

$flash_ok = null;
$flash_error = null;
if (isset($_SESSION['flash_ok'])) {
    $flash_ok = (string)$_SESSION['flash_ok'];
    unset($_SESSION['flash_ok']);
}
if (isset($_SESSION['flash_error'])) {
    $flash_error = (string)$_SESSION['flash_error'];
    unset($_SESSION['flash_error']);
}


/* SECURITY / PATH CLEAN */
function sanitize_md_path($path) {
    if (!$path) return null;
    if (strpos($path, '..') !== false) return null;

    $parts = explode('/', $path);
    foreach ($parts as $p) {
        if ($p === '') return null;
        // allow unicode letters/numbers plus . _ -
        if (!preg_match('/^[A-Za-z0-9._\-\p{L}\p{N}]+$/u', $p)) return null;
    }

    if (!preg_match('/\.md$/i', end($parts))) return null;

    $full = __DIR__ . '/' . $path;
    if (!is_file($full)) return null;

    return $path;
}

function sanitize_new_md_path($path) {
    if (!$path) return null;
    if (strpos($path, '..') !== false) return null;

    $path = trim($path);
    $path = str_replace("\\", "/", $path);
    $path = ltrim($path, "/");

    $parts = explode('/', $path);
    foreach ($parts as $p) {
        if ($p === '') return null;
        // allow unicode letters/numbers plus . _ -
        if (!preg_match('/^[A-Za-z0-9._\-\p{L}\p{N}]+$/u', $p)) return null;
    }

    if (!preg_match('/\.md$/i', end($parts))) return null;

    return $path;
}

function sanitize_folder_name($folder) {
    if (!is_string($folder)) return null;
    $folder = trim($folder);
    if ($folder === '') return null;
    if (strpos($folder, '..') !== false) return null;
    $folder = str_replace("\\", "/", $folder);
    $folder = trim($folder, "/");
    if (!preg_match('/^[A-Za-z0-9._\-\p{L}\p{N}]+$/u', $folder)) return null;
    return $folder;
}

function folder_from_path($path) {
    if (!$path) return null;
    $d = dirname($path);
    if ($d === '.' || $d === '') return 'root';
    return $d;
}

/* ESCAPE */
function h($s){ return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); }

/* INLINE MARKDOWN */
function inline_md($text) {
    $text = htmlspecialchars($text, ENT_QUOTES, 'UTF-8');

    // `code`
    $text = preg_replace(
        '/`([^`]+)`/',
        '<code class="bg-neutral-800 text-neutral-100 px-1.5 py-0.5 rounded text-[0.8em]">$1</code>',
        $text
    );

    // **bold**
    $text = preg_replace(
        '/\*\*([^*]+)\*\*/',
        '<strong class="font-semibold text-neutral-900 dark:text-neutral-100">$1</strong>',
        $text
    );

    // *italic*
    $text = preg_replace(
        '/\*([^*]+)\*/',
        '<em class="italic text-neutral-600 dark:text-neutral-300">$1</em>',
        $text
    );

    // [text](url)
    $text = preg_replace_callback(
        '/\[([^\]]+)\]\(([^)]+)\)/',
        function($m){
            $label = $m[1];
            $url   = $m[2];
            $urlEsc = htmlspecialchars($url, ENT_QUOTES, 'UTF-8');
            return '<a class="underline text-blue-600 dark:text-blue-400 hover:opacity-80" href="'.
                   $urlEsc.
                   '" target="_blank" rel="noopener noreferrer">'.$label.'</a>';
        },
        $text
    );

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

/* BLOCK MARKDOWN -> HTML */
function md_to_html($text) {
    $text = str_replace(["\r\n","\r"], "\n", $text);
    $lines = explode("\n",$text);

    $html = [];
    $in_codeblock = false;
    $listStack = [];

    $openList = function($tag, $indent) use (&$html, &$listStack) {
        $html[] = "<$tag>";
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
                $langAttr = $lang ? ' class="language-'.htmlspecialchars($lang).'"' : '';
                $html[] = '<pre class="rounded-xl bg-neutral-900 text-neutral-100 p-4 overflow-x-auto text-sm ring-1 ring-neutral-700/50"><code'.$langAttr.'>';
            }
            continue;
        }

        if ($in_codeblock) {
            $html[] = htmlspecialchars($line, ENT_QUOTES, 'UTF-8');
            continue;
        }

        // horizontal rule
        if (preg_match('/^\s*((\*|-|_)\s*){3,}$/', $line)) {
            $closeAllLists();
            $html[] = '<hr>';
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
            $html[] = '<blockquote>' . "\n" . md_to_html($inner) . "\n" . '</blockquote>';
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

            $table = [];
            $table[] = '<table>';
            $table[] = '<thead><tr>';
            for ($c = 0; $c < $colCount; $c++) {
                $txt = $headerCells[$c] ?? '';
                $a = $align[$c];
                $table[] = '<th class="align-'.$a.'">' . inline_md($txt) . '</th>';
            }
            $table[] = '</tr></thead>';
            $table[] = '<tbody>';
            foreach ($rows as $r) {
                $table[] = '<tr>';
                for ($c = 0; $c < $colCount; $c++) {
                    $txt = $r[$c] ?? '';
                    $a = $align[$c];
                    $table[] = '<td class="align-'.$a.'">' . inline_md($txt) . '</td>';
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

            $clsMap = [
                1 => "text-3xl font-bold mt-10 mb-4 text-neutral-900 dark:text-neutral-100 text-center",
                2 => "text-2xl font-semibold mt-8 mb-3 text-neutral-900 dark:text-neutral-100",
                3 => "text-xl font-semibold mt-6 mb-2 text-neutral-900 dark:text-neutral-100",
                4 => "text-lg font-semibold mt-4 mb-2 text-neutral-800 dark:text-neutral-200",
                5 => "text-base font-semibold mt-3 mb-2 text-neutral-800 dark:text-neutral-200",
                6 => "text-sm font-semibold mt-3 mb-2 uppercase tracking-wide text-neutral-600 dark:text-neutral-400",
            ];
            $cls = $clsMap[$level] ?? "font-bold mt-4 mb-2";

            $html[] = "<$tag class=\"$cls\">".inline_md($content)."</$tag>";
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

            $html[] = '<li>' . inline_md($content);
            $listStack[$topIndex]['liOpen'] = true;
            continue;
        }

        // normal paragraph / blank
        if (trim($line)==="") {
            $html[]="";
        } else {
            $closeAllLists();
            $html[]='<p class="leading-relaxed my-4 text-neutral-700 dark:text-neutral-300">'.inline_md($line).'</p>';
        }
    }

    $closeAllLists();
    if ($in_codeblock) $html[]="</code></pre>";

    return implode("\n",$html);
}

/* GET FIRST TITLE FROM MD */
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

function extract_title_from_file($fullPath, $fallbackBasename) {
    if (!is_string($fullPath) || $fullPath === '' || !is_file($fullPath)) return $fallbackBasename;
    $h = @fopen($fullPath, 'rb');
    if (!$h) return $fallbackBasename;

    $firstNonEmpty = null;
    $maxLines = 200;
    while ($maxLines-- > 0 && ($line = fgets($h)) !== false) {
        $line = rtrim($line, "\r\n");
        if (preg_match('/^#\s+(.*)$/', $line, $m)) {
            fclose($h);
            return trim($m[1]);
        }
        if ($firstNonEmpty === null && trim($line) !== '') {
            $firstNonEmpty = $line;
        }
    }
    fclose($h);

    if ($firstNonEmpty !== null) return trim($firstNonEmpty);
    return $fallbackBasename ?: 'Untitled';
}

/* parse yy-mm-dd- from filename */
function parse_ymd_from_filename($basename) {
    // returns array [yy, mm, dd] or [null,null,null]
    if (preg_match('/^(\d{2})-(\d{2})-(\d{2})-/', $basename, $m)) {
        return [$m[1], $m[2], $m[3]];
    }
    return [null, null, null];
}

/*
Compare two entries by (yy,mm,dd) DESC.
If either has no date, that one goes last.
If both have no date, fallback alphabetically on basename ASC.
*/
function compare_entries_desc_date($a, $b) {
    // a['basename'], a['yy'], a['mm'], a['dd']
    // b['basename'], b['yy'], b['mm'], b['dd']

    // both have valid yy?
    $aHas = $a['yy'] !== null;
    $bHas = $b['yy'] !== null;

    if ($aHas && $bHas) {
        // sort by yy desc, then mm desc, then dd desc
        if ($a['yy'] !== $b['yy']) return strcmp($b['yy'], $a['yy']);
        if ($a['mm'] !== $b['mm']) return strcmp($b['mm'], $a['mm']);
        if ($a['dd'] !== $b['dd']) return strcmp($b['dd'], $a['dd']);
        // same date => fallback filename ASC
        return strcasecmp($a['basename'], $b['basename']);
    }

    if ($aHas && !$bHas) return -1;  // a first
    if ($bHas && !$aHas) return  1;  // b first

    // neither has date -> ASC by filename
    return strcasecmp($a['basename'], $b['basename']);
}

/* ROOT FILES newest-first */
function list_md_root_sorted(){
    $mds = glob("*.md");
    $out=[];
    foreach($mds as $path){
        $base = basename($path);
        [$yy,$mm,$dd] = parse_ymd_from_filename($base);
        $out[] = [
            'path'     => $path,
            'basename' => $base,
            'yy'       => $yy,
            'mm'       => $mm,
            'dd'       => $dd,
        ];
    }
    usort($out, 'compare_entries_desc_date');
    return $out;
}

/* SUBDIR FILES newest-first per dir, dirs A→Z */
function list_md_by_subdir_sorted(){
    $dirs = array_filter(glob('*'), function($f){
        return is_dir($f) && $f[0]!=='.';
    });

    sort($dirs, SORT_NATURAL | SORT_FLAG_CASE); // folders A→Z

    $map=[];
    foreach($dirs as $dir){
        $mds = glob($dir.'/*.md');
        if(!$mds) continue;

        $tmp=[];
        foreach($mds as $path){
            $base = basename($path);
            [$yy,$mm,$dd] = parse_ymd_from_filename($base);
            $tmp[] = [
                'path'     => $path,
                'basename' => $base,
                'yy'       => $yy,
                'mm'       => $mm,
                'dd'       => $dd,
            ];
        }

        usort($tmp, 'compare_entries_desc_date');
        $map[$dir]=$tmp;
    }
    return $map;
}

/* LINKS FROM CSV (shortcuts at top) */
function read_shortcuts_csv($csv){
    $out=[];
    if(!file_exists($csv)) return $out;
    if(($h=fopen($csv,'r'))!==false){
        fgetcsv($h); // header skip
        while(($row=fgetcsv($h))!==false){
            if(count($row)>=2){
                $shortcut=trim($row[0]);
                $url=trim($row[1]);
                if($shortcut!=='' && $url!==''){
                    $out[]=[
                        'shortcut'=>$shortcut,
                        'url'=>$url
                    ];
                }
            }
        }
        fclose($h);
    }
    return $out;
}

function load_secret_mds() {
    global $SECRET_MDS_FILE;
    static $cache = null;

    if ($cache !== null) return $cache;

    $cache = [];
    if (is_file($SECRET_MDS_FILE)) {
        $lines = file($SECRET_MDS_FILE, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            $line = trim($line);
            if ($line !== '') {
                // relative path, bv: "python-scripts/foo.md"
                $cache[$line] = true;
            }
        }
    }
    return $cache;
}

function is_secret_file($relativePath) {
    $secret = load_secret_mds();
    return isset($secret[$relativePath]);
}

function is_secret_authenticated() {
    return !empty($_SESSION['secret_ok']);
}

function try_secret_login($passwordInput) {
    global $SECRET_MDS_PASSWORD;
    if (!is_string($passwordInput)) return false;
    // veilig vergelijken
    return hash_equals($SECRET_MDS_PASSWORD, $passwordInput);
}

/* ACTIONS (create/delete) */
$open_new_panel = isset($_GET['new']) && $_GET['new'] === '1';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
    $csrf = isset($_POST['csrf']) ? (string)$_POST['csrf'] : '';
    if (!hash_equals($CSRF_TOKEN, $csrf)) {
        $_SESSION['flash_error'] = 'Ongeldige sessie (CSRF). Herlaad de pagina.';
        header('Location: index.php');
        exit;
    } else if ($_POST['action'] === 'delete') {
        $postedFile = isset($_POST['file']) ? (string)$_POST['file'] : '';
        $san = sanitize_md_path($postedFile);
        if (!$san) {
            $_SESSION['flash_error'] = 'Invalid file path.';
        } else if (is_secret_file($san) && !is_secret_authenticated()) {
            $_SESSION['flash_error'] = 'Secret note is vergrendeld. Ontgrendel eerst via de viewer.';
        } else {
            $full = __DIR__ . '/' . $san;
            if (@unlink($full)) {
                $_SESSION['flash_ok'] = 'Verwijderd: ' . $san;
            } else {
                $err = error_get_last();
                $msg = 'Kon bestand niet verwijderen.';
                if ($err && !empty($err['message'])) {
                    $msg .= ' (' . $err['message'] . ')';
                }
                if (!is_writable($full)) {
                    $msg .= ' (geen write-permissies)';
                }
                $_SESSION['flash_error'] = $msg;
            }
        }
        header('Location: index.php');
        exit;
    } else if ($_POST['action'] === 'create') {
        $postedPath = isset($_POST['new_path']) ? (string)$_POST['new_path'] : '';
        $sanNew = sanitize_new_md_path($postedPath);
        $open_new_panel = true;
        if (!$sanNew) {
            $_SESSION['flash_error'] = 'Ongeldige bestandsnaam. Gebruik een relative path en eindig op .md';
        } else if (is_secret_file($sanNew) && !is_secret_authenticated()) {
            $_SESSION['flash_error'] = 'Dit pad staat als secret gemarkeerd. Ontgrendel eerst via de viewer.';
        } else {
            $dir = dirname($sanNew);
            if ($dir !== '.' && !is_dir(__DIR__ . '/' . $dir)) {
                $_SESSION['flash_error'] = 'Folder bestaat niet: ' . $dir;
            } else if (is_file(__DIR__ . '/' . $sanNew)) {
                $_SESSION['flash_error'] = 'Bestand bestaat al: ' . $sanNew;
            } else {
                $content = isset($_POST['new_content']) ? (string)$_POST['new_content'] : '';
                if (trim($content) === '') {
                    $content = "# " . preg_replace('/\.md$/i', '', basename($sanNew)) . "\n";
                }
                $full = __DIR__ . '/' . $sanNew;
                if (file_put_contents($full, $content, LOCK_EX) === false) {
                    $_SESSION['flash_error'] = 'Kon bestand niet aanmaken.';
                } else {
                    header('Location: edit.php?file=' . rawurlencode($sanNew));
                    exit;
                }
            }
        }
        header('Location: index.php?new=1');
        exit;
    }
}

/* ROUTING */
$requested = null;
if (isset($_GET['file'])) {
    $requested = sanitize_md_path($_GET['file']);
} else if (isset($_SERVER['QUERY_STRING']) && $_SERVER['QUERY_STRING']!=='') {
    // support index.php?Folder/file.md with no "file="
    if (strpos($_SERVER['QUERY_STRING'],'=')===false) {
        $requested = sanitize_md_path($_SERVER['QUERY_STRING']);
    }
}

$APP_NAME = 'Markdown Manager';

$mode = 'index';
$article_title = 'Index';
$article_html  = '';
$secret_error  = null;
$requested_is_secret = $requested ? is_secret_file($requested) : false;
$folder_filter = sanitize_folder_name($_GET['folder'] ?? '') ?? null;
$active_folder_for_breadcrumb = $requested ? folder_from_path($requested) : ($folder_filter ?: null);

if ($requested) {
    $full = __DIR__.'/'.$requested;
    if (is_file($full)) {

        // secret file? eerst wachtwoord checken
        if ($requested_is_secret && !is_secret_authenticated()) {
            if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['secret_password'])) {
                if (try_secret_login($_POST['secret_password'])) {
                    $_SESSION['secret_ok'] = true;
                } else {
                    $secret_error = 'Onjuist wachtwoord.';
                }
            }

            if (!is_secret_authenticated()) {
                $mode = 'secret_prompt';
                $article_title = 'Beveiligd document';
            } else {
                $mode = 'view';
                $raw = file_get_contents($full);
                $article_title = extract_title($raw);
                $article_html  = md_to_html($raw);
            }
        } else {
            // normaal, niet-secret bestand
            $mode='view';
            $raw = file_get_contents($full);
            $article_title = extract_title($raw);
            $article_html  = md_to_html($raw);
        }
    }
}

/* LOAD DATA FOR INDEX */
$shortcuts = $mode==='index' ? read_shortcuts_csv($LINKS_CSV) : [];
$rootList  = $mode==='index' ? list_md_root_sorted()        : [];
$dirMap    = $mode==='index' ? list_md_by_subdir_sorted()   : [];
$secretMap = load_secret_mds(); // voor index-weergave

if ($mode === 'index' && $folder_filter) {
    if ($folder_filter === 'root') {
        $dirMap = [];
    } else {
        $rootList = [];
        $dirMap = isset($dirMap[$folder_filter]) ? [$folder_filter => $dirMap[$folder_filter]] : [];
    }
}


?>
<!DOCTYPE html>
<html lang="en" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title><?=h($article_title)?></title>

<link rel="stylesheet" href="ui.css">
<link rel="stylesheet" href="markdown.css">
<link rel="stylesheet" href="htmlpreview.css">
<link rel="stylesheet" href="popicon.css">

<script>
(function(){
    const saved = localStorage.getItem('mdsite-theme');
    const prefers = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const mode = saved || (prefers ? 'dark' : 'light');
    const useDark = mode === 'dark';
    document.documentElement.classList.toggle('dark', useDark);
    document.documentElement.classList.toggle('theme-light', !useDark);
})();
</script>

<script>
window.MathJax = {
    tex: {
        inlineMath: [['\\(', '\\)']],
        displayMath: [['\\[', '\\]']],
        processEscapes: true
    },
    options: {
        skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
    }
};
</script>
<script defer src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js"></script>
</head>

<body class="app-body index-page">

<header class="app-header">
    <div class="app-header-inner">
        <div class="app-header-main">
            <div class="app-title">
                <?=h($APP_NAME)?>
                <?php if ($mode==='index'): ?>
                    <span style="font-weight: 500; opacity: 0.75;"> • overview</span>
                <?php endif; ?>
            </div>
            <div class="app-breadcrumb">
                <a class="breadcrumb-link" href="index.php">/index</a>
                <?php if ($active_folder_for_breadcrumb): ?>
                    <span class="breadcrumb-sep">/</span>
                    <a class="breadcrumb-link" href="index.php?folder=<?=rawurlencode($active_folder_for_breadcrumb)?>">
                        <?=h($active_folder_for_breadcrumb)?>
                    </a>
                <?php endif; ?>
                <?php if ($mode==='view' && $requested): ?>
                    <span class="breadcrumb-sep">/</span>
                    <span class="app-path-segment"><?=h(basename($requested))?></span>
                <?php endif; ?>
            </div>
        </div>
        <div class="app-header-actions">
            <?php if ($mode==='index'): ?>
            <button id="newMdToggle" type="button" class="btn btn-ghost btn-small">+MD</button>
            <?php endif; ?>
            <?php if ($mode==='view' && $requested): ?>
            <?php $hdrFolder = folder_from_path($requested); ?>
            <a href="edit.php?file=<?=rawurlencode($requested)?>&folder=<?=rawurlencode($hdrFolder)?>" class="btn btn-ghost icon-button" title="Edit">
                <span class="pi pi-edit"></span>
            </a>
            <form method="post" class="deleteForm" data-file="<?=h($requested)?>">
                <input type="hidden" name="action" value="delete">
                <input type="hidden" name="file" value="<?=h($requested)?>">
                <input type="hidden" name="csrf" value="<?=h($CSRF_TOKEN)?>">
                <button type="submit" class="btn btn-ghost icon-button" title="Delete">
                    <span class="pi pi-bin"></span>
                </button>
            </form>
            <?php endif; ?>
            <button id="themeToggle" type="button" class="btn btn-ghost icon-button"><span class="pi pi-sun" id="themeIcon"></span></button>
        </div>
    </div>
</header>

<main class="app-main">
<div class="app-main-inner" id="links_md_overview" tabindex="0">

<?php if ($mode==='index'): ?>

<?php if ($flash_ok || $flash_error): ?>
<section style="margin: 1rem 0 1.25rem;">
    <div class="editor-pane" style="padding: 0.75rem 1rem;">
        <?php if ($flash_ok): ?>
            <div style="font-size: 0.8rem; color: #16a34a;"><?=h($flash_ok)?></div>
        <?php else: ?>
            <div style="font-size: 0.8rem; color: var(--danger);"><?=h($flash_error)?></div>
        <?php endif; ?>
    </div>
</section>
<?php endif; ?>

<section id="newMdPanel" class="editor-pane" style="margin: 0 0 1.5rem; padding: 1rem; display: <?= $open_new_panel ? 'block' : 'none' ?>;">
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem;">
        <div>
            <div style="font-size: 0.9rem; font-weight: 600;">New markdown</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">
                Relative path, e.g. <code>finance/25-12-12-Note.md</code>
            </div>
        </div>
        <button id="newMdClose" type="button" class="btn btn-ghost btn-small">Close</button>
    </div>

    <form method="post" style="margin-top: 0.9rem; display: flex; flex-direction: column; gap: 0.6rem;">
        <input type="hidden" name="action" value="create">
        <input type="hidden" name="csrf" value="<?=h($CSRF_TOKEN)?>">
        <input name="new_path" class="input" type="text" placeholder="folder/yy-mm-dd-title.md" required>
        <textarea name="new_content" class="input" rows="4" style="height: auto; display: block;" placeholder="# Title&#10;&#10;Start writing..."></textarea>
        <div style="display: flex; justify-content: flex-end;">
            <button type="submit" class="btn btn-primary btn-small">Create & edit</button>
        </div>
    </form>
</section>

<!-- Shortcuts from links.csv -->
<?php if (!empty($shortcuts)): ?>
<section class="nav-section" style="margin-bottom: 2.5rem;">
    <div class="nav-section-title" style="justify-content: center; margin-bottom: 1rem; font-size: 1.25rem;">
        <span class="pi pi-dashboard"></span>
        <span>Shortcuts</span>
    </div>

<ul class="nav-list">
<?php foreach($shortcuts as $lnk): ?>
    <li class="nav-item">
        <a href="<?=h($lnk['url'])?>" target="_blank" rel="noopener noreferrer" class="note-link kbd-item">
            <div class="note-title">
                <span><?=h($lnk['shortcut'])?></span>
                <span class="pi pi-externallink" style="font-size: 0.8em; opacity: 0.6;"></span>
            </div>
            <div class="nav-item-path"><?=h($lnk['url'])?></div>
        </a>
    </li>
<?php endforeach; ?>
</ul>
</section>
<?php endif; ?>

<!-- Filter + heading -->
<section style="text-align: center; margin-bottom: 2rem;">
    <h1 style="font-size: 1.875rem; font-weight: 700; margin-bottom: 0.75rem;">Contents</h1>
    <p style="font-size: 0.8rem; color: var(--text-muted); max-width: 42em; margin: 0 auto; line-height: 1.6;">
        Filter by title. Newest dates first (based on filename prefix yy-mm-dd-).
        First <code># Heading</code> in each .md becomes the title.
    </p>
    <input id="filterInput" class="input notes-filter-input" style="max-width: 20rem; margin-top: 1rem;" type="text" placeholder="Type to filter...">
</section>

<div id="contentList" style="margin-top: 1.5rem;">

<!-- Root files -->
<?php if (!empty($rootList)): ?>
<section class="nav-section" style="margin-bottom: 2.5rem;">
    <h2 class="note-group-title">
        <span class="pi pi-folder"></span>
        <a class="breadcrumb-link" href="index.php?folder=root">Root</a>
    </h2>
<ul class="notes-list">
<?php foreach($rootList as $entry):
$p   = $entry['path'];
$t   = extract_title_from_file(__DIR__ . '/' . $p, $entry['basename']);
$isSecret = isset($secretMap[$p]);
?>
<li class="note-item doclink note-row" data-file="<?=h($p)?>">
    <a href="index.php?file=<?=rawurlencode($p)?>&folder=<?=rawurlencode(folder_from_path($p))?>&focus=<?=rawurlencode($p)?>" class="note-link note-link-main kbd-item">
        <div class="note-title" style="justify-content: space-between;">
            <span><?=h($t)?></span>
            <?php if ($isSecret): ?>
                <span class="badge-secret">secret</span>
            <?php endif; ?>
        </div>
        <div class="nav-item-path"><?=h($p)?></div>
    </a>
    <div class="note-actions">
        <a href="edit.php?file=<?=rawurlencode($p)?>&folder=<?=rawurlencode(folder_from_path($p))?>" class="btn btn-ghost icon-button" title="Edit">
            <span class="pi pi-edit"></span>
        </a>
        <form method="post" class="deleteForm" data-file="<?=h($p)?>">
            <input type="hidden" name="action" value="delete">
            <input type="hidden" name="file" value="<?=h($p)?>">
            <input type="hidden" name="csrf" value="<?=h($CSRF_TOKEN)?>">
            <button type="submit" class="btn btn-ghost icon-button" title="Delete">
                <span class="pi pi-bin"></span>
            </button>
        </form>
    </div>
</li>
<?php endforeach; ?>
</ul>
</section>
<?php endif; ?>

<!-- Subdirectory groups -->
<?php foreach($dirMap as $dirname=>$list): ?>
<section class="nav-section" style="margin-bottom: 2.5rem;">
    <h2 class="note-group-title">
        <span class="pi pi-folder"></span>
        <a class="breadcrumb-link" href="index.php?folder=<?=rawurlencode($dirname)?>"><?=h($dirname)?></a>
    </h2>

<ul class="notes-list">
<?php foreach($list as $entry):
$p   = $entry['path'];
$t   = extract_title_from_file(__DIR__ . '/' . $p, $entry['basename']);
$isSecret = isset($secretMap[$p]);
?>
<li class="note-item doclink note-row" data-file="<?=h($p)?>">
    <a href="index.php?file=<?=rawurlencode($p)?>&folder=<?=rawurlencode(folder_from_path($p))?>&focus=<?=rawurlencode($p)?>" class="note-link note-link-main kbd-item">
        <div class="note-title" style="justify-content: space-between;">
            <span><?=h($t)?></span>
            <?php if ($isSecret): ?>
                <span class="badge-secret">secret</span>
            <?php endif; ?>
        </div>
        <div class="nav-item-path"><?=h($p)?></div>
    </a>
    <div class="note-actions">
        <a href="edit.php?file=<?=rawurlencode($p)?>&folder=<?=rawurlencode(folder_from_path($p))?>" class="btn btn-ghost icon-button" title="Edit">
            <span class="pi pi-edit"></span>
        </a>
        <form method="post" class="deleteForm" data-file="<?=h($p)?>">
            <input type="hidden" name="action" value="delete">
            <input type="hidden" name="file" value="<?=h($p)?>">
            <input type="hidden" name="csrf" value="<?=h($CSRF_TOKEN)?>">
            <button type="submit" class="btn btn-ghost icon-button" title="Delete">
                <span class="pi pi-bin"></span>
            </button>
        </form>
    </div>
</li>
<?php endforeach; ?>
</ul>
</section>
<?php endforeach; ?>

<?php if (empty($rootList) && empty($dirMap) && empty($shortcuts)): ?>
<div style="color: var(--text-muted); font-size: 0.8rem; font-style: italic; text-align: center;">
Nothing here yet.
</div>
<?php endif; ?>

</div><!-- /contentList -->

<?php elseif ($mode==='secret_prompt'): ?>

<section class="editor-pane" style="max-width: 32rem; margin: 2rem auto; padding: 1.5rem 2rem; text-align: center;">
    <h1 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem;">Beveiligd document</h1>
    <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1rem;">
        Deze notitie is beveiligd. Voer het wachtwoord in om verder te gaan.
    </p>

<?php if ($secret_error): ?>
<div style="margin-bottom: 0.75rem; font-size: 0.8rem; color: var(--danger);">
<?=h($secret_error)?>
</div>
<?php endif; ?>

<form method="post" style="display: flex; flex-direction: column; gap: 1rem;">
<div>
<input type="password" name="secret_password" autocomplete="current-password" class="input" placeholder="Wachtwoord">
</div>
<div style="display: flex; align-items: center; justify-content: center; gap: 0.75rem;">
    <button type="submit" class="btn btn-primary">Ontgrendelen</button>
    <a href="index.php" style="font-size: 0.7rem; color: var(--text-muted);">Terug naar index</a>
</div>
</form>
</section>

<?php else: ?>

<!-- Article view -->
<article class="preview-container preview-content">
<?=$article_html?>
</article>

<?php endif; ?>

</div>
</main>

<footer class="app-footer">
    flat md site • <?=date('Y')?> • no db, no cms, no bloat
</footer>

<script>
const filterInput = document.getElementById('filterInput');
if (filterInput) {
    const counter = document.createElement('div');
    counter.id = 'filterCount';
    counter.className = 'status-text';
    counter.style.textAlign = 'center';
    counter.style.marginTop = '0.5rem';
    filterInput.insertAdjacentElement('afterend', counter);

    const update = () => {
        const q = filterInput.value.toLowerCase();
        const docs = document.querySelectorAll('.doclink');
        let visible = 0;
        docs.forEach(el => {
            const match = el.innerText.toLowerCase().includes(q);
            el.style.display = match ? '' : 'none';
            if (match) visible++;
        });
        counter.textContent = q
            ? `${visible} item${visible !== 1 ? 's' : ''} found`
            : `${docs.length} total items`;
    };

    const params = new URLSearchParams(window.location.search);
    const qParam = params.get('q');
    if (qParam) {
        filterInput.value = qParam;
    }

    filterInput.addEventListener('input', update);
    update();
}
</script>

<script defer src="base.js"></script>

</body>
</html>
