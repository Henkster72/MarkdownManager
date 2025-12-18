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
require_once __DIR__ . '/env_loader.php';

$LINKS_CSV           = env_path('LINKS_CSV', __DIR__ . '/links.csv');
$SECRET_MDS_FILE     = env_path('SECRET_MDS_FILE', __DIR__ . '/secret_mds.txt');
$SECRET_MDS_PASSWORD = (string)env_str('SECRET_MDS_PASSWORD', '');

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
    if ($path === '' || str_ends_with($path, '/')) return null;

    // Always enforce .md extension (append if missing).
    if (!preg_match('/\\.md$/i', $path)) {
        $path .= '.md';
    }

    $parts = explode('/', $path);
    foreach ($parts as $p) {
        if ($p === '') return null;
        // allow unicode letters/numbers plus . _ -
        if (!preg_match('/^[A-Za-z0-9._\-\p{L}\p{N}]+$/u', $p)) return null;
    }

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

require_once __DIR__ . '/html_preview.php';
require_once __DIR__ . '/themes_lib.php';

$STATIC_DIR = sanitize_folder_name(env_str('STATIC_DIR', 'static') ?? '') ?? 'static';
$IMAGES_DIR = sanitize_folder_name(env_str('IMAGES_DIR', 'images') ?? '') ?? 'images';
$THEMES_DIR = sanitize_folder_name(env_str('THEMES_DIR', 'themes') ?? '') ?? 'themes';
$themesList = list_available_themes($THEMES_DIR);

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
    $pluginsDir = env_path('PLUGINS_DIR', __DIR__ . '/plugins', __DIR__);
    $staticDir = sanitize_folder_name(env_str('STATIC_DIR', 'static') ?? '') ?? 'static';
    $imagesDir = sanitize_folder_name(env_str('IMAGES_DIR', 'images') ?? '') ?? 'images';
    $themesDir = sanitize_folder_name(env_str('THEMES_DIR', 'themes') ?? '') ?? 'themes';
    $exclude = [
        'root' => true,
        'HTML' => true,
        'PDF' => true,
        basename($pluginsDir) => true,
        $staticDir => true,
        $imagesDir => true,
        $themesDir => true,
    ];

    $dirs = array_filter(glob('*'), function($f){
        return is_dir($f) && $f[0]!=='.';
    });

    sort($dirs, SORT_NATURAL | SORT_FLAG_CASE); // folders A→Z

    $map=[];
    foreach($dirs as $dir){
        if (isset($exclude[$dir])) continue;
        $mds = glob($dir.'/*.md');

        $tmp=[];
        if ($mds) {
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
        }

        usort($tmp, 'compare_entries_desc_date');
        $map[$dir]=$tmp;
    }
    return $map;
}

