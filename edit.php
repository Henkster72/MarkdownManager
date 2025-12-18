<?php
/*******************************
 * MarkdownManager v0.1
 * - Static assets in STATIC_DIR (CSS/JS/font)
 * - shared security + secret_mds logic
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

require_once __DIR__ . '/html_preview.php';
require_once __DIR__ . '/themes_lib.php';

$STATIC_DIR = sanitize_folder_name(env_str('STATIC_DIR', 'static') ?? '') ?? 'static';
$IMAGES_DIR = sanitize_folder_name(env_str('IMAGES_DIR', 'images') ?? '') ?? 'images';
$THEMES_DIR = sanitize_folder_name(env_str('THEMES_DIR', 'themes') ?? '') ?? 'themes';
$themesList = list_available_themes($THEMES_DIR);

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

    sort($dirs, SORT_NATURAL | SORT_FLAG_CASE);

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
$rootList   = list_md_root_sorted();
$dirMap     = list_md_by_subdir_sorted();
$folder_filter = sanitize_folder_name($_GET['folder'] ?? '') ?? null;

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

<link rel="stylesheet" href="<?=h($STATIC_DIR)?>/ui.css">
<link rel="stylesheet" href="<?=h($STATIC_DIR)?>/markdown.css">
<link rel="stylesheet" href="<?=h($STATIC_DIR)?>/htmlpreview.css">
<link rel="stylesheet" href="<?=h($STATIC_DIR)?>/popicon.css">

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
		                <button id="themeSettingsBtn" type="button" class="btn btn-ghost icon-button" title="Theme settings" aria-label="Theme settings">
		                    <span class="pi pi-gear"></span>
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
	                                    <span class="pi pi-cross"></span>
	                                </button>
	                            </div>
                        </div>
	                        <div class="nav-filter-row">
	                            <input id="filterInput" class="input" type="text" placeholder="Filter…">
	                        </div>
	                    </header>
	                    <div class="pane-body nav-body">
	                        <?php
	                            require_once __DIR__ . '/explorer_view.php';
	                            explorer_view_render_tree([
	                                'page' => 'edit',
	                                'rootList' => $rootList,
	                                'dirMap' => $dirMap,
	                                'secretMap' => $secretMap,
	                                'folder_filter' => $folder_filter,
	                                'current_file' => $requested,
	                                'show_actions' => false,
	                                'plugins_enabled' => false,
	                            ]);
	                        ?>
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
		                                <button type="button" id="addLinkBtn" class="btn btn-ghost" title="Add link">
		                                    <span class="pi pi-linkchain"></span>
		                                    <span class="btn-label">Link</span>
		                                </button>
		                                <button type="button" id="addImageBtn" class="btn btn-ghost" title="Insert image">
		                                    <span class="pi pi-image"></span>
		                                    <span class="btn-label">Image</span>
		                                </button>
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
                            <div class="pane-header-actions">
                                <button type="button" id="exportHtmlBtn" class="btn btn-ghost" title="Download a plain HTML export" <?= $requested ? '' : 'disabled' ?>>
                                    <span class="pi pi-download"></span>
                                    <span class="btn-label">HTML download</span>
                                </button>
                                <button type="button" id="copyHtmlBtn" class="btn btn-ghost" title="Copy plain HTML to clipboard" <?= $requested ? '' : 'disabled' ?>>
                                    <span class="pi pi-copy"></span>
                                    <span class="btn-label">Copy HTML</span>
                                </button>
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
		        <?=date('Y')?> • <a href="https://github.com/Henkster72/MarkdownManager" target="_blank" rel="noopener noreferrer">Markdown Manager</a> • <a href="https://allroundwebsite.com" target="_blank" rel="noopener noreferrer">Allroundwebsite.com</a>
		    </footer>

		<div class="modal-overlay" id="linkModalOverlay" hidden></div>
		<div class="modal" id="linkModal" role="dialog" aria-modal="true" aria-labelledby="linkModalTitle" hidden>
		    <div class="modal-header">
		        <div class="modal-title" id="linkModalTitle">Add link</div>
		        <button type="button" class="btn btn-ghost icon-button" id="linkModalClose" aria-label="Close">
		            <span class="pi pi-cross"></span>
		        </button>
			</div>
		    <div class="modal-body">
		        <div class="modal-row">
		            <label class="radio">
		                <input type="radio" name="linkMode" value="internal" checked>
	                <span>Internal</span>
	            </label>
	            <label class="radio">
	                <input type="radio" name="linkMode" value="external">
	                <span>External</span>
	            </label>
	        </div>

	        <div id="linkModalInternal" class="link-modal-section">
	            <div class="link-picker-filter-row">
	                <input id="linkPickerFilter" type="text" class="input" placeholder="Search notes...">
	                <button type="button" class="btn btn-ghost icon-button" id="linkPickerFilterClear" aria-label="Clear search" style="display:none;">
	                    <span class="pi pi-cross"></span>
	                </button>
	            </div>
	            <div class="link-picker" id="linkPicker">
	                <?php
	                    $renderPickerGroup = function($groupTitle, $entries) use ($secretMap) {
	                        if (empty($entries)) return;
	                        $groupId = 'linkpicker-' . substr(sha1('picker:' . $groupTitle), 0, 10);
	                        ?>
	                        <section class="nav-section">
	                            <div class="nav-section-title">
	                                <span class="pi pi-folder"></span>
	                                <span><?=h($groupTitle)?></span>
	                            </div>
	                            <ul class="notes-list" id="<?=h($groupId)?>">
	                            <?php foreach ($entries as $entry):
	                                $p = $entry['path'];
	                                $t = function_exists('explorer_view_extract_md_title_from_file')
	                                    ? explorer_view_extract_md_title_from_file(__DIR__ . '/' . $p, $entry['basename'])
	                                    : $entry['basename'];
	                                $isSecret = isset($secretMap[$p]);
	                            ?>
	                                <li class="note-item">
	                                    <button type="button" class="note-link kbd-item link-pick-item" data-path="<?=h($p)?>" data-title="<?=h($t)?>">
	                                        <div class="note-title" style="justify-content: space-between;">
	                                            <span><?=h($t)?></span>
	                                            <?php if ($isSecret): ?>
	                                                <span class="badge-secret">secret</span>
	                                            <?php endif; ?>
	                                        </div>
	                                    </button>
	                                </li>
	                            <?php endforeach; ?>
	                            </ul>
	                        </section>
	                        <?php
	                    };

	                    $rootEntries = [];
	                    foreach ($rootList as $e) $rootEntries[] = $e;
	                    $renderPickerGroup('Root', $rootEntries);

	                    foreach ($dirMap as $dirname => $entries) {
	                        $renderPickerGroup($dirname, $entries);
	                    }
	                ?>
	            </div>
	        </div>

	        <div id="linkModalExternal" class="link-modal-section" hidden>
	            <div class="modal-field">
	                <label class="modal-label" for="externalLinkText">Link text</label>
	                <input id="externalLinkText" type="text" class="input" placeholder="e.g. Gold spot price">
	            </div>
	            <div class="modal-field">
	                <label class="modal-label" for="externalLinkUrl">URL</label>
	                <input id="externalLinkUrl" type="url" class="input" placeholder="https://example.com/">
	            </div>
	        </div>
	    </div>
		    <div class="modal-footer">
		        <button type="button" class="btn btn-ghost" id="linkModalCancel">Cancel</button>
		        <button type="button" class="btn btn-primary" id="linkModalInsert" disabled>Insert link</button>
		    </div>
		</div>

			<div class="modal-overlay" id="imageModalOverlay" hidden></div>
			<div class="modal" id="imageModal" role="dialog" aria-modal="true" aria-labelledby="imageModalTitle" hidden>
			    <div class="modal-header">
			        <div class="modal-title" id="imageModalTitle">Insert image</div>
		        <button type="button" class="btn btn-ghost icon-button" id="imageModalClose" aria-label="Close">
		            <span class="pi pi-cross"></span>
		        </button>
		    </div>
		    <div class="modal-body">
		        <input type="hidden" id="imageCsrf" value="<?=h($CSRF_TOKEN)?>">
		        <div class="modal-row" style="gap: 0.6rem;">
		            <div style="display:flex; gap:0.6rem; align-items:center; flex-wrap:wrap;">
		                <input id="imageUploadInput" type="file" class="input" accept="image/*" style="flex: 1 1 16rem;">
		                <button type="button" class="btn btn-primary btn-small" id="imageUploadBtn">Upload</button>
		            </div>
		            <div style="display:flex; gap:0.6rem; align-items:center;">
		                <input id="imageAltInput" type="text" class="input" placeholder="Alt text (optional)" style="flex: 1 1 auto;">
		            </div>
		            <div class="status-text" id="imageStatus" style="min-height: 1.2em;"></div>
		        </div>

		        <div class="modal-row" style="gap: 0.6rem;">
		            <div style="display:flex; gap:0.6rem; align-items:center;">
		                <input id="imageFilter" type="text" class="input" placeholder="Search images..." style="flex: 1 1 auto;">
		                <button type="button" class="btn btn-ghost btn-small" id="imageFilterClear" aria-label="Clear">Clear</button>
		            </div>
		            <div id="imageList" style="max-height: 55vh; overflow:auto; border: 1px solid var(--border-soft); border-radius: 0.75rem; padding: 0.5rem;"></div>
		            <div class="status-text" style="margin-top: 0.25rem;">
		                Tip: click an image to insert <code>![]()</code> at the cursor.
		            </div>
		        </div>
			    </div>
			    <div class="modal-footer" style="display:flex; justify-content:flex-end; gap:0.5rem;">
			        <button type="button" class="btn btn-ghost btn-small" id="imageModalCancel">Close</button>
			    </div>
			</div>

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
	window.CURRENT_FILE = <?= json_encode($requested ?? '') ?>;
	window.initialContent = <?= json_encode($current_content ?? '') ?>;
	window.IS_SECRET_AUTHENTICATED = <?= json_encode(is_secret_authenticated()) ?>;
	window.MDW_THEMES_DIR = <?= json_encode($THEMES_DIR) ?>;
	window.MDW_THEMES = <?= json_encode($themesList) ?>;
	</script>

<script defer src="<?=h($STATIC_DIR)?>/base.js"></script>

</body>
</html>
