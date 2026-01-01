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
require_once __DIR__ . '/i18n.php';

$LINKS_CSV           = env_path('LINKS_CSV', __DIR__ . '/links.csv');
$SECRET_MDS_FILE     = env_path('SECRET_MDS_FILE', __DIR__ . '/secret_mds.txt');
$SECRET_MDS_PASSWORD = (string)env_str('SECRET_MDS_PASSWORD', '');

if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(16));
}
$CSRF_TOKEN = $_SESSION['csrf_token'];

$TRANSLATIONS_DIR = mdw_i18n_dir();
$MDW_LANGS = mdw_i18n_list_languages(__DIR__, $TRANSLATIONS_DIR);
$MDW_LANG = mdw_i18n_pick_lang($MDW_LANGS);
mdw_i18n_load(__DIR__, $TRANSLATIONS_DIR, $MDW_LANG);

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

define('MDW_NEW_MD_TITLE_MIN', 3);
define('MDW_NEW_MD_TITLE_MAX', 80);
define('MDW_NEW_MD_SLUG_MIN', 3);
define('MDW_NEW_MD_SLUG_MAX', 80);

function mdw_strlen($s) {
    return function_exists('mb_strlen') ? mb_strlen($s) : strlen($s);
}

function mdw_substr($s, $len) {
    return function_exists('mb_substr') ? mb_substr($s, 0, $len) : substr($s, 0, $len);
}

function mdw_wpm_base_info() {
    $raw = env_str('WPM_BASE_URL', '');
    if (!is_string($raw)) $raw = '';
    $trimmed = trim($raw);
    if ($trimmed === '') return [null, null];
    $clean = preg_replace('~^https?://~i', '', $trimmed);
    $clean = rtrim($clean, '/');
    if ($clean === '') return [null, null];
    if (preg_match('~^https?://~i', $trimmed)) {
        $siteBase = rtrim($trimmed, '/');
    } else {
        $siteBase = 'https://' . $clean;
    }
    return [$clean, $siteBase];
}

function mdw_wpm_public_url($path, $siteBase) {
    if (!is_string($path) || $path === '') return null;
    if (!is_string($siteBase) || $siteBase === '') return null;
    $path = preg_replace('/\\.md$/i', '', $path);
    $parts = explode('/', $path);
    $parts = array_map('rawurlencode', $parts);
    $safePath = implode('/', $parts);
    return rtrim($siteBase, '/') . '/' . ltrim($safePath, '/');
}

