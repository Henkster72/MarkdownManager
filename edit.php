<?php
/*******************************
 * MarkdownManager v0.1
 * - Static assets in STATIC_DIR (CSS/JS/font)
 * - shared security + secret_mds logic
 *******************************/

require __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/i18n.php';
require_once __DIR__ . '/new_md_modal.php';

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
    return rtrim($siteBase, '/') . '/' . trim($safePath, '/') . '/';
}

[$WPM_BASE_DOMAIN, $WPM_SITE_BASE] = mdw_wpm_base_info();
$WPM_PLUGIN_ACTIVE = false;
if ($WPM_BASE_DOMAIN !== null) {
    $pluginsDir = env_path('PLUGINS_DIR', __DIR__ . '/plugins', __DIR__);
    if (is_file(rtrim($pluginsDir, "/\\") . '/google_search_plugin.php')) {
        $WPM_PLUGIN_ACTIVE = true;
    }
}

require_once __DIR__ . '/explorer_view.php';
require_once __DIR__ . '/explorer_view_basic.php';
$github_pages_plugin_loaded = false;
$aw_ssg_template_plugin_loaded = false;
$github_pages_env_ready = false;
$github_pages_plugins = explorer_view_get_enabled_plugins([
    'page' => 'edit',
    'project_dir' => __DIR__,
    'plugins_enabled' => true,
]);
foreach ($github_pages_plugins as $plugin) {
    $pluginId = (string)($plugin['id'] ?? '');
    if ($pluginId === 'github_pages_export') {
        $github_pages_plugin_loaded = true;
    } else if ($pluginId === 'aw_ssg_template_export') {
        $aw_ssg_template_plugin_loaded = true;
    }
}
if ($github_pages_plugin_loaded) {
    $github_token = trim((string)env_str('GITHUB_TOKEN', ''));
    $github_export_dir = trim((string)env_str('MDM_EXPORT_DIR', ''));
    $github_pages_env_ready = ($github_token !== '' && $github_export_dir !== '');
}

/* ESCAPE */
function h($s){ return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); }

function mdw_json_for_script($value) {
    return json_encode(
        $value,
        JSON_UNESCAPED_SLASHES
        | JSON_UNESCAPED_UNICODE
        | JSON_HEX_TAG
        | JSON_HEX_AMP
        | JSON_HEX_APOS
        | JSON_HEX_QUOT
    );
}

function mdw_section_snippet_label($filename) {
    $base = pathinfo((string)$filename, PATHINFO_FILENAME);
    $base = preg_replace('/^section[_-]*/i', 'sectie_', $base);
    $base = str_replace(['_', '-'], ' ', (string)$base);
    $base = trim((string)preg_replace('/\s+/', ' ', $base));
    return $base !== '' ? $base : (string)$filename;
}

function mdw_section_snippets($dir) {
    if (!is_string($dir) || !is_dir($dir)) return [];
    $items = @scandir($dir);
    if (!is_array($items)) return [];
    $snippets = [];
    foreach ($items as $item) {
        if ($item === '.' || $item === '..' || str_starts_with($item, '.')) continue;
        $path = rtrim($dir, "/\\") . DIRECTORY_SEPARATOR . $item;
        if (!is_file($path)) continue;
        $ext = strtolower((string)pathinfo($item, PATHINFO_EXTENSION));
        if (!in_array($ext, ['html', 'md', 'txt'], true)) continue;
        if ($ext === 'html') {
            $content = '{% include "' . $item . '" %}';
        } else {
            $content = @file_get_contents($path);
            if (!is_string($content) || trim($content) === '') continue;
        }
        $snippets[] = [
            'label' => mdw_section_snippet_label($item),
            'snippet' => $content,
        ];
    }
    usort($snippets, fn($a, $b) => strcasecmp((string)($a['label'] ?? ''), (string)($b['label'] ?? '')));
    return $snippets;
}

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
$TOOLS_DIR = 'tools';
function mdw_static_asset($file) {
    global $STATIC_DIR;
    $file = ltrim((string)$file, "/\\");
    $base = mdw_asset_relative_path('static_path', 'STATIC_PATH', $STATIC_DIR);
    $url = rtrim($base, "/\\") . '/' . $file;
    $path = mdw_asset_filesystem_path('static_path', 'STATIC_PATH', $STATIC_DIR) . '/' . $file;
    $mtime = is_file($path) ? @filemtime($path) : false;
    return $mtime ? ($url . '?v=' . rawurlencode((string)$mtime)) : $url;
}
$themesList = list_available_themes($THEMES_DIR);
$META_CFG = mdw_metadata_load_config();
$META_PUBLISHER_CFG = mdw_metadata_load_publisher_config();
$MDW_SETTINGS = (isset($META_CFG['_settings']) && is_array($META_CFG['_settings'])) ? $META_CFG['_settings'] : [];
$MDW_PUBLISHER_MODE = !empty($MDW_SETTINGS['publisher_mode']);
if ($WPM_SITE_BASE === null && $MDW_PUBLISHER_MODE) {
    $requestHost = trim((string)($_SERVER['HTTP_HOST'] ?? ''));
    if (preg_match('/^[A-Za-z0-9.-]+(?::\d+)?$/', $requestHost)) {
        $WPM_SITE_BASE = 'https://' . $requestHost;
    }
}
$copyButtonsEnabled = !array_key_exists('copy_buttons_enabled', $MDW_SETTINGS) || !empty($MDW_SETTINGS['copy_buttons_enabled']);
$copyIncludeMeta = !array_key_exists('copy_include_meta', $MDW_SETTINGS) || !empty($MDW_SETTINGS['copy_include_meta']);
$copyHtmlMode = isset($MDW_SETTINGS['copy_html_mode']) ? trim((string)$MDW_SETTINGS['copy_html_mode']) : 'dry';
if (!in_array($copyHtmlMode, ['dry', 'medium', 'wet'], true)) $copyHtmlMode = 'dry';
$exportClassPrefix = isset($MDW_SETTINGS['export_class_prefix']) ? trim((string)$MDW_SETTINGS['export_class_prefix']) : '';
$exportClassPrefix = preg_replace('/[^A-Za-z0-9_-]+/', '', (string)$exportClassPrefix);
if (is_string($exportClassPrefix) && strlen($exportClassPrefix) > 24) $exportClassPrefix = substr($exportClassPrefix, 0, 24);
$jinjaMetaPrefix = mdw_normalize_jinja_meta_prefix($MDW_SETTINGS['jinja_meta_prefix'] ?? 'page_');
$tocMenu = isset($MDW_SETTINGS['toc_menu']) ? strtolower(trim((string)$MDW_SETTINGS['toc_menu'])) : 'inline';
if (!in_array($tocMenu, ['inline', 'left', 'right'], true)) $tocMenu = 'inline';
$tocExportStyle = isset($MDW_SETTINGS['toc_export_style']) ? strtolower(trim((string)$MDW_SETTINGS['toc_export_style'])) : 'list';
if (!in_array($tocExportStyle, ['list', 'flat_links'], true)) $tocExportStyle = 'list';
$tocButtonEnabled = !empty($MDW_SETTINGS['toc_button_enabled']);
$postDateFormat = isset($MDW_SETTINGS['post_date_format']) ? trim((string)$MDW_SETTINGS['post_date_format']) : 'mdy_short';
if (!in_array($postDateFormat, ['mdy_short', 'dmy_long'], true)) $postDateFormat = 'mdy_short';
$postDateAlign = isset($MDW_SETTINGS['post_date_align']) ? trim((string)$MDW_SETTINGS['post_date_align']) : 'left';
if (!in_array($postDateAlign, ['left', 'center', 'right'], true)) $postDateAlign = 'left';
$folderIconStyle = isset($MDW_SETTINGS['folder_icon_style']) ? strtolower(trim((string)$MDW_SETTINGS['folder_icon_style'])) : 'folder';
if ($folderIconStyle !== 'caret') $folderIconStyle = 'folder';
$folderIconClass = $folderIconStyle === 'caret' ? 'folder-icons-caret' : 'folder-icons-folder';
$paneHeaderOrder = isset($MDW_SETTINGS['pane_header_order']) ? strtolower(trim((string)$MDW_SETTINGS['pane_header_order'])) : 'actions_left';
if (!in_array($paneHeaderOrder, ['actions_left', 'title_left'], true)) $paneHeaderOrder = 'actions_left';
$indexDualPaneEnabled = !array_key_exists('index_dual_pane_overview', $MDW_SETTINGS) || !empty($MDW_SETTINGS['index_dual_pane_overview']);
$hideMarkdownEditor = !empty($MDW_SETTINGS['hide_markdown_editor']);
$customFormat = mdw_custom_format_normalize($MDW_SETTINGS['custom_format'] ?? null);
$customFormatCss = !empty($customFormat['custom_css']);
$customFormatSections = !empty($customFormat['sections']);
$instanceFontAssets = mdw_font_assets_normalize($MDW_SETTINGS['font_assets'] ?? []);
$assetStaticPath = mdw_asset_relative_path('static_path', 'STATIC_PATH', $STATIC_DIR);
$assetImagesPath = mdw_asset_relative_path('images_path', 'IMAGES_PATH', $IMAGES_DIR);
$appLogoFile = mdw_app_logo_normalize($MDW_SETTINGS['app_logo'] ?? '');
$appLogoUrl = $appLogoFile === '' ? '' : rtrim($assetImagesPath, '/') . '/' . implode('/', array_map('rawurlencode', explode('/', $appLogoFile)));
$internalLinkPrefix = isset($MDW_SETTINGS['internal_link_prefix']) ? trim((string)$MDW_SETTINGS['internal_link_prefix']) : '';
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

function mdw_title_from_path($path) {
    $path = trim((string)$path);
    if ($path === '') return '';
    $path = str_replace("\\", "/", $path);
    $base = basename($path);
    $base = preg_replace('/\.md$/i', '', $base);
    $base = str_replace(['_', '-'], ' ', $base);
    $base = preg_replace('/\s+/', ' ', $base);
    return trim($base);
}

function mdw_clean_page_title_value($value) {
    $value = trim((string)$value);
    if ($value === '') return '';
    if (preg_match('/^(.*?)\}\s*\{[A-Za-z][A-Za-z0-9_-]*\s*:/', $value, $m)) {
        $value = $m[1];
    }
    return trim($value);
}

function mdw_editor_title_from_raw($raw, $publisherMode = false, $filePath = '') {
    $raw = (string)$raw;
    $fallback = extract_title($raw);
    if (!$publisherMode) return $fallback;
    if (!function_exists('mdw_hidden_meta_extract_and_remove_all')) return $fallback;
    $meta = [];
    mdw_hidden_meta_extract_and_remove_all($raw, $meta);
    $pageTitle = mdw_clean_page_title_value($meta['page_title'] ?? '');
    if ($pageTitle !== '') return $pageTitle;
    $fileTitle = mdw_title_from_path($filePath);
    return $fileTitle !== '' ? $fileTitle : $fallback;
}

function mdw_link_picker_is_linkable_note($path) {
    $path = trim(str_replace('\\', '/', (string)$path));
    if ($path === '' || str_starts_with($path, '.')) return false;
    $parts = array_values(array_filter(explode('/', $path), static fn($part) => $part !== ''));
    if (empty($parts)) return false;
    $helperFolders = [
        'bin', 'deploy', 'docs', 'example-notes', 'plugins', 'sections', 'tests', 'tools',
    ];
    foreach (array_slice($parts, 0, -1) as $folder) {
        if (in_array(strtolower($folder), $helperFolders, true)) return false;
    }
    $basename = strtolower((string)end($parts));
    if (in_array($basename, [
        'agents.md', 'changelog.md', 'readme.md', 'tutorial_markdowneditor.md', 'voorbeeld_markdown.md',
    ], true)) return false;
    return preg_match('/^(?:macro|section)[_-]/i', $basename) !== 1;
}

