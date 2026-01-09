<?php

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

$action = isset($data['action']) ? (string)$data['action'] : '';
$auth = mdw_auth_config();

if ($action === 'status') {
    echo json_encode([
        'ok' => true,
        'has_user' => $auth['user_hash'] !== '',
        'has_superuser' => $auth['superuser_hash'] !== '',
    ]);
    exit;
}

if ($action === 'setup') {
    if ($auth['user_hash'] !== '' || $auth['superuser_hash'] !== '') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'already_set']);
        exit;
    }
    $userPw = isset($data['user_password']) ? trim((string)$data['user_password']) : '';
    $superPw = isset($data['superuser_password']) ? trim((string)$data['superuser_password']) : '';
    if ($userPw === '' || $superPw === '') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'missing_password']);
        exit;
    }

    $userHash = mdw_auth_hash_password($userPw);
    $superHash = mdw_auth_hash_password($superPw);
    if ($userHash === '' || $superHash === '') {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'hash_failed']);
        exit;
    }
    $cfg = mdw_metadata_load_config();
    $cfg['_auth'] = [
        'user_hash' => $userHash,
        'superuser_hash' => $superHash,
    ];

    [$ok, $msg] = mdw_metadata_save_config($cfg);
    if (!$ok) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'write_failed', 'message' => $msg]);
        exit;
    }

    echo json_encode([
        'ok' => true,
        'role' => 'superuser',
        'token' => $superHash,
        'has_user' => $userHash !== '',
        'has_superuser' => $superHash !== '',
    ]);
    exit;
}

if ($action === 'login') {
    $role = isset($data['role']) ? (string)$data['role'] : '';
    $password = isset($data['password']) ? (string)$data['password'] : '';
    $password = trim($password);
    if ($password === '') {
        http_response_code(400);
        echo json_encode(['ok' => false, 'error' => 'missing_password']);
        exit;
    }
    $matches = ['user' => false, 'superuser' => false];
    if ($role === '') {
        $matchSuper = $auth['superuser_hash'] !== '' && mdw_auth_verify_password($password, $auth['superuser_hash']);
        $matchUser = $auth['user_hash'] !== '' && mdw_auth_verify_password($password, $auth['user_hash']);
        $matches['superuser'] = $matchSuper;
        $matches['user'] = $matchUser;
        if ($matchSuper) $role = 'superuser';
        else if ($matchUser) $role = 'user';
        else {
            http_response_code(403);
            echo json_encode(['ok' => false, 'error' => 'invalid_password']);
            exit;
        }
    } else {
        if ($role !== 'user' && $role !== 'superuser') {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'invalid_role']);
            exit;
        }
        if ($role === 'user' && $auth['user_hash'] === '') {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'user_not_set']);
            exit;
        }
        if ($role === 'superuser' && $auth['superuser_hash'] === '') {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'superuser_not_set']);
            exit;
        }
        $stored = $role === 'superuser' ? $auth['superuser_hash'] : $auth['user_hash'];
        if (!mdw_auth_verify_password($password, $stored)) {
            http_response_code(403);
            echo json_encode(['ok' => false, 'error' => 'invalid_password']);
            exit;
        }
        $matches[$role] = true;
        $otherRole = $role === 'superuser' ? 'user' : 'superuser';
        $otherKey = $otherRole . '_hash';
        if ($auth[$otherKey] !== '' && mdw_auth_verify_password($password, $auth[$otherKey])) {
            $matches[$otherRole] = true;
        }
    }

    $rehash = [];
    foreach (['user', 'superuser'] as $maybeRole) {
        $key = $maybeRole . '_hash';
        $stored = $auth[$key];
        if (!$matches[$maybeRole] || $stored === '') continue;
        if (!mdw_auth_password_needs_rehash($stored)) continue;
        $newHash = mdw_auth_hash_password($password);
        if ($newHash !== '') {
            $rehash[$key] = $newHash;
        }
    }
    if ($rehash) {
        $cfg = mdw_metadata_load_config();
        $cfg['_auth'] = isset($cfg['_auth']) && is_array($cfg['_auth']) ? $cfg['_auth'] : [];
        foreach ($rehash as $key => $val) {
            $cfg['_auth'][$key] = $val;
            $auth[$key] = $val;
        }
        mdw_metadata_save_config($cfg);
    }

    $stored = $role === 'superuser' ? $auth['superuser_hash'] : $auth['user_hash'];

    echo json_encode([
        'ok' => true,
        'role' => $role,
        'token' => $stored,
        'has_user' => $auth['user_hash'] !== '',
        'has_superuser' => $auth['superuser_hash'] !== '',
    ]);
    exit;
}

http_response_code(400);
echo json_encode(['ok' => false, 'error' => 'invalid_action']);
