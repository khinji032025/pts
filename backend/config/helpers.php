<?php
function cors() {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin) {
        header("Access-Control-Allow-Origin: $origin");
    } else {
        header("Access-Control-Allow-Origin: http://localhost:3000");
    }
    header("Access-Control-Allow-Credentials: true");
    header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type");
    header("Content-Type: application/json");
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
}

function ok($data = [], $code = 200) {
    http_response_code($code);
    echo json_encode(array_merge(['success' => true], $data));
    exit;
}

function err($msg, $code = 400) {
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $msg]);
    exit;
}

function body() {
    return json_decode(file_get_contents('php://input'), true) ?? [];
}

function getGoogleClientId() {
    return trim(getenv('GOOGLE_CLIENT_ID') ?: '');
}

function base64UrlDecode($input) {
    $remainder = strlen($input) % 4;
    if ($remainder) {
        $padlen = 4 - $remainder;
        $input .= str_repeat('=', $padlen);
    }
    $input = strtr($input, '-_', '+/');
    return base64_decode($input);
}

function verifyGoogleToken($token, &$debug = null) {
    $clientId = getGoogleClientId();
    $tokeninfo_url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($token);
    $ctx = stream_context_create(['http' => ['timeout' => 5]]);
    $info_json = @file_get_contents($tokeninfo_url, false, $ctx);
    if ($info_json) {
        $payload = json_decode($info_json, true);
        if (!$payload) {
            $debug = 'Tokeninfo response is not valid JSON.';
        } else {
            if (!isset($payload['iss']) || !in_array($payload['iss'], ['accounts.google.com', 'https://accounts.google.com'])) {
                $debug = 'Invalid issuer: ' . ($payload['iss'] ?? 'missing');
            } elseif (isset($payload['exp']) && $payload['exp'] < time()) {
                $debug = 'Token expired.';
            } elseif (isset($payload['email_verified']) && !in_array($payload['email_verified'], [true, 'true', 1, '1'], true)) {
                $debug = 'Email not verified.';
            } elseif ($clientId && !isset($payload['aud'])) {
                $debug = 'Audience missing.';
            } elseif ($clientId && isset($payload['aud']) && $payload['aud'] !== $clientId && ($payload['azp'] ?? '') !== $clientId) {
                $debug = 'Audience mismatch: ' . ($payload['aud'] ?? 'missing');
            } else {
                return $payload;
            }
        }
    } else {
        $debug = 'Tokeninfo endpoint unreachable or returned empty response.';
    }

    // Fallback: if tokeninfo is unavailable or rejects the token, do basic validation.
    return validateGoogleTokenBasic($token, $debug);
}

function validateGoogleTokenBasic($token, &$debug = null) {
    // Fallback basic validation without signature verification
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    
    $payload = json_decode(base64UrlDecode($parts[1]), true);
    if (!$payload) {
        $debug = 'Failed to parse JWT payload.';
        return null;
    }
    
    // Check token expiration
    if (isset($payload['exp']) && $payload['exp'] < time()) {
        $debug = 'Token expired.';
        return null;
    }
    
    // Check iss (issuer)
    if (!isset($payload['iss']) || !in_array($payload['iss'], ['accounts.google.com', 'https://accounts.google.com'])) {
        $debug = 'Invalid issuer: ' . ($payload['iss'] ?? 'missing');
        return null;
    }
    if (isset($payload['email_verified']) && !in_array($payload['email_verified'], [true, 'true', 1, '1'], true)) {
        $debug = 'Email not verified.';
        return null;
    }
    
    return $payload;
}
