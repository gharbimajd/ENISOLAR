<?php
/**
 * Send Password Reset Code
 * 
 * Generates a 6-digit code, stores it with 15-minute expiry,
 * and sends it via email to the user.
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Only allow POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit();
}

// Database configuration
require_once 'db_config.php';

try {
    // Get JSON input
    $json = file_get_contents('php://input');
    $data = json_decode($json, true);

    if (!isset($data['email']) || empty($data['email'])) {
        throw new Exception('Email is required');
    }

    $email = filter_var($data['email'], FILTER_VALIDATE_EMAIL);
    
    if (!$email) {
        throw new Exception('Invalid email address');
    }

    // Connect to database
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    
    if ($conn->connect_error) {
        throw new Exception('Database connection failed');
    }

    // Check if user exists
    $stmt = $conn->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        // Don't reveal that email doesn't exist for security
        echo json_encode(['success' => true]);
        exit();
    }

    // Generate 6-digit code
    $code = str_pad(rand(0, 999999), 6, '0', STR_PAD_LEFT);
    
    // Calculate expiry (15 minutes from now)
    $expiresAt = date('Y-m-d H:i:s', strtotime('+15 minutes'));

    // Delete any existing reset codes for this email
    $stmt = $conn->prepare("DELETE FROM password_resets WHERE email = ?");
    $stmt->bind_param("s", $email);
    $stmt->execute();

    // Insert new reset code
    $stmt = $conn->prepare("INSERT INTO password_resets (email, code, expires_at) VALUES (?, ?, ?)");
    $stmt->bind_param("sss", $email, $code, $expiresAt);
    
    if (!$stmt->execute()) {
        throw new Exception('Failed to create reset code');
    }

    // Send email
    $subject = 'ENISOLAR - Password Reset Code';
    $message = "Your password reset code is: $code\n\n";
    $message .= "This code will expire in 15 minutes.\n\n";
    $message .= "If you didn't request this code, please ignore this email.\n\n";
    $message .= "ENISOLAR Team";
    
    $headers = "From: noreply@enisolar.com\r\n";
    $headers .= "Reply-To: support@enisolar.com\r\n";
    $headers .= "X-Mailer: PHP/" . phpversion();

    $emailSent = mail($email, $subject, $message, $headers);

    if (!$emailSent) {
        // Log error but don't fail - code is still in database
        error_log("Failed to send reset email to: $email");
    }

    $stmt->close();
    $conn->close();

    echo json_encode([
        'success' => true,
        'message' => 'Reset code sent to your email'
    ]);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?>

