import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";

const R2_ENDPOINT      = "https://8e9d3fd67070c31a6bc9bc4cf4127735.r2.cloudflarestorage.com";
const R2_ACCESS_KEY_ID = "d8e656763146eda517113339694cc10c";
const R2_SECRET_KEY    = "df1798c437ed8976782756a03d153c602210a4f522c297b45a2d11b68f417d8a";
const R2_BUCKET        = "aonepro-db";

const s3 = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_KEY },
});

async function listAll(prefix) {
  const keys = [];
  let token;
  do {
    const res = await s3.send(new ListObjectsV2Command({ Bucket: R2_BUCKET, Prefix: prefix, ContinuationToken: token }));
    (res.Contents ?? []).forEach(obj => keys.push(obj.Key));
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

const all = await listAll("caddy-manager-pro/receipts/");
console.log("=== R2 receipts 전체 목록 ===");
all.forEach(k => console.log(" ", k));
console.log("총 " + all.length + "개\n");

const testFiles = all.filter(k => k.includes("TEST-OCR-000"));
console.log("=== TEST-OCR-000 삭제 대상: " + testFiles.length + "개 ===");
testFiles.forEach(k => console.log("  DEL:", k));

if (testFiles.length > 0) {
  await s3.send(new DeleteObjectsCommand({ Bucket: R2_BUCKET, Delete: { Objects: testFiles.map(Key => ({ Key })) } }));
  console.log("\n✅ " + testFiles.length + "개 삭제 완료");
  const remaining = await listAll("caddy-manager-pro/receipts/");
  console.log("\n=== 남은 receipts ===");
  remaining.forEach(k => console.log(" ", k));
  console.log("총 " + remaining.length + "개");
} else {
  console.log("삭제할 파일 없음.");
}
