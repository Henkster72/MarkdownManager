<?php
declare(strict_types=1);

require_once __DIR__ . '/_bootstrap.php';
require_once __DIR__ . '/html_preview.php';

function mdw_shared_auth_enabled(): bool
{
    return in_array(strtolower(trim((string)env_str('MDW_SHARED_AUTH', ''))), ['1', 'true', 'yes', 'on'], true);
}

function mdw_shared_auth_instance(): string
{
    return hash('sha256', (string)(realpath(__DIR__) ?: __DIR__));
}

function mdw_shared_auth_current_role(): string
{
    if (!mdw_shared_auth_enabled()) {
        return '';
    }

    $auth = $_SESSION['mdw_shared_auth'] ?? null;
    if (!is_array($auth) || ($auth['instance'] ?? '') !== mdw_shared_auth_instance()) {
        return '';
    }
    if ((int)($auth['expires_at'] ?? 0) < time()) {
        unset($_SESSION['mdw_shared_auth']);
        return '';
    }

    $role = (string)($auth['role'] ?? '');
    return in_array($role, ['user', 'superuser'], true) ? $role : '';
}

function mdw_shared_auth_login(string $role): bool
{
    if (!mdw_shared_auth_enabled() || !in_array($role, ['user', 'superuser'], true)) {
        return false;
    }

    session_regenerate_id(true);
    $_SESSION['mdw_shared_auth'] = [
        'instance' => mdw_shared_auth_instance(),
        'role' => $role,
        'expires_at' => time() + 8 * 60 * 60,
    ];
    return true;
}

function mdw_shared_auth_login_with_password(string $password): string
{
    $password = trim($password);
    if (!mdw_shared_auth_enabled() || $password === '') {
        return '';
    }

    $auth = mdw_auth_config();
    if ($auth['superuser_hash'] !== '' && mdw_auth_verify_password($password, $auth['superuser_hash'])) {
        mdw_shared_auth_login('superuser');
        return 'superuser';
    }
    if ($auth['user_hash'] !== '' && mdw_auth_verify_password($password, $auth['user_hash'])) {
        mdw_shared_auth_login('user');
        return 'user';
    }
    return '';
}

function mdw_shared_auth_logout(): void
{
    if (mdw_shared_auth_enabled()) {
        unset($_SESSION['mdw_shared_auth']);
    }
}