function list_existing_folders_sorted($excludeNames = []) {
    $exclude = [];
    if (is_array($excludeNames)) {
        foreach ($excludeNames as $n) {
            if (is_string($n) && $n !== '') $exclude[$n] = true;
        }
    }

    $dirs = array_filter(glob('*'), function($f) use ($exclude){
        if (!is_dir($f)) return false;
        if ($f === '' || $f[0] === '.') return false;
        if (isset($exclude[$f])) return false;
        return true;
    });

    sort($dirs, SORT_NATURAL | SORT_FLAG_CASE);
    return array_values($dirs);
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
	    } else if ($_POST['action'] === 'create_folder') {
	        $nameRaw = isset($_POST['folder_name']) ? (string)$_POST['folder_name'] : '';
	        $name = sanitize_folder_name($nameRaw);
	        if (!$name) {
	            $_SESSION['flash_error'] = 'Ongeldige foldernaam.';
	            header('Location: index.php');
	            exit;
	        }

	        $pluginsDir = env_path('PLUGINS_DIR', __DIR__ . '/plugins', __DIR__);
	        $reserved = [
	            'root' => true,
	            'HTML' => true,
	            'PDF' => true,
	            basename($pluginsDir) => true,
	            $STATIC_DIR => true,
	            $IMAGES_DIR => true,
	            $THEMES_DIR => true,
	        ];
	        if (isset($reserved[$name])) {
	            $_SESSION['flash_error'] = 'Deze foldernaam is gereserveerd.';
	            header('Location: index.php');
	            exit;
	        }

	        $full = __DIR__ . '/' . $name;
	        if (is_dir($full)) {
	            $_SESSION['flash_error'] = 'Folder bestaat al: ' . $name;
	            header('Location: index.php?folder=' . rawurlencode($name));
	            exit;
	        }
	        if (file_exists($full)) {
	            $_SESSION['flash_error'] = 'Pad bestaat al (geen folder): ' . $name;
	            header('Location: index.php');
	            exit;
	        }

	        if (!@mkdir($full, 0755, false)) {
	            $err = error_get_last();
	            $msg = 'Kon folder niet aanmaken.';
	            if ($err && !empty($err['message'])) $msg .= ' (' . $err['message'] . ')';
	            $_SESSION['flash_error'] = $msg;
	            header('Location: index.php');
	            exit;
	        }

	        $_SESSION['flash_ok'] = 'Folder aangemaakt: ' . $name;
	        header('Location: index.php?folder=' . rawurlencode($name));
	        exit;
	    } else if ($_POST['action'] === 'create') {
	        $postedPath = isset($_POST['new_path']) ? (string)$_POST['new_path'] : '';
	        $prefixDate = isset($_POST['prefix_date']) && (string)$_POST['prefix_date'] === '1';
	        if (trim($postedPath) === '') {
	            $folder = isset($_POST['new_folder']) ? (string)$_POST['new_folder'] : '';
            $folder = sanitize_folder_name($folder) ?? 'root';
            $file = isset($_POST['new_file']) ? (string)$_POST['new_file'] : '';
            $file = trim(str_replace("\\", "/", $file));
            $file = ltrim($file, "/");
            if ($prefixDate && !preg_match('/^\d{2}-\d{2}-\d{2}-/', $file)) {
                $file = date('y-m-d-') . $file;
            }
            $postedPath = ($folder && $folder !== 'root') ? ($folder . '/' . $file) : $file;
        } else if ($prefixDate) {
            $tmp = trim(str_replace("\\", "/", $postedPath));
            $tmp = ltrim($tmp, "/");
            $d = dirname($tmp);
            $b = basename($tmp);
            if (!preg_match('/^\d{2}-\d{2}-\d{2}-/', $b)) {
                $b = date('y-m-d-') . $b;
            }
            $postedPath = ($d === '.' || $d === '') ? $b : ($d . '/' . $b);
        }

	        $sanNew = sanitize_new_md_path($postedPath);
	        $open_new_panel = true;
	        if (!$sanNew) {
	            $_SESSION['flash_error'] = 'Ongeldige bestandsnaam. Gebruik een relative path (de app voegt automatisch .md toe).';
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
                $article_html  = md_to_html($raw, $requested, 'view');
            }
        } else {
            // normaal, niet-secret bestand
            $mode='view';
            $raw = file_get_contents($full);
            $article_title = extract_title($raw);
            $article_html  = md_to_html($raw, $requested, 'view');
        }
    }
}

	/* LOAD DATA FOR INDEX */
	$rootList  = $mode==='index' ? list_md_root_sorted()        : [];
	$dirMap    = $mode==='index' ? list_md_by_subdir_sorted()   : [];
	$secretMap = load_secret_mds(); // voor index-weergave
	$existingFolders = [];
	$default_new_folder = 'root';
	$today_prefix = date('y-m-d-');
		if ($mode === 'index') {
		    $pluginsDir = env_path('PLUGINS_DIR', __DIR__ . '/plugins', __DIR__);
		    $exclude = [basename($pluginsDir), 'HTML', 'PDF', $STATIC_DIR, $IMAGES_DIR, $THEMES_DIR];
		    $existingFolders = list_existing_folders_sorted($exclude);
		    if ($folder_filter && in_array($folder_filter, $existingFolders, true)) {
		        $default_new_folder = $folder_filter;
		    }
		}


?>
<!DOCTYPE html>
<html lang="en" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title><?=h($article_title)?></title>

