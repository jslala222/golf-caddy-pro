import fs from 'fs';
import crypto from 'crypto';

const data = JSON.parse(fs.readFileSync('./html/caddy-backup-2026-04-05.json', 'utf8'));
const CODE = 'DC-AWA-S72';
const NEW_IDS = true; // 새 UUID 생성 (기존 윤희라 UUID와 충돌 방지)
const EXCLUDE = [ // 제외할 항목 (날짜+type 조합)
  { date: '2026-03-10', type: 'work' },
];

const esc = v => {
  if (v == null) return 'NULL';
  return "'" + String(v).replace(/'/g, "''") + "'";
};
const num = (v, def = 0) => v != null ? Number(v) : def;
const bool = v => v ? 'true' : 'false';

// ── schedules ──
const schedRows = data.schedules
  .filter(s => !EXCLUDE.some(e => e.date === s.date && e.type === s.type))
  .map(s => {
  return '(' + [
    esc(NEW_IDS ? crypto.randomUUID() : s.id),
    esc(CODE),
    esc(s.date),
    esc(s.type),
    s.shift != null ? esc(s.shift) : 'NULL',
    s.holes != null ? s.holes : 'NULL',
    num(s.caddyFee),
    num(s.overFee),
    bool(s.isRain),
    esc(s.title),
    s.memo != null ? esc(s.memo) : 'NULL',
    s.createdAt != null ? esc(s.createdAt) : 'NULL',
    s.time != null ? esc(s.time) : 'NULL',
  ].join(',') + ')';
});

const schedSql = `INSERT INTO aone_pro_caddypro_schedules(id,license_code,date,type,shift,holes,caddy_fee,over_fee,is_rain,title,memo,created_at,time) VALUES\n`
  + schedRows.join(',\n') + ';';

// ── transactions ──
const txRows = data.transactions.map(t => {
  return '(' + [
    esc(NEW_IDS ? crypto.randomUUID() : t.id),
    esc(CODE),
    t.scheduleId != null ? esc(t.scheduleId) : 'NULL',
    esc(t.date),
    esc(t.type),
    num(t.amount),
    t.category != null ? esc(t.category) : 'NULL',
    t.memo != null ? esc(t.memo) : 'NULL',
    t.createdAt != null ? esc(t.createdAt) : 'NULL',
    t.receiptUrl != null ? esc(t.receiptUrl) : 'NULL',
  ].join(',') + ')';
});

const txSql = `INSERT INTO aone_pro_caddypro_transactions(id,license_code,schedule_id,date,type,amount,category,memo,created_at,receipt_url) VALUES\n`
  + txRows.join(',\n') + ';';

// ── clients ──
const clientRows = data.clients.map(c => {
  return '(' + [
    esc(NEW_IDS ? crypto.randomUUID() : c.id),
    esc(CODE),
    esc(c.name),
    c.phone != null ? esc(c.phone) : 'NULL',
    c.carInfo != null ? esc(c.carInfo) : 'NULL',
    c.birthDate != null ? esc(c.birthDate) : 'NULL',
    c.grade != null ? esc(c.grade) : 'NULL',
    c.visitCount != null ? num(c.visitCount) : 0,
    c.lastVisit != null ? esc(c.lastVisit) : 'NULL',
    c.memo != null ? esc(c.memo) : 'NULL',
    c.createdAt != null ? esc(c.createdAt) : 'NULL',
  ].join(',') + ')';
});

const clientSql = data.clients.length > 0
  ? `INSERT INTO aone_pro_caddypro_clients(id,license_code,name,phone,car_info,birth_date,grade,visit_count,last_visit,memo,created_at) VALUES\n`
    + clientRows.join(',\n') + ';'
  : '-- no clients';

fs.writeFileSync('./insert_schedules.sql', schedSql, 'utf8');
fs.writeFileSync('./insert_transactions.sql', txSql, 'utf8');
fs.writeFileSync('./insert_clients.sql', clientSql, 'utf8');

console.log('schedules:', schedRows.length);
console.log('transactions:', txRows.length);
console.log('clients:', clientRows.length);
