<?php

function load_dotenv_file(string $path): void
{
    if (!is_file($path) || !is_readable($path)) return;

    $lines = file($path, FILE_IGNORE_NEW_LINES);
    if ($lines === false) return;

    foreach ($lines as $line) {
        $line = trim((string)$line);
        if ($line === '' || str_starts_with($line, '#') || str_starts_with($line, ';')) continue;
        if (str_starts_with($line, 'export ')) $line = trim(substr($line, 7));

        $eqPos = strpos($line, '=');
        if ($eqPos === false) continue;

        $key = trim(substr($line, 0, $eqPos));
        $value = trim(substr($line, $eqPos + 1));
        if ($key === '') continue;

        // Don't override already-defined env vars.
        if (getenv($key) !== false) continue;
        if (array_key_exists($key, $_ENV) || array_key_exists($key, $_SERVER)) continue;

        if ($value !== '' && ($value[0] === '"' || $value[0] === "'")) {
            $q = $value[0];
            if (strlen($value) >= 2 && $value[strlen($value) - 1] === $q) {
                $value = substr($value, 1, -1);
            }
            if ($q === '"') {
                $value = str_replace(
                    ['\\n', '\\r', '\\t', '\\"', '\\\\'],
                    ["\n", "\r", "\t", '"', '\\'],
                    $value
                );
            }
        }

        $_ENV[$key] = $value;
        $_SERVER[$key] = $value;
        putenv($key . '=' . $value);
    }
}

function env_str(string $key, ?string $default = null): ?string
{
    $v = getenv($key);
    if ($v === false) return $default;
    return (string)$v;
}

function env_path(string $key, string $default, ?string $baseDir = null): string
{
    $raw = env_str($key, null);
    if ($raw === null) return $default;

    $raw = trim($raw);
    if ($raw === '') return $default;
    if (str_starts_with($raw, './')) $raw = substr($raw, 2);

    // Absolute Unix path or Windows drive path.
    if (str_starts_with($raw, '/') || preg_match('/^[A-Za-z]:[\\\\\\/]/', $raw)) return $raw;

    $baseDir = $baseDir ?? __DIR__;
    return rtrim($baseDir, "/\\") . '/' . ltrim($raw, "/\\");
}

load_dotenv_file(__DIR__ . '/.env');

