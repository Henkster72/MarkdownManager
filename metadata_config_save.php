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

$cfg = isset($data['config']) ? $data['config'] : null; // base fields map
$publisherCfgIn = isset($data['publisher_config']) ? $data['publisher_config'] : null; // publisher fields map
$settingsIn = isset($data['settings']) ? $data['settings'] : null;
$authIn = isset($data['auth']) ? $data['auth'] : null;

if (!is_array($cfg)) $cfg = [];
if (!is_array($publisherCfgIn)) $publisherCfgIn = [];
if ($cfg === [] && !is_array($settingsIn)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid_config']);
    exit;
}

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

$current = mdw_metadata_load_config();
$fields = isset($current['fields']) && is_array($current['fields']) ? $current['fields'] : [];

foreach ($fields as $k => $v) {
    $in = isset($cfg[$k]) && is_array($cfg[$k]) ? $cfg[$k] : [];
    $mdVis = isset($in['markdown_visible']) ? (bool)$in['markdown_visible'] : (bool)($v['markdown_visible'] ?? true);
    $htmlVis = isset($in['html_visible']) ? (bool)$in['html_visible'] : (bool)($v['html_visible'] ?? false);
    if (!$mdVis) $htmlVis = false;
    $fields[$k]['markdown_visible'] = $mdVis;
    $fields[$k]['html_visible'] = $htmlVis;
}

$out = $current;
$out['fields'] = $fields;

if (is_array($settingsIn)) {
    $curSettings = isset($out['_settings']) && is_array($out['_settings']) ? $out['_settings'] : [];

    $publisherMode = array_key_exists('publisher_mode', $settingsIn) ? !empty($settingsIn['publisher_mode']) : !empty($curSettings['publisher_mode']);
    $defaultAuthor = array_key_exists('publisher_default_author', $settingsIn) ? trim((string)($settingsIn['publisher_default_author'] ?? '')) : trim((string)($curSettings['publisher_default_author'] ?? ''));
    $requireH2 = array_key_exists('publisher_require_h2', $settingsIn) ? (bool)$settingsIn['publisher_require_h2'] : (!array_key_exists('publisher_require_h2', $curSettings) ? true : (bool)$curSettings['publisher_require_h2']);
    $allowUserDelete = array_key_exists('allow_user_delete', $settingsIn)
        ? (bool)$settingsIn['allow_user_delete']
        : (!array_key_exists('allow_user_delete', $curSettings) ? true : (bool)$curSettings['allow_user_delete']);
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

    $out['_settings'] = array_merge($curSettings, [
        'publisher_mode' => (bool)$publisherMode,
        'publisher_default_author' => $defaultAuthor,
        'publisher_require_h2' => (bool)$requireH2,
        'allow_user_delete' => (bool)$allowUserDelete,
        'ui_language' => $uiLanguage,
        'ui_theme' => $uiTheme,
        'theme_preset' => $themePreset,
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
foreach ($pubFields as $k => $v) {
    $in = isset($publisherCfgIn[$k]) && is_array($publisherCfgIn[$k]) ? $publisherCfgIn[$k] : [];
    $mdVis = isset($in['markdown_visible']) ? (bool)$in['markdown_visible'] : (bool)($v['markdown_visible'] ?? true);
    $htmlVis = isset($in['html_visible']) ? (bool)$in['html_visible'] : (bool)($v['html_visible'] ?? false);
    if (!$mdVis) $htmlVis = false;
    $pubFields[$k]['markdown_visible'] = $mdVis;
    $pubFields[$k]['html_visible'] = $htmlVis;
}
$outPub = $currentPub;
$outPub['fields'] = $pubFields;
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
]);
