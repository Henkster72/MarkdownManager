<?php

session_start();

require_once __DIR__ . '/env_loader.php';
require_once __DIR__ . '/html_preview.php';

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method_not_allowed']);
    exit;
}

$raw = file_get_contents('php://input');
$data = json_decode((string)$raw, true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid_json']);
    exit;
}

if (empty($_SESSION['csrf_token'])) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'no_session']);
    exit;
}

$csrf = isset($data['csrf']) ? (string)$data['csrf'] : '';
if (!hash_equals((string)$_SESSION['csrf_token'], $csrf)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'csrf']);
    exit;
}

$cfg = isset($data['config']) ? $data['config'] : null; // base fields map or config object
$publisherCfgIn = isset($data['publisher_config']) ? $data['publisher_config'] : null; // publisher fields map or config object
$settingsIn = isset($data['settings']) ? $data['settings'] : null;
$authIn = isset($data['auth']) ? $data['auth'] : null;

if (!is_array($cfg)) $cfg = [];
if (!is_array($publisherCfgIn)) $publisherCfgIn = [];
if ($cfg === [] && !is_array($settingsIn)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid_config']);
    exit;
}

$cfgFields = (isset($cfg['fields']) && is_array($cfg['fields'])) ? $cfg['fields'] : $cfg;
$publisherFieldsIn = (isset($publisherCfgIn['fields']) && is_array($publisherCfgIn['fields'])) ? $publisherCfgIn['fields'] : $publisherCfgIn;
$publisherHtmlMapIn = (isset($publisherCfgIn['html_map']) && is_array($publisherCfgIn['html_map'])) ? $publisherCfgIn['html_map'] : null;

$authRole = '';
$authToken = '';
if (is_array($authIn)) {
    $authRole = isset($authIn['role']) ? (string)$authIn['role'] : '';
    $authToken = isset($authIn['token']) ? (string)$authIn['token'] : '';
}
$authRequired = function_exists('mdw_auth_has_role')
    ? (mdw_auth_has_role('superuser') || mdw_auth_has_role('user'))
    : false;
if ($authRequired && !mdw_auth_verify_token('superuser', $authToken)) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'auth_required']);
    exit;
}

function mdw_wpm_sanitize_folder_name($folder) {
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
        if (!preg_match('/^[A-Za-z0-9._\\-\\p{L}\\p{N}\\p{So}]+$/u', $p)) return null;
    }
    return implode('/', $parts);
}