function mdw_link_picker_title($path, $fallbackBasename) {
    $fullPath = __DIR__ . '/' . ltrim(str_replace('\\', '/', (string)$path), '/');
    $raw = is_file($fullPath) ? @file_get_contents($fullPath) : false;
    if (is_string($raw)) {
        return mdw_editor_title_from_raw($raw, !empty($GLOBALS['MDW_PUBLISHER_MODE']), (string)$path);
    }
    return mdw_title_from_path($fallbackBasename);
}

/* DATE PARSE */
function parse_ymd_from_filename($basename) {
    if (preg_match('/^(\d{2})-(\d{2})-(\d{2})-/', $basename, $m)) {
        return [$m[1], $m[2], $m[3]];
    }
    return [null, null, null];
}

function compare_entries_desc_date($a, $b) {
    global $MDW_PUBLISHER_MODE;

    if (!empty($MDW_PUBLISHER_MODE)) {
        $dateA = mdw_entry_publisher_sort_date_key($a);
        $dateB = mdw_entry_publisher_sort_date_key($b);
        if ($dateA !== '' && $dateB !== '' && $dateA !== $dateB) return strcmp($dateB, $dateA);
        if ($dateA !== '' && $dateB === '') return -1;
        if ($dateA === '' && $dateB !== '') return 1;
    }

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

function mdw_entry_publisher_sort_date_key($entry) {
    if (!is_array($entry)) return '';
    $path = isset($entry['path']) ? trim((string)$entry['path']) : '';
    if ($path === '') return '';
    $basename = isset($entry['basename']) && is_string($entry['basename']) && $entry['basename'] !== ''
        ? $entry['basename']
        : basename($path);
    $info = explorer_view_extract_md_title_and_meta_from_file(
        __DIR__ . '/' . $path,
        $basename,
        ['post_date', 'creationdate']
    );
    $rawDate = trim((string)($info['meta']['post_date'] ?? ''));
    if ($rawDate === '') $rawDate = trim((string)($info['meta']['creationdate'] ?? ''));
    [$dateKey] = explorer_view_entry_date_key_label(
        $rawDate,
        $entry['yy'] ?? null,
        $entry['mm'] ?? null,
        $entry['dd'] ?? null
    );
    return (string)$dateKey;
}

function mdw_publisher_should_hide_md_entry($path) {
    global $MDW_PUBLISHER_MODE;
    if (empty($MDW_PUBLISHER_MODE)) return false;
    if (!is_string($path) || $path === '') return false;
    $full = mdw_safe_full_path($path, true);
    if (!$full || !is_file($full) || !is_readable($full)) return false;

    $h = @fopen($full, 'rb');
    if (!$h) return false;
    $state = '';
    $maxLines = 120;
    while ($maxLines-- > 0 && ($line = fgets($h)) !== false) {
        $line = rtrim($line, "\r\n");
        $k = null;
        $v = null;
        if (function_exists('mdw_hidden_meta_match') && mdw_hidden_meta_match($line, $k, $v)) {
            if (strtolower(trim((string)$k)) === 'publishstate') {
                $state = (string)$v;
                break;
            }
            continue;
        }
        if (preg_match('/^\s*(?:_+publishstate\s*:\s*(.*?)\s*_*\s*|\{+\s*publishstate\s*:\s*(.*?)\s*\}+\s*)$/iu', $line, $m)) {
            $state = (string)(($m[1] ?? '') !== '' ? $m[1] : ($m[2] ?? ''));
            break;
        }
    }
    fclose($h);
    if ($state === '') return false;
    $normalized = function_exists('mdw_publisher_normalize_publishstate')
        ? mdw_publisher_normalize_publishstate($state)
        : trim($state);
    return $normalized === 'ToDelete';
}

/* ROOT FILES */
function list_md_root_sorted(){
    $mds = glob("*.md");
    $out=[];
    foreach($mds as $path){
        if (mdw_publisher_should_hide_md_entry($path) || explorer_view_should_hide_editor_document($path)) continue;
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
        'sections' => true,
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
                    if (mdw_publisher_should_hide_md_entry($path) || explorer_view_should_hide_editor_document($path)) continue;
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

    $out = [];
    foreach ($dirs as $dir) {
        $out[] = $dir;
        $subdirs = array_filter(glob($dir . '/*'), function($f){
            if (!is_dir($f)) return false;
            $base = basename($f);
            if ($base === '' || $base[0] === '.') return false;
            return true;
        });
        sort($subdirs, SORT_NATURAL | SORT_FLAG_CASE);
        foreach ($subdirs as $sub) {
            $out[] = $dir . '/' . basename($sub);
        }
    }

    return $out;
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

function mdw_parse_basic_mode_value($raw) {
    if ($raw === null) return null;
    if (is_bool($raw)) return $raw;
    $v = strtolower(trim((string)$raw));
    if ($v === '') return true;
    if (in_array($v, ['1', 'true', 'yes', 'on', 'basic'], true)) return true;
    if (in_array($v, ['0', 'false', 'no', 'off', 'modern'], true)) return false;
    return null;
}

function mdw_detect_opera_mini_ua() {
    $ua = isset($_SERVER['HTTP_USER_AGENT']) ? (string)$_SERVER['HTTP_USER_AGENT'] : '';
    if ($ua === '') return false;
    return stripos($ua, 'Opera Mini') !== false;
}

$mdw_basic_from_query = array_key_exists('basic', $_GET) ? mdw_parse_basic_mode_value($_GET['basic']) : null;
$mdw_basic_from_post = array_key_exists('basic', $_POST) ? mdw_parse_basic_mode_value($_POST['basic']) : null;
$mdw_opera_mini_detected = mdw_detect_opera_mini_ua();

$MDW_BASIC_REASON = 'default';
if ($mdw_basic_from_query !== null) {
    $MDW_BASIC_MODE = $mdw_basic_from_query;
    $MDW_BASIC_REASON = 'query';
} else if ($mdw_basic_from_post !== null) {
    $MDW_BASIC_MODE = $mdw_basic_from_post;
    $MDW_BASIC_REASON = 'post';
} else if ($mdw_opera_mini_detected) {
    $MDW_BASIC_MODE = true;
    $MDW_BASIC_REASON = 'opera-mini';
} else {
    $MDW_BASIC_MODE = false;
}

function mdw_basic_url($script, $params = []) {
    global $MDW_BASIC_MODE;
    if (!is_array($params)) $params = [];
    if (!empty($MDW_BASIC_MODE) && !array_key_exists('basic', $params)) {
        $params['basic'] = '1';
    }
    $query = http_build_query($params, '', '&', PHP_QUERY_RFC3986);
    return $script . ($query !== '' ? ('?' . $query) : '');
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
$explorerTotalNotes = count($rootList);
foreach ($dirMap as $list) {
    if (is_array($list)) $explorerTotalNotes += count($list);
}
$explorerLazyThreshold = isset($MDW_SETTINGS['lazy_explorer_threshold'])
    ? (int)$MDW_SETTINGS['lazy_explorer_threshold']
    : 450;
if ($explorerLazyThreshold < 50) $explorerLazyThreshold = 50;
$explorerUseLazyNotes = $explorerTotalNotes >= $explorerLazyThreshold;
if (isset($_GET['lazy'])) {
    $lazyOverride = strtolower(trim((string)$_GET['lazy']));
    if ($lazyOverride === '1' || $lazyOverride === 'true' || $lazyOverride === 'yes') {
        $explorerUseLazyNotes = true;
    } else if ($lazyOverride === '0' || $lazyOverride === 'false' || $lazyOverride === 'no') {
        $explorerUseLazyNotes = false;
    }
}
if ($MDW_BASIC_MODE) {
    $explorerUseLazyNotes = false;
}
$explorerLazyEndpoint = 'index.php?json=explorer_tree';

$save_error = null;
$save_error_details = null;
$save_warning = [];
$saved_flag = isset($_GET['saved']) ? true : false;
$use_posted_content = false;
$posted_content_for_render = '';
$open_new_panel = isset($_GET['new']) && $_GET['new'] === '1';
$new_md_draft = null;
if (isset($_SESSION['new_md_draft']) && is_array($_SESSION['new_md_draft'])) {
    $new_md_draft = $_SESSION['new_md_draft'];
    unset($_SESSION['new_md_draft']);
    $open_new_panel = true;
}

$pluginsDir = env_path('PLUGINS_DIR', __DIR__ . '/plugins', __DIR__);
$excludeFolders = [basename($pluginsDir), 'HTML', 'PDF', 'sections', $TOOLS_DIR, $STATIC_DIR, $IMAGES_DIR, $THEMES_DIR, $TRANSLATIONS_DIR];
$existingFolders = list_existing_folders_sorted($excludeFolders);
$default_new_folder = 'root';
if ($requested) {
    $requestedFolder = folder_from_path($requested);
    if ($requestedFolder && in_array($requestedFolder, $existingFolders, true)) {
        $default_new_folder = $requestedFolder;
    }
}
if ($folder_filter && in_array($folder_filter, $existingFolders, true)) {
    $default_new_folder = $folder_filter;
}
$today_prefix = date('y-m-d-');
$new_md_title_value = '';
$new_md_slug_value = '';
$new_md_content_value = '';
$new_md_metadata_values = [];
$new_md_prefix_checked = empty($MDW_PUBLISHER_MODE) && empty($hideMarkdownEditor);
if (is_array($new_md_draft)) {
    $draftFolder = sanitize_folder_name((string)($new_md_draft['folder'] ?? '')) ?? 'root';
    if ($draftFolder === 'root' || in_array($draftFolder, $existingFolders, true)) {
        $default_new_folder = $draftFolder;
    }
    $new_md_title_value = (string)($new_md_draft['title'] ?? '');
    $new_md_slug_value = (string)($new_md_draft['slug'] ?? (string)($new_md_draft['file'] ?? ''));
    $new_md_content_value = (string)($new_md_draft['content'] ?? '');
    $new_md_metadata_values = is_array($new_md_draft['metadata'] ?? null) ? $new_md_draft['metadata'] : [];
    $new_md_prefix_checked = !empty($new_md_draft['prefix_date']) && empty($hideMarkdownEditor);
}

/* HANDLE PREVIEW ENDPOINT (AJAX) */
if (isset($_GET['preview']) && $_GET['preview'] === '1') {
    $contentProvided = array_key_exists('content', $_POST);
    if ($contentProvided) {
        $content = (string)$_POST['content'];
    } else {
        $content = '';
        if ($requested) {
            $isSecretReq = is_secret_file($requested);
            if ($isSecretReq && !is_secret_authenticated()) {
                json(['error' => 'forbidden'], 403);
            }
            $full = mdw_safe_full_path($requested, true);
            if ($full && is_file($full)) {
                $content = (string)file_get_contents($full);
            }
        }
    }

    $templateMode = isset($_GET['template']) ? strtolower(trim((string)$_GET['template'])) : '';
    if ($templateMode === 'jinja' || $templateMode === 'aw_ssg') {
        if (empty($aw_ssg_template_plugin_loaded)) {
            json(['ok' => false, 'error' => 'plugin_disabled', 'message' => 'AW-SSG template export plugin is not enabled.'], 404);
        }
        $bodyHtml = isset($_POST['body_html']) ? (string)$_POST['body_html'] : '';
        $template = mdw_export_markdown_jinja_template($content, [
            'md_path' => $requested,
            'content_html' => $bodyHtml,
        ]);
        header('Content-Type: text/plain; charset=utf-8');
        echo $template;
        exit;
    }

    html(md_to_html($content, $requested));
}

/* LOAD DATA FOR JSON REQUEST */
$is_secret_req_json = $requested ? is_secret_file($requested) : false;
$can_view_json = $requested && (!$is_secret_req_json || ($is_secret_req_json && is_secret_authenticated()));

/* HANDLE JSON DATA REQUEST (AJAX) */
if (isset($_GET['json']) && $_GET['json'] === '1') {
    if ($can_view_json) {
        $full = mdw_safe_full_path($requested, true);
        if (!$full || !is_file($full)) {
            json(['error' => 'not_found'], 404);
        }
        $raw_content = file_get_contents($full);
        $publishState = '';
        if (!empty($MDW_PUBLISHER_MODE)) {
            $meta = [];
            mdw_hidden_meta_extract_and_remove_all($raw_content, $meta);
            $publishState = mdw_publisher_normalize_publishstate($meta['publishstate'] ?? '');
            if ($publishState === '') $publishState = 'Concept';
        }

        json([
            'file'    => $requested,
            'title'   => mdw_editor_title_from_raw($raw_content, !empty($MDW_PUBLISHER_MODE), $requested),
            'content' => $raw_content,
            'html'    => md_to_html($raw_content, $requested),
            'is_secret' => (bool)$is_secret_req_json,
            'secret_authenticated' => is_secret_authenticated(),
            'publish_state' => $publishState,
        ]);
    } else {
        json(['error' => 'forbidden'], 403);
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
                $rawSlug = isset($_POST['new_name']) ? (string)$_POST['new_name'] : '';
                if ($rawSlug === '' && isset($_POST['new_slug'])) {
                    // Backward compatibility with older clients.
                    $rawSlug = (string)$_POST['new_slug'];
                }
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
                    $keepDatePrefix = !empty($MDW_PUBLISHER_MODE);
                    if (!$keepDatePrefix && $prefix !== '') {
                        $rawKeep = isset($_POST['keep_date_prefix']) ? strtolower(trim((string)$_POST['keep_date_prefix'])) : '';
                        $keepDatePrefix = in_array($rawKeep, ['1', 'true', 'yes', 'on'], true);
                    }
                    $nextPrefix = ($keepDatePrefix && $prefix !== '') ? $prefix : '';
                    if ($nextPrefix !== '' && str_starts_with($slug, $nextPrefix)) {
                        $newBase = $slug . '.md';
                    } else {
                        $newBase = $nextPrefix . $slug . '.md';
                    }
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
                            redirect(mdw_basic_url('edit.php', ['file' => $newPath]));
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
                json(['ok' => false, 'error' => 'forbidden'], 403);
            }
            redirect(mdw_basic_url('index.php', ['file' => $san]));
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
                $canPublish = false;
                $canSubmitForProcessing = false;
                $publishStateCandidate = null;
                if (!empty($MDW_PUBLISHER_MODE)) {
                    $authRequired = function_exists('mdw_auth_has_role')
                        ? (mdw_auth_has_role('superuser') || mdw_auth_has_role('user'))
                        : false;
                    $allowUserPublish = !array_key_exists('allow_user_publish', $MDW_SETTINGS) ? false : !empty($MDW_SETTINGS['allow_user_publish']);
                    $canPublish = !$authRequired || $authIsSuperuser || ($authIsUser && $allowUserPublish);
                    $canSubmitForProcessing = $authRequired && $authIsUser && !$authIsSuperuser;

                    if ($canPublish && !$authIsUser && $publishAction === 'publish') {
                        $desiredPublishState = 'Processing';
                    } else if ($canSubmitForProcessing && $publishAction === 'submit_for_processing' && $existingPublishState === 'Concept') {
                        $desiredPublishState = 'Processing';
                    } else if ($authIsSuperuser && $publishStateOverride && $publishStateInput !== '') {
                        $candidate = mdw_publisher_normalize_publishstate($publishStateInput);
                        if (in_array($candidate, $allowedPublishStates, true)) {
                            $desiredPublishState = $candidate;
                            $publishStateCandidate = $candidate;
                        }
                    }

                    if ($desiredPublishState === null && $contentChanged) {
                        $desiredPublishState = 'Concept';
                    }
                    if ($desiredPublishState === null) {
                        $desiredPublishState = $existingPublishState;
                    }
                }
                $finalPublishState = null;
                if (!empty($MDW_PUBLISHER_MODE)) {
                    $finalPublishState = $desiredPublishState;
                }

                $isPublishAttempt = false;
                if (!empty($MDW_PUBLISHER_MODE)) {
                    $isPublishAttempt = ($canPublish && !$authIsUser && $publishAction === 'publish')
                        || ($canSubmitForProcessing && $publishAction === 'submit_for_processing' && $existingPublishState === 'Concept')
                        || ($publishStateCandidate !== null && $publishStateCandidate !== 'Concept');
                }

                $author = '';
                if (!empty($MDW_PUBLISHER_MODE)) {
                    $defaultAuthor = isset($MDW_SETTINGS['publisher_default_author']) ? trim((string)$MDW_SETTINGS['publisher_default_author']) : '';
                    $metadataAuthor = trim((string)($submittedMeta['author'] ?? $existingMeta['author'] ?? ''));
                    $author = $postedAuthor !== '' ? $postedAuthor : ($metadataAuthor !== '' ? $metadataAuthor : $defaultAuthor);
                    $publisherWarnings = [];
                    if ($author === '') {
                        $publisherWarnings[] = mdw_t('flash.publisher_author_required', 'WPM requires an author name.', ['app' => $APP_NAME]);
                    }
                    $pageTitle = trim((string)($submittedMeta['page_title'] ?? ''));
                    if ($pageTitle === '') {
                        $publisherWarnings[] = mdw_t('flash.publisher_requires_page_title', 'WPM requires a page_title metadata line.', ['app' => $APP_NAME]);
                    }
                    $pagePicture = trim((string)($submittedMeta['page_picture'] ?? ''));
                    if ($pagePicture === '') {
                        $publisherWarnings[] = mdw_t('flash.publisher_requires_page_picture', 'WPM requires a page_picture metadata line.', ['app' => $APP_NAME]);
                    }
                    $requireH2 = !array_key_exists('publisher_require_h2', $MDW_SETTINGS) ? true : !empty($MDW_SETTINGS['publisher_require_h2']);
                    if ($requireH2 && !mdw_md_has_h2($content)) {
                        $publisherWarnings[] = mdw_t('flash.publisher_requires_subtitle', 'WPM requires a subtitle line starting with "##".', ['app' => $APP_NAME]);
                    }
                    if ($isPublishAttempt && !empty($publisherWarnings)) {
                        $save_error = $publisherWarnings[0];
                    } else if (!empty($publisherWarnings)) {
                        $save_warning = array_values(array_unique(array_merge($save_warning, $publisherWarnings)));
                    }
                }

                if ($save_error === null) {
                    $save_ok_payload = ['ok' => true, 'publish_state' => $finalPublishState];
                    if (!empty($save_warning)) {
                        $save_ok_payload['warnings'] = array_values($save_warning);
                    }
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
                                        json($save_ok_payload);
                                    }
                                    redirect(mdw_basic_url('edit.php', ['file' => $san, 'saved' => '1']));
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
                                        json($save_ok_payload);
                                    }
                                    redirect(mdw_basic_url('edit.php', ['file' => $san, 'saved' => '1']));
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
                                    json($save_ok_payload);
                                }
                                redirect(mdw_basic_url('edit.php', ['file' => $san, 'saved' => '1']));
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
        json([
            'ok' => false,
            'error' => (string)($save_error ?: 'Save failed.'),
            'details' => $save_error_details,
        ], 400);
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
        redirect(mdw_basic_url('index.php', ['file' => $requested]));
    }

	$full = mdw_safe_full_path($requested, true);
	if ($use_posted_content && $posted_content_for_render !== '') {
	    $raw             = $posted_content_for_render;
	    $current_content = (string)$raw;
	    $current_title   = mdw_editor_title_from_raw($raw, !empty($MDW_PUBLISHER_MODE), $requested);
	    $current_html    = md_to_html($raw, $requested);
	} else if ($full && is_file($full)) {
	    $raw             = file_get_contents($full);
	    $current_content = (string)$raw;
	    $current_title   = mdw_editor_title_from_raw($raw, !empty($MDW_PUBLISHER_MODE), $requested);
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
$current_publish_state_ui = ($current_publish_state === 'ToDelete') ? 'Processing' : $current_publish_state;
$current_publish_state_lower = strtolower($current_publish_state_ui);

$rename_slug_value = '';
$rename_prefix_value = '';
$rename_field_is_slug = !empty($MDW_PUBLISHER_MODE);
$rename_field_label_key = $rename_field_is_slug ? 'rename_modal.slug_label' : 'rename_modal.filename_label';
$rename_field_label_fallback = $rename_field_is_slug ? 'New slug' : 'New filename';
$rename_field_placeholder_key = $rename_field_is_slug ? 'rename_modal.slug_placeholder' : 'rename_modal.filename_placeholder';
$rename_field_placeholder_fallback = $rename_field_is_slug ? 'new-title' : 'new-filename';
if ($requested) {
    $base = basename($requested);
    if (preg_match('/^\\d{2}-\\d{2}-\\d{2}-/', $base, $m)) {
        $rename_prefix_value = $m[0];
        $base = substr($base, strlen($rename_prefix_value));
    }
    $base = preg_replace('/\\.md$/i', '', $base);
    $rename_slug_value = $base;
}

if ($MDW_BASIC_MODE) {
    require __DIR__ . '/edit_basic_view.php';
    exit;
}

$editSplitColStorageKey = 'mdw_edit_split_col_widths';
$editSplitColStorageLegacyKey = 'mdw_editor_col_widths';
$editSplitRowStorageKey = 'mdw_edit_split_row_heights';
$editSplitRowStorageLegacyKey = 'mdw_editor_row_heights';

?>
<!DOCTYPE html>
<html lang="<?=h($MDW_LANG)?>" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title><?=h($current_title)?> • md edit</title>
<link rel="icon" href="<?=h($appLogoUrl !== '' ? $appLogoUrl : 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22%3E%3Crect width=%2232%22 height=%2232%22 rx=%226%22 fill=%22%23334155%22/%3E%3Cpath d=%22M8 24V8h4l4 7 4-7h4v16h-4v-9l-4 7-4-7v9z%22 fill=%22white%22/%3E%3C/svg%3E')?>">

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
        const storageKey = <?= json_encode($editSplitColStorageKey, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>;
        const legacyKey = <?= json_encode($editSplitColStorageLegacyKey, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>;
        const parseState = (raw) => {
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return (parsed && typeof parsed === 'object') ? parsed : null;
        };
        let raw = window.__mdwStorageGet(storageKey);
        let saved = parseState(raw);
        if (!saved) {
            raw = window.__mdwStorageGet(legacyKey);
            saved = parseState(raw);
            if (!saved) return;
        }
        const toPct = (value) => {
            if (typeof value !== 'string') return null;
            const n = parseFloat(value.replace('%', '').trim());
            return Number.isFinite(n) ? n : null;
        };
        let left = toPct(saved.left);
        let mid = toPct(saved.mid);
        let right = toPct(saved.right);
        if (!Number.isFinite(left) || !Number.isFinite(mid) || !Number.isFinite(right)) return;
        const total = left + mid + right;
        if (!(total > 0)) return;
        const scale = 100 / total;
        left *= scale;
        mid *= scale;
        right *= scale;
        const minPct = 10;
        left = Math.max(minPct, Math.min(100 - (minPct * 2), left));
        mid = Math.max(minPct, Math.min(100 - left - minPct, mid));
        right = 100 - left - mid;
        if (right < minPct) {
            right = minPct;
            mid = Math.max(minPct, 100 - left - right);
            left = 100 - mid - right;
        }
        const normalized = {
            left: `${left.toFixed(2)}%`,
            mid: `${mid.toFixed(2)}%`,
            right: `${right.toFixed(2)}%`,
        };
        const root = document.documentElement;
        root.style.setProperty('--col-left', normalized.left);
        root.style.setProperty('--col-mid', normalized.mid);
        root.style.setProperty('--col-right', normalized.right);
        window.__mdwStorageSet(storageKey, JSON.stringify(normalized));
    } catch {}
})();
</script>

<script>
// Bootstrap editor word wrap early (pre-CSS) to avoid layout shift on reload/save.
(function(){
    try {
        if (<?= !empty($MDW_SETTINGS['editor_wrap']) ? 'true' : 'false' ?>) {
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

<link rel="stylesheet" href="<?=h(mdw_static_asset('ui.css'))?>">
<link rel="stylesheet" href="<?=h(mdw_static_asset('markdown.css'))?>">
<link rel="stylesheet" href="<?=h(mdw_static_asset('htmlpreview.css'))?>">
<link rel="stylesheet" href="<?=h(mdw_static_asset('popicon.css'))?>">
<link rel="stylesheet" href="<?=h(mdw_static_asset('popbrand.css'))?>">
<?php if ($instanceFontAssets['stylesheet'] !== ''): ?>
<link rel="stylesheet" href="<?=h(mdw_static_asset($instanceFontAssets['stylesheet']))?>">
<?php endif; ?>
<?php if ($instanceFontAssets['family'] !== ''): ?>
<style>body.app-body { --font-sans: <?=$instanceFontAssets['family']?>; }</style>
<?php endif; ?>

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

<body class="app-body edit-page <?=h($folderIconClass)?> <?= $paneHeaderOrder === 'title_left' ? 'pane-header-title-left' : '' ?> <?= $hideMarkdownEditor ? 'hide-markdown-editor' : '' ?>">
    <header class="app-header">
        <div class="app-header-inner">
	            <div class="app-header-main">
		                <a class="app-logo" href="index.php" aria-label="Go to index">
		                    <?php if ($appLogoUrl !== ''): ?>
		                        <img class="app-logo-image" src="<?=h($appLogoUrl)?>" alt="">
		                    <?php else: ?>
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
		                    <?php endif; ?>
		                </a>
	                <div class="app-header-text">
	                    <div class="app-title-row">
	                        <div class="app-title"><?=h($current_title)?></div>
                            <?php if ($requested && !empty($MDW_PUBLISHER_MODE) && $WPM_SITE_BASE): ?>
                                <?php $wpm_public_url = mdw_wpm_public_url($requested, $WPM_SITE_BASE); ?>
                                <?php if ($wpm_public_url): ?>
                                    <a id="wpmPublicPageLink" class="icon-button" href="<?=h($wpm_public_url)?>" target="_blank" rel="noopener noreferrer" aria-label="Open public page" title="Open public page" data-wpm-public-base="<?=h($WPM_SITE_BASE ?? '')?>">
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
                            <?php $showFolderCrumb = ($crumbFolder && $crumbFolder !== 'root'); ?>
                            <?php $crumbFolderHref = $showFolderCrumb
                                ? ('index.php?folder=' . rawurlencode($crumbFolder) . '#contentList')
                                : 'index.php#contentList'; ?>
                            <?php $crumbFileHref = $showFolderCrumb
                                ? ('index.php?file=' . rawurlencode($requested) . '&folder=' . rawurlencode($crumbFolder) . '&focus=' . rawurlencode($requested))
                                : ('index.php?file=' . rawurlencode($requested) . '&focus=' . rawurlencode($requested)); ?>
                            <span data-crumb="folder-wrap"<?= $showFolderCrumb ? '' : ' hidden' ?>>
	                        <span class="breadcrumb-sep">/</span>
                        <a class="breadcrumb-link" data-crumb="folder" href="<?=h($crumbFolderHref)?>">
                            <?=h($showFolderCrumb ? $crumbFolder : '')?>
                        </a>
                            </span>
	                        <span class="breadcrumb-sep">/</span>
	                        <a class="breadcrumb-link app-path-segment" data-crumb="file" href="<?=h($crumbFileHref)?>">
                                <?=h($hideMarkdownEditor ? preg_replace('/\.md$/i', '', basename($requested)) : basename($requested))?>
                            </a>
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

                    <button id="mobileNavToggle" type="button" class="btn btn-ghost icon-button mobile-nav-toggle" aria-label="<?=h(mdw_t('edit.nav.open_files_aria','Show files'))?>">
                        <span class="pi pi-openfolder"></span>
                    </button>
			                <button id="themeSettingsBtn" type="button" class="btn btn-ghost icon-button" title="<?=h(mdw_t('theme.settings_title','Settings'))?>" aria-label="<?=h(mdw_t('theme.settings_title','Settings'))?>" data-auth-superuser="1">
			                    <span class="pi pi-gear"></span>
		                </button>
		                <button id="authToggleBtn" type="button" class="btn btn-ghost icon-button" title="<?=h(mdw_t('auth.logout','Logout'))?>" aria-label="<?=h(mdw_t('auth.logout','Logout'))?>">
		                    <span class="pi pi-upload auth-logout-icon"></span>
		                </button>
			                <button id="themeToggle" type="button" class="btn btn-ghost icon-button"><span class="pi pi-sun" id="themeIcon"></span></button>
                    <form id="newFolderForm" method="post" action="index.php" style="display:none;">
                        <input type="hidden" name="action" value="create_folder">
                        <input type="hidden" name="csrf" value="<?=h($CSRF_TOKEN)?>">
                        <input type="hidden" name="folder_name" id="newFolderName" value="">
                        <input type="hidden" name="return_page" value="edit">
                        <input type="hidden" name="return_file" value="<?=h((string)($requested ?? ''))?>">
                    </form>
			            </div>
	        </div>
	    </header>

    <div class="nav-overlay" id="navOverlay"></div>

<main class="app-main">
    <div class="editor-shell">
        <div class="editor-grid" id="editorGrid"
             data-split-mode="three"
             data-split-storage-key="<?=h($editSplitColStorageKey)?>"
             data-split-storage-legacy-key="<?=h($editSplitColStorageLegacyKey)?>"
             data-split-row-storage-key="<?=h($editSplitRowStorageKey)?>"
             data-split-row-storage-legacy-key="<?=h($editSplitRowStorageLegacyKey)?>"
             data-split-mobile-resizer="right"
             data-split-focus-lock-classes="mdw-pane-focus-md,mdw-pane-focus-preview">

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
			                                'csrf_token' => $CSRF_TOKEN,
			                                'show_actions' => false,
			                                'plugins_enabled' => false,
                                            'show_filter_row' => true,
                                            'show_filter_reset' => false,
                                            'sticky_controls' => true,
                                            'lazy_notes' => $explorerUseLazyNotes,
                                            'lazy_endpoint' => $explorerLazyEndpoint,
                                            'lazy_cache_ttl_ms' => 300000,
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
                                <span class="icon-text-logo"><span class="pi pi-code"></span></span>
                                <?php if ($requested): ?>
                                    <span class="pane-subtitle small"><?=h($requested)?></span>
                                <?php endif; ?>
                            </div>
			                            <div class="pane-header-actions">
			                                <?php if (!empty($MDW_PUBLISHER_MODE) && !$hideMarkdownEditor): ?>
                                    <button type="submit" form="editor-form" class="btn btn-ghost" id="publishBtn" name="publish_action" value="publish" data-auth-publish="1" <?= (!$requested || $current_publish_state_lower !== 'concept') ? 'disabled' : '' ?> title="<?=h(mdw_t('edit.toolbar.publish_title','Send to processing'))?>" aria-label="<?=h(mdw_t('edit.toolbar.publish_title','Send to processing'))?>">
			                                        <span class="pi pi-upload"></span>
			                                        <span class="btn-label"><?=h(mdw_t('edit.toolbar.publish','Publish'))?></span>
			                                    </button>
			                                    <select id="publishStateSelect" name="publish_state" form="editor-form" class="input publish-state-select" data-auth-superuser="1" <?= $requested ? 'data-auth-superuser-enable="1" disabled' : 'disabled' ?> title="<?=h(mdw_t('edit.publish_state_label','Publish state'))?>" aria-label="<?=h(mdw_t('edit.publish_state_label','Publish state'))?>">
			                                        <?php
			                                            $stateOptions = [
			                                                'Concept' => mdw_t('edit.publish_state.concept', 'Concept'),
			                                                'Processing' => mdw_t('edit.publish_state.processing', 'Processing'),
			                                                'Published' => mdw_t('edit.publish_state.published', 'Published'),
			                                            ];
			                                            foreach ($stateOptions as $val => $label):
			                                                $selected = ($current_publish_state_ui === $val) ? 'selected' : '';
			                                        ?>
			                                            <option value="<?=h($val)?>" <?= $selected ?>><?=h($label)?></option>
			                                        <?php endforeach; ?>
			                                    </select>
			                                <?php endif; ?>
                            </div>
                        </div>
                    </header>

                    <form method="post" class="editor-form" id="editor-form" autocomplete="off">
                        <input type="hidden" name="file" value="<?=h($requested)?>">
                        <input type="hidden" name="action" value="save">
                        <?php if (!empty($MDW_PUBLISHER_MODE)): ?>
                            <input type="hidden" name="publish_state_override" id="publishStateOverride" value="0">
                        <?php endif; ?>

                        <?php $editorToolbar = function() use ($requested, $MDW_PUBLISHER_MODE, $tocButtonEnabled, $current_publish_state_lower) { ?>
                        <div class="editor-toolbar">
                            <div class="editor-toolbar-left">
                                <button type="submit" form="editor-form" class="btn btn-ghost" id="saveBtn">
                                    <span class="pi pi-floppydisk"></span>
                                    <span class="btn-label"><?=h(mdw_t('edit.toolbar.save','Save'))?></span>
                                </button>
                                <?php if (!empty($MDW_PUBLISHER_MODE)): ?>
                                <button type="button" id="articleMetaBtn" class="btn btn-ghost btn-small" title="<?=h(mdw_t('edit.toolbar.article_meta_title','Article metadata'))?>" aria-label="<?=h(mdw_t('edit.toolbar.article_meta_title','Article metadata'))?>" <?= $requested ? '' : 'disabled' ?>>
                                    <span class="pi pi-gear"></span>
                                </button>
                                <?php endif; ?>
                                <button type="button" id="markdownSourceToggle" class="btn btn-ghost btn-small md-source-toggle" title="<?=h(mdw_t('edit.toolbar.show_markdown_title','Show markdown source'))?>" aria-label="<?=h(mdw_t('edit.toolbar.show_markdown_title','Show markdown source'))?>" aria-pressed="false">
                                    <span class="pi pi-code"></span>
                                </button>
                                <button type="button" id="formatBoldBtn" class="btn btn-ghost btn-small format-btn" aria-label="<?=h(mdw_t('edit.toolbar.bold','Bold'))?>" aria-pressed="false">
                                    <span class="format-letter">B</span>
                                </button>
                                <button type="button" id="formatItalicBtn" class="btn btn-ghost btn-small format-btn" aria-label="<?=h(mdw_t('edit.toolbar.italic','Italic'))?>" aria-pressed="false">
                                    <span class="format-letter format-italic">I</span>
                                </button>
                                <button type="button" id="formatUnderlineBtn" class="btn btn-ghost btn-small format-btn" aria-label="<?=h(mdw_t('edit.toolbar.underline','Underline'))?>" aria-pressed="false">
                                    <span class="format-letter format-underline">U</span>
                                </button>
                                <button type="button" id="addLinkBtn" class="btn btn-ghost">
                                    <span class="pi pi-linkchain"></span>
                                    <span class="btn-label"><?=h(mdw_t('edit.toolbar.link','Link'))?></span>
                                </button>
                                <button type="button" id="addImageBtn" class="btn btn-ghost">
                                    <span class="pi pi-image"></span>
                                    <span class="btn-label"><?=h(mdw_t('edit.toolbar.image','Image'))?></span>
                                </button>
                                <select id="alignSelect" class="input editor-toolbar-select editor-align-select" aria-label="<?=h(mdw_t('edit.toolbar.align','Align'))?>">
                                    <option value="left">L</option>
                                    <option value="center">C</option>
                                    <option value="right">R</option>
                                </select>
                                <select id="headingSelect" class="input editor-toolbar-select editor-heading-select" aria-label="<?=h(mdw_t('edit.toolbar.heading','Heading'))?>">
                                    <option value="" class="heading-select-option" selected>H</option>
                                    <option value="2" class="md-h2 heading-select-option">H2</option>
                                    <option value="3" class="md-h3 heading-select-option">H3</option>
                                    <option value="4" class="md-h4 heading-select-option">H4</option>
                                    <option value="5" class="md-h5 heading-select-option">H5</option>
                                    <option value="6" class="md-h6 heading-select-option">H6</option>
                                </select>
                                <select id="customFormat" class="input editor-toolbar-select editor-css-select" aria-label="<?=h(mdw_t('edit.toolbar.custom_format','Custom format'))?>" hidden>
                                    <option value="" selected><?=h(mdw_t('edit.toolbar.custom_format','Custom format'))?></option>
                                </select>                                <button type="button" id="formatBlockquoteBtn" class="btn btn-ghost btn-small format-btn" aria-label="<?=h(mdw_t('edit.toolbar.blockquote','Blockquote'))?>">
                                    <span class="pi pi-quote"></span>
                                </button>
                                <button type="button" id="formatOrderedListBtn" class="btn btn-ghost btn-small format-btn" aria-label="<?=h(mdw_t('edit.toolbar.ordered_list','Ordered list'))?>">
                                    <span class="format-letter format-ordered-list" aria-hidden="true">
                                        <span>1.</span>
                                        <span>2.</span>
                                        <span>3.</span>
                                    </span>
                                </button>
                                <button type="button" id="formatUnorderedListBtn" class="btn btn-ghost btn-small format-btn" aria-label="<?=h(mdw_t('edit.toolbar.unordered_list','Unordered list'))?>">
                                    <span class="pi pi-list"></span>
                                </button>
                                <button type="button" id="insertTableBtn" class="btn btn-ghost btn-small format-btn" aria-label="<?=h(mdw_t('edit.toolbar.table','Insert table'))?>">
                                    <span class="icon-table-grid" aria-hidden="true"><span></span><span></span><span></span><span></span></span>
                                </button>
                                <?php if (!empty($MDW_PUBLISHER_MODE) && $tocButtonEnabled): ?>
                                <button type="button" id="toggleTocBtn" class="btn btn-ghost btn-small format-btn format-toc-btn" aria-label="<?=h(mdw_t('edit.toolbar.toc','TOC'))?>">
                                    <span class="format-letter">TOC</span>
                                </button>
                                <?php endif; ?>
                                <button type="button" id="btnRevert" class="btn btn-ghost">
                                    <span class="pi pi-recycle"></span>
                                    <span class="btn-label"><?=h(mdw_t('edit.toolbar.revert','Revert'))?></span>
                                </button>
                                <?php if (!empty($MDW_PUBLISHER_MODE)): ?>
                                <button type="submit" form="editor-form" class="btn btn-ghost" id="submitForProcessingBtn" name="publish_action" value="submit_for_processing" data-auth-regular="1" <?= (!$requested || $current_publish_state_lower !== 'concept') ? 'disabled' : '' ?> title="<?=h(mdw_t('edit.toolbar.publish_title','Send to processing'))?>" aria-label="<?=h(mdw_t('edit.toolbar.publish_title','Send to processing'))?>">
                                    <span class="pi pi-send"></span>
                                </button>
                                <?php endif; ?>
                            </div>
                        </div>
                        <?php }; ?>
                        <?php if (!$hideMarkdownEditor): ?>
                            <?php $editorToolbar(); ?>
                        <?php endif; ?>

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
                <button type="button" class="pane-focus-toggle" data-focus-target="markdown" aria-label="<?=h(mdw_t('edit.pane_focus_markdown','Focus markdown pane'))?>" title="<?=h(mdw_t('edit.pane_focus_markdown','Focus markdown pane'))?>">
                    <span class="pi pi-downcaret"></span>
                </button>
            </section>

            <!-- resizer tussen midden en rechts -->
            <div class="col-resizer" data-resizer="right"></div>

            <!-- RECHTERPANE: HTML-preview -->
            <section class="editor-pane" id="panePreview">
                <div class="editor-pane-inner">
                    <header class="pane-header">
                        <div class="pane-title-row">
                            <div class="pane-title">
                                <?php if ($hideMarkdownEditor): ?>
                                    <span class="pi pi-eye"></span>
                                    <span><?=h(mdw_t('edit.visual_editor_title','Visual editor'))?></span>
                                <?php else: ?>
                                    <span class="pi pi-eye"></span>
                                    <span><?=h(mdw_t('edit.preview_title','HTML preview'))?></span>
                                <?php endif; ?>
                            </div>
                            <div class="pane-header-actions">
                                <?php if ($hideMarkdownEditor): ?>
                                    <?php $editorToolbar(); ?>
                                    <?php if (!empty($MDW_PUBLISHER_MODE)): ?>
                                        <button type="submit" form="editor-form" class="btn btn-ghost" id="publishBtn" name="publish_action" value="publish" data-auth-publish="1" <?= (!$requested || $current_publish_state_lower !== 'concept') ? 'disabled' : '' ?> title="<?=h(mdw_t('edit.toolbar.publish_title','Send to processing'))?>" aria-label="<?=h(mdw_t('edit.toolbar.publish_title','Send to processing'))?>">
                                            <span class="pi pi-upload"></span>
                                            <span class="btn-label"><?=h(mdw_t('edit.toolbar.publish','Publish'))?></span>
                                        </button>
                                        <select id="publishStateSelect" name="publish_state" form="editor-form" class="input publish-state-select" data-auth-superuser="1" <?= $requested ? 'data-auth-superuser-enable="1" disabled' : 'disabled' ?> title="<?=h(mdw_t('edit.publish_state_label','Publish state'))?>" aria-label="<?=h(mdw_t('edit.publish_state_label','Publish state'))?>">
                                            <?php
                                                $stateOptions = [
                                                    'Concept' => mdw_t('edit.publish_state.concept', 'Concept'),
                                                    'Processing' => mdw_t('edit.publish_state.processing', 'Processing'),
                                                    'Published' => mdw_t('edit.publish_state.published', 'Published'),
                                                ];
                                                foreach ($stateOptions as $val => $label):
                                                    $selected = ($current_publish_state_ui === $val) ? 'selected' : '';
                                            ?>
                                                <option value="<?=h($val)?>" <?= $selected ?>><?=h($label)?></option>
                                            <?php endforeach; ?>
                                        </select>
                                    <?php endif; ?>
                                <?php endif; ?>
                                <button type="button" id="exportHtmlBtn" class="btn btn-ghost" title="<?=h(mdw_t('edit.preview.export_title','Download a plain HTML export'))?>" <?= $requested ? '' : 'disabled' ?> data-auth-superuser="1">
                                    <span class="pi pi-download"></span>
                                    <span class="btn-label"><?=h(mdw_t('edit.preview.export_btn','HTML download'))?></span>
                                </button>
                                <?php if (!empty($aw_ssg_template_plugin_loaded)): ?>
                                <button type="button" id="exportTemplateBtn" class="btn btn-ghost" title="<?=h(mdw_t('edit.preview.export_template_title','Download an AW-SSG Jinja template export'))?>" <?= $requested ? '' : 'disabled' ?> data-auth-superuser="1">
                                    <span class="pi pi-download"></span>
                                    <span class="btn-label"><?=h(mdw_t('edit.preview.export_template_btn','Template download'))?></span>
                                </button>
                                <?php endif; ?>
                                <?php if ($requested && $github_pages_plugin_loaded && $github_pages_env_ready): ?>
                                    <button type="button" id="githubPagesExportBtn" class="btn btn-ghost" title="<?=h(mdw_t('edit.preview.github_pages_title','Export this note to GitHub Pages'))?>" data-auth-superuser="1">
                                        <span class="pi pi-upload"></span>
                                        <span class="btn-label"><?=h(mdw_t('edit.preview.github_pages_btn','GitHub Pages'))?></span>
                                    </button>
                                <?php endif; ?>
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
                <button type="button" class="pane-focus-toggle" data-focus-target="preview" aria-label="<?=h(mdw_t('edit.pane_focus_preview','Focus preview pane'))?>" title="<?=h(mdw_t('edit.pane_focus_preview','Focus preview pane'))?>">
                    <span class="pi pi-upcaret"></span>
                </button>
            </section>

        </div>
    </div>
</main>

		    <footer class="app-footer">
		        <?=date('Y')?> • <a href="https://github.com/Henkster72/MarkdownManager" target="_blank" rel="noopener noreferrer">Markdown Manager</a> • <a href="https://allroundwebsite.com" target="_blank" rel="noopener noreferrer">Allroundwebsite.com</a>
		    </footer>

        <?php
        mdw_render_new_md_modal([
            'open' => $open_new_panel,
            'csrf' => $CSRF_TOKEN,
            'form_action' => 'index.php',
            'existing_folders' => $existingFolders,
            'default_folder' => $default_new_folder,
            'today_prefix' => $today_prefix,
            'title' => $new_md_title_value,
            'slug' => $new_md_slug_value,
            'content' => $new_md_content_value,
            'prefix_checked' => $new_md_prefix_checked,
            'hide_markdown_editor' => $hideMarkdownEditor,
            'publisher_mode' => !empty($MDW_PUBLISHER_MODE),
            'metadata_values' => $new_md_metadata_values,
            'error_message' => $open_new_panel ? ($flash_error ?? '') : '',
            'hidden_fields' => [
                'return_page' => 'edit',
                'return_file' => (string)($requested ?? ''),
            ],
        ]);
        ?>

        <?php if (!empty($MDW_PUBLISHER_MODE)): ?>
        <div class="modal-overlay" id="articleMetaModalOverlay" hidden></div>
        <div class="modal" id="articleMetaModal" role="dialog" aria-modal="true" aria-labelledby="articleMetaModalTitle" hidden>
            <div class="modal-header">
                <div>
                    <div class="modal-title" id="articleMetaModalTitle"><?=h(mdw_t('article_meta.title','Article metadata'))?></div>
                    <div class="status-text" style="margin-top:0.25rem;"><?=h(mdw_t('article_meta.hint','Edit the main article details.'))?></div>
                </div>
                <button type="button" class="btn btn-ghost icon-button" id="articleMetaModalClose" aria-label="<?=h(mdw_t('common.close','Close'))?>">
                    <span class="pi pi-cross"></span>
                </button>
            </div>
            <form id="articleMetaForm">
                <div class="modal-body">
                    <div id="articleMetaFields" class="article-meta-fields"></div>
                    <div id="articleMetaEmpty" class="status-text" hidden><?=h(mdw_t('article_meta.empty','No editable metadata fields are visible in Markdown.'))?></div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-ghost" id="articleMetaCancel"><?=h(mdw_t('common.cancel','Cancel'))?></button>
                    <button type="submit" class="btn btn-primary" id="articleMetaApply"><?=h(mdw_t('article_meta.apply','Apply'))?></button>
                </div>
            </form>
        </div>
        <?php endif; ?>

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
                <input type="hidden" name="file" id="renameModalFile" value="<?=h($requested ?? '')?>">
                <input type="hidden" name="csrf" value="<?=h($CSRF_TOKEN)?>">
                <input type="hidden" name="auth_role" id="renameAuthRole" value="">
                <input type="hidden" name="auth_token" id="renameAuthToken" value="">
                <div class="modal-body">
                    <?php if ($rename_field_is_slug): ?>
                    <div id="renameModalPrefixHintWrap" class="status-text" style="margin-bottom: 0.35rem;"<?= $rename_prefix_value !== '' ? '' : ' hidden' ?>>
                        <?=h(mdw_t('rename_modal.prefix_hint','Date prefix kept:'))?> <code id="renameModalPrefixValue"><?=h($rename_prefix_value)?></code>
                    </div>
                    <?php else: ?>
                    <label id="renameModalKeepDateWrap" class="status-text" style="display:flex; align-items:center; gap:0.35rem; margin-bottom: 0.35rem;"<?= $rename_prefix_value !== '' ? '' : ' hidden' ?> title="<?=h(mdw_t('rename_modal.keep_date_title','Keep the yy-mm-dd- prefix in the filename'))?>">
                        <input id="renameModalKeepDatePrefix" type="checkbox" name="keep_date_prefix" value="1"<?= $rename_prefix_value !== '' ? ' checked' : '' ?>>
                        <span><?=h(mdw_t('rename_modal.keep_date_prefix','Keep date prefix'))?></span>
                        <code id="renameModalKeepDateValue"><?=h($rename_prefix_value)?></code>
                    </label>
                    <?php endif; ?>
                    <label id="renameModalFieldLabel" class="modal-label" for="renameModalSlug"><?=h(mdw_t($rename_field_label_key, $rename_field_label_fallback))?></label>
                    <div style="display:flex; align-items:center; gap: 0.4rem;">
                        <input id="renameModalSlug" name="new_name" class="input" type="text" value="<?=h($rename_slug_value)?>" placeholder="<?=h(mdw_t($rename_field_placeholder_key, $rename_field_placeholder_fallback))?>" data-slug-min="<?=MDW_NEW_MD_SLUG_MIN?>" data-slug-max="<?=MDW_NEW_MD_SLUG_MAX?>" data-prefix="<?=h($rename_prefix_value)?>" data-label-slug="<?=h(mdw_t('rename_modal.slug_label','New slug'))?>" data-label-filename="<?=h(mdw_t('rename_modal.filename_label','New filename'))?>" data-placeholder-slug="<?=h(mdw_t('rename_modal.slug_placeholder','new-title'))?>" data-placeholder-filename="<?=h(mdw_t('rename_modal.filename_placeholder','new-filename'))?>" required>
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
	                <input id="linkPickerFilter" type="text" class="input" placeholder="<?=h(mdw_t('link_modal.search_internal_links_or_new','Search internal links or add a new internal link'))?>">
	                <button type="button" class="btn btn-ghost icon-button" id="linkPickerFilterClear" aria-label="<?=h(mdw_t('link_modal.clear_search_aria','Clear search'))?>" style="display:none;">
	                    <span class="pi pi-cross"></span>
	                </button>
	            </div>
	            <div class="link-picker" id="linkPicker">
	                <?php
	                    $renderPickerGroup = function($groupTitle, $entries) use ($secretMap) {
	                        $entries = array_values(array_filter($entries, static function($entry) {
	                            return is_array($entry) && mdw_link_picker_is_linkable_note($entry['path'] ?? '');
	                        }));
	                        foreach ($entries as &$entry) {
	                            $entry['picker_title'] = mdw_link_picker_title(
	                                $entry['path'] ?? '',
	                                $entry['basename'] ?? basename((string)($entry['path'] ?? ''))
	                            );
	                        }
	                        unset($entry);
	                        usort($entries, static function($left, $right) {
	                            return strnatcasecmp((string)($left['picker_title'] ?? ''), (string)($right['picker_title'] ?? ''));
	                        });
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
	                                $pickerTitle = (string)($entry['picker_title'] ?? '');
	                                $pickerSearch = trim($pickerTitle . ' ' . preg_replace('/\.md$/i', '', (string)$p));
	                                $isSecret = isset($secretMap[$p]);
	                            ?>
	                                <li class="note-item">
	                                    <button type="button" class="note-link kbd-item link-pick-item" data-path="<?=h($p)?>" data-title="<?=h($pickerTitle)?>" data-search="<?=h($pickerSearch)?>">
	                                        <div class="note-title" style="justify-content: space-between;">
	                                            <span><?=h($pickerTitle)?></span>
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
                <div class="modal-row" style="gap: 0.6rem; margin: 0;">
                    <div class="modal-field" style="flex: 1 1 14rem; margin: 0;">
                        <label class="modal-label" for="footnoteStyleSelect"><?=h(mdw_t('link_modal.footnote_style_label','Footnote style'))?></label>
                        <select id="footnoteStyleSelect" class="input">
                            <option value="decimal"><?=h(mdw_t('link_modal.footnote_style_decimal','1, 2, 3'))?></option>
                            <option value="roman-upper"><?=h(mdw_t('link_modal.footnote_style_roman_upper','I, II, III'))?></option>
                            <option value="roman-lower"><?=h(mdw_t('link_modal.footnote_style_roman_lower','i, ii, iii'))?></option>
                            <option value="alpha-lower"><?=h(mdw_t('link_modal.footnote_style_alpha_lower','a, b, c'))?></option>
                            <option value="alpha-upper"><?=h(mdw_t('link_modal.footnote_style_alpha_upper','A, B, C'))?></option>
                        </select>
                    </div>
                    <div class="modal-field" style="flex: 0 0 9rem; margin: 0;">
                        <label class="modal-label" for="footnoteNextLabel"><?=h(mdw_t('link_modal.footnote_next_label','Next label'))?></label>
                        <input id="footnoteNextLabel" type="text" class="input" value="1" readonly>
                    </div>
                </div>
                <div id="footnoteStyleHint" class="status-text"><?=h(mdw_t('link_modal.footnote_style_hint','Style detection runs on the current note.'))?></div>
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
                    <?php if (!$hideMarkdownEditor): ?>
		            <div class="status-text" style="margin-top: 0.25rem;">
		                <?=h(mdw_t('image_modal.tip_insert','Tip: click an image to insert'))?> <code>![](image.webp)</code> <?=h(mdw_t('image_modal.tip_at_cursor','at the cursor.'))?>
		            </div>
                    <?php endif; ?>
		        </div>
			    </div>
			<div class="modal-footer" style="display:flex; justify-content:flex-end; gap:0.5rem;">
			        <button type="button" class="btn btn-ghost btn-small" id="imageModalCancel"><?=h(mdw_t('common.close','Close'))?></button>
			    </div>
			</div>

			<div class="modal-overlay no-blur find-replace-overlay" id="replaceModalOverlay" hidden></div>
			<div class="modal modal-small find-replace-modal" id="replaceModal" role="dialog" aria-modal="false" aria-labelledby="replaceModalTitle" hidden>
			    <div class="modal-header">
			        <div class="modal-title" id="replaceModalTitle"><?=h(mdw_t('replace_modal.find_title','Find'))?></div>
			        <button type="button" class="btn btn-ghost icon-button" id="replaceModalClose" aria-label="<?=h(mdw_t('common.close','Close'))?>">
			            <span class="pi pi-cross"></span>
			        </button>
			    </div>
			    <div class="modal-body">
			        <div class="modal-field">
			            <label class="modal-label" for="replaceFindInput"><?=h(mdw_t('replace_modal.find_label','Find'))?></label>
			            <input id="replaceFindInput" type="text" class="input" autocomplete="off">
			        </div>
			        <div class="modal-field" id="replaceWithField" hidden>
			            <label class="modal-label" for="replaceWithInput"><?=h(mdw_t('replace_modal.replace_label','Replace with'))?></label>
			            <input id="replaceWithInput" type="text" class="input" autocomplete="off">
			        </div>
			        <div class="status-text" id="replaceModalStatus" style="min-height: 1.1em;" role="status" aria-live="polite"></div>
			    </div>
			    <div class="modal-footer" style="display:flex; justify-content:flex-end; gap:0.5rem;">
			        <button type="button" class="btn btn-ghost btn-small" id="findNextBtn" disabled><?=h(mdw_t('replace_modal.find_next','Find next'))?></button>
			        <button type="button" class="btn btn-ghost btn-small" id="replaceSkipBtn" disabled hidden><?=h(mdw_t('replace_modal.skip','Skip'))?></button>
			        <button type="button" class="btn btn-ghost btn-small" id="replaceAllBtn" disabled hidden><?=h(mdw_t('replace_modal.replace_all','Replace all'))?></button>
			        <button type="button" class="btn btn-primary btn-small" id="replaceNextBtn" disabled><?=h(mdw_t('replace_modal.replace_current','Replace'))?></button>
			    </div>
			</div>

			<div class="auth-overlay" id="wpmUserOverlay" hidden>
				<div class="modal auth-modal" id="wpmUserModal" role="dialog" aria-modal="true" aria-labelledby="wpmUserTitle">
					<div class="modal-header">
						<div class="modal-title auth-modal-title" id="wpmUserTitle"><?php if ($appLogoUrl !== ''): ?><img class="auth-modal-logo" src="<?=h($appLogoUrl)?>" alt=""><?php endif; ?><span class="auth-modal-title-text"><?=h(mdw_t('wpm.setup_title','WPM setup'))?></span></div>
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
						<div class="modal-title auth-modal-title" id="authModalTitle"><?php if ($appLogoUrl !== ''): ?><img class="auth-modal-logo" src="<?=h($appLogoUrl)?>" alt=""><?php endif; ?><span class="auth-modal-title-text"><?=h($APP_NAME)?></span></div>
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
				        <details class="theme-modal-section" style="margin-bottom: 0.8rem;">
				            <summary class="theme-modal-summary"><span class="pi pi-leftcaret modal-caret" aria-hidden="true"></span><span><?=h(mdw_t('theme.ui.title','User interface'))?></span></summary>
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
			                <label class="modal-label" for="internalLinkPrefixInput"><?=h(mdw_t('theme.internal_links.prefix_label','Internal link URL prefix'))?></label>
				                <div class="modal-row" style="gap: 0.6rem; margin: 0;">
				                    <input id="internalLinkPrefixInput" type="text" class="input" style="flex: 1 1 auto;" placeholder="<?=h(mdw_t('theme.internal_links.prefix_placeholder','https://example.com/markdownmanager/'))?>" value="<?=h($internalLinkPrefix)?>" data-auth-superuser-enable="1">
				                    <button type="button" class="btn btn-ghost btn-small" id="internalLinkPrefixSaveBtn" data-auth-superuser-enable="1"><?=h(mdw_t('theme.internal_links.prefix_save','Save prefix'))?></button>
				                </div>
				                <div id="internalLinkPrefixStatus" class="status-text" style="margin-top: 0.35rem;">
				                    <?=h(mdw_t('theme.internal_links.prefix_hint','Prefix is added before index.php?file= (leave empty for relative links).'))?>
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
			                <label class="modal-label" for="paneHeaderOrderSelect"><?=h(mdw_t('theme.pane_header.label','Pane header order'))?></label>
			                <select id="paneHeaderOrderSelect" class="input" data-auth-superuser-enable="1">
			                    <option value="actions_left" <?= $paneHeaderOrder === 'actions_left' ? 'selected' : '' ?>><?=h(mdw_t('theme.pane_header.actions_left','Toolbar left, title right'))?></option>
			                    <option value="title_left" <?= $paneHeaderOrder === 'title_left' ? 'selected' : '' ?>><?=h(mdw_t('theme.pane_header.title_left','Title left, toolbar right'))?></option>
			                </select>
			                <div id="paneHeaderOrderStatus" class="status-text" style="margin-top: 0.35rem;">
			                    <?=h(mdw_t('theme.pane_header.hint','Saved for all users. Toolbar remains visible when space is limited.'))?>
			                </div>
			            </div>

            <div class="modal-field" data-auth-superuser="1">
	                <div class="modal-label"><?=h(mdw_t('theme.index_layout.label','Index overview layout'))?></div>
				                <label style="display:flex; align-items:center; gap:0.5rem; margin-top: 0.35rem;">
				                    <input id="indexDualPaneToggle" type="checkbox" <?= $indexDualPaneEnabled ? 'checked' : '' ?> data-auth-superuser-enable="1">
				                    <span class="status-text"><?=h(mdw_t('theme.index_layout.dual','Show overview + preview split view'))?></span>
				                </label>
				                <label style="display:flex; align-items:center; gap:0.5rem; margin-top: 0.35rem;">
				                    <input id="hideMarkdownEditorToggle" type="checkbox" <?= $hideMarkdownEditor ? 'checked' : '' ?> data-auth-superuser-enable="1">
				                    <span class="status-text"><?=h(mdw_t('theme.index_layout.hide_markdown','Hide markdown'))?></span>
				                </label>
				                <div id="indexLayoutStatus" class="status-text" style="margin-top: 0.35rem;">
				                    <?=h(mdw_t('theme.index_layout.hint','Turn off to use the classic overview-only index page.'))?>
	                </div>
	            </div>

            <?php if (!empty($MDW_PUBLISHER_MODE)): ?>
            <div class="modal-field" data-auth-superuser="1">
                <div class="modal-label"><?=h(mdw_t('theme.custom_format.label','Custom format sources'))?></div>
                <label style="display:flex; align-items:center; gap:0.5rem; margin-top: 0.35rem;">
                    <input id="customFormatCustomCssToggle" type="checkbox" <?= $customFormatCss ? 'checked' : '' ?> data-auth-superuser-enable="1">
                    <span class="status-text"><?=h(mdw_t('theme.custom_format.custom_css','Show custom.css'))?></span>
                </label>
                <label style="display:flex; align-items:center; gap:0.5rem; margin-top: 0.35rem;">
                    <input id="customFormatSectionsToggle" type="checkbox" <?= $customFormatSections ? 'checked' : '' ?> data-auth-superuser-enable="1">
                    <span class="status-text"><?=h(mdw_t('theme.custom_format.sections','Show sections'))?></span>
                </label>
                <div id="customFormatStatus" class="status-text" style="margin-top: 0.35rem;">
                    <?=h(mdw_t('theme.custom_format.hint','Choose which sources appear in the custom format toolbar.'))?>
                </div>
            </div>
            <div class="modal-field" data-auth-superuser="1">
                <div class="modal-label"><?=h(mdw_t('theme.critical_sections.label','Critical custom sections'))?></div>
                <div id="criticalSectionsList" style="display:flex; flex-direction:column; gap:0.35rem;"></div>
                <div id="criticalSectionsStatus" class="status-text" style="margin-top:0.35rem;"><?=h(mdw_t('theme.critical_sections.hint','Warn regular users before they send Markdown containing these sections.'))?></div>
            </div>
            <?php endif; ?>

            <div class="modal-field" data-auth-superuser="1">
                <div class="modal-label"><?=h(mdw_t('theme.asset_paths.title','Asset paths'))?></div>
                <label class="modal-label" for="staticPathInput"><?=h(mdw_t('theme.asset_paths.static_label','Static folder path'))?></label>
                <input id="staticPathInput" type="text" class="input" value="<?=h($assetStaticPath)?>" data-auth-superuser-enable="1">
                <label class="modal-label" for="imagesPathInput" style="margin-top: 0.5rem;"><?=h(mdw_t('theme.asset_paths.images_label','Images folder path'))?></label>
                <input id="imagesPathInput" type="text" class="input" value="<?=h($assetImagesPath)?>" data-auth-superuser-enable="1">
                <label class="modal-label" for="appLogoInput" style="margin-top: 0.5rem;"><?=h(mdw_t('theme.asset_paths.logo_label','App logo'))?></label>
                <input id="appLogoInput" type="text" class="input" list="appLogoImageOptions" value="<?=h($appLogoFile)?>" placeholder="logo.svg" data-auth-superuser-enable="1">
                <datalist id="appLogoImageOptions"></datalist>
                <img id="appLogoPreview" class="settings-logo-preview" alt="" hidden>
                <div class="status-text" style="margin-top: 0.35rem;"><?=h(mdw_t('theme.asset_paths.logo_hint','Choose a PNG or SVG from the images folder. Leave empty for the default logo.'))?></div>
                <div class="status-text" style="margin-top: 0.35rem;"><?=h(mdw_t('theme.asset_paths.hint','Relative to the editor folder, for example ../static and ../static/images.'))?></div>
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
					            </div>
					        </div>
					    </details>

					    <details class="theme-modal-section" style="margin-top: 0.8rem;">
					        <summary class="theme-modal-summary"><span class="pi pi-leftcaret modal-caret" aria-hidden="true"></span><span><?=h(mdw_t('theme.html_preview.title','HTML preview settings'))?></span></summary>
					        <div style="margin-top: 0.75rem; display:flex; flex-direction:column; gap: 0.75rem;">
					            <div class="modal-field" data-auth-superuser="1">
					                <div class="modal-label"><?=h(mdw_t('theme.copy.title','Copy buttons'))?></div>
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
					                <label class="modal-label" for="exportClassPrefixInput" style="margin-top: 0.5rem;"><?=h(mdw_t('theme.copy.class_prefix_label','Export class prefix'))?></label>
					                <div class="modal-row" style="gap: 0.6rem; margin: 0;">
					                    <input id="exportClassPrefixInput" type="text" class="input" style="flex: 1 1 auto;" placeholder="<?=h(mdw_t('theme.copy.class_prefix_placeholder','md-'))?>" value="<?=h($exportClassPrefix)?>" data-auth-superuser-enable="1">
					                    <button type="button" class="btn btn-ghost btn-small" id="exportClassPrefixSaveBtn" data-auth-superuser-enable="1"><?=h(mdw_t('theme.copy.class_prefix_save','Save prefix'))?></button>
					                </div>
					                <div id="exportClassPrefixStatus" class="status-text" style="margin-top: 0.35rem;">
					                    <?=h(mdw_t('theme.copy.class_prefix_hint','Applies to medium/wet HTML export; dry export removes all classes.'))?>
					                </div>
					                <label class="modal-label" for="tocMenuSelect" style="margin-top: 0.5rem;"><?=h(mdw_t('theme.toc_menu.label','TOC menu'))?></label>
					                <select id="tocMenuSelect" class="input" data-auth-superuser-enable="1">
					                    <option value="inline" <?= $tocMenu === 'inline' ? 'selected' : '' ?>><?=h(mdw_t('theme.toc_menu.option_inline','Inline (default)'))?></option>
					                    <option value="left" <?= $tocMenu === 'left' ? 'selected' : '' ?>><?=h(mdw_t('theme.toc_menu.option_left','Left sidebar'))?></option>
					                    <option value="right" <?= $tocMenu === 'right' ? 'selected' : '' ?>><?=h(mdw_t('theme.toc_menu.option_right','Right sidebar'))?></option>
					                </select>
					                <label class="modal-label" for="tocExportStyleSelect" style="margin-top: 0.5rem;"><?=h(mdw_t('theme.toc_menu.export_label','TOC export format'))?></label>
					                <select id="tocExportStyleSelect" class="input" data-auth-superuser-enable="1">
					                    <option value="list" <?= $tocExportStyle === 'list' ? 'selected' : '' ?>><?=h(mdw_t('theme.toc_menu.export_list','List'))?></option>
					                    <option value="flat_links" <?= $tocExportStyle === 'flat_links' ? 'selected' : '' ?>><?=h(mdw_t('theme.toc_menu.export_flat_links','Flat links'))?></option>
					                </select>
					                <?php if (!empty($MDW_PUBLISHER_MODE)): ?>
					                <label style="display:flex; align-items:center; gap:0.5rem; margin-top: 0.35rem;">
					                    <input id="tocButtonToggle" type="checkbox" <?= $tocButtonEnabled ? 'checked' : '' ?> data-auth-superuser-enable="1">
					                    <span class="status-text"><?=h(mdw_t('theme.toc_menu.show_button','Show TOC toolbar button'))?></span>
					                </label>
					                <?php endif; ?>
					                <div id="copySettingsStatus" class="status-text" style="margin-top: 0.35rem;">
					                    <?=h(mdw_t('theme.copy.hint','Saved for all users.'))?>
					                </div>
					                <div id="tocMenuStatus" class="status-text" style="margin-top: 0.35rem;">
					                    <?=h(mdw_t('theme.toc_menu.hint','Side menu appears in preview/view and only exports in wet HTML.'))?>
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

					    <details class="theme-modal-section" style="margin-top: 0.8rem;">
					        <summary class="theme-modal-summary"><span class="pi pi-leftcaret modal-caret" aria-hidden="true"></span><span><?=h(mdw_t('theme.theme_settings.title','Theme settings'))?></span></summary>
					        <div style="margin-top: 0.75rem; display:flex; flex-direction:column; gap: 0.75rem;">
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

					        <div style="margin-top: 0.35rem;">
						            <div class="modal-label" style="font-weight: 600;"><?=h(mdw_t('theme.overrides.summary','Theme adjustments (optional)'))?></div>
					            <div style="margin-top: 0.55rem; display:flex; flex-direction:column; gap: 0.75rem;">
					                <div class="status-text">
					                    <?=h(mdw_t('theme.overrides.saved_auto','Theme adjustments are saved in your browser (localStorage) automatically as you type.'))?>
				                    <span id="themeOverridesStatus" class="chip theme-overrides-status" hidden aria-live="polite"></span>
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
					        </div>
					        </div>
					    </details>

				        <details class="theme-modal-section" style="margin-top: 0.8rem;">
				            <summary class="theme-modal-summary"><span class="pi pi-leftcaret modal-caret" aria-hidden="true"></span><span><?=h(mdw_t('theme.metadata.title','Metadata'))?></span></summary>
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
				                        <?=h(mdw_t('theme.publisher.hint','WPM adds publish states (Concept / Processing / Published) and shows them in the overview. Requires an author name; subtitle requirement is optional.'))?>
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
				                <?php if (!empty($aw_ssg_template_plugin_loaded)): ?>
				                <div class="modal-field" style="margin: 0;">
				                    <label class="modal-label" for="jinjaMetaPrefixInput"><?=h(mdw_t('theme.metadata.jinja_prefix_label','Jinja mapped prefix'))?></label>
				                    <div class="modal-row" style="gap: 0.6rem; margin: 0;">
				                        <input id="jinjaMetaPrefixInput" type="text" class="input" style="flex: 1 1 auto;" value="<?=h($jinjaMetaPrefix)?>" placeholder="<?=h(mdw_t('theme.metadata.jinja_prefix_placeholder','page_'))?>">
				                        <button type="button" class="btn btn-ghost btn-small" id="jinjaMetaPrefixSaveBtn"><?=h(mdw_t('theme.metadata.jinja_prefix_save','Save prefix'))?></button>
				                    </div>
				                    <div id="jinjaMetaPrefixStatus" class="status-text" style="margin-top: 0.35rem;">
				                        <?=h(mdw_t('theme.metadata.jinja_prefix_hint','Maps metadata keys like page_picture -> blog_picture in Template download (default: page_).'))?>
				                    </div>
				                </div>
				                <?php endif; ?>
				                <div style="display:grid; grid-template-columns: 1fr auto auto auto minmax(10rem, 1fr); gap: 0.5rem 0.75rem; align-items:center;">
				                    <div class="status-text" style="font-weight: 600;"><?=h(mdw_t('theme.metadata.field','Field'))?></div>
				                    <div class="status-text" style="font-weight: 600;"><?=h(mdw_t('theme.metadata.show_markdown','Markdown'))?></div>
				                    <div class="status-text" style="font-weight: 600;"><?=h(mdw_t('theme.metadata.show_html','HTML'))?></div>
				                    <div class="status-text" style="font-weight: 600;"><?=h(mdw_t('theme.metadata.obligatory','Obligatory'))?></div>
				                    <div class="status-text" style="font-weight: 600;"><?=h(mdw_t('theme.metadata.default_value','Default value'))?></div>
				                    <?php foreach (($META_CFG['fields'] ?? []) as $k => $f): ?>
				                        <?php
				                            $label = (string)($f['label'] ?? $k);
				                            $mdVis = !empty($f['markdown_visible']);
				                            $allowHtmlNoMd = ($k === 'author');
				                            $htmlVis = !empty($f['html_visible']) && ($mdVis || $allowHtmlNoMd);
				                            $obligatory = !empty($f['obligatory']);
				                            $defaultValue = trim((string)($f['default_value'] ?? ''));
				                            $defaultIsBoolean = in_array(strtolower($defaultValue), ['true', 'false'], true);
				                        ?>
				                        <div><?=h($label)?></div>
				                        <label class="checkbox" style="display:inline-flex; align-items:center; justify-content:center;">
				                            <input type="checkbox" data-meta-scope="base" data-meta-key="<?=h($k)?>" data-meta-field="markdown" <?= $mdVis ? 'checked' : '' ?>>
				                        </label>
				                        <label class="checkbox" style="display:inline-flex; align-items:center; justify-content:center;">
				                            <input type="checkbox" data-meta-scope="base" data-meta-key="<?=h($k)?>" data-meta-field="html" <?= $htmlVis ? 'checked' : '' ?> <?= ($mdVis || $allowHtmlNoMd) ? '' : 'disabled' ?>>
				                        </label>
				                        <label class="checkbox" style="display:inline-flex; align-items:center; justify-content:center;">
				                            <input type="checkbox" data-meta-scope="base" data-meta-key="<?=h($k)?>" data-meta-field="obligatory" <?= $obligatory ? 'checked' : '' ?>>
				                        </label>
				                        <?php if ($defaultIsBoolean): ?>
				                        <label class="checkbox" style="display:inline-flex; align-items:center; justify-content:flex-start; gap:0.4rem;">
				                            <input type="checkbox" data-meta-scope="base" data-meta-key="<?=h($k)?>" data-meta-field="default_value_boolean" <?= strtolower($defaultValue) === 'true' ? 'checked' : '' ?> aria-label="<?=h(mdw_t('theme.metadata.default_value','Default value'))?>">
				                            <span class="status-text" data-meta-boolean-label></span>
				                        </label>
				                        <?php else: ?>
				                        <input type="text" class="input" data-meta-scope="base" data-meta-key="<?=h($k)?>" data-meta-field="default_value" value="<?=h($defaultValue)?>" placeholder="<?=h(mdw_t('theme.metadata.default_value_placeholder','e.g. True'))?>">
				                        <?php endif; ?>
				                    <?php endforeach; ?>
				                </div>
				                <div id="publisherMetaFields" style="<?= $publisherMode ? '' : 'display:none;' ?> border-top: 1px solid var(--border-soft); padding-top: 0.75rem; margin-top: 0.25rem;">
				                    <div class="status-text" style="font-weight: 600; margin-bottom: 0.4rem;"><?=h(mdw_t('theme.publisher.title','WPM (Website publication mode)'))?></div>
				                    <div style="display:grid; grid-template-columns: 1fr auto auto auto minmax(10rem, 1fr); gap: 0.5rem 0.75rem; align-items:center;">
				                        <div class="status-text" style="font-weight: 600;"><?=h(mdw_t('theme.metadata.field','Field'))?></div>
				                        <div class="status-text" style="font-weight: 600;"><?=h(mdw_t('theme.metadata.show_markdown','Markdown'))?></div>
				                        <div class="status-text" style="font-weight: 600;"><?=h(mdw_t('theme.metadata.show_html','HTML'))?></div>
				                        <div class="status-text" style="font-weight: 600;"><?=h(mdw_t('theme.metadata.obligatory','Obligatory'))?></div>
				                        <div class="status-text" style="font-weight: 600;"><?=h(mdw_t('theme.metadata.default_value','Default value'))?></div>
				                        <?php foreach (($META_PUBLISHER_CFG['fields'] ?? []) as $k => $f): ?>
				                            <?php
				                                $label = (string)($f['label'] ?? $k);
				                                $mdVis = !empty($f['markdown_visible']);
				                                $allowHtmlNoMd = ($k === 'author');
				                                $htmlVis = !empty($f['html_visible']) && ($mdVis || $allowHtmlNoMd);
				                                $obligatory = !empty($f['obligatory']);
				                                $defaultValue = trim((string)($f['default_value'] ?? ''));
				                                $defaultIsBoolean = in_array(strtolower($defaultValue), ['true', 'false'], true);
				                            ?>
				                            <div><?=h($label)?></div>
				                            <label class="checkbox" style="display:inline-flex; align-items:center; justify-content:center;">
				                                <input type="checkbox" data-meta-scope="publisher" data-meta-key="<?=h($k)?>" data-meta-field="markdown" <?= $mdVis ? 'checked' : '' ?>>
				                            </label>
				                            <label class="checkbox" style="display:inline-flex; align-items:center; justify-content:center;">
				                                <input type="checkbox" data-meta-scope="publisher" data-meta-key="<?=h($k)?>" data-meta-field="html" <?= $htmlVis ? 'checked' : '' ?> <?= ($mdVis || $allowHtmlNoMd) ? '' : 'disabled' ?>>
				                            </label>
				                            <label class="checkbox" style="display:inline-flex; align-items:center; justify-content:center;">
				                                <input type="checkbox" data-meta-scope="publisher" data-meta-key="<?=h($k)?>" data-meta-field="obligatory" <?= $obligatory ? 'checked' : '' ?>>
				                            </label>
				                            <?php if ($defaultIsBoolean): ?>
				                            <label class="checkbox" style="display:inline-flex; align-items:center; justify-content:flex-start; gap:0.4rem;">
				                                <input type="checkbox" data-meta-scope="publisher" data-meta-key="<?=h($k)?>" data-meta-field="default_value_boolean" <?= strtolower($defaultValue) === 'true' ? 'checked' : '' ?> aria-label="<?=h(mdw_t('theme.metadata.default_value','Default value'))?>">
				                                <span class="status-text" data-meta-boolean-label></span>
				                            </label>
				                            <?php else: ?>
				                            <input type="text" class="input" data-meta-scope="publisher" data-meta-key="<?=h($k)?>" data-meta-field="default_value" value="<?=h($defaultValue)?>" placeholder="<?=h(mdw_t('theme.metadata.default_value_placeholder','e.g. True'))?>">
				                            <?php endif; ?>
				                        <?php endforeach; ?>
				                    </div>
				                </div>
				                <div style="display:flex; align-items:center; gap: 0.6rem; justify-content:flex-end;">
				                    <span id="metaSettingsStatus" class="status-text"></span>
				                    <button type="button" class="btn btn-ghost btn-small" id="metaSettingsSaveBtn"><?=h(mdw_t('theme.metadata.save','Save metadata settings'))?></button>
				                </div>
				            </div>
				        </details>
                        <?php if ($github_pages_plugin_loaded): ?>
                        <details class="theme-modal-section" style="margin-top: 0.8rem;" data-auth-superuser="1">
                            <summary class="theme-modal-summary"><span class="pi pi-leftcaret modal-caret" aria-hidden="true"></span><span><?=h(mdw_t('theme.github_pages.title','GitHub Pages export'))?></span></summary>
                            <div style="margin-top: 0.75rem; display:flex; flex-direction:column; gap: 0.6rem;">
                                <div class="status-text"><?=h(mdw_t('theme.github_pages.hint','Run a configuration check before exporting.'))?></div>
                                <div style="display:flex; align-items:center; gap: 0.6rem; flex-wrap: wrap;">
                                    <button type="button" id="githubPagesCheckBtn" class="btn btn-ghost btn-small" data-auth-superuser-enable="1"><?=h(mdw_t('theme.github_pages.check_btn','Check GitHub Pages config'))?></button>
                                </div>
                                <div id="githubPagesCheckStatus" class="status-text"></div>
                                <div id="githubPagesCheckDetails" class="status-text" style="white-space: pre-line;"></div>
                            </div>
                        </details>
                        <?php endif; ?>
				        <details class="theme-modal-section" style="margin-top: 0.8rem;" data-auth-superuser="1">
				            <summary class="theme-modal-summary"><span class="pi pi-leftcaret modal-caret" aria-hidden="true"></span><span><?=h(mdw_t('theme.settings_io.title','Settings import/export'))?></span></summary>
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
	window.CURRENT_FILE = <?= mdw_json_for_script($requested ?? '') ?>;
	window.initialContent = <?= mdw_json_for_script($current_content ?? '') ?>;
	window.IS_SECRET_AUTHENTICATED = <?= mdw_json_for_script(is_secret_authenticated()) ?>;
	window.MDW_THEMES_DIR = <?= mdw_json_for_script($THEMES_DIR) ?>;
	window.MDW_IMAGES_URL = <?= mdw_json_for_script(mdw_asset_relative_path('images_path', 'IMAGES_PATH', $IMAGES_DIR)) ?>;
	window.MDW_THEMES = <?= mdw_json_for_script($themesList) ?>;
	window.MDW_TRANSLATIONS_DIR = <?= mdw_json_for_script($TRANSLATIONS_DIR) ?>;
	window.MDW_LANG = <?= mdw_json_for_script($MDW_LANG) ?>;
	window.MDW_LANGS = <?= mdw_json_for_script($MDW_LANGS) ?>;
	window.MDW_I18N = <?= mdw_json_for_script($GLOBALS['MDW_I18N'] ?? new stdClass()) ?>;
	window.MDW_CSRF = <?= mdw_json_for_script($CSRF_TOKEN) ?>;
	window.MDW_AUTH_META = <?= mdw_json_for_script($MDW_AUTH_META) ?>;
	window.MDW_META_CONFIG = <?= mdw_json_for_script($META_CFG_CLIENT) ?>;
	window.MDW_META_PUBLISHER_CONFIG = <?= mdw_json_for_script($META_PUBLISHER_CFG) ?>;
	window.MDW_SECTION_SNIPPETS = <?= mdw_json_for_script(mdw_section_snippets(__DIR__ . '/sections')) ?>;
	</script>

<script defer src="<?=h(mdw_static_asset('mdm.dom.js'))?>"></script>
<script defer src="<?=h(mdw_static_asset('mdm.api.js'))?>"></script>
<script defer src="<?=h(mdw_static_asset('mdm.ui.js'))?>"></script>
<script defer src="<?=h(mdw_static_asset('mdm.auth.js'))?>"></script>
<script defer src="<?=h(mdw_static_asset('mdm.settings.js'))?>"></script>
<script defer src="<?=h(mdw_static_asset('mdm.splitter.js'))?>"></script>
<script defer src="<?=h(mdw_static_asset('mdm.editor.js'))?>"></script>
<script defer src="<?=h(mdw_static_asset('mdm.explorer.js'))?>"></script>
<script defer src="<?=h(mdw_static_asset('mdm.modals.js'))?>"></script>
<script defer src="<?=h(mdw_static_asset('mdm.layout.js'))?>"></script>
<script defer src="<?=h(mdw_static_asset('mdm.core.js'))?>"></script>
<?php if ($github_pages_plugin_loaded): ?>
<script defer src="<?=h(mdw_static_asset('github_pages_export.js'))?>"></script>
<?php endif; ?>

</body>
</html>
