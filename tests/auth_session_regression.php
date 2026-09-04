<?php
declare(strict_types=1);

$configPath = tempnam(sys_get_temp_dir(), 'mdw-auth-config-');
if ($configPath === false) {
    fwrite(STDERR, "Could not create temporary auth config\n");
    exit(1);
}

$superHash = hash('sha256', 'super-password');
$userHash = hash('sha256', 'user-password');
$config = ['_auth' => [
    'user_hash' => $userHash,
    'superuser_hash' => $superHash,
]];
if (@file_put_contents($configPath, json_encode($config) . "\n") === false) {
    fwrite(STDERR, "Could not write temporary auth config\n");
    exit(1);
}

putenv('METADATA_CONFIG_FILE=' . $configPath);
putenv('MDW_SHARED_AUTH=1');
putenv('MDW_SHARED_SESSION_NAME=MDW_AUTH_REGRESSION');
putenv('MDW_SHARED_SESSION_PATH=/');

require_once dirname(__DIR__) . '/env_loader.php';
require_once dirname(__DIR__) . '/shared_auth.php';

if (!mdw_shared_auth_login('superuser') || mdw_shared_auth_current_role() !== 'superuser') {
    fwrite(STDERR, "Shared auth login must survive non-destructive session rotation\n");
    @unlink($configPath);
    exit(1);
}
if (mdw_shared_auth_role_from_token('superuser', $superHash) !== 'superuser') {
    fwrite(STDERR, "A valid client token must restore the shared auth role\n");
    @unlink($configPath);
    exit(1);
}
if (mdw_shared_auth_role_from_token('superuser', $userHash) !== '' || mdw_shared_auth_role_from_token('user', 'invalid') !== '') {
    fwrite(STDERR, "Client token fallback must reject invalid role/token combinations\n");
    @unlink($configPath);
    exit(1);
}

@unlink($configPath);
echo "Authentication session regression checks passed\n";