<link rel="stylesheet" href="<?=h($STATIC_DIR)?>/ui.css">
<link rel="stylesheet" href="<?=h($STATIC_DIR)?>/markdown.css">
<link rel="stylesheet" href="<?=h($STATIC_DIR)?>/htmlpreview.css">
<link rel="stylesheet" href="<?=h($STATIC_DIR)?>/popicon.css">

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
		            <a class="app-logo" href="index.php" aria-label="Go to index">
		                <svg fill="none" version="1.1" viewBox="0 0 833 607" xmlns="http://www.w3.org/2000/svg">
		                 <style><![CDATA[.B{stroke-linejoin:round}.C{stroke-linecap:round}]]></style>
		                 <g stroke="#fff" stroke-width="20">
		                  <path class="B C" d="M673 371v198c0 16-13 28-28 28H39c-15 0-28-13-28-28V38c0-16 13-28 28-28h606c16-.1 28 12 28 28v133"/>
	                  <path d="m10 130h663"/>
	                  <path class="B C" d="M550 70H216"/>
	                  <path d="m172 70a24 24 0 1 1-48 0 24 24 0 0 1 48 0zm-70 0a24 24 0 1 1-48 0 24 24 0 0 1 48 0zm713 109c10-10 10-27 0-38l-18-18c-10-10-27-10-37 0l-294 297-48 90c-6 9 5 20 14 14l89-49 294-296zm-299 296-51-52"/>
	                  <path d="m796 197-55-55z"/>
	                  <path class="B C" d="M72 499h165M72 447h330M72 397h330M72 348h330"/>
		                  <path class="B" d="M72 222c0-8 7-15 15-15h300c8 0 15 7 15 15v62c0 8-7 15-15 15H87c-8-.06-15-7-15-15z"/>
		                 </g>
		                </svg>
		            </a>
	            <div class="app-header-text">
	                <div class="app-title-row">
	                    <div class="app-title">
	                        <?=h($APP_NAME)?>
	                        <?php if ($mode==='index'): ?>
	                            <span style="font-weight: 500; opacity: 0.75;"> • overview</span>
	                        <?php endif; ?>
	                    </div>
	                </div>
	                <div class="app-breadcrumb">
	                <a class="breadcrumb-link" href="index.php">/index</a>
		                <?php if ($active_folder_for_breadcrumb): ?>
		                    <span class="breadcrumb-sep">/</span>
		                    <a class="breadcrumb-link" href="index.php?folder=<?=rawurlencode($active_folder_for_breadcrumb)?>#contentList">
	                        <?=h($active_folder_for_breadcrumb)?>
	                    </a>
	                <?php endif; ?>
	                <?php if ($mode==='view' && $requested): ?>
	                    <span class="breadcrumb-sep">/</span>
	                    <span class="app-path-segment"><?=h(basename($requested))?></span>
	                <?php endif; ?>
	                </div>
	            </div>
	        </div>
	        <div class="app-header-actions">
	            <?php if ($mode==='index'): ?>
	            <button id="newMdToggle" type="button" class="btn btn-ghost btn-small">+MD</button>
	            <button id="newFolderBtn" type="button" class="btn btn-ghost btn-small" title="Create a new folder">
	                <span class="pi pi-folder"></span>
	                <span>+</span>
	            </button>
	            <form id="newFolderForm" method="post" style="display:none;">
	                <input type="hidden" name="action" value="create_folder">
	                <input type="hidden" name="csrf" value="<?=h($CSRF_TOKEN)?>">
	                <input type="hidden" name="folder_name" id="newFolderName" value="">
	            </form>
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
	            <button id="themeSettingsBtn" type="button" class="btn btn-ghost icon-button" title="Theme settings" aria-label="Theme settings">
	                <span class="pi pi-gear"></span>
	            </button>
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
		        <div style="display: flex; flex-direction: column; gap: 0.6rem;">
		            <div style="display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap;">
		                <select name="new_folder" class="input" style="width: auto; flex: 1 1 12rem; min-width: 10rem;" aria-label="Folder">
		                <option value="root" <?= $default_new_folder === 'root' ? 'selected' : '' ?>>Root</option>
		                <?php foreach ($existingFolders as $folder): ?>
		                    <option value="<?=h($folder)?>" <?= $default_new_folder === $folder ? 'selected' : '' ?>><?=h($folder)?></option>
		                <?php endforeach; ?>
		            </select>
		            <label class="status-text" style="display:flex; align-items:center; gap:0.35rem; white-space:nowrap;" title="Adds a yy-mm-dd- prefix so notes sort nicely by date.">
		                <input id="newMdPrefixDate" type="checkbox" name="prefix_date" value="1" checked data-date-prefix="<?=h($today_prefix)?>">
		                <span>yy-mm-dd-</span>
		            </label>
		            </div>
		            <input id="newMdFile" name="new_file" class="input" style="width: 100%;" type="text" value="<?=h($today_prefix)?>" placeholder="title.md" required>
		        </div>
		        <textarea name="new_content" class="input" rows="4" style="height: auto; display: block;" placeholder="# Title&#10;&#10;Start writing..."></textarea>
		        <div style="display: flex; justify-content: flex-end;">
		            <button type="submit" class="btn btn-primary btn-small">Create & edit</button>
		        </div>
	    </form>
