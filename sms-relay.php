<?php
// 알리고 SMS 중계 스크립트 (caddy.dothome.co.kr)
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: https://caddy-pink.vercel.app');
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['ok' => false, 'message' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || empty($input['receiver']) || empty($input['msg'])) {
    echo json_encode(['ok' => false, 'message' => '필수 파라미터 없음']);
    exit;
}

$apiKey  = 'yczi82961yse34dwljg0wzk82n2h1v7d';
$userId  = 'supersm3';
$sender  = '01027377229';
$receiver = preg_replace('/\D/', '', $input['receiver']);
$msg     = $input['msg'];
$msgType = !empty($input['msg_type']) ? $input['msg_type'] : (strlen($msg) > 90 ? 'LMS' : 'SMS');
$title   = !empty($input['title']) ? $input['title'] : '';

$postData = http_build_query([
    'key'      => $apiKey,
    'user_id'  => $userId,
    'sender'   => $sender,
    'receiver' => $receiver,
    'msg'      => $msg,
    'msg_type' => $msgType,
    'title'    => $title,
]);

$ch = curl_init('https://apis.aligo.in/send/');
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $postData);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/x-www-form-urlencoded']);
$result = curl_exec($ch);
curl_close($ch);

$data = json_decode($result, true);
if (!empty($data['result_code']) && ($data['result_code'] == '1' || $data['result_code'] == 1)) {
    echo json_encode(['ok' => true]);
} else {
    echo json_encode(['ok' => false, 'message' => $data['message'] ?? '발송 실패']);
}
