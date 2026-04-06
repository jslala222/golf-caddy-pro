import fs from 'fs';
import { randomUUID } from 'crypto';

const data = JSON.parse(fs.readFileSync('./html/caddy-backup-2026-04-05.json', 'utf8'));

const CODES = [
  { code: 'DC-AWA-S72', reuseIds: true },   // 윤희라 — 원본 UUID 사용
  { code: 'DL-B8A-S72', reuseIds: false },  // 이현석 — 새 UUID
];

const esc = (v) => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return v;
  return `'${String(v).replace(/'/g, "''")}'`;
};

let sql = '';

for (const { code, reuseIds } of CODES) {
  // ── schedules ──
  const schLines = data.schedules.map(s => {
    const id = reuseIds ? s.id : randomUUID();
    return `(${esc(id)},${esc(code)},${esc(s.date)},${esc(s.type)},${esc(s.shift ?? null)},${esc(s.holes ?? 18)},${esc(s.caddyFee ?? 0)},${esc(s.overFee ?? 0)},${s.isRain ? 'true' : 'false'},${esc(s.title ?? '')},NULL,${esc(s.createdAt)},${esc(s.time ?? '00:00')})`;
  });
  sql += `INSERT INTO aone_pro_caddypro_schedules(id,license_code,date,type,shift,holes,caddy_fee,over_fee,is_rain,title,memo,created_at,time) VALUES\n${schLines.join(',\n')};\n\n`;

  // ── transactions ──
  const txLines = data.transactions.map(t => {
    const id = reuseIds ? t.id : randomUUID();
    return `(${esc(id)},${esc(code)},NULL,${esc(t.date)},${esc(t.type)},${esc(t.amount)},${esc(t.category ?? null)},${esc(t.memo ?? '')},${esc(t.createdAt)},NULL)`;
  });
  sql += `INSERT INTO aone_pro_caddypro_transactions(id,license_code,schedule_id,date,type,amount,category,memo,created_at,receipt_url) VALUES\n${txLines.join(',\n')};\n\n`;

  // ── clients ──
  const clLines = data.clients.map(c => {
    const id = reuseIds ? c.id : randomUUID();
    return `(${esc(id)},${esc(code)},${esc(c.name)},${esc(c.contact ?? null)},${esc(c.carInfo ?? null)},${esc(c.birthDate ?? '')},${esc(c.grade ?? 'normal')},${esc(c.visitCount ?? 0)},NULL,${esc(c.memo ?? null)},${esc(c.createdAt)})`;
  });
  sql += `INSERT INTO aone_pro_caddypro_clients(id,license_code,name,phone,car_info,birth_date,grade,visit_count,last_visit,memo,created_at) VALUES\n${clLines.join(',\n')};\n\n`;
}

fs.writeFileSync('./restore-both.sql', sql, 'utf8');
console.log('생성 완료: restore-both.sql');
console.log(`schedules: ${data.schedules.length}건 x2`);
console.log(`transactions: ${data.transactions.length}건 x2`);
console.log(`clients: ${data.clients.length}건 x2`);
