<?php
declare(strict_types=1);

function mdw_path_normalize($path) {
    return str_replace("\\", "/", (string)$path);
}

function mdw_project_root() {
    static $root = null;
    if ($root === null) {
        $root = realpath(__DIR__);
        if ($root === false) $root = __DIR__;
    }
    return $root;
}

function mdw_path_within_root($path, $root = null) {
    $root = $root ?? mdw_project_root();
    if (!is_string($root) || $root === '') return false;
    $rootNorm = rtrim(mdw_path_normalize($root), '/');
    $pathNorm = mdw_path_normalize($path);
    if ($pathNorm === $rootNorm) return true;
    return str_starts_with($pathNorm, $rootNorm . '/');
}

function safe_note_path($root, $requested) {
    $requested = str_replace("\0", '', (string)$requested);

    if (str_starts_with($requested, '/') || preg_match('~^[A-Za-z]:[\\\/]~', $requested)) {
        throw new RuntimeException('Invalid path');
    }

    $full = realpath(rtrim((string)$root, "/\\") . '/' . $requested);
    if ($full === false) {
        throw new RuntimeException('Not found');
    }

    $rootReal = realpath((string)$root);
    if ($rootReal === false || !str_starts_with(mdw_path_normalize($full), mdw_path_normalize($rootReal) . '/')) {
        throw new RuntimeException('Path escape attempt');
    }

    return $full;
}

function mdw_safe_full_path($relativePath, $requireExists = true) {
    if (!is_string($relativePath) || $relativePath === '') return null;
    $root = mdw_project_root();
    if (!is_string($root) || $root === '') return null;
    $clean = mdw_path_normalize($relativePath);
    $clean = ltrim($clean, "/");
    if ($clean === '') return null;
    $full = rtrim($root, "/\\") . '/' . $clean;

    if ($requireExists) {
        try {
            $resolved = safe_note_path($root, $relativePath);
        } catch (RuntimeException $e) {
            return null;
        }
        if (!mdw_path_within_root($resolved, $root)) return null;
        return $full;
    }

    $parent = dirname($full);
    $parentResolved = realpath($parent);
    if ($parentResolved === false) return null;
    if (!mdw_path_within_root($parentResolved, $root)) return null;
    return $full;
}

function sanitize_md_path($path) {
    if (!$path) return null;
    if (strpos($path, '..') !== false) return null;

    $parts = explode('/', $path);
    if (count($parts) > 3) return null;
    foreach ($parts as $p) {
        if ($p === '') return null;
        if (!preg_match('/^[A-Za-z0-9._\-\p{L}\p{N}\p{So}]+$/u', $p)) return null;
    }

    if (!preg_match('/\.md$/i', end($parts))) return null;

    try {
        $full = safe_note_path(mdw_project_root(), $path);
    } catch (RuntimeException $e) {
        return null;
    }
    if (!is_file($full)) return null;

    return $path;
}

function sanitize_md_path_like($path) {
    if (!is_string($path)) return null;
    $path = trim($path);
    if ($path === '' || strpos($path, '..') !== false) return null;

    $path = str_replace("\\", '/', $path);
    $path = trim($path, '/');
    $parts = explode('/', $path);
    if (count($parts) > 3) return null;
    foreach ($parts as $p) {
        if ($p === '') return null;
        if (!preg_match('/^[A-Za-z0-9._\-\p{L}\p{N}\p{So}]+$/u', $p)) return null;
    }
    if (!preg_match('/\.md$/i', end($parts))) return null;
    return $path;
}

function sanitize_new_md_path($path) {
    if (!is_string($path) || trim($path) === '') return null;

    $path = trim($path);
    $path = str_replace("\\", '/', $path);
    $path = preg_replace('~/+~', '/', $path);
    $path = ltrim($path, '/');
    if ($path === '' || str_ends_with($path, '/')) return null;

    $hasMd = (bool)preg_match('/\.md$/i', $path);
    if (!$hasMd) $path .= '.md';

    $parts = explode('/', $path);
    if (count($parts) > 3) return null;
    $cleanParts = [];
    foreach ($parts as $p) {
        if ($p === '') return null;
        $p = preg_replace('/\s+/u', '-', $p);
        $p = preg_replace('/[^A-Za-z0-9._\-\p{L}\p{N}\p{So}]+/u', '', $p);
        $p = preg_replace('/-+/', '-', $p);
        $p = trim($p, '-');
        if ($p === '' || $p === '.' || $p === '..') return null;
        $cleanParts[] = $p;
    }

    $out = implode('/', $cleanParts);
    if (!preg_match('/\.md$/i', $out)) $out .= '.md';
    return $out;
}

function sanitize_new_md_slug($slug) {
    if (!is_string($slug)) return null;
    $slug = trim($slug);
    if ($slug === '') return null;
    $slug = preg_replace('/\.md$/i', '', $slug);
    $slug = str_replace(['\\', '/'], ' ', $slug);
    $slug = preg_replace('/\s+/u', '-', $slug);
    $slug = preg_replace('/[^A-Za-z0-9._\-\p{L}\p{N}]+/u', '', $slug);
    $slug = preg_replace('/-+/', '-', $slug);
    $slug = trim($slug, '-');
    $slug = trim($slug, '.');
    if ($slug === '' || $slug === '.' || $slug === '..') return null;
    return $slug;
}

function sanitize_folder_name($folder) {
    if (!is_string($folder)) return null;
    $folder = trim($folder);
    if ($folder === '') return null;
    if (strpos($folder, '..') !== false) return null;
    $folder = str_replace("\\", '/', $folder);
    $folder = trim($folder, '/');
    if ($folder === '') return null;
    $parts = explode('/', $folder);
    if (count($parts) > 2) return null;
    foreach ($parts as $p) {
        if ($p === '' || $p === '.' || $p === '..') return null;
        if (!preg_match('/^[A-Za-z0-9._\-\p{L}\p{N}\p{So}]+$/u', $p)) return null;
    }
    return implode('/', $parts);
}

function folder_from_path($path) {
    if (!$path) return null;
    $d = dirname($path);
    if ($d === '.' || $d === '') return 'root';
    return $d;
}