</section>

	<?php
	require_once __DIR__ . '/explorer_view.php';
	explorer_view_render_plugin_hook('header', [
	    'page' => 'index',
	    'project_dir' => __DIR__,
	    'plugins_enabled' => true,
	    'links_csv' => $LINKS_CSV,
	    'links_variant' => 'index',
	]);
	?>

<!-- Filter + heading -->
<section style="text-align: center; margin-bottom: 2rem;">
    <h1 style="font-size: 1.875rem; font-weight: 700; margin-bottom: 0.75rem;">Contents</h1>
	    <p style="font-size: 0.8rem; color: var(--text-muted); max-width: 42em; margin: 0 auto; line-height: 1.6;">
	        Filter by title. Newest dates first (based on filename prefix yy-mm-dd-).
	        First <code># Heading</code> in each .md becomes the title; HTML uses <code>&lt;title&gt;</code> (or <code>&lt;h1&gt;</code>).
	    </p>
	    <div id="filterWrap" style="position: relative; max-width: 20rem; margin: 1rem auto 0;">
	        <input id="filterInput" class="input notes-filter-input" style="margin: 0; padding-right: 2.25rem;" type="text" placeholder="Type to filter...">
	        <button id="filterClear" type="button" class="btn btn-ghost icon-button" title="Clear filter" aria-label="Clear filter" style="display: none; position: absolute; right: 0.35rem; top: 50%; transform: translateY(-50%);">
	            <span class="pi pi-cross"></span>
        </button>
    </div>
