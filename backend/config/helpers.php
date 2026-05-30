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

function verifyGoogleToken($token) {
    // Google's public certs endpoint
    $certs_url = 'https://www.googleapis.com/oauth2/v1/certs';
    
    // Fetch certificates from Google
    $ctx = stream_context_create(['http' => ['timeout' => 5]]);
    $certs_json = @file_get_contents($certs_url, false, $ctx);
    
    if (!$certs_json) {
        // Fallback: if we can't reach Google, we'll do basic token validation
        // In production, you should cache the certificates
        return validateGoogleTokenBasic($token);
    }
    
    $certs = json_decode($certs_json, true);
    if (!$certs) return null;
    
    // Decode the JWT without verifying first to get the kid
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    
    $header = json_decode(base64_decode(str_pad($parts[0], strlen($parts[0]) % 4, '=', STR_PAD_RIGHT)), true);
    $payload = json_decode(base64_decode(str_pad($parts[1], strlen($parts[1]) % 4, '=', STR_PAD_RIGHT)), true);
    
    if (!$header || !$payload) return null;
    
    // Check token expiration
    if (isset($payload['exp']) && $payload['exp'] < time()) return null;
    
    // Check iss (issuer)
    if (!isset($payload['iss']) || !in_array($payload['iss'], ['accounts.google.com', 'https://accounts.google.com'])) return null;
    
    // Verify signature
    $kid = $header['kid'] ?? null;
    if (!$kid || !isset($certs[$kid])) return null;
    
    $pubKey = openssl_pkey_get_public('-----BEGIN CERTIFICATE-----' . "\n" . wordwrap($certs[$kid], 64, "\n", true) . "\n" . '-----END CERTIFICATE-----');
    if (!$pubKey) return null;
    
    $signature = base64_decode(str_pad($parts[2], strlen($parts[2]) % 4, '=', STR_PAD_RIGHT));
    $verified = openssl_verify($parts[0] . '.' . $parts[1], $signature, $pubKey, OPENSSL_ALGO_SHA256);
    openssl_free_key($pubKey);
    
    return $verified === 1 ? $payload : null;
}

function validateGoogleTokenBasic($token) {
    // Fallback basic validation without signature verification
    $parts = explode('.', $token);
    if (count($parts) !== 3) return null;
    
    $payload = json_decode(base64_decode(str_pad($parts[1], strlen($parts[1]) % 4, '=', STR_PAD_RIGHT)), true);
    if (!$payload) return null;
    
    // Check token expiration
    if (isset($payload['exp']) && $payload['exp'] < time()) return null;
    
    // Check iss (issuer)
    if (!isset($payload['iss']) || !in_array($payload['iss'], ['accounts.google.com', 'https://accounts.google.com'])) return null;
    
    return $payload;
}