[$WPM_BASE_DOMAIN, $WPM_SITE_BASE] = mdw_wpm_base_info();
$WPM_PLUGIN_ACTIVE = false;
if ($WPM_BASE_DOMAIN !== null) {
    $pluginsDir = env_path('PLUGINS_DIR', __DIR__ . '/plugins', __DIR__);
    if (is_file(rtrim($pluginsDir, "/\\") . '/google_search_plugin.php')) {
        $WPM_PLUGIN_ACTIVE = true;
    }
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

function sanitize_md_path_like($path) {
    if (!is_string($path)) return null;
    $path = trim($path);
    if ($path === '' || strpos($path, '..') !== false) return null;

    $path = str_replace("\\", "/", $path);
    $path = trim($path, "/");
    $parts = explode('/', $path);
    foreach ($parts as $p) {
        if ($p === '') return null;
        if (!preg_match('/^[A-Za-z0-9._\-\p{L}\p{N}]+$/u', $p)) return null;
    }
    if (!preg_match('/\.md$/i', end($parts))) return null;
    return $path;
}

function sanitize_new_md_path($path) {
    if (!is_string($path) || trim($path) === '') return null;

    $path = trim($path);
    $path = str_replace("\\", "/", $path);
    $path = preg_replace('~/+~', '/', $path);
    $path = ltrim($path, "/");
    if ($path === '' || str_ends_with($path, '/')) return null;

    $hasMd = (bool)preg_match('/\\.md$/i', $path);
    if (!$hasMd) $path .= '.md';

    $parts = explode('/', $path);
    $cleanParts = [];
    foreach ($parts as $p) {
        if ($p === '') return null;
        $p = preg_replace('/\\s+/u', '-', $p);
        $p = preg_replace('/[^A-Za-z0-9._\\-\\p{L}\\p{N}]+/u', '', $p);
        $p = preg_replace('/-+/', '-', $p);
        $p = trim($p, '-');
        if ($p === '' || $p === '.' || $p === '..') return null;
        $cleanParts[] = $p;
    }

    $out = implode('/', $cleanParts);
    if (!preg_match('/\\.md$/i', $out)) $out .= '.md';
    return $out;
}

function sanitize_new_md_slug($slug) {
    if (!is_string($slug)) return null;
    $slug = trim($slug);
    if ($slug === '') return null;
    $slug = preg_replace('/\\.md$/i', '', $slug);
    $slug = str_replace(['\\', '/'], ' ', $slug);
    $slug = preg_replace('/\\s+/u', '-', $slug);
    $slug = preg_replace('/[^A-Za-z0-9._\\-\\p{L}\\p{N}]+/u', '', $slug);
    $slug = preg_replace('/-+/', '-', $slug);
    $slug = trim($slug, '-');
    $slug = trim($slug, '.');
    if ($slug === '' || $slug === '.' || $slug === '..') return null;
    return $slug;
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
$META_CFG = mdw_metadata_load_config();
$META_PUBLISHER_CFG = mdw_metadata_load_publisher_config();
$MDW_SETTINGS = (isset($META_CFG['_settings']) && is_array($META_CFG['_settings'])) ? $META_CFG['_settings'] : [];
$MDW_PUBLISHER_MODE = !empty($MDW_SETTINGS['publisher_mode']);
$copyButtonsEnabled = !array_key_exists('copy_buttons_enabled', $MDW_SETTINGS) || !empty($MDW_SETTINGS['copy_buttons_enabled']);
$copyIncludeMeta = !array_key_exists('copy_include_meta', $MDW_SETTINGS) || !empty($MDW_SETTINGS['copy_include_meta']);
$copyHtmlMode = isset($MDW_SETTINGS['copy_html_mode']) ? trim((string)$MDW_SETTINGS['copy_html_mode']) : 'dry';
if (!in_array($copyHtmlMode, ['dry', 'medium', 'wet'], true)) $copyHtmlMode = 'dry';
$postDateFormat = isset($MDW_SETTINGS['post_date_format']) ? trim((string)$MDW_SETTINGS['post_date_format']) : 'mdy_short';
if (!in_array($postDateFormat, ['mdy_short', 'dmy_long'], true)) $postDateFormat = 'mdy_short';
$postDateAlign = isset($MDW_SETTINGS['post_date_align']) ? trim((string)$MDW_SETTINGS['post_date_align']) : 'left';
if (!in_array($postDateAlign, ['left', 'center', 'right'], true)) $postDateAlign = 'left';
$MDW_AUTH = function_exists('mdw_auth_config') ? mdw_auth_config() : ['user_hash' => '', 'superuser_hash' => ''];
$MDW_AUTH_META = [
    'has_user' => !empty($MDW_AUTH['user_hash']),
    'has_superuser' => !empty($MDW_AUTH['superuser_hash']),
];
$APP_TITLE_OVERRIDE = trim((string)($MDW_SETTINGS['app_title'] ?? ''));
$APP_NAME = $APP_TITLE_OVERRIDE !== '' ? $APP_TITLE_OVERRIDE : 'Markdown Manager';
$META_CFG_CLIENT = $META_CFG;
if (is_array($META_CFG_CLIENT) && array_key_exists('_auth', $META_CFG_CLIENT)) {
    unset($META_CFG_CLIENT['_auth']);
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
        $k = null; $v = null;
        if (function_exists('mdw_hidden_meta_match') && mdw_hidden_meta_match($line, $k, $v)) continue;
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

/* List md files in a specific dir (relative), sorted like root list */
function list_md_in_dir_sorted($dirRel) {
    $dirRel = is_string($dirRel) ? $dirRel : '';
    $dirRel = trim(str_replace("\\", "/", $dirRel), "/");
    $pattern = ($dirRel === '' || $dirRel === '.' || $dirRel === 'root') ? "*.md" : ($dirRel . "/*.md");

    $mds = glob($pattern);
    $out = [];
    foreach ($mds as $path) {
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
    $translationsDir = function_exists('mdw_i18n_dir') ? mdw_i18n_dir() : 'translations';
    $exclude = [
        'root' => true,
        'HTML' => true,
        'PDF' => true,
        basename($pluginsDir) => true,
        $staticDir => true,
        $imagesDir => true,
        $themesDir => true,
        $translationsDir => true,
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
    global $MDW_PUBLISHER_MODE;
    if (!empty($MDW_PUBLISHER_MODE)) return [];
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
        $new_md_draft = null;
        if (isset($_SESSION['new_md_draft']) && is_array($_SESSION['new_md_draft'])) {
            $new_md_draft = $_SESSION['new_md_draft'];
            unset($_SESSION['new_md_draft']);
        }

		if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action'])) {
		    $csrf = isset($_POST['csrf']) ? (string)$_POST['csrf'] : '';
		    if (!hash_equals($CSRF_TOKEN, $csrf)) {
	        $_SESSION['flash_error'] = mdw_t('flash.csrf_invalid', 'Invalid session (CSRF). Reload the page.');
	        header('Location: index.php');
	        exit;
	    } else if ($_POST['action'] === 'delete') {
        $postedFile = isset($_POST['file']) ? (string)$_POST['file'] : '';
        $san = sanitize_md_path($postedFile);
        $allowUserDelete = !array_key_exists('allow_user_delete', $MDW_SETTINGS) ? true : !empty($MDW_SETTINGS['allow_user_delete']);
        $authRole = isset($_POST['auth_role']) ? (string)$_POST['auth_role'] : '';
        $authToken = isset($_POST['auth_token']) ? (string)$_POST['auth_token'] : '';
        $authRequired = function_exists('mdw_auth_has_role')
            ? (mdw_auth_has_role('superuser') || mdw_auth_has_role('user'))
            : false;
        $authIsSuperuser = function_exists('mdw_auth_verify_token')
            ? mdw_auth_verify_token('superuser', $authToken)
            : false;
        $authIsUser = function_exists('mdw_auth_verify_token')
            ? mdw_auth_verify_token('user', $authToken)
            : false;

        $deleteAfter = isset($_POST['delete_after']) ? trim((string)$_POST['delete_after']) : '';
        if ($deleteAfter !== 'next') $deleteAfter = 'overview';
        $returnOpen = sanitize_folder_name($_POST['return_open'] ?? '') ?? null;
        $returnFilter = sanitize_folder_name($_POST['return_filter'] ?? '') ?? null;
        $returnFocus = sanitize_md_path_like($_POST['return_focus'] ?? '') ?? null;

        $nextFile = null;
        $prevFile = null;
        if ($deleteAfter === 'next' && $san) {
            $dir = folder_from_path($san);
            $entries = list_md_in_dir_sorted($dir);
            $paths = [];
            foreach ($entries as $e) {
                $p = $e['path'];
                if (!is_string($p) || $p === '') continue;
                if (is_secret_file($p) && !is_secret_authenticated()) continue;
                $paths[] = $p;
            }
            $idx = array_search($san, $paths, true);
            if ($idx !== false) {
                if ($idx > 0) $prevFile = $paths[$idx - 1];
                if ($idx < (count($paths) - 1)) $nextFile = $paths[$idx + 1];
            }
        }

        if ($authRequired && !$authIsSuperuser) {
            if (!$allowUserDelete || !$authIsUser) {
                $_SESSION['flash_error'] = mdw_t('flash.auth_required', 'Superuser login required.');
                $redirect = 'index.php';
                if ($returnFilter) {
                    $redirect = 'index.php?folder=' . rawurlencode($returnFilter);
                    if ($returnFocus) $redirect .= '&focus=' . rawurlencode($returnFocus);
                } else if ($returnOpen) {
                    $redirect = 'index.php?open=' . rawurlencode($returnOpen);
                    if ($returnFocus) $redirect .= '&focus=' . rawurlencode($returnFocus);
                } else if ($returnFocus) {
                    $redirect = 'index.php?focus=' . rawurlencode($returnFocus);
                }
                header('Location: ' . $redirect);
                exit;
            }
        }

        if (!$san) {
            $_SESSION['flash_error'] = mdw_t('flash.invalid_file_path', 'Invalid file path.');
        } else if (is_secret_file($san) && !is_secret_authenticated()) {
            $_SESSION['flash_error'] = mdw_t('flash.secret_locked', 'Secret note is locked. Unlock first via the viewer.');
        } else {
            $full = __DIR__ . '/' . $san;
            if (@unlink($full)) {
                $_SESSION['flash_ok'] = mdw_t('flash.deleted_prefix', 'Deleted:') . ' ' . $san;
            } else {
                $err = error_get_last();
                $msg = mdw_t('flash.delete_failed', 'Could not delete file.');
                if ($err && !empty($err['message'])) {
                    $msg .= ' (' . $err['message'] . ')';
                }
                if (!is_writable($full)) {
                    $msg .= ' (' . mdw_t('flash.no_write_permissions', 'no write permissions') . ')';
                }
                $_SESSION['flash_error'] = $msg;
            }
        }

        $redirect = 'index.php';
        if ($deleteAfter === 'next') {
            $target = $nextFile ?: $prevFile;
            if ($target) {
                $targetFolder = folder_from_path($target);
                $redirect = 'index.php?file=' . rawurlencode($target) . '&folder=' . rawurlencode($targetFolder) . '&focus=' . rawurlencode($target);
            } else if ($returnFilter) {
                $redirect = 'index.php?folder=' . rawurlencode($returnFilter);
                if ($returnFocus) $redirect .= '&focus=' . rawurlencode($returnFocus);
            } else if ($returnOpen) {
                $redirect = 'index.php?open=' . rawurlencode($returnOpen);
                if ($returnFocus) $redirect .= '&focus=' . rawurlencode($returnFocus);
            } else if ($returnFocus) {
                $redirect = 'index.php?focus=' . rawurlencode($returnFocus);
            }
        } else {
            if ($returnFilter) {
                $redirect = 'index.php?folder=' . rawurlencode($returnFilter);
                if ($returnFocus) $redirect .= '&focus=' . rawurlencode($returnFocus);
            } else if ($returnOpen) {
                $redirect = 'index.php?open=' . rawurlencode($returnOpen);
                if ($returnFocus) $redirect .= '&focus=' . rawurlencode($returnFocus);
            } else if ($returnFocus) {
                $redirect = 'index.php?focus=' . rawurlencode($returnFocus);
            }
        }

	        header('Location: ' . $redirect);
	        exit;
		    } else if ($_POST['action'] === 'create_folder') {
                $authRole = isset($_POST['auth_role']) ? (string)$_POST['auth_role'] : '';
                $authToken = isset($_POST['auth_token']) ? (string)$_POST['auth_token'] : '';
                $authRequired = function_exists('mdw_auth_has_role')
                    ? (mdw_auth_has_role('superuser') || mdw_auth_has_role('user'))
                    : false;
                if ($authRequired && !mdw_auth_verify_token('superuser', $authToken)) {
                    $_SESSION['flash_error'] = mdw_t('flash.auth_required', 'Superuser login required.');
                    header('Location: index.php');
                    exit;
                }

		        $nameRaw = isset($_POST['folder_name']) ? (string)$_POST['folder_name'] : '';
		        $name = sanitize_folder_name($nameRaw);
		        if (!$name) {
		            $_SESSION['flash_error'] = mdw_t('flash.invalid_folder_name', 'Invalid folder name.');
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
			            $TRANSLATIONS_DIR => true,
			        ];
		        if (isset($reserved[$name])) {
		            $_SESSION['flash_error'] = mdw_t('flash.reserved_folder_name', 'This folder name is reserved.');
		            header('Location: index.php');
		            exit;
		        }

		        $full = __DIR__ . '/' . $name;
		        if (!is_writable(__DIR__)) {
		            $msg = mdw_t('flash.folder_create_failed', 'Could not create folder.');
		            $msg .= ' (' . mdw_t('flash.no_write_permissions', 'no write permissions') . ': ' . __DIR__ . ')';
		            $msg .= ' ' . mdw_t(
		                'flash.permissions_hint',
		                'Fix by making this directory writable for the web server/PHP user (chown/chmod; on SELinux also set the right context).'
		            );
		            $_SESSION['flash_error'] = $msg;
		            header('Location: index.php');
		            exit;
		        }
		        if (is_dir($full)) {
		            $_SESSION['flash_error'] = mdw_t('flash.folder_exists_prefix', 'Folder already exists:') . ' ' . $name;
		            header('Location: index.php?folder=' . rawurlencode($name));
		            exit;
		        }
		        if (file_exists($full)) {
	            $_SESSION['flash_error'] = mdw_t('flash.path_exists_not_folder_prefix', 'Path already exists (not a folder):') . ' ' . $name;
		            header('Location: index.php');
		            exit;
		        }

			        $oldUmask = umask(0002);
			        if (!@mkdir($full, 0775, true)) {
			            umask($oldUmask);
			            $err = error_get_last();
			            $msg = mdw_t('flash.folder_create_failed', 'Could not create folder.');
			            if ($err && !empty($err['message'])) $msg .= ' (' . $err['message'] . ')';
			            if (!is_writable(__DIR__)) {
			                $msg .= ' (' . mdw_t('flash.no_write_permissions', 'no write permissions') . ': ' . __DIR__ . ')';
			            }
			            $_SESSION['flash_error'] = $msg;
			            header('Location: index.php');
			            exit;
			        }
			        umask($oldUmask);
		        @chmod($full, 0775);

		        $_SESSION['flash_ok'] = mdw_t('flash.folder_created_prefix', 'Folder created:') . ' ' . $name;
		        header('Location: index.php?folder=' . rawurlencode($name));
		        exit;
            } else if ($_POST['action'] === 'create') {
            $postedPath = isset($_POST['new_path']) ? (string)$_POST['new_path'] : '';
            $prefixDate = isset($_POST['prefix_date']) && (string)$_POST['prefix_date'] === '1';
                $draftFolder = isset($_POST['new_folder']) ? (string)$_POST['new_folder'] : 'root';
                $draftTitle = isset($_POST['new_title']) ? (string)$_POST['new_title'] : '';
                $draftSlug = isset($_POST['new_slug']) ? (string)$_POST['new_slug'] : (isset($_POST['new_file']) ? (string)$_POST['new_file'] : '');
                $draftContent = isset($_POST['new_content']) ? (string)$_POST['new_content'] : '';
                $titleInput = trim((string)($draftTitle ?? ''));
                $titleInput = preg_replace('/\\s+/u', ' ', $titleInput);
                $titleLen = mdw_strlen($titleInput);
                $authToken = isset($_POST['auth_token']) ? (string)$_POST['auth_token'] : '';
                $authIsSuperuser = function_exists('mdw_auth_verify_token')
                    ? mdw_auth_verify_token('superuser', $authToken)
                    : false;
            if (trim($postedPath) === '') {
                $folder = isset($_POST['new_folder']) ? (string)$_POST['new_folder'] : '';
            $folder = sanitize_folder_name($folder) ?? 'root';
            $slugInput = trim((string)($draftSlug ?? ''));
            if (!$authIsSuperuser || $slugInput === '') $slugInput = $titleInput;
            $slug = sanitize_new_md_slug($slugInput);
            $maxSlugLen = min(MDW_NEW_MD_SLUG_MAX, $titleLen);
            if ($titleInput === '' || $titleLen < MDW_NEW_MD_TITLE_MIN) {
                $_SESSION['flash_error'] = mdw_t('flash.title_too_short', 'Title is too short.', ['min' => MDW_NEW_MD_TITLE_MIN]);
            } else if ($titleLen > MDW_NEW_MD_TITLE_MAX) {
                $_SESSION['flash_error'] = mdw_t('flash.title_too_long', 'Title is too long.', ['max' => MDW_NEW_MD_TITLE_MAX]);
            } else if (!$slug) {
                $_SESSION['flash_error'] = mdw_t('flash.invalid_filename_hint', 'Invalid filename. Adjust the title (spaces become hyphens) and try again.');
            } else {
                if ($maxSlugLen < MDW_NEW_MD_SLUG_MIN) {
                    $_SESSION['flash_error'] = mdw_t('flash.slug_too_short', 'Slug is too short.', ['min' => MDW_NEW_MD_SLUG_MIN]);
                } else {
                    $slug = mdw_substr($slug, $maxSlugLen);
                    $slug = rtrim($slug, '-.');
                    if ($slug === '' || mdw_strlen($slug) < MDW_NEW_MD_SLUG_MIN) {
                        $_SESSION['flash_error'] = mdw_t('flash.slug_too_short', 'Slug is too short.', ['min' => MDW_NEW_MD_SLUG_MIN]);
                    } else {
                        $file = $slug . '.md';
                        if ($prefixDate && !preg_match('/^\\d{2}-\\d{2}-\\d{2}-/', $file)) {
                            $file = date('y-m-d-') . $file;
                        }
                        $postedPath = ($folder && $folder !== 'root') ? ($folder . '/' . $file) : $file;
                    }
                }
            }
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

		        $sanNew = $postedPath ? sanitize_new_md_path($postedPath) : null;
		        $open_new_panel = true;
		        if (!$sanNew) {
		            if (!isset($_SESSION['flash_error']) || $_SESSION['flash_error'] === '') {
		                $_SESSION['flash_error'] = mdw_t('flash.invalid_filename_hint', 'Invalid filename. Adjust the title (spaces become hyphens) and try again.');
		            }
		        } else if (is_secret_file($sanNew) && !is_secret_authenticated()) {
		            $_SESSION['flash_error'] = mdw_t('flash.secret_marked_locked', 'This path is marked as secret. Unlock first via the viewer.');
		        } else {
            $dir = dirname($sanNew);
            if ($dir !== '.' && !is_dir(__DIR__ . '/' . $dir)) {
                $_SESSION['flash_error'] = mdw_t('flash.folder_not_exist_prefix', 'Folder does not exist:') . ' ' . $dir;
		            } else if (is_file(__DIR__ . '/' . $sanNew)) {
		                $_SESSION['flash_error'] = mdw_t('flash.file_exists_prefix', 'File already exists:') . ' ' . $sanNew;
		            } else {
		                $content = isset($_POST['new_content']) ? (string)$_POST['new_content'] : '';
		                if (trim($content) === '') {
		                    $baseTitle = trim((string)($titleInput ?? ''));
                        if ($baseTitle === '') {
                            $baseTitle = preg_replace('/\.md$/i', '', basename($sanNew));
                        }
		                    if (!empty($MDW_PUBLISHER_MODE)) {
		                        $content = "# " . $baseTitle . "\n\n## Subtitle\n";
		                    } else {
		                        $content = "# " . $baseTitle . "\n";
		                    }
		                }
		                $authToken = isset($_POST['auth_token']) ? (string)$_POST['auth_token'] : '';
		                $authIsUser = function_exists('mdw_auth_verify_token')
		                    ? mdw_auth_verify_token('user', $authToken)
		                    : false;
		                $postedAuthor = isset($_POST['publisher_author']) ? trim((string)$_POST['publisher_author']) : '';
		                $author = '';
		                if (!empty($MDW_PUBLISHER_MODE)) {
		                    $author = $authIsUser ? $postedAuthor : ($postedAuthor !== '' ? $postedAuthor : (isset($MDW_SETTINGS['publisher_default_author']) ? trim((string)$MDW_SETTINGS['publisher_default_author']) : ''));
		                    if (($authIsUser && $author === '') || $author === '') {
		                        $_SESSION['new_md_draft'] = [
		                            'folder' => $draftFolder,
		                            'title' => $draftTitle,
		                            'slug' => $draftSlug,
		                            'content' => $draftContent,
		                            'prefix_date' => $prefixDate ? 1 : 0,
		                        ];
		                        $_SESSION['flash_error'] = mdw_t('flash.publisher_author_required', 'WPM requires an author name.', ['app' => $APP_NAME]);
		                        header('Location: index.php?new=1');
		                        exit;
		                    }
		                    $requireH2 = !array_key_exists('publisher_require_h2', $MDW_SETTINGS) ? true : !empty($MDW_SETTINGS['publisher_require_h2']);
		                    if ($requireH2 && !mdw_md_has_h2($content)) {
		                        $_SESSION['new_md_draft'] = [
		                            'folder' => $draftFolder,
		                            'title' => $draftTitle,
		                            'slug' => $draftSlug,
		                            'content' => $draftContent,
		                            'prefix_date' => $prefixDate ? 1 : 0,
		                        ];
		                        $_SESSION['flash_error'] = mdw_t('flash.publisher_requires_subtitle', 'WPM requires a subtitle line starting with "##".', ['app' => $APP_NAME]);
		                        header('Location: index.php?new=1');
		                        exit;
		                    }
		                }
		                // Ensure hidden metadata block at top (creationdate/changedate/date/publishstate).
		                $opts = [];
		                if (!empty($MDW_PUBLISHER_MODE) && $author !== '') {
		                    $settingsOverride = is_array($MDW_SETTINGS) ? $MDW_SETTINGS : [];
		                    $settingsOverride['publisher_default_author'] = $author;
		                    $opts['settings'] = $settingsOverride;
		                }
		                $content = mdw_hidden_meta_ensure_block($content, $sanNew, $opts);
		                $full = __DIR__ . '/' . $sanNew;
	                $parentDir = dirname($full);
	                if (!is_dir($parentDir) || !is_writable($parentDir)) {
	                    $msg = mdw_t('flash.file_create_failed', 'Could not create file.');
	                    $msg .= ' (' . mdw_t('flash.no_write_permissions', 'no write permissions') . ': ' . $parentDir . ')';
	                    $msg .= ' ' . mdw_t(
	                        'flash.permissions_hint',
	                        'Fix by making this directory writable for the web server/PHP user (chown/chmod; on SELinux also set the right context).'
	                    );
	                    $_SESSION['flash_error'] = $msg;
	                } else if (file_put_contents($full, $content, LOCK_EX) === false) {
	                    $err = error_get_last();
	                    $msg = mdw_t('flash.file_create_failed', 'Could not create file.');
	                    if ($err && !empty($err['message'])) $msg .= ' (' . $err['message'] . ')';
	                    $_SESSION['flash_error'] = $msg;
	                } else {
	                    header('Location: edit.php?file=' . rawurlencode($sanNew));
	                    exit;
	                }
		            }
			    }

            // Preserve the form input so the user can adjust it after an error.
            $_SESSION['new_md_draft'] = [
                'folder' => $draftFolder,
                'title' => $draftTitle,
                'slug' => $draftSlug,
                'content' => $draftContent,
                'prefix_date' => $prefixDate ? 1 : 0,
            ];
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

	$mode = 'index';
	$article_title = 'Index';
	$article_html  = '';
	$secret_error  = null;
	$requested_is_secret = $requested ? is_secret_file($requested) : false;
	$folder_filter = sanitize_folder_name($_GET['folder'] ?? '') ?? null;
	$active_folder_for_breadcrumb = $requested ? folder_from_path($requested) : ($folder_filter ?: null);
    $view_prev = null;
    $view_next = null;

if ($requested) {
    $full = __DIR__.'/'.$requested;
	    if (is_file($full)) {

        // secret file? eerst wachtwoord checken
        if ($requested_is_secret && !is_secret_authenticated()) {
            if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['secret_password'])) {
                if (try_secret_login($_POST['secret_password'])) {
                    $_SESSION['secret_ok'] = true;
                } else {
                    $secret_error = mdw_t('secret.wrong_password', 'Wrong password.');
                }
            }

            if (!is_secret_authenticated()) {
                $mode = 'secret_prompt';
                $article_title = mdw_t('secret.title', 'Protected document');
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

    // Prev/next neighbors for ArrowLeft/ArrowRight navigation in view mode.
    if ($mode === 'view' && $requested) {
        $dir = dirname($requested);
        if ($dir === '.' || $dir === '') $dir = 'root';

        $entries = list_md_in_dir_sorted($dir);
        $paths = [];
        foreach ($entries as $e) {
            $p = $e['path'];
            if (!is_string($p) || $p === '') continue;
            if (is_secret_file($p) && !is_secret_authenticated()) continue;
            $paths[] = $p;
        }

        $idx = array_search($requested, $paths, true);
        if ($idx !== false) {
            if ($idx > 0) $view_prev = $paths[$idx - 1];
            if ($idx < (count($paths) - 1)) $view_next = $paths[$idx + 1];
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
				    $exclude = [basename($pluginsDir), 'HTML', 'PDF', $STATIC_DIR, $IMAGES_DIR, $THEMES_DIR, $TRANSLATIONS_DIR];
				    $existingFolders = list_existing_folders_sorted($exclude);
			    if ($folder_filter && in_array($folder_filter, $existingFolders, true)) {
			        $default_new_folder = $folder_filter;
			    }
			}

        $new_md_title_value = '';
        $new_md_slug_value = '';
        $new_md_content_value = '';
        $new_md_prefix_checked = empty($MDW_PUBLISHER_MODE);
        if (is_array($new_md_draft)) {
            $draftFolder = sanitize_folder_name((string)($new_md_draft['folder'] ?? '')) ?? 'root';
            if ($draftFolder === 'root' || in_array($draftFolder, $existingFolders, true)) {
                $default_new_folder = $draftFolder;
            }
            $new_md_title_value = (string)($new_md_draft['title'] ?? $new_md_title_value);
            $new_md_slug_value = (string)($new_md_draft['slug'] ?? (string)($new_md_draft['file'] ?? $new_md_slug_value));
            $new_md_content_value = (string)($new_md_draft['content'] ?? '');
            $new_md_prefix_checked = !empty($new_md_draft['prefix_date']);
        }

	?>
<!DOCTYPE html>
<html lang="<?=h($MDW_LANG)?>" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title><?=h($article_title)?></title>

<script>
// Namespace localStorage per app base URL to avoid cross-instance collisions.
(function(){
    const loc = window.location;
    const origin = String(loc.origin || '');
    const path = String(loc.pathname || '/');
    const dir = path.endsWith('/') ? path : path.slice(0, path.lastIndexOf('/') + 1);
    const prefix = `mdw:${origin}${dir}`;
    const storageKey = (key) => `${prefix}:${key}`;
    window.__mdwStoragePrefix = prefix;
    window.__mdwStorageKey = storageKey;
    window.__mdwStorageGet = (key) => {
        try { return localStorage.getItem(storageKey(key)); } catch { return null; }
    };
    window.__mdwStorageSet = (key, value) => {
        try { localStorage.setItem(storageKey(key), value); } catch {}
    };
    window.__mdwStorageRemove = (key) => {
        try { localStorage.removeItem(storageKey(key)); } catch {}
    };
})();
</script>

<link rel="stylesheet" href="<?=h($STATIC_DIR)?>/ui.css">
<link rel="stylesheet" href="<?=h($STATIC_DIR)?>/markdown.css">
<link rel="stylesheet" href="<?=h($STATIC_DIR)?>/htmlpreview.css">
<link rel="stylesheet" href="<?=h($STATIC_DIR)?>/popicon.css">

<script>
(function(){
    const saved = window.__mdwStorageGet('mdsite-theme');
    const prefers = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const mode = saved || (prefers ? 'dark' : 'light');
    const useDark = mode === 'dark';
    document.documentElement.classList.toggle('dark', useDark);
    document.documentElement.classList.toggle('theme-light', !useDark);
})();
</script>
<script>
(function(){
    try {
        const hasUser = <?= $MDW_AUTH_META['has_user'] ? 'true' : 'false' ?>;
        const hasSuper = <?= $MDW_AUTH_META['has_superuser'] ? 'true' : 'false' ?>;
        const role = window.__mdwStorageGet('mdw_auth_role') || '';
        const token = window.__mdwStorageGet('mdw_auth_token') || '';
        if (!role || !token || (!hasUser && !hasSuper)) {
            document.documentElement.classList.add('auth-locked');
        }
    } catch {}
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
<script type="module">
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs";
mermaid.initialize({ startOnLoad: true });
window.mermaid = mermaid;
</script>
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
	                        <span class="app-title-text"><?=h($APP_NAME)?></span>
	                        <?php if ($mode==='index'): ?>
	                            <span style="font-weight: 500; opacity: 0.75;"> • overview</span>
	                        <?php endif; ?>
	                    </div>
                        <?php if ($mode === 'view' && $requested && $WPM_PLUGIN_ACTIVE): ?>
                            <?php $wpm_public_url = mdw_wpm_public_url($requested, $WPM_SITE_BASE); ?>
                            <?php if ($wpm_public_url): ?>
                                <a class="btn btn-ghost icon-button" href="<?=h($wpm_public_url)?>" target="_blank" rel="noopener noreferrer" aria-label="Open public page" title="Open public page">
                                    <span class="pi pi-externallink"></span>
                                </a>
                            <?php endif; ?>
                        <?php endif; ?>
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
	            <button id="newFolderBtn" type="button" class="btn btn-ghost btn-small" title="<?=h(mdw_t('index.new_folder_title','Create a new folder'))?>" data-auth-superuser="1">
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
	            <a href="edit.php?file=<?=rawurlencode($requested)?>&folder=<?=rawurlencode($hdrFolder)?>" class="btn btn-ghost icon-button" title="<?=h(mdw_t('common.edit','Edit'))?>">
	                <span class="pi pi-edit"></span>
	            </a>
            <form method="post" class="deleteForm" data-file="<?=h($requested)?>">
                <input type="hidden" name="action" value="delete">
                <input type="hidden" name="file" value="<?=h($requested)?>">
                <input type="hidden" name="csrf" value="<?=h($CSRF_TOKEN)?>">
	                <button type="submit" class="btn btn-ghost icon-button" title="<?=h(mdw_t('common.delete','Delete'))?>">
	                    <span class="pi pi-bin"></span>
	                </button>
	            </form>
	            <?php endif; ?>
		            <button id="themeSettingsBtn" type="button" class="btn btn-ghost icon-button" title="<?=h(mdw_t('theme.settings_title','Settings'))?>" aria-label="<?=h(mdw_t('theme.settings_title','Settings'))?>" data-auth-superuser="1">
		                <span class="pi pi-gear"></span>
		            </button>
		            <button id="authToggleBtn" type="button" class="btn btn-ghost icon-button" title="<?=h(mdw_t('auth.logout','Logout'))?>" aria-label="<?=h(mdw_t('auth.logout','Logout'))?>">
		                <span class="pi pi-upload auth-logout-icon"></span>
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
            <div style="font-size: 0.9rem; font-weight: 600;"><?=h(mdw_t('index.new_markdown.title','New markdown'))?></div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">
                <?=h(mdw_t('index.new_markdown.relative_path','Pick a folder, add a title, and a slug is created for the filename.'))?>
            </div>
        </div>
        <button id="newMdClose" type="button" class="btn btn-ghost btn-small"><?=h(mdw_t('index.new_markdown.close','Close'))?></button>
    </div>

	    <form method="post" style="margin-top: 0.9rem; display: flex; flex-direction: column; gap: 0.6rem;">
	        <input type="hidden" name="action" value="create">
	        <input type="hidden" name="csrf" value="<?=h($CSRF_TOKEN)?>">
		        <div style="display: flex; flex-direction: column; gap: 0.6rem;">
		            <div style="display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap;">
			                <select name="new_folder" class="input" style="width: auto; flex: 1 1 12rem; min-width: 10rem;" aria-label="<?=h(mdw_t('common.folder','Folder'))?>">
			                <option value="root" <?= $default_new_folder === 'root' ? 'selected' : '' ?>><?=h(mdw_t('common.root','Root'))?></option>
		                <?php foreach ($existingFolders as $folder): ?>
		                    <option value="<?=h($folder)?>" <?= $default_new_folder === $folder ? 'selected' : '' ?>><?=h($folder)?></option>
		                <?php endforeach; ?>
		            </select>
			            <label class="status-text" style="display:flex; align-items:center; gap:0.35rem; white-space:nowrap;" title="<?=h(mdw_t('index.new_markdown.date_prefix_title','Adds a yy-mm-dd- prefix so notes sort nicely by date.'))?>">
			                <input id="newMdPrefixDate" type="checkbox" name="prefix_date" value="1" <?= $new_md_prefix_checked ? 'checked' : '' ?> data-date-prefix="<?=h($today_prefix)?>">
			                <span>yy-mm-dd-</span>
			            </label>
			            </div>
                        <div style="display:flex; flex-direction: column; gap: 0.35rem;">
                            <label class="status-text" for="newMdTitle"><?=h(mdw_t('index.new_markdown.title_label','Title'))?></label>
                            <input id="newMdTitle" name="new_title" class="input" style="width: 100%;" type="text" value="<?=h($new_md_title_value)?>" placeholder="<?=h(mdw_t('index.new_markdown.title_placeholder','Your title'))?>" minlength="<?=MDW_NEW_MD_TITLE_MIN?>" maxlength="<?=MDW_NEW_MD_TITLE_MAX?>" data-title-min="<?=MDW_NEW_MD_TITLE_MIN?>" data-title-max="<?=MDW_NEW_MD_TITLE_MAX?>" required>
                            <div id="newMdTitleHint" class="status-text" style="display:none; margin-top: 0.1rem;"></div>
                        </div>
                        <div style="display:flex; flex-direction: column; gap: 0.35rem;">
                            <label class="status-text" for="newMdFile"><?=h(mdw_t('index.new_markdown.slug_label','Slug / filename'))?></label>
                            <div style="display:flex; align-items:center; gap: 0.4rem;">
                                <input id="newMdFile" name="new_slug" class="input" style="width: 100%;" type="text" value="<?=h($new_md_slug_value)?>" placeholder="<?=h(mdw_t('index.new_markdown.filename_placeholder','my-title'))?>" minlength="<?=MDW_NEW_MD_SLUG_MIN?>" maxlength="<?=MDW_NEW_MD_SLUG_MAX?>" data-slug-min="<?=MDW_NEW_MD_SLUG_MIN?>" data-slug-max="<?=MDW_NEW_MD_SLUG_MAX?>" required>
                                <span class="status-text">.md</span>
                            </div>
                            <div id="newMdFileHint" class="status-text" style="display:none; margin-top: 0.1rem;"></div>
                            <div id="newMdFilePreview" class="status-text" data-label="<?=h(mdw_t('index.new_markdown.filename_preview','Filename'))?>" style="margin-top: 0.1rem; display: none;">
                                <?=h(mdw_t('index.new_markdown.filename_preview','Filename'))?>: <code id="newMdFilePreviewValue"></code>
                            </div>
                            <div class="status-text" data-auth-regular="1" style="margin-top: 0.1rem;"><?=h(mdw_t('index.new_markdown.slug_locked','Only a superuser can edit the slug.'))?></div>
                        </div>
			        </div>
			        <textarea name="new_content" class="input" rows="4" style="height: auto; display: block;" placeholder="<?=h(mdw_t('index.new_markdown.content_placeholder', "# Title\n\nStart writing..."))?>"><?=h($new_md_content_value)?></textarea>
			        <div style="display: flex; justify-content: flex-end;">
				            <button type="submit" class="btn btn-primary btn-small"><?=h(mdw_t('index.new_markdown.create_edit','Create & edit'))?></button>
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
    <h1 style="font-size: 1.875rem; font-weight: 700; margin-bottom: 0.75rem;"><?=h(mdw_t('index.contents','Contents'))?></h1>
		    <p style="font-size: 0.8rem; color: var(--text-muted); max-width: 42em; margin: 0 auto; line-height: 1.6;">
		        <?=h(mdw_t('index.filter_desc','Filter by title. Newest dates first (based on filename prefix yy-mm-dd-).'))?>
		        <?=h(mdw_t('index.title_rule.prefix','First'))?> <code># Heading</code> <?=h(mdw_t('index.title_rule.middle','in each .md becomes the title; HTML uses'))?> <code>&lt;title&gt;</code> <?=h(mdw_t('index.title_rule.or','(or'))?> <code>&lt;h1&gt;</code><?=h(mdw_t('index.title_rule.suffix',').'))?>
		    </p>
		    <div id="filterWrap" style="position: relative; max-width: 20rem; margin: 1rem auto 0;">
		        <input id="filterInput" class="input notes-filter-input" style="margin: 0; padding-right: 2.25rem;" type="text" placeholder="<?=h(mdw_t('index.filter_placeholder','Type to filter...'))?>">
		        <button id="filterClear" type="button" class="btn btn-ghost icon-button" title="<?=h(mdw_t('index.filter_clear','Clear filter'))?>" aria-label="<?=h(mdw_t('index.filter_clear','Clear filter'))?>" style="display: none; position: absolute; right: 0.35rem; top: 50%; transform: translateY(-50%);">
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
	    'publisher_mode' => !empty($MDW_PUBLISHER_MODE),
	    'folder_filter' => $folder_filter,
	    'csrf_token' => $CSRF_TOKEN,
	    'show_actions' => true,
	]);
	?>

<?php elseif ($mode==='secret_prompt'): ?>

<section class="editor-pane" style="max-width: 32rem; margin: 2rem auto; padding: 1.5rem 2rem; text-align: center;">
    <h1 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem;"><?=h(mdw_t('secret.title','Protected document'))?></h1>
    <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1rem;">
        <?=h(mdw_t('secret.desc','This note is protected. Enter the password to continue.'))?>
    </p>

<?php if ($secret_error): ?>
<div style="margin-bottom: 0.75rem; font-size: 0.8rem; color: var(--danger);">
<?=h($secret_error)?>
</div>
<?php endif; ?>

<form method="post" style="display: flex; flex-direction: column; gap: 1rem;">
<div>
<input type="password" name="secret_password" autocomplete="current-password" class="input" placeholder="<?=h(mdw_t('secret.password_placeholder','Password'))?>">
</div>
<div style="display: flex; align-items: center; justify-content: center; gap: 0.75rem;">
    <button type="submit" class="btn btn-primary"><?=h(mdw_t('secret.unlock_btn','Unlock'))?></button>
    <a href="index.php" style="font-size: 0.7rem; color: var(--text-muted);"><?=h(mdw_t('secret.back_to_index','Back to index'))?></a>
</div>
</form>
</section>

<?php else: ?>

<!-- Article view -->
<script>
window.MDW_VIEW_NAV = <?= json_encode(['prev' => $view_prev, 'next' => $view_next], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>;
<?php if ($mode === 'view' && $requested && isset($raw)): ?>
window.CURRENT_FILE = <?= json_encode($requested, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>;
window.MDW_CURRENT_MD = <?= json_encode($raw, JSON_UNESCAPED_UNICODE) ?>;
<?php endif; ?>
</script>
<div class="preview-container">
    <?php if ($mode === 'view' && $requested): ?>
        <div class="preview-copy-toolbar" data-copy-buttons="1" <?= $copyButtonsEnabled ? '' : 'hidden' ?>>
            <button type="button" id="copyMdBtn" class="btn btn-ghost copy-btn" title="<?=h(mdw_t('index.preview.copy_md_title','Copy Markdown to clipboard'))?>">
                <span class="btn-icon-stack">
                    <span class="pi pi-copy copy-icon"></span>
                    <span class="pi pi-checkmark copy-check"></span>
                </span>
                <span class="btn-label"><?=h(mdw_t('index.preview.copy_md_btn','Copy MD'))?></span>
            </button>
            <button type="button" id="copyHtmlBtn" class="btn btn-ghost copy-btn" title="<?=h(mdw_t('index.preview.copy_html_title','Copy HTML to clipboard'))?>">
                <span class="btn-icon-stack">
                    <span class="pi pi-copy copy-icon"></span>
                    <span class="pi pi-checkmark copy-check"></span>
                </span>
                <span class="btn-label"><?=h(mdw_t('index.preview.copy_html_btn','Copy HTML'))?></span>
            </button>
        </div>
    <?php endif; ?>
    <article id="preview" class="preview-content">
    <?=$article_html?>
    </article>
</div>

<?php endif; ?>

</div>
</main>

	<footer class="app-footer">
	    <?=date('Y')?> • <a href="https://github.com/Henkster72/MarkdownManager" target="_blank" rel="noopener noreferrer">Markdown Manager</a> • <a href="https://allroundwebsite.com" target="_blank" rel="noopener noreferrer">Allroundwebsite.com</a>
	</footer>

		<div class="auth-overlay" id="wpmUserOverlay" hidden>
			<div class="modal auth-modal" id="wpmUserModal" role="dialog" aria-modal="true" aria-labelledby="wpmUserTitle">
				<div class="modal-header">
					<div class="modal-title" id="wpmUserTitle"><?=h(mdw_t('wpm.setup_title','WPM setup'))?></div>
				</div>
				<div class="modal-body">
					<div class="status-text" style="margin-bottom: 0.6rem;">
						<?=h(mdw_t('wpm.setup_hint','Set your author name and UI language.'))?>
					</div>
					<label class="modal-label" for="wpmAuthorInput"><?=h(mdw_t('wpm.author_label','Author name'))?></label>
					<input id="wpmAuthorInput" type="text" class="input" autocomplete="name" placeholder="<?=h(mdw_t('wpm.author_placeholder','Your name'))?>">
						<label class="modal-label" for="wpmLangSelect" style="margin-top: 0.6rem;"><?=h(mdw_t('wpm.language_label','UI language'))?></label>
						<select id="wpmLangSelect" class="input" style="width: 100%;">
						<?php foreach ($MDW_LANGS as $l): ?>
							<?php
								$code = (string)($l['code'] ?? '');
								$label = (string)($l['native'] ?? ($l['label'] ?? $code));
							?>
							<option value="<?=h($code)?>" <?= $MDW_LANG === $code ? 'selected' : '' ?>><?=h($label)?></option>
						<?php endforeach; ?>
						</select>
						<div class="modal-label" style="margin-top: 0.6rem;"><?=h(mdw_t('theme.kbd_modifier.label','Keyboard shortcuts system'))?></div>
						<label class="radio" style="margin-top: 0.35rem;">
							<input type="radio" name="wpmKbdShortcutMod" id="wpmKbdShortcutModOption" value="option">
							<span><?=h(mdw_t('theme.kbd_modifier.option','Windows / Linux (Ctrl + Alt)'))?></span>
						</label>
						<label class="radio">
							<input type="radio" name="wpmKbdShortcutMod" id="wpmKbdShortcutModCommand" value="command">
							<span><?=h(mdw_t('theme.kbd_modifier.command','Mac (Ctrl + Command)'))?></span>
						</label>
						<div class="status-text" style="margin-top: 0.35rem;"><?=h(mdw_t('theme.kbd_modifier.tip','Choose the system your shortcuts should follow (saved in this browser).'))?></div>
						<div id="wpmUserStatus" class="status-text" style="margin-top: 0.5rem;"></div>
					</div>
					<div class="modal-footer">
						<button type="button" class="btn btn-ghost" id="wpmUserSwitchBtn"><?=h(mdw_t('wpm.switch_user','Switch user'))?></button>
						<button type="button" class="btn btn-primary" id="wpmUserSaveBtn"><?=h(mdw_t('wpm.save','Save'))?></button>
					</div>
				</div>
			</div>

		<div class="auth-overlay" id="authOverlay" hidden>
			<div class="modal auth-modal" id="authModal" role="dialog" aria-modal="true" aria-labelledby="authModalTitle">
				<div class="modal-header">
					<div class="modal-title" id="authModalTitle"><?=h($APP_NAME)?></div>
				</div>
				<form class="modal-body" id="authForm" autocomplete="on">
					<div id="authSetupFields" hidden>
						<div class="modal-field">
							<label class="modal-label" for="authSetupUserPassword">User password</label>
							<input id="authSetupUserPassword" type="password" class="input" autocomplete="new-password">
						</div>
						<div class="modal-field">
							<label class="modal-label" for="authSetupSuperPassword">Superuser password</label>
							<input id="authSetupSuperPassword" type="password" class="input" autocomplete="new-password">
						</div>
						<div class="status-text" style="margin-top: 0.35rem;">Set both passwords to finish setup.</div>
					</div>
					<div id="authLoginFields" hidden>
						<div class="modal-field">
							<label class="modal-label" for="authLoginPassword">Password</label>
							<input id="authLoginPassword" type="password" class="input" autocomplete="current-password">
						</div>
					</div>
					<div id="authStatus" class="status-text" style="margin-top: 0.5rem;"></div>
				</form>
				<div class="modal-footer">
					<button type="submit" form="authForm" class="btn btn-ghost" id="authSubmitBtn">
						<span class="pi pi-login"></span>
						<span class="btn-label">Login</span>
					</button>
				</div>
			</div>
		</div>

		<div class="modal-overlay no-blur" id="themeModalOverlay" hidden></div>
			<div class="modal theme-modal" id="themeModal" role="dialog" aria-modal="true" aria-labelledby="themeModalTitle" hidden>
			    <div class="modal-header">
			        <div class="modal-title" id="themeModalTitle"><?=h(mdw_t('theme.title','Settings'))?></div>
			        <button type="button" class="btn btn-ghost icon-button" id="themeModalClose" aria-label="<?=h(mdw_t('common.close','Close'))?>">
			            <span class="pi pi-cross"></span>
			        </button>
			    </div>
			    <div class="modal-body">
			        <details style="margin-bottom: 0.8rem;">
			            <summary style="cursor:pointer; user-select:none; font-weight: 600;"><?=h(mdw_t('theme.ui.title','User interface'))?></summary>
			            <div style="margin-top: 0.75rem; display:flex; flex-direction:column; gap: 0.75rem;">
			                <div class="modal-field">
			                    <div class="modal-label"><?=h(mdw_t('theme.kbd_modifier.label','Keyboard shortcuts system'))?></div>
			                    <div class="modal-row" style="gap: 1rem; margin: 0;">
			                        <label class="radio">
			                            <input type="radio" name="kbdShortcutMod" id="kbdShortcutModOption" value="option">
			                        <span><?=h(mdw_t('theme.kbd_modifier.option','Windows / Linux (Ctrl + Alt)'))?></span>
			                    </label>
			                    <label class="radio">
			                        <input type="radio" name="kbdShortcutMod" id="kbdShortcutModCommand" value="command">
			                        <span><?=h(mdw_t('theme.kbd_modifier.command','Mac (Ctrl + Command)'))?></span>
			                    </label>
			                </div>
			                <div class="status-text">
			                    <?=h(mdw_t('theme.kbd_modifier.tip','Choose the system your shortcuts should follow (saved in this browser).'))?>
			                </div>
			            </div>

			            <div class="modal-field">
			                <label class="modal-label" for="langSelect"><?=h(mdw_t('theme.language.label','Language'))?></label>
			                <select id="langSelect" class="input" style="width: 100%;">
			                    <?php foreach ($MDW_LANGS as $l): ?>
			                        <?php
			                            $code = (string)($l['code'] ?? '');
			                            $label = (string)($l['native'] ?? ($l['label'] ?? $code));
			                        ?>
			                        <option value="<?=h($code)?>" <?= $MDW_LANG === $code ? 'selected' : '' ?>><?=h($label)?></option>
			                    <?php endforeach; ?>
			                </select>
			                <div class="status-text" style="margin-top: 0.35rem;">
			                    <?=h(mdw_t('theme.language.hint','Choose UI language (auto-detected from translations/*.json).'))?>
				            </div>
			            </div>

			            <div class="modal-field">
			                <div class="modal-label"><?=h(mdw_t('theme.delete_after.label','After deleting a note'))?></div>
			                <div class="modal-row" style="gap: 1rem; margin: 0;">
			                    <label class="radio">
			                        <input type="radio" name="deleteAfter" id="deleteAfterOverview" value="overview">
			                        <span><?=h(mdw_t('theme.delete_after.overview','Back to overview'))?></span>
			                    </label>
			                    <label class="radio">
			                        <input type="radio" name="deleteAfter" id="deleteAfterNext" value="next">
			                        <span><?=h(mdw_t('theme.delete_after.next','Open next note'))?></span>
			                    </label>
			                </div>
			                <div class="status-text">
			                    <?=h(mdw_t('theme.delete_after.hint','Saved in this browser.'))?>
			                </div>
			            </div>

			            <div class="modal-field" data-auth-superuser="1">
			                <label class="modal-label" for="appTitleInput"><?=h(mdw_t('theme.app_title.label','App title'))?></label>
			                <div class="modal-row" style="gap: 0.6rem; margin: 0;">
			                    <input id="appTitleInput" type="text" class="input" style="flex: 1 1 auto;" placeholder="<?=h(mdw_t('theme.app_title.placeholder','Markdown Manager'))?>" value="<?=h($APP_TITLE_OVERRIDE)?>" data-auth-superuser-enable="1">
			                    <button type="button" class="btn btn-ghost btn-small" id="appTitleSaveBtn" data-auth-superuser-enable="1"><?=h(mdw_t('theme.app_title.save','Save title'))?></button>
			                </div>
			                <div id="appTitleStatus" class="status-text" style="margin-top: 0.35rem;">
			                    <?=h(mdw_t('theme.app_title.hint','Leave blank to use the default.'))?>
			                </div>
			            </div>

			            <div class="modal-field" data-auth-superuser="1">
			                <div class="modal-label"><?=h(mdw_t('theme.permissions.title','Permissions'))?></div>
			                <label style="display:flex; align-items:center; gap:0.5rem; margin-top: 0.35rem;">
			                    <input id="allowUserDeleteToggle" type="checkbox" <?= !array_key_exists('allow_user_delete', $MDW_SETTINGS) || !empty($MDW_SETTINGS['allow_user_delete']) ? 'checked' : '' ?> data-auth-superuser-enable="1">
			                    <span class="status-text"><?=h(mdw_t('theme.permissions.allow_user_delete','Allow users to delete notes'))?></span>
			                </label>
			                <div id="allowUserDeleteStatus" class="status-text" style="margin-top: 0.35rem;">
			                    <?=h(mdw_t('theme.permissions.hint','Saved for all users.'))?>
			                </div>
			            </div>

			            <div class="modal-field" data-auth-superuser="1">
			                <div class="modal-label"><?=h(mdw_t('theme.copy.title','Copy buttons'))?></div>
			                <label style="display:flex; align-items:center; gap:0.5rem; margin-top: 0.35rem;">
			                    <input id="copyButtonsToggle" type="checkbox" <?= $copyButtonsEnabled ? 'checked' : '' ?> data-auth-superuser-enable="1">
			                    <span class="status-text"><?=h(mdw_t('theme.copy.show_buttons','Show preview copy buttons'))?></span>
			                </label>
			                <label style="display:flex; align-items:center; gap:0.5rem; margin-top: 0.35rem;">
			                    <input id="copyIncludeMetaToggle" type="checkbox" <?= $copyIncludeMeta ? 'checked' : '' ?> data-auth-superuser-enable="1">
			                    <span class="status-text"><?=h(mdw_t('theme.copy.include_meta','Include metadata in copy'))?></span>
			                </label>
			                <label class="modal-label" for="copyHtmlModeSelect" style="margin-top: 0.5rem;"><?=h(mdw_t('theme.copy.html_mode_label','HTML copy mode'))?></label>
			                <select id="copyHtmlModeSelect" class="input" data-auth-superuser-enable="1">
			                    <option value="dry" <?= $copyHtmlMode === 'dry' ? 'selected' : '' ?>><?=h(mdw_t('theme.copy.html_mode_dry','Dry HTML (no classes/styles)'))?></option>
			                    <option value="medium" <?= $copyHtmlMode === 'medium' ? 'selected' : '' ?>><?=h(mdw_t('theme.copy.html_mode_medium','Medium dry HTML (classes only)'))?></option>
			                    <option value="wet" <?= $copyHtmlMode === 'wet' ? 'selected' : '' ?>><?=h(mdw_t('theme.copy.html_mode_wet','Wet HTML (inline styles)'))?></option>
			                </select>
			                <div id="copySettingsStatus" class="status-text" style="margin-top: 0.35rem;">
			                    <?=h(mdw_t('theme.copy.hint','Saved for all users.'))?>
			                </div>
			            </div>

			            <div class="modal-field" data-auth-superuser="1">
			                <label class="modal-label" for="postDateFormatSelect"><?=h(mdw_t('theme.post_date_format.label','Post date format'))?></label>
			                <select id="postDateFormatSelect" class="input" data-auth-superuser-enable="1">
			                    <option value="mdy_short" <?= $postDateFormat === 'mdy_short' ? 'selected' : '' ?>><?=h(mdw_t('theme.post_date_format.option_mdy_short','Nov 20, 2025'))?></option>
			                    <option value="dmy_long" <?= $postDateFormat === 'dmy_long' ? 'selected' : '' ?>><?=h(mdw_t('theme.post_date_format.option_dmy_long','16 December 2025'))?></option>
			                </select>
			                <div id="postDateFormatStatus" class="status-text" style="margin-top: 0.35rem;">
			                    <?=h(mdw_t('theme.post_date_format.hint','Saved for all users.'))?>
			                </div>
			            </div>
			            <div class="modal-field" data-auth-superuser="1">
			                <label class="modal-label" for="postDateAlignSelect"><?=h(mdw_t('theme.post_date_align.label','Post date alignment'))?></label>
			                <select id="postDateAlignSelect" class="input" data-auth-superuser-enable="1">
			                    <option value="left" <?= $postDateAlign === 'left' ? 'selected' : '' ?>><?=h(mdw_t('theme.post_date_align.option_left','Left'))?></option>
			                    <option value="center" <?= $postDateAlign === 'center' ? 'selected' : '' ?>><?=h(mdw_t('theme.post_date_align.option_center','Center'))?></option>
			                    <option value="right" <?= $postDateAlign === 'right' ? 'selected' : '' ?>><?=h(mdw_t('theme.post_date_align.option_right','Right'))?></option>
			                </select>
			                <div id="postDateAlignStatus" class="status-text" style="margin-top: 0.35rem;">
			                    <?=h(mdw_t('theme.post_date_align.hint','Saved for all users.'))?>
			                </div>
			            </div>
			        </div>
			    </details>
			        <div class="modal-field">
			            <label class="modal-label" for="themePreset"><?=h(mdw_t('theme.preset','Theme'))?></label>
		            <div style="display:flex; align-items:center; gap:0.6rem;">
			            <select id="themePreset" class="input" style="flex: 1 1 auto;">
		                <option value="default"><?=h(mdw_t('theme.default','Default'))?></option>
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
				            <div class="status-text" style="margin-top: 0.4rem;">
				                <?=h(mdw_t('theme.applies_hint','Applies only to the Markdown editor + HTML preview.'))?>
				            </div>
				        </div>

			        <details style="margin-top: 0.8rem;">
			            <summary style="cursor:pointer; user-select:none; font-weight: 600;"><?=h(mdw_t('theme.overrides.summary','Theme adjustments (optional)'))?></summary>
			            <div style="margin-top: 0.75rem; display:flex; flex-direction:column; gap: 0.75rem;">
		                <div class="status-text">
		                    <?=h(mdw_t('theme.overrides.saved_auto','Theme adjustments are saved in your browser (localStorage) automatically as you type.'))?>
		                    <span id="themeOverridesStatus" style="margin-left: 0.35rem;"></span>
		                </div>
		                <div class="modal-field">
		                    <div class="modal-label" style="margin-bottom: 0.35rem;"><?=h(mdw_t('theme.overrides.preview_section','HTML preview'))?></div>
		                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 0.6rem;">
		                        <input id="themePreviewBg" type="text" class="input" placeholder="<?=h(mdw_t('theme.overrides.placeholders.preview_bg','Background (e.g. #ffffff)'))?>">
		                        <input id="themePreviewText" type="text" class="input" placeholder="<?=h(mdw_t('theme.overrides.placeholders.preview_text','Text color (e.g. #111827)'))?>">
		                        <input id="themePreviewFont" type="text" class="input" placeholder="<?=h(mdw_t('theme.overrides.placeholders.preview_font','Font family (e.g. Playfair Display)'))?>">
		                        <input id="themePreviewFontSize" type="text" class="input" placeholder="<?=h(mdw_t('theme.overrides.placeholders.preview_font_size','Font size (e.g. 16px)'))?>">
		                        <input id="themeHeadingFont" type="text" class="input" placeholder="<?=h(mdw_t('theme.overrides.placeholders.heading_font','Heading font family (e.g. Montserrat)'))?>">
		                        <input id="themeHeadingColor" type="text" class="input" placeholder="<?=h(mdw_t('theme.overrides.placeholders.heading_color','Heading color (e.g. rgb(229,33,157))'))?>">
		                        <input id="themeListColor" type="text" class="input" placeholder="<?=h(mdw_t('theme.overrides.placeholders.list_color','List color (optional)'))?>">
		                        <input id="themeBlockquoteTint" type="text" class="input" placeholder="<?=h(mdw_t('theme.overrides.placeholders.blockquote_tint','Blockquote tint (optional)'))?>">
		                    </div>
		                </div>

		                <div class="modal-field">
		                    <div class="modal-label" style="margin-bottom: 0.35rem;"><?=h(mdw_t('theme.overrides.editor_section','Markdown editor'))?></div>
		                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 0.6rem;">
		                        <input id="themeEditorFont" type="text" class="input" placeholder="<?=h(mdw_t('theme.overrides.placeholders.editor_font','Font family (e.g. Playfair Display)'))?>">
		                        <input id="themeEditorFontSize" type="text" class="input" placeholder="<?=h(mdw_t('theme.overrides.placeholders.editor_font_size','Font size (e.g. 15px)'))?>">
		                        <input id="themeEditorAccent" type="text" class="input" placeholder="<?=h(mdw_t('theme.overrides.placeholders.editor_accent','Accent color (e.g. rgb(229,33,157))'))?>">
		                    </div>
		                </div>

		                <div style="display:flex; gap: 0.6rem; align-items:center; justify-content:flex-end;">
		                    <button type="button" class="btn btn-ghost btn-small" id="themeSaveOverridesBtn" title="<?=h(mdw_t('theme.overrides.save_title','Save theme adjustments now'))?>"><?=h(mdw_t('theme.overrides.save_btn','Save theme adjustments'))?></button>
		                    <button type="button" class="btn btn-ghost btn-small" id="themeResetBtn" title="<?=h(mdw_t('theme.overrides.reset_title','Clear theme adjustments'))?>"><?=h(mdw_t('theme.overrides.reset_btn','Reset theme adjustments'))?></button>
		                </div>
		            </div>
		        </details>

				        <details style="margin-top: 0.8rem;">
				            <summary style="cursor:pointer; user-select:none; font-weight: 600;"><?=h(mdw_t('theme.metadata.title','Metadata'))?></summary>
				            <div style="margin-top: 0.75rem; display:flex; flex-direction:column; gap: 0.75rem;">
				                <?php
				                    $publisherMode = !empty(($META_CFG['_settings']['publisher_mode'] ?? false));
				                    $publisherAuthor = (string)($META_CFG['_settings']['publisher_default_author'] ?? '');
				                    $publisherRequireH2 = !array_key_exists('publisher_require_h2', ($META_CFG['_settings'] ?? []))
				                        ? true
				                        : !empty($META_CFG['_settings']['publisher_require_h2']);
				                ?>
				                <div class="modal-field" style="margin: 0;">
				                    <div class="modal-label"><?=h(mdw_t('theme.publisher.title','WPM (Website publication mode)'))?></div>
				                    <label style="display:flex; align-items:center; gap:0.5rem; margin-top: 0.35rem;">
				                        <input id="publisherModeToggle" type="checkbox" <?= $publisherMode ? 'checked' : '' ?>>
				                        <span class="status-text"><?=h(mdw_t('theme.publisher.enable','Enable WPM'))?></span>
				                    </label>
				                    <div class="status-text" style="margin-top: 0.35rem;">
				                        <?=h(mdw_t('theme.publisher.hint','WPM adds publish states (Concept / Processing / Published) and shows them in the overview. Disables Secret notes. Requires an author name; subtitle requirement is optional.'))?>
				                    </div>
				                    <div style="display:grid; grid-template-columns: 1fr; gap: 0.35rem; margin-top: 0.6rem;">
				                        <label class="status-text" for="publisherAuthorInput"><?=h(mdw_t('theme.publisher.author_label','Author name'))?></label>
				                        <input id="publisherAuthorInput" type="text" class="input" value="<?=h($publisherAuthor)?>" placeholder="<?=h(mdw_t('theme.publisher.author_placeholder','Your name'))?>">
				                    </div>
				                    <label style="display:flex; align-items:center; gap:0.5rem; margin-top: 0.6rem;">
				                        <input id="publisherRequireH2Toggle" type="checkbox" <?= $publisherRequireH2 ? 'checked' : '' ?>>
				                        <span class="status-text"><?=h(mdw_t('theme.publisher.require_subtitle','Require subtitle (##)'))?></span>
				                    </label>
				                </div>
				                <div class="status-text">
				                    <?=h(mdw_t('theme.metadata.hint','Control whether metadata is shown in the Markdown editor and/or HTML preview. If hidden in Markdown, it is also hidden in HTML preview.'))?>
				                </div>
				                <div style="display:grid; grid-template-columns: 1fr auto auto; gap: 0.5rem 0.75rem; align-items:center;">
				                    <div class="status-text" style="font-weight: 600;"><?=h(mdw_t('theme.metadata.field','Field'))?></div>
				                    <div class="status-text" style="font-weight: 600;"><?=h(mdw_t('theme.metadata.show_markdown','Markdown'))?></div>
				                    <div class="status-text" style="font-weight: 600;"><?=h(mdw_t('theme.metadata.show_html','HTML'))?></div>
				                    <?php foreach (($META_CFG['fields'] ?? []) as $k => $f): ?>
				                        <?php
				                            $label = (string)($f['label'] ?? $k);
				                            $mdVis = !empty($f['markdown_visible']);
				                            $htmlVis = !empty($f['html_visible']) && $mdVis;
				                        ?>
				                        <div><?=h($label)?></div>
				                        <label class="checkbox" style="display:inline-flex; align-items:center; justify-content:center;">
				                            <input type="checkbox" data-meta-scope="base" data-meta-key="<?=h($k)?>" data-meta-field="markdown" <?= $mdVis ? 'checked' : '' ?>>
				                        </label>
				                        <label class="checkbox" style="display:inline-flex; align-items:center; justify-content:center;">
				                            <input type="checkbox" data-meta-scope="base" data-meta-key="<?=h($k)?>" data-meta-field="html" <?= $htmlVis ? 'checked' : '' ?> <?= $mdVis ? '' : 'disabled' ?>>
				                        </label>
				                    <?php endforeach; ?>
				                </div>
				                <div id="publisherMetaFields" style="<?= $publisherMode ? '' : 'display:none;' ?> border-top: 1px solid var(--border-soft); padding-top: 0.75rem; margin-top: 0.25rem;">
				                    <div class="status-text" style="font-weight: 600; margin-bottom: 0.4rem;"><?=h(mdw_t('theme.publisher.title','WPM (Website publication mode)'))?></div>
				                    <div style="display:grid; grid-template-columns: 1fr auto auto; gap: 0.5rem 0.75rem; align-items:center;">
				                        <div class="status-text" style="font-weight: 600;"><?=h(mdw_t('theme.metadata.field','Field'))?></div>
				                        <div class="status-text" style="font-weight: 600;"><?=h(mdw_t('theme.metadata.show_markdown','Markdown'))?></div>
				                        <div class="status-text" style="font-weight: 600;"><?=h(mdw_t('theme.metadata.show_html','HTML'))?></div>
				                        <?php foreach (($META_PUBLISHER_CFG['fields'] ?? []) as $k => $f): ?>
				                            <?php
				                                $label = (string)($f['label'] ?? $k);
				                                $mdVis = !empty($f['markdown_visible']);
				                                $htmlVis = !empty($f['html_visible']) && $mdVis;
				                            ?>
				                            <div><?=h($label)?></div>
				                            <label class="checkbox" style="display:inline-flex; align-items:center; justify-content:center;">
				                                <input type="checkbox" data-meta-scope="publisher" data-meta-key="<?=h($k)?>" data-meta-field="markdown" <?= $mdVis ? 'checked' : '' ?>>
				                            </label>
				                            <label class="checkbox" style="display:inline-flex; align-items:center; justify-content:center;">
				                                <input type="checkbox" data-meta-scope="publisher" data-meta-key="<?=h($k)?>" data-meta-field="html" <?= $htmlVis ? 'checked' : '' ?> <?= $mdVis ? '' : 'disabled' ?>>
				                            </label>
				                        <?php endforeach; ?>
				                    </div>
				                </div>
				                <div style="display:flex; align-items:center; gap: 0.6rem; justify-content:flex-end;">
				                    <span id="metaSettingsStatus" class="status-text"></span>
				                    <button type="button" class="btn btn-ghost btn-small" id="metaSettingsSaveBtn"><?=h(mdw_t('theme.metadata.save','Save metadata settings'))?></button>
				                </div>
				            </div>
				        </details>
				        <details style="margin-top: 0.8rem;" data-auth-superuser="1">
				            <summary style="cursor:pointer; user-select:none; font-weight: 600;"><?=h(mdw_t('theme.settings_io.title','Settings import/export'))?></summary>
				            <div style="margin-top: 0.75rem; display:flex; flex-direction:column; gap: 0.75rem;">
				                <div class="settings-io-grid">
				                    <div class="modal-field" style="margin: 0;">
				                        <div class="modal-label"><?=h(mdw_t('theme.settings_io.export_label','Export'))?></div>
				                        <button type="button" id="settingsExportBtn" class="btn btn-ghost btn-small" data-auth-superuser-enable="1"><?=h(mdw_t('theme.settings_io.export_btn','Export settings'))?></button>
				                    </div>
				                    <div class="modal-field" style="margin: 0;">
				                        <label class="modal-label" for="settingsImportFile"><?=h(mdw_t('theme.settings_io.import_label','Import'))?></label>
				                        <div style="display:flex; align-items:center; gap: 0.6rem; flex-wrap:wrap;">
				                            <input id="settingsImportFile" type="file" class="input" accept="application/json" data-auth-superuser-enable="1">
				                            <button type="button" id="settingsImportBtn" class="btn btn-ghost btn-small" data-auth-superuser-enable="1"><?=h(mdw_t('theme.settings_io.import_btn','Import settings'))?></button>
				                        </div>
				                    </div>
				                </div>
				                <div id="settingsImportExportStatus" class="status-text"></div>
				            </div>
				        </details>
		    </div>
		    <div class="modal-footer">
		        <button type="button" class="btn btn-ghost" id="themeModalCancel"><?=h(mdw_t('common.close','Close'))?></button>
		    </div>
		</div>

		<script>
		window.MDW_THEMES_DIR = <?= json_encode($THEMES_DIR) ?>;
		window.MDW_THEMES = <?= json_encode($themesList) ?>;
		window.MDW_TRANSLATIONS_DIR = <?= json_encode($TRANSLATIONS_DIR) ?>;
		window.MDW_LANG = <?= json_encode($MDW_LANG) ?>;
		window.MDW_LANGS = <?= json_encode($MDW_LANGS) ?>;
		window.MDW_I18N = <?= json_encode($GLOBALS['MDW_I18N'] ?? new stdClass(), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>;
		window.MDW_CSRF = <?= json_encode($CSRF_TOKEN) ?>;
		window.MDW_AUTH_META = <?= json_encode($MDW_AUTH_META) ?>;
		window.MDW_META_CONFIG = <?= json_encode($META_CFG_CLIENT, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>;
		window.MDW_META_PUBLISHER_CONFIG = <?= json_encode($META_PUBLISHER_CFG, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>;
		</script>

	<script defer src="<?=h($STATIC_DIR)?>/base.js"></script>

	</body>
	</html>
