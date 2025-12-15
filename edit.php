<?php
/*******************************
 * MarkdownManager v0.1
 * - Plain CSS (ui.css / markdown.css / htmlpreview.css)
 * - shared security + secret_mds logic
 *******************************/

session_start();

/* CONFIG */
$LINKS_CSV        = __DIR__ . '/links.csv';
$SECRET_MDS_FILE  = __DIR__ . '/secret_mds.txt';
$SECRET_MDS_PASSWORD = 'secretpwd';

if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(16));
}
$CSRF_TOKEN = $_SESSION['csrf_token'];

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

/* ESCAPE */
function h($s){ return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); }

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

/* INLINE MARKDOWN */
function inline_md($text, $mdPath = null) {
    $text = htmlspecialchars($text, ENT_QUOTES, 'UTF-8');

    // `code`
    $text = preg_replace(
        '/`([^`]+)`/',
        '<code class="md-code-inline">$1</code>',
        $text
    );

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
    $text = preg_replace(
        '/\*\*([^*]+)\*\*/',
        '<strong class="md-strong">$1</strong>',
        $text
    );

    // *italic*
    $text = preg_replace(
        '/\*([^*]+)\*/',
        '<em class="md-em">$1</em>',
        $text
    );

    // [text](url)
    $text = preg_replace_callback(
        '/\[([^\]]+)\]\(([^)]+)\)/',
        function($m){
            $label = $m[1];
            $url   = $m[2];
            $urlEsc = htmlspecialchars($url, ENT_QUOTES, 'UTF-8');
            return '<a class="md-link" href="'.
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
function md_to_html($text, $mdPath = null) {
    $text = str_replace(["\r\n","\r"], "\n", $text);
    $lines = explode("\n",$text);

    $html = [];
    $in_codeblock = false;
    $listStack = [];

    $openList = function($tag, $indent) use (&$html, &$listStack) {
        $cls = $tag === 'ol' ? 'md-olist' : 'md-list';
        $html[] = "<$tag class=\"$cls\">";
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
                $html[] = '<pre class="md-codeblock"><code'.$langAttr.'>';
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
            $html[] = '<hr class="md-hr">';
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
            $i--; // compensate for for-loop increment
            $inner = implode("\n", $bq);
            $html[] = '<blockquote>' . "\n" . md_to_html($inner, $mdPath) . "\n" . '</blockquote>';
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
            $i--; // for-loop will increment

            $table = [];
            $table[] = '<table class="md-table">';
            $table[] = '<thead><tr>';
            for ($c = 0; $c < $colCount; $c++) {
                $txt = $headerCells[$c] ?? '';
                $a = $align[$c];
                $table[] = '<th class="md-th align-'.$a.'">' . inline_md($txt, $mdPath) . '</th>';
            }
            $table[] = '</tr></thead>';
            $table[] = '<tbody>';
            foreach ($rows as $r) {
                $table[] = '<tr>';
                for ($c = 0; $c < $colCount; $c++) {
                    $txt = $r[$c] ?? '';
                    $a = $align[$c];
                    $table[] = '<td class="md-td align-'.$a.'">' . inline_md($txt, $mdPath) . '</td>';
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
                1 => "md-h1",
                2 => "md-h2",
                3 => "md-h3",
                4 => "md-h4",
                5 => "md-h5",
                6 => "md-h6",
            ];
            $cls = $clsMap[$level] ?? "md-heading";

            $html[] = "<$tag class=\"$cls\">".inline_md($content, $mdPath)."</$tag>";
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

            $html[] = '<li class="md-li">' . inline_md($content, $mdPath);
            $listStack[$topIndex]['liOpen'] = true;
            continue;
        }

        // normal paragraph / blank
        if (trim($line)==="") {
            $html[]="";
        } else {
            $closeAllLists();
            $html[]='<p class="md-p">'.inline_md($line, $mdPath).'</p>';
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

/* DATE PARSE */
function parse_ymd_from_filename($basename) {
    if (preg_match('/^(\d{2})-(\d{2})-(\d{2})-/', $basename, $m)) {
        return [$m[1], $m[2], $m[3]];
    }
    return [null, null, null];
}

function compare_entries_desc_date($a, $b) {
    $aHas = $a['yy'] !== null;
    $bHas = $b['yy'] !== null;

    if ($aHas && $bHas) {
        if ($a['yy'] !== $b['yy']) return strcmp($b['yy'], $a['yy']);
        if ($a['mm'] !== $b['mm']) return strcmp($b['mm'], $a['mm']);
        if ($a['dd'] !== $b['dd']) return strcmp($b['dd'], $a['dd']);
        return strcasecmp($a['basename'], $b['basename']);
    }

    if ($aHas && !$bHas) return -1;
    if ($bHas && !$aHas) return  1;
    return strcasecmp($a['basename'], $b['basename']);
}

/* ROOT FILES */
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

/* SUBDIR FILES */
function list_md_by_subdir_sorted(){
    $dirs = array_filter(glob('*'), function($f){
        return is_dir($f) && $f[0]!=='.';
    });

    sort($dirs, SORT_NATURAL | SORT_FLAG_CASE);

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

/* SHORTCUTS */
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

/* SECRET MDS */
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
    return hash_equals($SECRET_MDS_PASSWORD, $passwordInput);
}

/* ROUTING: determine requested file */
$requested = null;
if (isset($_GET['file'])) {
    $requested = sanitize_md_path($_GET['file']);
} else if (isset($_SERVER['QUERY_STRING']) && $_SERVER['QUERY_STRING']!=='') {
    if (strpos($_SERVER['QUERY_STRING'],'=')===false) {
        $requested = sanitize_md_path($_SERVER['QUERY_STRING']);
    }
}

$secretMap  = load_secret_mds();
$shortcuts  = read_shortcuts_csv($LINKS_CSV);
$rootList   = list_md_root_sorted();
$dirMap     = list_md_by_subdir_sorted();
$folder_filter = sanitize_folder_name($_GET['folder'] ?? '') ?? null;

if ($folder_filter) {
    if ($folder_filter === 'root') {
        $dirMap = [];
    } else {
        $rootList = [];
        $dirMap = isset($dirMap[$folder_filter]) ? [$folder_filter => $dirMap[$folder_filter]] : [];
    }
}

$save_error = null;
$saved_flag = isset($_GET['saved']) ? true : false;

/* HANDLE PREVIEW ENDPOINT (AJAX) */
if (isset($_GET['preview']) && $_GET['preview'] === '1') {
    header('Content-Type: text/html; charset=utf-8');
    $content = isset($_POST['content']) ? (string)$_POST['content'] : '';
    echo md_to_html($content, $requested);
    exit;
}

/* LOAD DATA FOR JSON REQUEST */
$is_secret_req_json = $requested ? is_secret_file($requested) : false;
$can_view_json = $requested && (!$is_secret_req_json || ($is_secret_req_json && is_secret_authenticated()));

/* HANDLE JSON DATA REQUEST (AJAX) */
if (isset($_GET['json']) && $_GET['json'] === '1') {
    if ($can_view_json) {
        header('Content-Type: application/json; charset=utf-8');
        $raw_content = file_get_contents(__DIR__ . '/' . $requested);

        echo json_encode([
            'file'    => $requested,
            'title'   => extract_title($raw_content),
            'content' => $raw_content,
            'html'    => md_to_html($raw_content, $requested),
            'is_secret' => (bool)$is_secret_req_json,
            'secret_authenticated' => is_secret_authenticated(),
        ]);
        exit;
    } else {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => 'forbidden']);
        exit;
    }
}


/* HANDLE SAVE */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'save') {
    $postedFile = isset($_POST['file']) ? $_POST['file'] : '';
    $san = sanitize_md_path($postedFile);
    if (!$san) {
        $save_error = 'Invalid file path.';
    } else {
        if (is_secret_file($san) && !is_secret_authenticated()) {
            // niet stiekem saven als je niet ingelogd bent
            header('Location: index.php?file='.rawurlencode($san));
            exit;
        }
        $full = __DIR__ . '/' . $san;
        $content = isset($_POST['content']) ? (string)$_POST['content'] : '';
        // Normalize line endings so the editor doesn't appear "dirty" after save.
        $content = str_replace(["\r\n", "\r"], "\n", $content);

        $tmp = $full . '.tmp';
        if (file_put_contents($tmp, $content) === false) {
            $save_error = 'Kon tijdelijke file niet schrijven.';
        } else {
            if (!rename($tmp, $full)) {
                $save_error = 'Kon originele file niet overschrijven.';
            } else {
                header('Location: edit.php?file=' . rawurlencode($san) . '&saved=1');
                exit;
            }
        }
        $requested = $san;
    }
}

/* LOAD REQUESTED FILE CONTENT */
$current_title   = 'Editor';
$current_content = '';
$current_html    = '';
$is_secret_req   = $requested ? is_secret_file($requested) : false;

if ($requested) {
    if ($is_secret_req && !is_secret_authenticated()) {
        // eerst via index.php wachtwoord laten invoeren
        header('Location: index.php?file='.rawurlencode($requested));
        exit;
    }

    $full = __DIR__ . '/' . $requested;
    if (is_file($full)) {
        $raw             = file_get_contents($full);
        $current_content = (string)$raw;
        $current_title   = extract_title($raw);
        $current_html    = md_to_html($raw, $requested);
    } else {
        $save_error = 'Bestand niet gevonden.';
    }
} else {
    $current_title = 'Geen bestand geselecteerd';
}

?>
<!DOCTYPE html>
<html lang="en" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title><?=h($current_title)?> • md edit</title>

<link rel="stylesheet" href="ui.css">
<link rel="stylesheet" href="markdown.css">
<link rel="stylesheet" href="htmlpreview.css">
<link rel="stylesheet" href="popicon.css">

<script>
// theme bootstrap (zonder Tailwind)
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

<body class="app-body edit-page">
    <header class="app-header">
        <div class="app-header-inner">
            <div class="app-header-main">
                <div class="app-title-row">
                    <span class="pi pi-edit app-logo" aria-hidden="true"></span>
                    <div class="app-title"><?=h($current_title)?></div>
                    <span id="dirtyStar" class="dirty-star" style="display:none;" title="Unsaved changes">*</span>
                </div>
                <div class="app-breadcrumb">
                    <a class="breadcrumb-link" href="index.php">/index</a>
                    <?php if ($requested): ?>
                        <?php $crumbFolder = folder_from_path($requested); ?>
                        <span class="breadcrumb-sep">/</span>
                        <a class="breadcrumb-link" href="edit.php?file=<?=rawurlencode($requested)?>&folder=<?=rawurlencode($crumbFolder)?>">
                            <?=h($crumbFolder)?>
                        </a>
                        <span class="breadcrumb-sep">/</span>
                        <span class="app-path-segment"><?=h(basename($requested))?></span>
                        <span id="headerSecretBadge" class="badge-secret" style="<?= $is_secret_req ? '' : 'display:none;' ?>">secret</span>
                    <?php endif; ?>
                </div>
            </div>
            <div class="app-header-actions">
                <?php if ($saved_flag && !$save_error): ?>
                    <div class="chip" style="background-color: #166534; color: white;">Opgeslagen</div>
                <?php elseif ($save_error): ?>
                    <div class="chip" style="background-color: var(--danger); color: white;"><?=h($save_error)?></div>
                <?php endif; ?>

                <button id="mobileNavToggle" type="button" class="btn btn-ghost icon-button mobile-nav-toggle" aria-label="Toon files">
                    <span class="pi pi-list"></span>
                </button>
                <button id="themeToggle" type="button" class="btn btn-ghost icon-button"><span class="pi pi-sun" id="themeIcon"></span></button>
            </div>
        </div>
    </header>

    <div class="nav-overlay" id="navOverlay"></div>

<main class="app-main">
    <div class="editor-shell">
        <div class="editor-grid" id="editorGrid">

            <!-- LINKERPANE: index / filter -->
            <section class="editor-pane" id="links_md_overview" tabindex="0">
                <div class="editor-pane-inner">
                    <header class="pane-header">
                        <div class="pane-title-row">
                            <div class="pane-title">
                                <span class="pi pi-notebook"></span>
                                <span>Notes</span>
                            </div>
                            <div class="pane-title-actions">
                                <div class="pane-subtitle" id="navCount">0 items</div>
                                <button type="button" id="mobileNavClose" class="btn btn-ghost icon-button mobile-nav-close" aria-label="Sluit files">
                                    <span class="pi pi-times"></span>
                                </button>
                            </div>
                        </div>
                        <div class="nav-filter-row">
                            <input id="filterInput" class="input" type="text" placeholder="Filter…">
                            <button type="button" id="filterReset" class="btn btn-ghost icon-button filter-reset" aria-label="Reset filter">
                                <span class="pi pi-times" aria-hidden="true"></span>
                            </button>
                        </div>
                    </header>
                    <div class="pane-body nav-body">
                        <?php if (!empty($shortcuts)): ?>
                        <div class="nav-section">
                            <div class="nav-section-title">
                                <span class="pi pi-dashboard"></span>
                                <span>Shortcuts</span>
                            </div>
                            <ul class="nav-list">
                            <?php foreach($shortcuts as $lnk): ?>
                                <li class="nav-shortcut">
                                    <a href="<?=h($lnk['url'])?>" target="_blank" rel="noopener noreferrer" class="nav-shortcut-link kbd-item">
                                        <span class="nav-shortcut-label"><?=h($lnk['shortcut'])?></span>
                                        <span class="pi pi-externallink nav-shortcut-icon"></span>
                                    </a>
                                </li>
                            <?php endforeach; ?>
                            </ul>
                        </div>
                        <?php endif; ?>

                        <?php if (!empty($rootList)): ?>
                        <div class="nav-section">
                            <div class="nav-section-title">
                                <span class="pi pi-folder"></span>
                                <a class="breadcrumb-link" href="edit.php?<?= $requested ? ('file='.rawurlencode($requested).'&') : '' ?>folder=root">Root</a>
                            </div>
                            <ul class="nav-list">
                            <?php foreach($rootList as $entry):
                                $p   = $entry['path'];
                                $raw = @file_get_contents($p);
                                $t   = $raw ? extract_title($raw) : $entry['basename'];
                                $isSecret = isset($secretMap[$p]);
                                $isCurrent = ($requested === $p);
                            ?>
                                <li class="nav-item doclink <?= $isCurrent ? 'nav-item-current' : '' ?>" data-secret="<?=$isSecret ? 'true' : 'false'?>" data-file="<?=h($p)?>">
                                    <a href="edit.php?file=<?=rawurlencode($p)?>" class="nav-item-link kbd-item">
                                        <div class="nav-item-main">
                                            <span class="nav-item-title"><?=h($t)?></span>
                                            <?php if ($isSecret): ?>
                                                <span class="badge badge-secret">secret</span>
                                            <?php endif; ?>
                                        </div>
                                        <div class="nav-item-path"><?=h($p)?></div>
                                    </a>
                                </li>
                            <?php endforeach; ?>
                            </ul>
                        </div>
                        <?php endif; ?>

                        <?php foreach($dirMap as $dirname=>$list): ?>
                        <div class="nav-section">
                            <div class="nav-section-title">
                                <span class="pi pi-folder"></span>
                                <a class="breadcrumb-link" href="edit.php?<?= $requested ? ('file='.rawurlencode($requested).'&') : '' ?>folder=<?=rawurlencode($dirname)?>"><?=h($dirname)?></a>
                            </div>
                            <ul class="nav-list">
                            <?php foreach($list as $entry):
                                $p   = $entry['path'];
                                $raw = @file_get_contents($p);
                                $t   = $raw ? extract_title($raw) : $entry['basename'];
                                $isSecret = isset($secretMap[$p]);
                                $isCurrent = ($requested === $p);
                            ?>
                                <li class="nav-item doclink <?= $isCurrent ? 'nav-item-current' : '' ?>" data-secret="<?=$isSecret ? 'true' : 'false'?>" data-file="<?=h($p)?>">
                                    <a href="edit.php?file=<?=rawurlencode($p)?>" class="nav-item-link kbd-item">
                                        <div class="nav-item-main">
                                            <span class="nav-item-title"><?=h($t)?></span>
                                            <?php if ($isSecret): ?>
                                                <span class="badge badge-secret">secret</span>
                                            <?php endif; ?>
                                        </div>
                                        <div class="nav-item-path"><?=h($p)?></div>
                                    </a>
                                </li>
                            <?php endforeach; ?>
                            </ul>
                        </div>
                        <?php endforeach; ?>

                        <?php if (empty($rootList) && empty($dirMap) && empty($shortcuts)): ?>
                            <div class="nav-empty">Nothing here yet.</div>
                        <?php endif; ?>
                    </div>
                </div>
            </section>

            <!-- resizer tussen links en midden -->
            <div class="col-resizer" data-resizer="left"></div>

            <!-- MIDDENPANE: markdown-editor -->
            <section class="editor-pane" id="paneMarkdown">
                <div class="editor-pane-inner">
                    <header class="pane-header editor-header">
                        <div class="pane-title-row">
                            <div class="pane-title">
                                <span class="icon-text-logo">MD</span>
                                <span>Markdown</span>
                            </div>
                            <div class="pane-header-actions">
                                <button type="submit" form="editor-form" class="btn btn-ghost">
                                    <span class="pi pi-floppydisk"></span>
                                    <span class="btn-label">Save</span>
                                </button>
                                <button type="button" id="btnRevert" class="btn btn-ghost">
                                    <span class="pi pi-recycle"></span>
                                    <span class="btn-label">Revert</span>
                                </button>
                                <form method="post" action="index.php" id="deleteForm" class="deleteForm" data-file="<?=h($requested ?? '')?>">
                                    <input type="hidden" name="action" value="delete">
                                    <input type="hidden" name="file" id="deleteFileInput" value="<?=h($requested ?? '')?>">
                                    <input type="hidden" name="csrf" value="<?=h($CSRF_TOKEN)?>">
                                    <button type="submit" class="btn btn-ghost" <?= $requested ? '' : 'disabled' ?>>
                                        <span class="pi pi-bin"></span>
                                        <span class="btn-label">Delete</span>
                                    </button>
                                </form>
                            </div>
                        </div>
                        <?php if ($requested): ?>
                        <div class="pane-subtitle small">
                            <?=h($requested)?>
                        </div>
                        <?php endif; ?>
                    </header>

                    <form method="post" class="editor-form" id="editor-form" autocomplete="off">
                        <input type="hidden" name="file" value="<?=h($requested)?>">
                        <input type="hidden" name="action" value="save">

                        <div class="editor-body">
                            <div class="editor-lines" id="lineNumbers"></div>
                            <textarea id="editor" name="content" class="editor-textarea"
                                spellcheck="false"><?=htmlspecialchars($current_content, ENT_QUOTES, 'UTF-8')?></textarea>
                        </div>

                        <footer class="editor-footer">
                            <div class="editor-footer-right">
                                <span id="liveStatus" class="status-text"></span>
                            </div>
                        </footer>
                    </form>
                </div>
            </section>

            <!-- resizer tussen midden en rechts -->
            <div class="col-resizer" data-resizer="right"></div>

            <!-- RECHTERPANE: HTML-preview -->
            <section class="editor-pane" id="panePreview">
                <div class="editor-pane-inner">
                    <header class="pane-header">
                        <div class="pane-title-row">
                            <div class="pane-title">
                                <span class="pi pi-eye"></span>
                                <span>HTML preview</span>
                            </div>
                        </div>
                    </header>
                    <div class="pane-body preview-body">
                        <div id="preview" class="preview-content">
                            <?=$current_html?>
                        </div>
                    </div>
                </div>
            </section>

        </div>
    </div>
</main>

    <footer class="app-footer">
        flat md site • <?=date('Y')?> • no db, no cms, no bloat
    </footer>

<script>
window.CURRENT_FILE = <?= json_encode($requested ?? '') ?>;
window.initialContent = <?= json_encode($current_content ?? '') ?>;
window.IS_SECRET_AUTHENTICATED = <?= json_encode(is_secret_authenticated()) ?>;
</script>

<script defer src="base.js"></script>

</body>
</html>