function mdw_wpm_reserved_names() {
    $pluginsDir = env_path('PLUGINS_DIR', __DIR__ . '/plugins', __DIR__);
    $staticDir = mdw_wpm_sanitize_folder_name(env_str('STATIC_DIR', 'static') ?? '') ?? 'static';
    $imagesDir = mdw_wpm_sanitize_folder_name(env_str('IMAGES_DIR', 'images') ?? '') ?? 'images';
    $themesDir = mdw_wpm_sanitize_folder_name(env_str('THEMES_DIR', 'themes') ?? '') ?? 'themes';
    $translationsDir = trim((string)env_str('TRANSLATIONS_DIR', 'translations'));
    if ($translationsDir === '') $translationsDir = 'translations';
    $toolsDir = 'tools';
    return [
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
}

function mdw_wpm_clean_folder_name($name) {
    $name = (string)$name;
    $name = preg_replace('/\\p{So}+/u', '', $name);
    $name = preg_replace('/[^A-Za-z0-9._\\-\\p{L}\\p{N}]+/u', '', $name);
    $name = preg_replace('/-+/', '-', $name);
    $name = trim($name, '-.');
    if ($name === '' || $name === '.' || $name === '..') {
        $name = 'folder';
    }
    return $name;
}

function mdw_wpm_unique_name($root, $base, $used) {
    $base = (string)$base;
    $root = rtrim((string)$root, "/\\");
    $candidate = $base;
    $i = 2;
    while (isset($used[$candidate]) || file_exists($root . '/' . $candidate)) {
        $candidate = $base . '-' . $i;
        $i++;
    }
    return $candidate;
}

function mdw_wpm_migrate_folders($root) {
    $warnings = [
        'renamed' => [],
        'moved' => [],
        'errors' => [],
    ];
    $root = rtrim((string)$root, "/\\");
    $reserved = mdw_wpm_reserved_names();

    $entries = @scandir($root);
    if (!is_array($entries)) {
        return $warnings;
    }

    $used = [];
    foreach ($entries as $entry) {
        if ($entry === '.' || $entry === '..') continue;
        if (is_dir($root . '/' . $entry)) {
            $used[$entry] = true;
        }
    }
    foreach ($reserved as $name => $_v) {
        $used[$name] = true;
    }

    foreach ($entries as $entry) {
        if ($entry === '.' || $entry === '..') continue;
        if ($entry === '' || $entry[0] === '.') continue;
        if (isset($reserved[$entry])) continue;
        $path = $root . '/' . $entry;
        if (!is_dir($path)) continue;

        $newTop = mdw_wpm_clean_folder_name($entry);
        if ($newTop !== $entry) {
            $newTop = mdw_wpm_unique_name($root, $newTop, $used);
            $target = $root . '/' . $newTop;
            if (@rename($path, $target)) {
                unset($used[$entry]);
                $used[$newTop] = true;
                $warnings['renamed'][] = ['from' => $entry, 'to' => $newTop];
                $entry = $newTop;
                $path = $target;
            } else {
                $err = error_get_last();
                $warnings['errors'][] = [
                    'from' => $entry,
                    'to' => $newTop,
                    'error' => $err && !empty($err['message']) ? $err['message'] : 'rename_failed',
                ];
            }
        }

        $subdirs = @scandir($path);
        if (!is_array($subdirs)) continue;
        foreach ($subdirs as $sub) {
            if ($sub === '.' || $sub === '..') continue;
            if ($sub === '' || $sub[0] === '.') continue;
            $subPath = $path . '/' . $sub;
            if (!is_dir($subPath)) continue;
            $clean = mdw_wpm_clean_folder_name($sub);
            $targetName = mdw_wpm_unique_name($root, $clean, $used);
            $targetPath = $root . '/' . $targetName;
            if (@rename($subPath, $targetPath)) {
                $used[$targetName] = true;
                $warnings['moved'][] = [
                    'from' => $entry . '/' . $sub,
                    'to' => $targetName,
                ];
            } else {
                $err = error_get_last();
                $warnings['errors'][] = [
                    'from' => $entry . '/' . $sub,
                    'to' => $targetName,
                    'error' => $err && !empty($err['message']) ? $err['message'] : 'move_failed',
                ];
            }
        }
    }

    return $warnings;
}

$current = mdw_metadata_load_config();
$fields = isset($current['fields']) && is_array($current['fields']) ? $current['fields'] : [];
foreach ($cfgFields as $k => $in) {
    if (!is_string($k) || trim($k) === '') continue;
    if (!is_array($in)) $in = [];
    $cur = (isset($fields[$k]) && is_array($fields[$k])) ? $fields[$k] : [];
    $label = isset($in['label']) ? trim((string)$in['label']) : trim((string)($cur['label'] ?? $k));
    if ($label === '') $label = $k;
    $mdVis = isset($in['markdown_visible']) ? (bool)$in['markdown_visible'] : (bool)($cur['markdown_visible'] ?? true);
    $htmlVis = isset($in['html_visible']) ? (bool)$in['html_visible'] : (bool)($cur['html_visible'] ?? false);
    if (!$mdVis) $htmlVis = false;
    $fields[$k] = [
        'label' => $label,
        'markdown_visible' => $mdVis,
        'html_visible' => $htmlVis,
    ];
}

$out = $current;
$out['fields'] = $fields;

if (is_array($settingsIn)) {
    $curSettings = isset($out['_settings']) && is_array($out['_settings']) ? $out['_settings'] : [];

    $wasPublisherMode = !empty($curSettings['publisher_mode']);
    $publisherMode = array_key_exists('publisher_mode', $settingsIn) ? !empty($settingsIn['publisher_mode']) : !empty($curSettings['publisher_mode']);
    $defaultAuthor = array_key_exists('publisher_default_author', $settingsIn) ? trim((string)($settingsIn['publisher_default_author'] ?? '')) : trim((string)($curSettings['publisher_default_author'] ?? ''));
    $requireH2 = array_key_exists('publisher_require_h2', $settingsIn) ? (bool)$settingsIn['publisher_require_h2'] : (!array_key_exists('publisher_require_h2', $curSettings) ? true : (bool)$curSettings['publisher_require_h2']);
    $allowUserPublish = array_key_exists('allow_user_publish', $settingsIn)
        ? (bool)$settingsIn['allow_user_publish']
        : (!array_key_exists('allow_user_publish', $curSettings) ? false : (bool)$curSettings['allow_user_publish']);
    $allowUserDelete = array_key_exists('allow_user_delete', $settingsIn)
        ? (bool)$settingsIn['allow_user_delete']
        : (!array_key_exists('allow_user_delete', $curSettings) ? true : (bool)$curSettings['allow_user_delete']);
    $copyButtonsEnabled = array_key_exists('copy_buttons_enabled', $settingsIn)
        ? (bool)$settingsIn['copy_buttons_enabled']
        : (!array_key_exists('copy_buttons_enabled', $curSettings) ? true : (bool)$curSettings['copy_buttons_enabled']);
    $copyIncludeMeta = array_key_exists('copy_include_meta', $settingsIn)
        ? (bool)$settingsIn['copy_include_meta']
        : (!array_key_exists('copy_include_meta', $curSettings) ? true : (bool)$curSettings['copy_include_meta']);
    $copyHtmlMode = array_key_exists('copy_html_mode', $settingsIn)
        ? trim((string)($settingsIn['copy_html_mode'] ?? ''))
        : trim((string)($curSettings['copy_html_mode'] ?? 'dry'));
    if (!in_array($copyHtmlMode, ['dry', 'medium', 'wet'], true)) $copyHtmlMode = 'dry';
    $tocMenu = array_key_exists('toc_menu', $settingsIn)
        ? strtolower(trim((string)($settingsIn['toc_menu'] ?? '')))
        : strtolower(trim((string)($curSettings['toc_menu'] ?? 'inline')));
    if (!in_array($tocMenu, ['inline', 'left', 'right'], true)) $tocMenu = 'inline';
    $postDateFormat = array_key_exists('post_date_format', $settingsIn)
        ? trim((string)($settingsIn['post_date_format'] ?? ''))
        : trim((string)($curSettings['post_date_format'] ?? 'mdy_short'));
    if (!in_array($postDateFormat, ['mdy_short', 'dmy_long'], true)) $postDateFormat = 'mdy_short';
    $postDateAlign = array_key_exists('post_date_align', $settingsIn)
        ? trim((string)($settingsIn['post_date_align'] ?? ''))
        : trim((string)($curSettings['post_date_align'] ?? 'left'));
    if (!in_array($postDateAlign, ['left', 'center', 'right'], true)) $postDateAlign = 'left';
    $folderIconStyle = array_key_exists('folder_icon_style', $settingsIn)
        ? strtolower(trim((string)($settingsIn['folder_icon_style'] ?? '')))
        : strtolower(trim((string)($curSettings['folder_icon_style'] ?? 'folder')));
    if ($folderIconStyle !== 'caret' && $folderIconStyle !== 'folder') $folderIconStyle = 'folder';
    $uiLanguage = array_key_exists('ui_language', $settingsIn)
        ? trim((string)($settingsIn['ui_language'] ?? ''))
        : trim((string)($curSettings['ui_language'] ?? ''));
    if ($uiLanguage !== '' && !preg_match('/^[a-z]{2}(-[A-Za-z0-9]+)?$/', $uiLanguage)) {
        $uiLanguage = '';
    }

    $uiTheme = array_key_exists('ui_theme', $settingsIn) ? strtolower(trim((string)($settingsIn['ui_theme'] ?? ''))) : strtolower(trim((string)($curSettings['ui_theme'] ?? '')));
    if ($uiTheme !== 'dark' && $uiTheme !== 'light') $uiTheme = '';

    $themePreset = array_key_exists('theme_preset', $settingsIn) ? trim((string)($settingsIn['theme_preset'] ?? '')) : trim((string)($curSettings['theme_preset'] ?? ''));
    if ($themePreset === '') $themePreset = 'default';

    $themeOverrides = array_key_exists('theme_overrides', $settingsIn)
        ? mdw_theme_overrides_normalize($settingsIn['theme_overrides'])
        : mdw_theme_overrides_normalize($curSettings['theme_overrides'] ?? []);
    $customCss = array_key_exists('custom_css', $settingsIn)
        ? mdw_sanitize_custom_css($settingsIn['custom_css'] ?? '')
        : mdw_sanitize_custom_css($curSettings['custom_css'] ?? '');

    $appTitle = array_key_exists('app_title', $settingsIn)
        ? trim((string)($settingsIn['app_title'] ?? ''))
        : trim((string)($curSettings['app_title'] ?? ''));
    $appTitle = preg_replace('/[\r\n]+/', ' ', $appTitle);
    if (is_string($appTitle) && strlen($appTitle) > 80) {
        $appTitle = substr($appTitle, 0, 80);
    }

    if ($publisherMode && $defaultAuthor === '') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'publisher_author_required']);
        exit;
    }

    $wpmMigration = null;
    if ($publisherMode && !$wasPublisherMode) {
        $wpmMigration = mdw_wpm_migrate_folders(__DIR__);
    }

    $out['_settings'] = array_merge($curSettings, [
        'publisher_mode' => (bool)$publisherMode,
        'publisher_default_author' => $defaultAuthor,
        'publisher_require_h2' => (bool)$requireH2,
        'allow_user_publish' => (bool)$allowUserPublish,
        'allow_user_delete' => (bool)$allowUserDelete,
        'copy_buttons_enabled' => (bool)$copyButtonsEnabled,
        'copy_include_meta' => (bool)$copyIncludeMeta,
        'copy_html_mode' => $copyHtmlMode,
        'toc_menu' => $tocMenu,
        'post_date_format' => $postDateFormat,
        'post_date_align' => $postDateAlign,
        'folder_icon_style' => $folderIconStyle,
        'ui_language' => $uiLanguage,
        'ui_theme' => $uiTheme,
        'theme_preset' => $themePreset,
        'theme_overrides' => $themeOverrides,
        'custom_css' => $customCss,
        'app_title' => $appTitle,
    ]);
}

