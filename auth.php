<?php

require __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/html_preview.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json(['ok' => false, 'error' => 'method_not_allowed'], 405);
}

$raw = file_get_contents('php://input');
$data = json_decode((string)$raw, true);
if (!is_array($data)) {
    json(['ok' => false, 'error' => 'invalid_json'], 400);
}

$action = isset($data['action']) ? (string)$data['action'] : '';
$auth = mdw_auth_config();

if ($action === 'status') {
    json([
        'ok' => true,
        'has_user' => $auth['user_hash'] !== '',
        'has_superuser' => $auth['superuser_hash'] !== '',
    ]);
}

if ($action === 'setup') {
    if ($auth['user_hash'] !== '' || $auth['superuser_hash'] !== '') {
        json(['ok' => false, 'error' => 'already_set'], 400);
    }
    $userPw = isset($data['user_password']) ? trim((string)$data['user_password']) : '';
    $superPw = isset($data['superuser_password']) ? trim((string)$data['superuser_password']) : '';
    if ($userPw === '' || $superPw === '') {
        json(['ok' => false, 'error' => 'missing_password'], 400);
    }

    $userHash = mdw_auth_hash_password($userPw);
    $superHash = mdw_auth_hash_password($superPw);
    if ($userHash === '' || $superHash === '') {
        json(['ok' => false, 'error' => 'hash_failed'], 500);
    }
    $cfg = mdw_metadata_load_config();
    $cfg['_auth'] = [
        'user_hash' => $userHash,
        'superuser_hash' => $superHash,
    ];

    [$ok, $msg] = mdw_metadata_save_config($cfg);
    if (!$ok) {
        json(['ok' => false, 'error' => 'write_failed', 'message' => $msg], 500);
    }

    json([
        'ok' => true,
        'role' => 'superuser',
        'token' => $superHash,
        'has_user' => $userHash !== '',
        'has_superuser' => $superHash !== '',
    ]);
}

if ($action === 'login') {
    $role = isset($data['role']) ? (string)$data['role'] : '';
    $password = isset($data['password']) ? (string)$data['password'] : '';
    $password = trim($password);
    if ($password === '') {
        json(['ok' => false, 'error' => 'missing_password'], 400);
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
            json(['ok' => false, 'error' => 'invalid_password'], 403);
        }
    } else {
        if ($role !== 'user' && $role !== 'superuser') {
            json(['ok' => false, 'error' => 'invalid_role'], 400);
        }
        if ($role === 'user' && $auth['user_hash'] === '') {
            json(['ok' => false, 'error' => 'user_not_set'], 400);
        }
        if ($role === 'superuser' && $auth['superuser_hash'] === '') {
            json(['ok' => false, 'error' => 'superuser_not_set'], 400);
        }
        $stored = $role === 'superuser' ? $auth['superuser_hash'] : $auth['user_hash'];
        if (!mdw_auth_verify_password($password, $stored)) {
            json(['ok' => false, 'error' => 'invalid_password'], 403);
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

    json([
        'ok' => true,
        'role' => $role,
        'token' => $stored,
        'has_user' => $auth['user_hash'] !== '',
        'has_superuser' => $auth['superuser_hash'] !== '',
    ]);
}

json(['ok' => false, 'error' => 'invalid_action'], 400);
