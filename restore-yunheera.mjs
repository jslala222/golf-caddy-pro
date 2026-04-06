// 윤희라(DC-AWA-S72) 백업 데이터 → Supabase 복원 스크립트
import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lajjbrrysvkaxzrchanp.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LICENSE_CODE = 'DC-AWA-S72';

if (!SUPABASE_SERVICE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const backup = JSON.parse(readFileSync('./html/caddy-backup-2026-04-05.json', 'utf-8'));

async function run() {
  // 1. 기존 데이터 삭제
  console.log('기존 데이터 삭제 중...');
  await supabase.from('aone_pro_caddypro_schedules').delete().eq('license_code', LICENSE_CODE);
  await supabase.from('aone_pro_caddypro_transactions').delete().eq('license_code', LICENSE_CODE);
  await supabase.from('aone_pro_caddypro_clients').delete().eq('license_code', LICENSE_CODE);

  // 2. schedules 삽입
  console.log(`일정 ${backup.schedules.length}건 삽입 중...`);
  const schedRows = backup.schedules.map(s => ({
    id: s.id,
    license_code: LICENSE_CODE,
    date: s.date,
    time: s.time ?? '00:00',
    type: s.type,
    shift: s.shift ?? null,
    holes: s.holes ?? 18,
    caddy_fee: s.caddyFee ?? 0,
    over_fee: s.overFee ?? 0,
    is_rain: s.isRain ?? false,
    title: s.title ?? null,
    memo: s.memo ?? null,
    created_at: s.createdAt ?? new Date().toISOString(),
  }));
  const { error: schedErr } = await supabase.from('aone_pro_caddypro_schedules').upsert(schedRows, { onConflict: 'id' });
  if (schedErr) console.error('schedules 오류:', schedErr.message);
  else console.log('✅ schedules 완료');

  // 3. transactions 삽입
  console.log(`수입/지출 ${backup.transactions.length}건 삽입 중...`);
  const txRows = backup.transactions.map(t => ({
    id: t.id,
    license_code: LICENSE_CODE,
    date: t.date,
    type: t.type,
    amount: t.amount,
    category: t.category ?? null,
    memo: t.memo ?? null,
    receipt_url: t.receiptUrl ?? null,
    created_at: t.createdAt ?? new Date().toISOString(),
  }));
  const { error: txErr } = await supabase.from('aone_pro_caddypro_transactions').upsert(txRows, { onConflict: 'id' });
  if (txErr) console.error('transactions 오류:', txErr.message);
  else console.log('✅ transactions 완료');

  // 4. clients 삽입
  if (backup.clients?.length) {
    console.log(`고객 ${backup.clients.length}건 삽입 중...`);
    const clientRows = backup.clients.map(c => ({
      id: c.id,
      license_code: LICENSE_CODE,
      name: c.name,
      contact: c.contact ?? null,
      car_info: c.carInfo ?? null,
      birth_date: c.birthDate ?? null,
      memo: c.memo ?? null,
      grade: c.grade ?? 'normal',
      visit_count: c.visitCount ?? 0,
      created_at: c.createdAt ?? new Date().toISOString(),
    }));
    const { error: clientErr } = await supabase.from('aone_pro_caddypro_clients').upsert(clientRows, { onConflict: 'id' });
    if (clientErr) console.error('clients 오류:', clientErr.message);
    else console.log('✅ clients 완료');
  }

  // 5. 결과 확인
  const { count: sc } = await supabase.from('aone_pro_caddypro_schedules').select('*', { count: 'exact', head: true }).eq('license_code', LICENSE_CODE);
  const { count: tc } = await supabase.from('aone_pro_caddypro_transactions').select('*', { count: 'exact', head: true }).eq('license_code', LICENSE_CODE);
  console.log(`\n🎉 복원 완료! schedules: ${sc}건, transactions: ${tc}건`);
}

run().catch(console.error);
