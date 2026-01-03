<?php
/*******************************
 * MarkdownManager v0.1
 * - Static assets in STATIC_DIR (CSS/JS/font)
 * - shared security + secret_mds logic
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

function sanitize_folder_name($folder) {
    if (!is_string($folder)) return null;
    $folder = trim($folder);
    if ($folder === '') return null;
    if (strpos($folder, '..') !== false) return null;
    $folder = str_replace("\\", "/", $folder);
    $folder = trim($folder, "/");
    if ($folder === '') return null;
    $parts = explode('/', $folder);
    if (count($parts) > 2) return null;
    foreach ($parts as $p) {
        if ($p === '' || $p === '.' || $p === '..') return null;
        if (!preg_match('/^[A-Za-z0-9._\-\p{L}\p{N}\p{So}]+$/u', $p)) return null;
    }
    return implode('/', $parts);
}

function folder_from_path($path) {
    if (!$path) return null;
    $d = dirname($path);
    if ($d === '.' || $d === '') return 'root';
    return $d;
}

/* SECURITY / PATH CLEAN */
function mdw_path_normalize($path) {
    return str_replace("\\", "/", (string)$path);
}

function mdw_project_root() {
    static $root = null;
    if ($root === null) {
        $root = realpath(__DIR__);
        if ($root === false) $root = __DIR__;
    }
    return $root;
}

function mdw_path_within_root($path, $root = null) {
    $root = $root ?? mdw_project_root();
    if (!is_string($root) || $root === '') return false;
    $rootNorm = rtrim(mdw_path_normalize($root), '/');
    $pathNorm = mdw_path_normalize($path);
    if ($pathNorm === $rootNorm) return true;
    return str_starts_with($pathNorm, $rootNorm . '/');
}

function mdw_safe_full_path($relativePath, $requireExists = true) {
    if (!is_string($relativePath) || $relativePath === '') return null;
    $root = mdw_project_root();
    if (!is_string($root) || $root === '') return null;
    $clean = mdw_path_normalize($relativePath);
    $clean = ltrim($clean, "/");
    if ($clean === '') return null;
    $full = rtrim($root, "/\\") . '/' . $clean;

    if ($requireExists) {
        $resolved = realpath($full);
        if ($resolved === false) return null;
        if (!mdw_path_within_root($resolved, $root)) return null;
        return $full;
    }

    $parent = dirname($full);
    $parentResolved = realpath($parent);
    if ($parentResolved === false) return null;
    if (!mdw_path_within_root($parentResolved, $root)) return null;
    return $full;
}

function sanitize_md_path($path) {
    if (!$path) return null;
    if (strpos($path, '..') !== false) return null;

    $parts = explode('/', $path);
    if (count($parts) > 3) return null;
    foreach ($parts as $p) {
        if ($p === '') return null;
        // allow unicode letters/numbers plus . _ -
        if (!preg_match('/^[A-Za-z0-9._\-\p{L}\p{N}\p{So}]+$/u', $p)) return null;
    }

    if (!preg_match('/\.md$/i', end($parts))) return null;

    $full = mdw_safe_full_path($path, true);
    if (!$full || !is_file($full)) return null;

    return $path;
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

/* ESCAPE */
function h($s){ return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); }

function mdw_perm_user_name($uid) {
    if ($uid === false || $uid === null) return 'unknown';
    if (function_exists('posix_getpwuid')) {
        $info = @posix_getpwuid($uid);
        if (is_array($info) && isset($info['name'])) {
            return $info['name'] . '(' . $uid . ')';
        }
    }
    return (string)$uid;
}

function mdw_perm_group_name($gid) {
    if ($gid === false || $gid === null) return 'unknown';
    if (function_exists('posix_getgrgid')) {
        $info = @posix_getgrgid($gid);
        if (is_array($info) && isset($info['name'])) {
            return $info['name'] . '(' . $gid . ')';
        }
    }
    return (string)$gid;
}

function mdw_perm_diag($fullPath) {
    $parts = [];
    $dir = dirname($fullPath);
    if ($dir !== '') {
        $parts[] = 'dir=' . $dir;
        if (is_dir($dir)) {
            $parts[] = 'dir_w=' . (is_writable($dir) ? 'yes' : 'no');
            $perm = @fileperms($dir);
            if ($perm !== false) $parts[] = 'dir_perm=' . substr(sprintf('%o', $perm), -4);
            $owner = @fileowner($dir);
            if ($owner !== false) $parts[] = 'dir_owner=' . mdw_perm_user_name($owner);
            $group = @filegroup($dir);
            if ($group !== false) $parts[] = 'dir_group=' . mdw_perm_group_name($group);
        } else {
            $parts[] = 'dir_missing=yes';
        }
    }
    $parts[] = 'file=' . $fullPath;
    if (file_exists($fullPath)) {
        $parts[] = 'file_w=' . (is_writable($fullPath) ? 'yes' : 'no');
        $perm = @fileperms($fullPath);
        if ($perm !== false) $parts[] = 'file_perm=' . substr(sprintf('%o', $perm), -4);
        $owner = @fileowner($fullPath);
        if ($owner !== false) $parts[] = 'file_owner=' . mdw_perm_user_name($owner);
        $group = @filegroup($fullPath);
        if ($group !== false) $parts[] = 'file_group=' . mdw_perm_group_name($group);
    } else {
        $parts[] = 'file_missing=yes';
    }
    return implode(', ', $parts);
}

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
$folderIconStyle = isset($MDW_SETTINGS['folder_icon_style']) ? strtolower(trim((string)$MDW_SETTINGS['folder_icon_style'])) : 'folder';
if ($folderIconStyle !== 'caret') $folderIconStyle = 'folder';
$folderIconClass = $folderIconStyle === 'caret' ? 'folder-icons-caret' : 'folder-icons-folder';
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

