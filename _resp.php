<?php
declare(strict_types=1);

function json(array $data, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function redirect(string $url, int $code = 302): void {
    http_response_code($code);
    header('Location: ' . $url);
    exit;
}

function html(string $s, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: text/html; charset=utf-8');
    echo $s;
    exit;
}
