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
    $hash = mdw_auth_hash_password($password);
    if ($role === '') {
        $matchSuper = $auth['superuser_hash'] !== '' && hash_equals($auth['superuser_hash'], $hash);
        $matchUser = $auth['user_hash'] !== '' && hash_equals($auth['user_hash'], $hash);
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
        if (!hash_equals($stored, $hash)) {
            http_response_code(403);
            echo json_encode(['ok' => false, 'error' => 'invalid_password']);
            exit;
        }
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