[$ok, $msg] = mdw_metadata_save_config($out);
if (!$ok) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'write_failed', 'message' => $msg]);
    exit;
}

// Publisher config (separate file)
$currentPub = mdw_metadata_load_publisher_config();
$pubFields = isset($currentPub['fields']) && is_array($currentPub['fields']) ? $currentPub['fields'] : [];
foreach ($publisherFieldsIn as $k => $in) {
    if (!is_string($k) || trim($k) === '') continue;
    if (!is_array($in)) $in = [];
    $cur = (isset($pubFields[$k]) && is_array($pubFields[$k])) ? $pubFields[$k] : [];
    $label = isset($in['label']) ? trim((string)$in['label']) : trim((string)($cur['label'] ?? $k));
    if ($label === '') $label = $k;
    $mdVis = isset($in['markdown_visible']) ? (bool)$in['markdown_visible'] : (bool)($cur['markdown_visible'] ?? true);
    $htmlVis = isset($in['html_visible']) ? (bool)$in['html_visible'] : (bool)($cur['html_visible'] ?? false);
    if (!$mdVis) $htmlVis = false;
    $pubFields[$k] = [
        'label' => $label,
        'markdown_visible' => $mdVis,
        'html_visible' => $htmlVis,
    ];
}
$outPub = $currentPub;
$outPub['fields'] = $pubFields;
if (is_array($publisherHtmlMapIn)) {
    $outPub['html_map'] = $publisherHtmlMapIn;
}
[$ok2, $msg2] = mdw_metadata_save_publisher_config($outPub);
if (!$ok2) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'write_failed', 'message' => $msg2]);
    exit;
}

$cfgOut = mdw_metadata_normalize_config($out);
if (is_array($cfgOut) && array_key_exists('_auth', $cfgOut)) {
    unset($cfgOut['_auth']);
}
echo json_encode([
    'ok' => true,
    'config' => $cfgOut,
    'publisher_config' => mdw_metadata_normalize_publisher_config($outPub),
    'wpm_migration' => isset($wpmMigration) ? $wpmMigration : null,
]);
