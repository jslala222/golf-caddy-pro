/**
 * r2Client.ts
 * Cloudflare R2 (S3 호환) 백업 유틸리티 — 서버사이드 전용
 *
 * 저장 경로 구조:
 *   caddy-manager-pro/backups/{license_code}/latest.json
 *   caddy-manager-pro/backups/{license_code}/{YYYY-MM-DD}.json
 */
import { S3Client, PutObjectCommand, GetObjectCommand, NoSuchKey } from '@aws-sdk/client-s3';

const APP_NAME = 'caddy-manager-pro';

function getR2Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

function getBucketName(): string {
  return process.env.R2_BUCKET_NAME!;
}

/** 최신 백업 키 */
function latestKey(licenseCode: string): string {
  return `${APP_NAME}/backups/${licenseCode}/latest.json`;
}

/** 날짜별 스냅샷 키 */
function dailyKey(licenseCode: string, date: string): string {
  return `${APP_NAME}/backups/${licenseCode}/${date}.json`;
}

/**
 * 백업 업로드
 * - latest.json 항상 덮어쓰기
 * - YYYY-MM-DD.json 날짜별 스냅샷 저장 (하루 1회 보존)
 */
export async function uploadBackup(licenseCode: string, data: unknown): Promise<void> {
  const client = getR2Client();
  const bucket = getBucketName();
  const body   = JSON.stringify({ data, backedUpAt: new Date().toISOString() });
  const today  = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  await Promise.all([
    client.send(new PutObjectCommand({
      Bucket:      bucket,
      Key:         latestKey(licenseCode),
      Body:        body,
      ContentType: 'application/json',
    })),
    client.send(new PutObjectCommand({
      Bucket:      bucket,
      Key:         dailyKey(licenseCode, today),
      Body:        body,
      ContentType: 'application/json',
    })),
  ]);
}

/**
 * 영수증 이미지 업로드
 * 저장 경로: caddy-manager-pro/receipts/{license_code}/{filename}
 * 공개 URL 또는 키 반환
 */
export async function uploadReceipt(
  licenseCode: string,
  filename: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  const client = getR2Client();
  const bucket = getBucketName();
  const key = `${APP_NAME}/receipts/${licenseCode}/${filename}`;
  await client.send(new PutObjectCommand({
    Bucket:      bucket,
    Key:         key,
    Body:        body,
    ContentType: contentType,
  }));
  // R2 public URL (버킷 공개 설정 시 사용)
  const publicBase = process.env.R2_PUBLIC_URL;
  return publicBase ? `${publicBase}/${key}` : key;
}

/**
 * 최신 백업 다운로드
 * 없으면 null 반환
 */
export async function downloadBackup(licenseCode: string): Promise<unknown | null> {
  const client = getR2Client();

  try {
    const res = await client.send(new GetObjectCommand({
      Bucket: getBucketName(),
      Key:    latestKey(licenseCode),
    }));

    const text = await res.Body?.transformToString();
    if (!text) return null;

    const parsed = JSON.parse(text);
    return parsed.data ?? parsed;
  } catch (e) {
    if (e instanceof NoSuchKey) return null;
    throw e;
  }
}