</section>

	<?php
	explorer_view_render_tree([
	    'page' => 'index',
	    'rootList' => $rootList,
	    'dirMap' => $dirMap,
	    'secretMap' => $secretMap,
	    'folder_filter' => $folder_filter,
	    'csrf_token' => $CSRF_TOKEN,
	    'show_actions' => true,
	]);
	?>

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
	    <?=date('Y')?> • <a href="https://github.com/Henkster72/MarkdownManager" target="_blank" rel="noopener noreferrer">Markdown Manager</a> • <a href="https://allroundwebsite.com" target="_blank" rel="noopener noreferrer">Allroundwebsite.com</a>
	</footer>

	<div class="modal-overlay" id="themeModalOverlay" hidden></div>
	<div class="modal" id="themeModal" role="dialog" aria-modal="true" aria-labelledby="themeModalTitle" hidden>
	    <div class="modal-header">
	        <div class="modal-title" id="themeModalTitle">Theme</div>
	        <button type="button" class="btn btn-ghost icon-button" id="themeModalClose" aria-label="Close">
	            <span class="pi pi-cross"></span>
	        </button>
	    </div>
	    <div class="modal-body">
	        <div class="modal-field">
	            <label class="modal-label" for="themePreset">Preset</label>
	            <div style="display:flex; align-items:center; gap:0.6rem;">
		            <select id="themePreset" class="input" style="flex: 1 1 auto;">
	                <option value="default">Default</option>
	                <?php foreach ($themesList as $t): ?>
	                    <?php
	                        $label = (isset($t['label']) && is_string($t['label']) && $t['label'] !== '') ? $t['label'] : $t['name'];
	                        if (isset($t['color']) && is_string($t['color']) && $t['color'] !== '') $label .= ' • ' . $t['color'];
	                    ?>
	                    <option value="<?=h($t['name'])?>"><?=h($label)?></option>
	                <?php endforeach; ?>
		            </select>
		            <div aria-hidden="true" style="display:flex; gap:0.35rem; align-items:center;">
		                <span id="themeSwatchPrimary" style="width: 1rem; height: 1rem; border-radius: 0.35rem; border:1px solid var(--border-soft);"></span>
		                <span id="themeSwatchSecondary" style="width: 1rem; height: 1rem; border-radius: 0.35rem; border:1px solid var(--border-soft);"></span>
		            </div>
	            </div>
	            <div id="themePresetPreview" style="margin-top: 0.5rem; padding: 0.55rem 0.65rem; border-radius: 0.75rem; border: 1px solid var(--border-soft);"></div>
	            <div class="status-text" style="margin-top: 0.4rem;">
	                Applies only to the Markdown editor + HTML preview.
	            </div>
	        </div>

	        <details style="margin-top: 0.8rem;">
	            <summary style="cursor:pointer; user-select:none; font-weight: 600;">Overrides (optional)</summary>
	            <div style="margin-top: 0.75rem; display:flex; flex-direction:column; gap: 0.75rem;">
	                <div class="status-text">
	                    Overrides are saved in your browser (localStorage) automatically as you type.
	                    <span id="themeOverridesStatus" style="margin-left: 0.35rem;"></span>
	                </div>
	                <div class="modal-field">
	                    <div class="modal-label" style="margin-bottom: 0.35rem;">HTML preview</div>
	                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 0.6rem;">
	                        <input id="themePreviewBg" type="text" class="input" placeholder="Background (e.g. #ffffff)">
	                        <input id="themePreviewText" type="text" class="input" placeholder="Text color (e.g. #111827)">
	                        <input id="themePreviewFont" type="text" class="input" placeholder="Font family (e.g. Playfair Display)">
	                        <input id="themePreviewFontSize" type="text" class="input" placeholder="Font size (e.g. 16px)">
	                        <input id="themeHeadingFont" type="text" class="input" placeholder="Heading font family (e.g. Montserrat)">
	                        <input id="themeHeadingColor" type="text" class="input" placeholder="Heading color (e.g. rgb(229,33,157))">
	                        <input id="themeListColor" type="text" class="input" placeholder="List color (optional)">
	                        <input id="themeBlockquoteTint" type="text" class="input" placeholder="Blockquote tint (optional)">
	                    </div>
	                </div>

	                <div class="modal-field">
	                    <div class="modal-label" style="margin-bottom: 0.35rem;">Markdown editor</div>
	                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 0.6rem;">
	                        <input id="themeEditorFont" type="text" class="input" placeholder="Font family (e.g. Playfair Display)">
	                        <input id="themeEditorFontSize" type="text" class="input" placeholder="Font size (e.g. 15px)">
	                        <input id="themeEditorAccent" type="text" class="input" placeholder="Accent color (e.g. rgb(229,33,157))">
	                    </div>
	                </div>

	                <div style="display:flex; gap: 0.6rem; align-items:center; justify-content:flex-end;">
	                    <button type="button" class="btn btn-ghost btn-small" id="themeSaveOverridesBtn" title="Save overrides now">Save overrides</button>
	                    <button type="button" class="btn btn-ghost btn-small" id="themeResetBtn" title="Clear overrides">Reset overrides</button>
	                </div>
	            </div>
	        </details>
	    </div>
	    <div class="modal-footer">
	        <button type="button" class="btn btn-ghost" id="themeModalCancel">Close</button>
	    </div>
	</div>

	<script>
	window.MDW_THEMES_DIR = <?= json_encode($THEMES_DIR) ?>;
	window.MDW_THEMES = <?= json_encode($themesList) ?>;
	</script>

	<script defer src="<?=h($STATIC_DIR)?>/base.js"></script>

	</body>
	</html>