function mdw_editor_title_from_raw($raw, $publisherMode = false) {
    $raw = (string)$raw;
    $fallback = extract_title($raw);
    if (!$publisherMode) return $fallback;
    if (!function_exists('mdw_hidden_meta_extract_and_remove_all')) return $fallback;
    $meta = [];
    mdw_hidden_meta_extract_and_remove_all($raw, $meta);
    $pageTitle = trim((string)($meta['page_title'] ?? ''));
    return $pageTitle !== '' ? $pageTitle : $fallback;
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
    $pluginsDir = env_path('PLUGINS_DIR', __DIR__ . '/plugins', __DIR__);
    $staticDir = sanitize_folder_name(env_str('STATIC_DIR', 'static') ?? '') ?? 'static';
    $imagesDir = sanitize_folder_name(env_str('IMAGES_DIR', 'images') ?? '') ?? 'images';
    $themesDir = sanitize_folder_name(env_str('THEMES_DIR', 'themes') ?? '') ?? 'themes';
    $translationsDir = function_exists('mdw_i18n_dir') ? mdw_i18n_dir() : 'translations';
    $toolsDir = 'tools';
    $exclude = [
        'root' => true,
        'HTML' => true,
        'PDF' => true,
        basename($pluginsDir) => true,
        $toolsDir => true,
        $staticDir => true,
        $imagesDir => true,
        $themesDir => true,
        $translationsDir => true,
    ];

    $dirs = array_filter(glob('*'), function($f){
        return is_dir($f) && $f[0]!=='.';
    });

    sort($dirs, SORT_NATURAL | SORT_FLAG_CASE);

    $map = [];
    foreach ($dirs as $dir) {
        if (isset($exclude[$dir])) continue;

        $targets = [$dir];
        $subdirs = array_filter(glob($dir . '/*'), function($f){
            return is_dir($f) && basename($f)[0] !== '.';
        });
        sort($subdirs, SORT_NATURAL | SORT_FLAG_CASE);
        foreach ($subdirs as $sub) {
            $subBase = basename($sub);
            $targets[] = $dir . '/' . $subBase;
        }

        foreach ($targets as $target) {
            $mds = glob($target . '/*.md');
            $tmp = [];
            if ($mds) {
                foreach ($mds as $path) {
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
            $map[$target] = $tmp;
        }
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
$save_error_details = null;
$saved_flag = isset($_GET['saved']) ? true : false;
$use_posted_content = false;
$posted_content_for_render = '';

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
        $full = mdw_safe_full_path($requested, true);
        if (!$full || !is_file($full)) {
            http_response_code(404);
            echo json_encode(['error' => 'not_found']);
            exit;
        }
        $raw_content = file_get_contents($full);
        $publishState = '';
        if (!empty($MDW_PUBLISHER_MODE)) {
            $meta = [];
            mdw_hidden_meta_extract_and_remove_all($raw_content, $meta);
            $publishState = mdw_publisher_normalize_publishstate($meta['publishstate'] ?? '');
            if ($publishState === '') $publishState = 'Concept';
        }

        echo json_encode([
            'file'    => $requested,
            'title'   => mdw_editor_title_from_raw($raw_content, !empty($MDW_PUBLISHER_MODE)),
            'content' => $raw_content,
            'html'    => md_to_html($raw_content, $requested),
            'is_secret' => (bool)$is_secret_req_json,
            'secret_authenticated' => is_secret_authenticated(),
            'publish_state' => $publishState,
        ]);
        exit;
    } else {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => 'forbidden']);
        exit;
    }
}

/* HANDLE RENAME (superuser) */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'rename') {
    $csrf = isset($_POST['csrf']) ? (string)$_POST['csrf'] : '';
    if ($csrf === '' || !hash_equals($CSRF_TOKEN, $csrf)) {
        $save_error = mdw_t('flash.csrf_invalid', 'Invalid session (CSRF). Reload the page.');
    } else {
        $authToken = isset($_POST['auth_token']) ? (string)$_POST['auth_token'] : '';
        $authIsSuperuser = function_exists('mdw_auth_verify_token')
            ? mdw_auth_verify_token('superuser', $authToken)
            : false;
        if (!$authIsSuperuser) {
            $save_error = mdw_t('auth.superuser_required', 'Superuser login required.');
        } else {
            $postedFile = isset($_POST['file']) ? (string)$_POST['file'] : '';
            $san = sanitize_md_path($postedFile);
            if (!$san) {
                $save_error = mdw_t('flash.invalid_file_path', 'Invalid file path.');
            } else {
                $rawSlug = isset($_POST['new_slug']) ? (string)$_POST['new_slug'] : '';
                $slug = sanitize_new_md_slug($rawSlug);
                $slugLen = $slug ? mdw_strlen($slug) : 0;
                if (!$slug || $slugLen < MDW_NEW_MD_SLUG_MIN) {
                    $save_error = mdw_t('flash.slug_too_short', 'Slug is too short.', ['min' => MDW_NEW_MD_SLUG_MIN]);
                } else if ($slugLen > MDW_NEW_MD_SLUG_MAX) {
                    $slug = mdw_substr($slug, MDW_NEW_MD_SLUG_MAX);
                    $slug = rtrim($slug, '-.');
                }
                if ($save_error === null) {
                    $dir = dirname($san);
                    if ($dir === '.' || $dir === '') $dir = '';
                    $base = basename($san);
                    $prefix = '';
                    if (preg_match('/^\\d{2}-\\d{2}-\\d{2}-/', $base, $m)) {
                        $prefix = $m[0];
                    }
                    $newBase = $prefix . $slug . '.md';
                    $newPath = $dir ? ($dir . '/' . $newBase) : $newBase;
                    if ($newPath === $san) {
                        $save_error = mdw_t('flash.rename_no_change', 'Filename did not change.');
                    } else {
                        $oldFull = mdw_safe_full_path($san, true);
                        $newFull = mdw_safe_full_path($newPath, false);
                        $existingFull = mdw_safe_full_path($newPath, true);
                        if (!$oldFull || !is_file($oldFull) || !$newFull) {
                            $save_error = mdw_t('flash.invalid_file_path', 'Invalid file path.');
                        } else if ($existingFull && is_file($existingFull)) {
                            $save_error = mdw_t('flash.file_exists_prefix', 'File already exists:') . ' ' . $newPath;
                        } else if (!$existingFull && file_exists($newFull)) {
                            $save_error = mdw_t('flash.invalid_file_path', 'Invalid file path.');
                        } else if (!@rename($oldFull, $newFull)) {
                            $err = error_get_last();
                            $save_error = mdw_t('flash.rename_failed', 'Could not rename file.');
                            if ($err && !empty($err['message'])) $save_error .= ' (' . $err['message'] . ')';
                        } else {
                            header('Location: edit.php?file=' . rawurlencode($newPath));
                            exit;
                        }
                    }
                }
            }
        }
    }
}


/* HANDLE SAVE */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['action']) && $_POST['action'] === 'save') {
    $isAjax = !empty($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower((string)$_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest';
    $postedFile = isset($_POST['file']) ? $_POST['file'] : '';
    if ($postedFile === '' && isset($_GET['file'])) {
        $postedFile = (string)$_GET['file'];
    }
    $san = sanitize_md_path($postedFile);
    if (!$san) {
        $save_error = 'Invalid file path.';
    } else {
        if (is_secret_file($san) && !is_secret_authenticated()) {
            // niet stiekem saven als je niet ingelogd bent
            if ($isAjax) {
                http_response_code(403);
                header('Content-Type: application/json; charset=utf-8');
                echo json_encode(['ok' => false, 'error' => 'forbidden']);
                exit;
            }
            header('Location: index.php?file='.rawurlencode($san));
            exit;
        }
            $full = mdw_safe_full_path($san, true);
            if (!$full || !is_file($full)) {
                $save_error = 'Invalid file path.';
            } else {
                $content = isset($_POST['content']) ? (string)$_POST['content'] : '';
                $authRole = isset($_POST['auth_role']) ? (string)$_POST['auth_role'] : '';
                $authToken = isset($_POST['auth_token']) ? (string)$_POST['auth_token'] : '';
                $authIsSuperuser = function_exists('mdw_auth_verify_token')
                    ? mdw_auth_verify_token('superuser', $authToken)
                    : false;
                $authIsUser = function_exists('mdw_auth_verify_token')
                    ? mdw_auth_verify_token('user', $authToken)
                    : false;
                $postedAuthor = isset($_POST['publisher_author']) ? trim((string)$_POST['publisher_author']) : '';
                // Normalize line endings so the editor doesn't appear "dirty" after save.
                $content = str_replace(["\r\n", "\r"], "\n", $content);
                $submittedMeta = [];
                $submittedBody = mdw_hidden_meta_extract_and_remove_all($content, $submittedMeta);
                $publishAction = isset($_POST['publish_action']) ? trim((string)$_POST['publish_action']) : '';
                $publishStateInput = isset($_POST['publish_state']) ? trim((string)$_POST['publish_state']) : '';
                $publishStateOverride = isset($_POST['publish_state_override']) ? trim((string)$_POST['publish_state_override']) : '';
                $publishStateOverride = ($publishStateOverride === '1' || $publishStateOverride === 'true');
                $existingMeta = [];
                $existingRaw = '';
                if (is_file($full)) {
                    $existingRaw = (string)@file_get_contents($full);
                    mdw_hidden_meta_extract_and_remove_all($existingRaw, $existingMeta);
                }
                $contentChanged = false;
                if (!empty($MDW_PUBLISHER_MODE)) {
                    $existingNormalized = str_replace(["\r\n", "\r"], "\n", $existingRaw);
                    $contentChanged = ($existingNormalized !== $content);
                }
                $existingPublishState = null;
                if (!empty($MDW_PUBLISHER_MODE)) {
                    $existingPublishState = mdw_publisher_normalize_publishstate($existingMeta['publishstate'] ?? '');
                    if ($existingPublishState === '') $existingPublishState = 'Concept';
                }
                $desiredPublishState = null;
                $allowedPublishStates = ['Concept', 'Processing', 'Published'];
                if (!empty($MDW_PUBLISHER_MODE)) {
                    $authRequired = function_exists('mdw_auth_has_role')
                        ? (mdw_auth_has_role('superuser') || mdw_auth_has_role('user'))
                        : false;
                    $allowUserPublish = !array_key_exists('allow_user_publish', $MDW_SETTINGS) ? false : !empty($MDW_SETTINGS['allow_user_publish']);
                    $canPublish = !$authRequired || $authIsSuperuser || ($authIsUser && $allowUserPublish);

                    if ($canPublish && $publishAction === 'publish') {
                        $desiredPublishState = 'Processing';
                    } else if ($authIsSuperuser && $publishStateOverride && $publishStateInput !== '') {
                        $candidate = mdw_publisher_normalize_publishstate($publishStateInput);
                        if (in_array($candidate, $allowedPublishStates, true)) {
                            $desiredPublishState = $candidate;
                        }
                    }

                    if ($desiredPublishState === null) {
                        $desiredPublishState = 'Concept';
                    }
                }
                $finalPublishState = null;
                if (!empty($MDW_PUBLISHER_MODE)) {
                    $finalPublishState = $desiredPublishState;
                }

                $author = '';
                if (!empty($MDW_PUBLISHER_MODE)) {
                    $author = $authIsUser ? $postedAuthor : ($postedAuthor !== '' ? $postedAuthor : (isset($MDW_SETTINGS['publisher_default_author']) ? trim((string)$MDW_SETTINGS['publisher_default_author']) : ''));
                    if ($authIsUser && $author === '') {
                    $save_error = mdw_t('flash.publisher_author_required', 'WPM requires an author name.', ['app' => $APP_NAME]);
                    } else if ($author === '') {
                    $save_error = mdw_t('flash.publisher_author_required', 'WPM requires an author name.', ['app' => $APP_NAME]);
                    } else {
                        $pageTitle = trim((string)($submittedMeta['page_title'] ?? ''));
                        if ($pageTitle === '') {
                        $save_error = mdw_t('flash.publisher_requires_page_title', 'WPM requires a page_title metadata line.', ['app' => $APP_NAME]);
                        } else {
                            $pagePicture = trim((string)($submittedMeta['page_picture'] ?? ''));
                            if ($pagePicture === '') {
                            $save_error = mdw_t('flash.publisher_requires_page_picture', 'WPM requires a page_picture metadata line.', ['app' => $APP_NAME]);
                            }
                        }
                    }
                    if ($save_error === null) {
                        $requireH2 = !array_key_exists('publisher_require_h2', $MDW_SETTINGS) ? true : !empty($MDW_SETTINGS['publisher_require_h2']);
                        if ($requireH2 && !mdw_md_has_h2($content)) {
                    $save_error = mdw_t('flash.publisher_requires_subtitle', 'WPM requires a subtitle line starting with "##".', ['app' => $APP_NAME]);
                        }
                    }
                }

                if ($save_error === null) {
                    $metaOverrides = [];
                    $fieldCfg = function_exists('mdw_metadata_all_field_configs')
                        ? mdw_metadata_all_field_configs(!empty($MDW_PUBLISHER_MODE))
                        : [];
                    foreach ($fieldCfg as $k => $f) {
                        $kk = strtolower((string)$k);
                        $mdVis = isset($f['markdown_visible']) ? (bool)$f['markdown_visible'] : true;
                        if ($mdVis) continue;
                        $hasExisting = array_key_exists($kk, $existingMeta);
                        $hasSubmitted = array_key_exists($kk, $submittedMeta);
                        if ($hasExisting) {
                            $metaOverrides[$kk] = (string)$existingMeta[$kk];
                        } else if ($hasSubmitted) {
                            $metaOverrides[$kk] = '';
                        }
                    }

                    $publishStateChanged = false;
                    if (!empty($MDW_PUBLISHER_MODE) && $desiredPublishState !== null && $existingPublishState !== null) {
                        $publishStateChanged = $desiredPublishState !== $existingPublishState;
                    }
                    $publishedDateWillChange = false;
                    if ($desiredPublishState !== null) {
                        $metaOverrides['publishstate'] = $desiredPublishState;
                    }
                    if ($desiredPublishState === 'Published' && $existingPublishState !== 'Published') {
                        $submittedPublishedDate = trim((string)($submittedMeta['published_date'] ?? ''));
                        if ($submittedPublishedDate === '') {
                            $metaOverrides['published_date'] = date('Y-m-d');
                            $publishedDateWillChange = true;
                        }
                    }
                    if (!empty($MDW_PUBLISHER_MODE) && ($contentChanged || $publishStateChanged || $publishedDateWillChange)) {
                        $metaOverrides['changedate'] = date('Y-m-d H:i');
                    }
                    // Ensure hidden metadata block at top (creationdate/changedate/date/published_date/publishstate).
                    $opts = !empty($metaOverrides) ? ['set' => $metaOverrides] : [];
                    if (!empty($MDW_PUBLISHER_MODE) && $author !== '') {
                        $settingsOverride = is_array($MDW_SETTINGS) ? $MDW_SETTINGS : [];
                        $settingsOverride['publisher_default_author'] = $author;
                        $opts['settings'] = $settingsOverride;
                    }
                        $content = mdw_hidden_meta_ensure_block($content, $san, $opts);

                        $parentDir = dirname($full);
                        $dirWritable = is_dir($parentDir) && is_writable($parentDir);
                        $fileWritable = is_writable($full);
                        if (!$dirWritable && !$fileWritable) {
                            $save_error = mdw_t('flash.no_write_permissions', 'no write permissions') . ': ' . $parentDir;
                            $save_error .= ' ' . mdw_t(
                                'flash.permissions_hint',
                                'Fix by making this directory writable for the web server/PHP user (chown/chmod; on SELinux also set the right context).'
                            );
                            $diag = mdw_perm_diag($full);
                            if ($diag !== '') $save_error_details = $diag;
                        } else if ($dirWritable) {
                            $tmp = $full . '.tmp';
                            if (file_put_contents($tmp, $content) === false) {
                                $err = error_get_last();
                                if ($fileWritable && file_put_contents($full, $content, LOCK_EX) !== false) {
                                    if ($isAjax) {
                                        header('Content-Type: application/json; charset=utf-8');
                                        echo json_encode(['ok' => true, 'publish_state' => $finalPublishState]);
                                        exit;
                                    }
                                    header('Location: edit.php?file=' . rawurlencode($san) . '&saved=1');
                                    exit;
                                }
                                $save_error = 'Kon tijdelijke file niet schrijven.';
                                if ($err && !empty($err['message'])) $save_error .= ' (' . $err['message'] . ')';
                                $diag = mdw_perm_diag($full);
                                if ($diag !== '') $save_error_details = $diag;
                            } else {
                                if (!rename($tmp, $full)) {
                                    $err = error_get_last();
                                    $save_error = 'Kon originele file niet overschrijven.';
                                    if ($err && !empty($err['message'])) $save_error .= ' (' . $err['message'] . ')';
                                    $diag = mdw_perm_diag($full);
                                    if ($diag !== '') $save_error_details = $diag;
                                } else {
                                    if ($isAjax) {
                                        header('Content-Type: application/json; charset=utf-8');
                                        echo json_encode(['ok' => true, 'publish_state' => $finalPublishState]);
                                        exit;
                                    }
                                    header('Location: edit.php?file=' . rawurlencode($san) . '&saved=1');
                                    exit;
                                }
                            }
                        } else {
                            if (file_put_contents($full, $content, LOCK_EX) === false) {
                                $err = error_get_last();
                                $save_error = 'Kon bestand niet schrijven.';
                                if ($err && !empty($err['message'])) $save_error .= ' (' . $err['message'] . ')';
                                $diag = mdw_perm_diag($full);
                                if ($diag !== '') $save_error_details = $diag;
                            } else {
                                if ($isAjax) {
                                    header('Content-Type: application/json; charset=utf-8');
                                    echo json_encode(['ok' => true, 'publish_state' => $finalPublishState]);
                                    exit;
                                }
                                header('Location: edit.php?file=' . rawurlencode($san) . '&saved=1');
                                exit;
                            }
                        }
                }
            $requested = $san;
            if ($save_error !== null) {
                $use_posted_content = true;
                $posted_content_for_render = $content;
            }
        }
    }
    if ($isAjax) {
        http_response_code(400);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'ok' => false,
            'error' => (string)($save_error ?: 'Save failed.'),
            'details' => $save_error_details,
        ]);
        exit;
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

	$full = mdw_safe_full_path($requested, true);
	if ($use_posted_content && $posted_content_for_render !== '') {
	    $raw             = $posted_content_for_render;
	    $current_content = (string)$raw;
	    $current_title   = mdw_editor_title_from_raw($raw, !empty($MDW_PUBLISHER_MODE));
	    $current_html    = md_to_html($raw, $requested);
	} else if ($full && is_file($full)) {
	    $raw             = file_get_contents($full);
	    $current_content = (string)$raw;
	    $current_title   = mdw_editor_title_from_raw($raw, !empty($MDW_PUBLISHER_MODE));
	    $current_html    = md_to_html($raw, $requested);
	} else {
	    $save_error = 'Bestand niet gevonden.';
	}
} else {
    $current_title = 'Geen bestand geselecteerd';
}

$current_publish_state = 'Concept';
if (!empty($MDW_PUBLISHER_MODE)) {
    $meta = [];
    if ($current_content !== '') {
        mdw_hidden_meta_extract_and_remove_all($current_content, $meta);
    }
    $current_publish_state = mdw_publisher_normalize_publishstate($meta['publishstate'] ?? '');
    if ($current_publish_state === '') $current_publish_state = 'Concept';
}
$current_publish_state_lower = strtolower($current_publish_state);

$rename_slug_value = '';
$rename_prefix_value = '';
if ($requested) {
    $base = basename($requested);
    if (preg_match('/^\\d{2}-\\d{2}-\\d{2}-/', $base, $m)) {
        $rename_prefix_value = $m[0];
        $base = substr($base, strlen($rename_prefix_value));
    }
    $base = preg_replace('/\\.md$/i', '', $base);
    $rename_slug_value = $base;
}

?>
<!DOCTYPE html>
<html lang="<?=h($MDW_LANG)?>" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title><?=h($current_title)?> • md edit</title>

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

<script>
// Bootstrap editor pane widths early (pre-CSS) to avoid layout shift on reload/save.
(function(){
    try {
        const raw = window.__mdwStorageGet('mdw_editor_col_widths');
        if (!raw) return;
        const saved = JSON.parse(raw);
        const ok = (v) => (typeof v === 'string') && /^\d+(\.\d+)?%$/.test(v);
        if (!saved || !ok(saved.left) || !ok(saved.mid) || !ok(saved.right)) return;
        const root = document.documentElement;
        root.style.setProperty('--col-left', saved.left);
        root.style.setProperty('--col-mid', saved.mid);
        root.style.setProperty('--col-right', saved.right);
    } catch {}
})();
</script>

<script>
// Bootstrap editor word wrap early (pre-CSS) to avoid layout shift on reload/save.
(function(){
    try {
        if (window.__mdwStorageGet('mdw_editor_wrap') === '1') {
            document.documentElement.classList.add('mdw-wrap-on');
        }
    } catch {}
})();
</script>

<script>
// Bootstrap line numbers early (pre-CSS) to avoid layout shift on reload/save.
(function(){
    try {
        if (window.__mdwStorageGet('mdw_editor_lines') === '0') {
            document.documentElement.classList.add('mdw-lines-off');
        }
    } catch {}
})();
</script>

<link rel="stylesheet" href="<?=h($STATIC_DIR)?>/ui.css">
<link rel="stylesheet" href="<?=h($STATIC_DIR)?>/markdown.css">
<link rel="stylesheet" href="<?=h($STATIC_DIR)?>/htmlpreview.css">
<link rel="stylesheet" href="<?=h($STATIC_DIR)?>/popicon.css">

<script>
// theme bootstrap (zonder Tailwind)
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

<body class="app-body edit-page <?=h($folderIconClass)?>">
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
                            <?php if ($requested && $WPM_PLUGIN_ACTIVE): ?>
                                <?php $wpm_public_url = mdw_wpm_public_url($requested, $WPM_SITE_BASE); ?>
                                <?php if ($wpm_public_url): ?>
                                    <a class="btn btn-ghost icon-button" href="<?=h($wpm_public_url)?>" target="_blank" rel="noopener noreferrer" aria-label="Open public page" title="Open public page">
                                        <span class="pi pi-externallink"></span>
                                    </a>
                                <?php endif; ?>
                            <?php endif; ?>
	                        <span id="dirtyStar" class="dirty-star" style="display:none;" title="<?=h(mdw_t('edit.unsaved_title','Unsaved changes'))?>">*</span>
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
	                        <span id="headerSecretBadge" class="badge-secret" style="<?= $is_secret_req ? '' : 'display:none;' ?>"><?=h(mdw_t('common.secret','secret'))?></span>
	                    <?php endif; ?>
	                    </div>
	                </div>
	            </div>
            <div class="app-header-actions">
                <span id="offlineIndicator" class="chip offline-chip" hidden aria-live="polite" title="<?=h(mdw_t('common.offline_hint','Offline: changes are stored locally until you are back online.'))?>"><?=h(mdw_t('common.offline','Offline'))?></span>
                <div id="saveStatusChip" class="chip" style="background-color: #166534; color: white; <?= ($saved_flag && !$save_error) ? '' : 'display:none;' ?>"><?=h(mdw_t('common.saved','Saved'))?></div>
                <?php if ($save_error): ?>
                    <div class="chip" style="background-color: var(--danger); color: white;"<?= $save_error_details ? ' title="' . h($save_error_details) . '"' : '' ?>><?=h($save_error)?></div>
                <?php endif; ?>

                    <button id="newMdToggle" type="button" class="btn btn-ghost btn-small">+MD</button>
                    <button id="mobileNavToggle" type="button" class="btn btn-ghost icon-button mobile-nav-toggle" aria-label="<?=h(mdw_t('edit.nav.open_files_aria','Show files'))?>">
                        <span class="pi pi-list"></span>
                    </button>
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
	                                <span><?=h(mdw_t('common.notes','Notes'))?></span>
	                            </div>
	                                <div class="pane-title-actions">
	                                <button type="button" id="explorerCollapseToggle" class="btn btn-ghost icon-button" title="<?=h(mdw_t('edit.nav.collapse_overview','Collapse overview'))?>" aria-label="<?=h(mdw_t('edit.nav.collapse_overview','Collapse overview'))?>">
	                                    <span class="pi pi-leftcaret"></span>
	                                </button>
	                                <div class="pane-subtitle" id="navCount">0 <?=h(mdw_t('common.items','items'))?></div>
	                                <button type="button" id="mobileNavClose" class="btn btn-ghost icon-button mobile-nav-close" aria-label="<?=h(mdw_t('edit.nav.close_files_aria','Close files'))?>">
	                                    <span class="pi pi-cross"></span>
	                                </button>
	                            </div>
	                        </div>
                            <?php if ($requested): ?>
                            <div class="nav-file-actions">
                                <button type="button" id="renameFileBtn" class="btn btn-ghost btn-small" data-auth-superuser="1" <?= $requested ? '' : 'disabled' ?>>
                                    <span class="pi pi-edit"></span>
                                    <span class="btn-label"><?=h(mdw_t('edit.toolbar.rename','Rename'))?></span>
                                </button>
                                <form method="post" action="index.php" id="deleteForm" class="deleteForm" data-file="<?=h($requested ?? '')?>" data-auth-superuser="1">
                                    <input type="hidden" name="action" value="delete">
                                    <input type="hidden" name="file" id="deleteFileInput" value="<?=h($requested ?? '')?>">
                                    <input type="hidden" name="csrf" value="<?=h($CSRF_TOKEN)?>">
                                    <button type="submit" class="btn btn-ghost btn-small" <?= $requested ? '' : 'disabled' ?>>
                                        <span class="pi pi-bin"></span>
                                        <span class="btn-label"><?=h(mdw_t('edit.toolbar.delete','Delete'))?></span>
                                    </button>
                                </form>
                            </div>
                            <?php endif; ?>
	                        <div class="nav-filter-row">
	                            <input id="filterInput" class="input" type="text" placeholder="<?=h(mdw_t('common.filter_placeholder','Filter…'))?>">
	                        </div>
                        <div class="status-text" style="margin-top: 0.35rem;">
                            <?=h(mdw_t('edit.new_md_hint','Use +MD in the top bar to create a new markdown file.'))?>
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
		                                'publisher_mode' => !empty($MDW_PUBLISHER_MODE),
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
	                                <span><?=h(mdw_t('common.markdown','Markdown'))?></span>
	                            </div>
			                            <div class="pane-header-actions">
			                                <?php if (!empty($MDW_PUBLISHER_MODE)): ?>
                                    <button type="submit" form="editor-form" class="btn btn-ghost" id="publishBtn" name="publish_action" value="publish" data-auth-publish="1" <?= (!$requested || $current_publish_state_lower !== 'concept') ? 'disabled' : '' ?> title="<?=h(mdw_t('edit.toolbar.publish_title','Send to processing'))?>" aria-label="<?=h(mdw_t('edit.toolbar.publish_title','Send to processing'))?>">
			                                        <span class="pi pi-upload"></span>
			                                        <span class="btn-label"><?=h(mdw_t('edit.toolbar.publish','Publish'))?></span>
			                                    </button>
			                                    <select id="publishStateSelect" name="publish_state" form="editor-form" class="input" data-auth-superuser="1" <?= $requested ? 'data-auth-superuser-enable="1" disabled' : 'disabled' ?> title="<?=h(mdw_t('edit.publish_state_label','Publish state'))?>" aria-label="<?=h(mdw_t('edit.publish_state_label','Publish state'))?>">
			                                        <?php
			                                            $stateOptions = [
			                                                'Concept' => mdw_t('edit.publish_state.concept', 'Concept'),
			                                                'Processing' => mdw_t('edit.publish_state.processing', 'Processing'),
			                                                'Published' => mdw_t('edit.publish_state.published', 'Published'),
			                                            ];
			                                            foreach ($stateOptions as $val => $label):
			                                                $selected = ($current_publish_state === $val) ? 'selected' : '';
			                                        ?>
			                                            <option value="<?=h($val)?>" <?= $selected ?>><?=h($label)?></option>
			                                        <?php endforeach; ?>
			                                    </select>
			                                <?php endif; ?>
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
                        <?php if (!empty($MDW_PUBLISHER_MODE)): ?>
                            <input type="hidden" name="publish_state_override" id="publishStateOverride" value="0">
                        <?php endif; ?>

                        <div class="editor-toolbar">
                            <div class="editor-toolbar-left">
                                <button type="submit" form="editor-form" class="btn btn-ghost" id="saveBtn">
                                    <span class="pi pi-floppydisk"></span>
                                    <span class="btn-label"><?=h(mdw_t('edit.toolbar.save','Save'))?></span>
                                </button>
                                <select id="headingSelect" class="input editor-toolbar-select" aria-label="<?=h(mdw_t('edit.toolbar.heading','Heading'))?>">
                                    <option value="" selected>H</option>
                                    <option value="1">H1</option>
                                    <option value="2">H2</option>
                                    <option value="3">H3</option>
                                    <option value="4">H4</option>
                                    <option value="5">H5</option>
                                    <option value="6">H6</option>
                                </select>
                                <button type="button" id="formatBoldBtn" class="btn btn-ghost btn-small format-btn" aria-label="<?=h(mdw_t('edit.toolbar.bold','Bold'))?>">
                                    <span class="format-letter">B</span>
                                </button>
                                <button type="button" id="formatItalicBtn" class="btn btn-ghost btn-small format-btn" aria-label="<?=h(mdw_t('edit.toolbar.italic','Italic'))?>">
                                    <span class="format-letter format-italic">I</span>
                                </button>
                                <button type="button" id="formatUnderlineBtn" class="btn btn-ghost btn-small format-btn" aria-label="<?=h(mdw_t('edit.toolbar.underline','Underline'))?>">
                                    <span class="format-letter format-underline">U</span>
                                </button>
                                <select id="alignSelect" class="input editor-toolbar-select editor-align-select" aria-label="<?=h(mdw_t('edit.toolbar.align','Align'))?>">
                                    <option value="left">L</option>
                                    <option value="center">C</option>
                                    <option value="right">R</option>
                                </select>
                                <button type="button" id="formatBlockquoteBtn" class="btn btn-ghost btn-small format-btn" aria-label="<?=h(mdw_t('edit.toolbar.blockquote','Blockquote'))?>">
                                    <span class="pi pi-quote"></span>
                                </button>
                                <button type="button" id="formatOrderedListBtn" class="btn btn-ghost btn-small format-btn" aria-label="<?=h(mdw_t('edit.toolbar.ordered_list','Ordered list'))?>">
                                    <span class="format-letter">1.</span>
                                </button>
                                <button type="button" id="formatUnorderedListBtn" class="btn btn-ghost btn-small format-btn" aria-label="<?=h(mdw_t('edit.toolbar.unordered_list','Unordered list'))?>">
                                    <span class="pi pi-list"></span>
                                </button>
                                <button type="button" id="insertTableBtn" class="btn btn-ghost btn-small format-btn" aria-label="<?=h(mdw_t('edit.toolbar.table','Insert table'))?>">
                                    <span class="icon-table-grid" aria-hidden="true"><span></span><span></span><span></span><span></span></span>
                                </button>
                                <button type="button" id="btnRevert" class="btn btn-ghost">
                                    <span class="pi pi-recycle"></span>
                                    <span class="btn-label"><?=h(mdw_t('edit.toolbar.revert','Revert'))?></span>
                                </button>
                            </div>
                        </div>
                        <button type="button" id="addLinkBtn" class="btn btn-ghost" hidden>
                            <span class="pi pi-linkchain"></span>
                            <span class="btn-label"><?=h(mdw_t('edit.toolbar.link','Link'))?></span>
                        </button>
                        <button type="button" id="addImageBtn" class="btn btn-ghost" hidden>
                            <span class="pi pi-image"></span>
                            <span class="btn-label"><?=h(mdw_t('edit.toolbar.image','Image'))?></span>
                        </button>

                        <div class="editor-body">
                            <div class="editor-lines" id="lineNumbers"></div>
                            <textarea id="editor" name="content" class="editor-textarea"
                                spellcheck="false"><?=htmlspecialchars($current_content, ENT_QUOTES, 'UTF-8')?></textarea>
                        </div>

                        <footer class="editor-footer">
                            <div class="editor-footer-right">
                                <span id="liveStatus" class="status-text"></span>
                                <div id="saveErrorPanel" class="save-error-panel" <?= $save_error ? '' : 'hidden' ?>>
                                    <div id="saveErrorMessage" class="save-error-message"><?=h($save_error ?? '')?></div>
                                    <details id="saveErrorDetailsWrap" class="save-error-details" <?= $save_error_details ? '' : 'hidden' ?>>
                                        <summary><?=h(mdw_t('common.details','Details'))?></summary>
                                        <code id="saveErrorDetails"><?=h($save_error_details ?? '')?></code>
                                    </details>
                                </div>
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
                                <span><?=h(mdw_t('edit.preview_title','HTML preview'))?></span>
                            </div>
                            <div class="pane-header-actions">
                                <button type="button" id="exportHtmlBtn" class="btn btn-ghost" title="<?=h(mdw_t('edit.preview.export_title','Download a plain HTML export'))?>" <?= $requested ? '' : 'disabled' ?> data-auth-superuser="1">
                                    <span class="pi pi-download"></span>
                                    <span class="btn-label"><?=h(mdw_t('edit.preview.export_btn','HTML download'))?></span>
                                </button>
                                <button type="button" id="copyHtmlBtn" class="btn btn-ghost copy-btn" title="<?=h(mdw_t('edit.preview.copy_title','Copy plain HTML to clipboard'))?>" <?= $requested ? '' : 'disabled' ?> data-copy-buttons="1" <?= $copyButtonsEnabled ? '' : 'hidden' ?> data-auth-superuser="1">
                                    <span class="btn-icon-stack">
                                        <span class="pi pi-copy copy-icon"></span>
                                        <span class="pi pi-checkmark copy-check"></span>
                                    </span>
                                    <span class="btn-label"><?=h(mdw_t('edit.preview.copy_btn','Copy HTML'))?></span>
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

        <div class="modal-overlay" id="renameModalOverlay" hidden></div>
        <div class="modal" id="renameModal" role="dialog" aria-modal="true" aria-labelledby="renameModalTitle" hidden>
            <div class="modal-header">
                <div class="modal-title" id="renameModalTitle"><?=h(mdw_t('rename_modal.title','Rename file'))?></div>
                <button type="button" class="btn btn-ghost icon-button" id="renameModalClose" aria-label="<?=h(mdw_t('common.close','Close'))?>">
                    <span class="pi pi-cross"></span>
                </button>
            </div>
            <form method="post" action="edit.php" id="renameModalForm">
                <input type="hidden" name="action" value="rename">
                <input type="hidden" name="file" value="<?=h($requested ?? '')?>">
                <input type="hidden" name="csrf" value="<?=h($CSRF_TOKEN)?>">
                <input type="hidden" name="auth_role" id="renameAuthRole" value="">
                <input type="hidden" name="auth_token" id="renameAuthToken" value="">
                <div class="modal-body">
                    <?php if ($rename_prefix_value !== ''): ?>
                        <div class="status-text" style="margin-bottom: 0.35rem;">
                            <?=h(mdw_t('rename_modal.prefix_hint','Date prefix kept:'))?> <code><?=h($rename_prefix_value)?></code>
                        </div>
                    <?php endif; ?>
                    <label class="modal-label" for="renameModalSlug"><?=h(mdw_t('rename_modal.slug_label','New slug'))?></label>
                    <div style="display:flex; align-items:center; gap: 0.4rem;">
                        <input id="renameModalSlug" name="new_slug" class="input" type="text" value="<?=h($rename_slug_value)?>" placeholder="<?=h(mdw_t('rename_modal.slug_placeholder','new-title'))?>" data-slug-min="<?=MDW_NEW_MD_SLUG_MIN?>" data-slug-max="<?=MDW_NEW_MD_SLUG_MAX?>" data-prefix="<?=h($rename_prefix_value)?>" required>
                        <span class="status-text">.md</span>
                    </div>
                    <div id="renameModalStatus" class="status-text" style="margin-top: 0.35rem;"></div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-ghost" id="renameModalCancel"><?=h(mdw_t('rename_modal.cancel','Cancel'))?></button>
                    <button type="submit" class="btn btn-primary" id="renameModalConfirm"><?=h(mdw_t('rename_modal.confirm','Rename'))?></button>
                </div>
            </form>
        </div>

        <div class="modal-overlay" id="errorModalOverlay" hidden></div>
        <div class="modal modal-small" id="errorModal" role="dialog" aria-modal="true" aria-labelledby="errorModalTitle" hidden>
            <div class="modal-header">
                <div class="modal-title" id="errorModalTitle"><?=h(mdw_t('error_modal.title','Something went wrong'))?></div>
                <button type="button" class="btn btn-ghost icon-button" id="errorModalClose" aria-label="<?=h(mdw_t('common.close','Close'))?>">
                    <span class="pi pi-cross"></span>
                </button>
            </div>
            <div class="modal-body">
                <div id="errorModalMessage" class="status-text" style="color: var(--text); font-size: 0.95rem;"></div>
                <details id="errorModalDetailsWrap" class="save-error-details" hidden>
                    <summary><?=h(mdw_t('common.details','Details'))?></summary>
                    <code id="errorModalDetails"></code>
                </details>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-primary" id="errorModalOk"><?=h(mdw_t('common.close','Close'))?></button>
            </div>
        </div>

		<div class="modal-overlay" id="linkModalOverlay" hidden></div>
		<div class="modal" id="linkModal" role="dialog" aria-modal="true" aria-labelledby="linkModalTitle" hidden>
		    <div class="modal-header">
		        <div class="modal-title" id="linkModalTitle"><?=h(mdw_t('link_modal.title','Add link'))?></div>
		        <button type="button" class="btn btn-ghost icon-button" id="linkModalClose" aria-label="<?=h(mdw_t('common.close','Close'))?>">
		            <span class="pi pi-cross"></span>
		        </button>
			</div>
	        <div class="modal-body">
	            <div class="modal-row">
	                <label class="radio">
	                    <input type="radio" name="linkMode" value="internal" checked>
	                <span><?=h(mdw_t('link_modal.mode_internal','Internal'))?></span>
	            </label>
	            <label class="radio">
	                <input type="radio" name="linkMode" value="external">
	                <span><?=h(mdw_t('link_modal.mode_external','External'))?></span>
	            </label>
                <label class="radio">
                    <input type="radio" name="linkMode" value="footnote">
                    <span><?=h(mdw_t('link_modal.mode_footnote','Footnote'))?></span>
                </label>
                <label class="radio">
                    <input type="radio" name="linkMode" value="youtube">
                    <span><?=h(mdw_t('link_modal.mode_youtube','YouTube'))?></span>
                </label>
	        </div>

	        <div id="linkModalInternal" class="link-modal-section">
	            <div class="link-picker-filter-row">
	                <input id="linkPickerFilter" type="text" class="input" placeholder="<?=h(mdw_t('link_modal.search_notes','Search notes...'))?>">
	                <button type="button" class="btn btn-ghost icon-button" id="linkPickerFilterClear" aria-label="<?=h(mdw_t('link_modal.clear_search_aria','Clear search'))?>" style="display:none;">
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
	                                                <span class="badge-secret"><?=h(mdw_t('common.secret','secret'))?></span>
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
	                    $renderPickerGroup(mdw_t('common.root','Root'), $rootEntries);

	                    foreach ($dirMap as $dirname => $entries) {
	                        $renderPickerGroup($dirname, $entries);
	                    }
	                ?>
	            </div>
	        </div>

	        <div id="linkModalExternal" class="link-modal-section" hidden>
	            <div class="modal-field">
	                <label class="modal-label" for="externalLinkText"><?=h(mdw_t('link_modal.link_text_label','Link text'))?></label>
	                <input id="externalLinkText" type="text" class="input" placeholder="<?=h(mdw_t('link_modal.link_text_placeholder','e.g. Gold spot price'))?>">
	            </div>
	            <div class="modal-field">
	                <label class="modal-label" for="externalLinkUrl"><?=h(mdw_t('link_modal.url_label','URL'))?></label>
	                <input id="externalLinkUrl" type="url" class="input" placeholder="<?=h(mdw_t('link_modal.url_placeholder','https://example.com/'))?>">
	            </div>
	        </div>
            <div id="linkModalFootnote" class="link-modal-section" hidden>
                <div class="modal-field">
                    <label class="modal-label" for="footnoteLinkText"><?=h(mdw_t('link_modal.footnote_text_label','Footnote text'))?></label>
                    <input id="footnoteLinkText" type="text" class="input" placeholder="<?=h(mdw_t('link_modal.footnote_text_placeholder','e.g. Tweede Kamer'))?>">
                </div>
                <div class="modal-field">
                    <label class="modal-label" for="footnoteLinkUrl"><?=h(mdw_t('link_modal.footnote_url_label','Footnote URL'))?></label>
                    <input id="footnoteLinkUrl" type="url" class="input" placeholder="<?=h(mdw_t('link_modal.url_placeholder','https://example.com/'))?>">
                </div>
                <div class="modal-field">
                    <label class="modal-label" for="footnoteLinkTitle"><?=h(mdw_t('link_modal.footnote_title_label','Footnote title (optional)'))?></label>
                    <input id="footnoteLinkTitle" type="text" class="input" placeholder="<?=h(mdw_t('link_modal.footnote_title_placeholder','e.g. Ongekend onrecht'))?>">
                </div>
            </div>
	        <div id="linkModalYoutube" class="link-modal-section" hidden>
	            <div class="modal-field">
	                <label class="modal-label" for="youtubeLinkInput"><?=h(mdw_t('link_modal.youtube_label','YouTube ID or URL'))?></label>
	                <input id="youtubeLinkInput" type="text" class="input" placeholder="<?=h(mdw_t('link_modal.youtube_placeholder','yob8SkcOKaYv or https://youtu.be/'))?>">
	            </div>
	        </div>
	    </div>
		    <div class="modal-footer">
		        <button type="button" class="btn btn-ghost" id="linkModalCancel"><?=h(mdw_t('common.cancel','Cancel'))?></button>
		        <button type="button" class="btn btn-primary" id="linkModalInsert" disabled><?=h(mdw_t('link_modal.insert','Insert link'))?></button>
		    </div>
		</div>

			<div class="modal-overlay" id="imageModalOverlay" hidden></div>
			<div class="modal" id="imageModal" role="dialog" aria-modal="true" aria-labelledby="imageModalTitle" hidden>
			    <div class="modal-header">
			        <div class="modal-title" id="imageModalTitle"><?=h(mdw_t('image_modal.title','Insert image'))?></div>
		        <button type="button" class="btn btn-ghost icon-button" id="imageModalClose" aria-label="<?=h(mdw_t('common.close','Close'))?>">
		            <span class="pi pi-cross"></span>
		        </button>
		    </div>
		    <div class="modal-body">
		        <input type="hidden" id="imageCsrf" value="<?=h($CSRF_TOKEN)?>">
		        <div class="modal-row" style="gap: 0.6rem;">
		            <div style="display:flex; gap:0.6rem; align-items:center;">
		                <input id="imageFilter" type="text" class="input" placeholder="<?=h(mdw_t('image_modal.search_images','Search images...'))?>" style="flex: 1 1 auto;">
		                <button type="button" class="btn btn-ghost btn-small" id="imageFilterClear" aria-label="<?=h(mdw_t('common.clear','Clear'))?>"><?=h(mdw_t('common.clear','Clear'))?></button>
		            </div>
		        </div>

		        <div class="modal-row" style="gap: 0.6rem;">
		            <div style="display:flex; gap:0.6rem; align-items:center; flex-wrap:wrap;">
		                <input id="imageUploadInput" type="file" accept="image/*" style="display:none;">
		                <button type="button" class="btn btn-ghost btn-small" id="imagePickBtn"><?=h(mdw_t('image_modal.choose_file','Choose file'))?></button>
		                <span class="status-text" id="imagePickLabel"><?=h(mdw_t('image_modal.no_file','No file chosen'))?></span>
		                <button type="button" class="btn btn-primary btn-small" id="imageUploadBtn"><?=h(mdw_t('image_modal.upload','Upload'))?></button>
		            </div>
		            <div style="display:flex; gap:0.6rem; align-items:center;">
		                <input id="imageAltInput" type="text" class="input" placeholder="<?=h(mdw_t('image_modal.alt_placeholder','Alt text (optional)'))?>" style="flex: 1 1 auto;">
		            </div>
		            <div class="status-text" id="imageStatus" style="min-height: 1.2em;"></div>
		        </div>

		        <div class="modal-row" style="gap: 0.6rem;">
		            <div id="imageList" style="max-height: 38vh; overflow:auto; border: 1px solid var(--border-soft); border-radius: 0.75rem; padding: 0.5rem;"></div>
		            <div class="status-text" style="margin-top: 0.25rem;">
		                <?=h(mdw_t('image_modal.tip_insert','Tip: click an image to insert'))?> <code>![]({{ }})</code> <?=h(mdw_t('image_modal.tip_at_cursor','at the cursor.'))?>
		            </div>
		        </div>
			    </div>
			<div class="modal-footer" style="display:flex; justify-content:flex-end; gap:0.5rem;">
			        <button type="button" class="btn btn-ghost btn-small" id="imageModalCancel"><?=h(mdw_t('common.close','Close'))?></button>
			    </div>
			</div>

			<div class="modal-overlay no-blur" id="replaceModalOverlay" hidden></div>
			<div class="modal modal-small" id="replaceModal" role="dialog" aria-modal="true" aria-labelledby="replaceModalTitle" hidden>
			    <div class="modal-header">
			        <div class="modal-title" id="replaceModalTitle"><?=h(mdw_t('replace_modal.title','Replace'))?></div>
			        <button type="button" class="btn btn-ghost icon-button" id="replaceModalClose" aria-label="<?=h(mdw_t('common.close','Close'))?>">
			            <span class="pi pi-cross"></span>
			        </button>
			    </div>
			    <div class="modal-body">
			        <div class="modal-field">
			            <label class="modal-label" for="replaceFindInput"><?=h(mdw_t('replace_modal.find_label','Find'))?></label>
			            <input id="replaceFindInput" type="text" class="input" autocomplete="off">
			        </div>
			        <div class="modal-field">
			            <label class="modal-label" for="replaceWithInput"><?=h(mdw_t('replace_modal.replace_label','Replace with'))?></label>
			            <input id="replaceWithInput" type="text" class="input" autocomplete="off">
			        </div>
			        <div class="status-text" id="replaceModalStatus" style="min-height: 1.1em;"></div>
			    </div>
			    <div class="modal-footer" style="display:flex; justify-content:flex-end; gap:0.5rem;">
			        <button type="button" class="btn btn-ghost btn-small" id="replaceAllBtn" disabled><?=h(mdw_t('replace_modal.replace_all','Replace all'))?></button>
			        <button type="button" class="btn btn-primary btn-small" id="replaceNextBtn" disabled><?=h(mdw_t('replace_modal.replace_next','Replace next'))?></button>
			    </div>
			</div>

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
								<label class="status-text" for="authLoginPasswordToggle" style="margin-top: 0.35rem; display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer;">
									<input id="authLoginPasswordToggle" type="checkbox">
									<span><?=h(mdw_t('auth.show_password','Show password'))?></span>
								</label>
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
				                    <div class="modal-label"><?=h(mdw_t('theme.editor_view.title','Editor view'))?></div>
				                    <div class="modal-row" style="gap: 0.6rem; margin: 0; flex-wrap: wrap;">
				                        <button type="button" id="wrapToggle" class="btn btn-ghost btn-small toggle-btn" title="<?=h(mdw_t('edit.toolbar.wrap_title','Word wrap'))?>" aria-pressed="false" aria-label="<?=h(mdw_t('edit.toolbar.wrap_title','Word wrap'))?>">
				                            <span class="toggle-box" aria-hidden="true"><span class="pi pi-checkmark"></span></span>
				                            <span class="btn-label"><?=h(mdw_t('edit.toolbar.wrap','Wrap'))?></span>
				                        </button>
				                        <button type="button" id="lineNumbersToggle" class="btn btn-ghost btn-small toggle-btn" title="<?=h(mdw_t('edit.toolbar.lines_title','Line numbers'))?>" aria-pressed="true" aria-label="<?=h(mdw_t('edit.toolbar.lines_title','Line numbers'))?>">
				                            <span class="toggle-box" aria-hidden="true"><span class="pi pi-checkmark"></span></span>
				                            <span class="btn-label"><?=h(mdw_t('edit.toolbar.lines','Lines'))?></span>
				                        </button>
				                    </div>
				                </div>

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

				            <div class="modal-field">
				                <label class="modal-label" for="offlineDelaySelect"><?=h(mdw_t('theme.offline_delay.label','Offline indicator delay'))?></label>
				                <select id="offlineDelaySelect" class="input" style="width: 100%;">
				                    <?php foreach ([1, 2, 3, 5, 10, 15, 20, 30, 45, 60] as $i): ?>
				                        <option value="<?= $i ?>"><?=h(mdw_t('theme.offline_delay.option_minutes','{n} min', ['n' => $i]))?></option>
				                    <?php endforeach; ?>
				                </select>
				                <div class="status-text" style="margin-top: 0.35rem;">
				                    <?=h(mdw_t('theme.offline_delay.hint','Wait before showing Offline after network errors.'))?>
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
				                <label class="modal-label" for="folderIconStyleSelect"><?=h(mdw_t('theme.folder_icons.label','Folder icons'))?></label>
				                <select id="folderIconStyleSelect" class="input" data-auth-superuser-enable="1">
				                    <option value="folder" <?= $folderIconStyle === 'folder' ? 'selected' : '' ?>><?=h(mdw_t('theme.folder_icons.option_folder','Folder'))?></option>
				                    <option value="caret" <?= $folderIconStyle === 'caret' ? 'selected' : '' ?>><?=h(mdw_t('theme.folder_icons.option_caret','Caret'))?></option>
				                </select>
				                <div id="folderIconStyleStatus" class="status-text" style="margin-top: 0.35rem;">
				                    <?=h(mdw_t('theme.folder_icons.hint','Saved for all users.'))?>
				                </div>
				            </div>

				            <div class="modal-field" data-auth-superuser="1">
				                <div class="modal-label"><?=h(mdw_t('theme.permissions.title','Permissions'))?></div>
				                <label style="display:flex; align-items:center; gap:0.5rem; margin-top: 0.35rem;">
				                    <input id="allowUserPublishToggle" type="checkbox" <?= !empty($MDW_SETTINGS['allow_user_publish']) ? 'checked' : '' ?> data-auth-superuser-enable="1">
				                    <span class="status-text"><?=h(mdw_t('theme.permissions.allow_user_publish','Allow users to publish'))?></span>
				                </label>
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
				                <div class="modal-field">
				                    <label class="modal-label" for="themeCustomCss"><?=h(mdw_t('theme.overrides.custom_css_label','Custom CSS'))?></label>
				                    <textarea id="themeCustomCss" class="input" rows="6" placeholder="<?=h(mdw_t('theme.overrides.custom_css_placeholder','e.g. .callout { padding: 12px; border-radius: 10px; }'))?>"></textarea>
				                    <div class="status-text" style="margin-top: 0.35rem;">
				                        <?=h(mdw_t('theme.overrides.custom_css_hint','Applies to the HTML preview and wet HTML export.'))?>
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
	window.CURRENT_FILE = <?= json_encode($requested ?? '') ?>;
	window.initialContent = <?= json_encode($current_content ?? '') ?>;
	window.IS_SECRET_AUTHENTICATED = <?= json_encode(is_secret_authenticated()) ?>;
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
