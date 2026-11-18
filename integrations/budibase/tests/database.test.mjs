import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Real embedded PostgreSQL, in memory. No credentials, external network, or real people.
const db = new PGlite();
const sqlFile = name => readFile(new URL(`../sql/${name}`, import.meta.url), 'utf8');
const price = { base_fare: 70, per_km: 17, per_minute: 4, minimum_fare: 140,
  night_surcharge: 0, rush_hour_surcharge: 0, is_active: true };
before(async () => {
  await db.exec(await readFile(new URL('base_schema.sql', import.meta.url), 'utf8'));
  await db.exec(await sqlFile('01_migration.sql'));
  await db.exec(await sqlFile('02_permissions.sql'));
});
beforeEach(async () => {
  await db.exec(`TRUNCATE snar_admin.audit_log, snar_admin.identities, public.rides,
    public.vehicles, public.drivers, public.pricing_zones, public.users RESTART IDENTITY CASCADE;
    UPDATE snar_admin.config SET price_unit=NULL,confirmed_at=NULL;
    INSERT INTO public.users(id,name,email,phone,role,is_blocked) VALUES
    (101,'QA Admin','admin@example.invalid','qa-admin','ADMIN',false),
    (201,'QA Driver A','a@example.invalid','qa-driver-a','DRIVER',false),
    (301,'QA Driver B','b@example.invalid','qa-driver-b','DRIVER',false),
    (401,'QA Passenger','p@example.invalid','qa-passenger','PASSENGER',false),
    (501,'QA Blocked','blocked@example.invalid','qa-blocked','ADMIN',true);
    INSERT INTO snar_admin.identities(issuer,subject,user_id) VALUES
    ('https://qa.example.invalid','admin',101),('https://qa.example.invalid','driver-a',201),
    ('https://qa.example.invalid','driver-b',301),('https://qa.example.invalid','passenger',401),
    ('https://qa.example.invalid','blocked',501);
    INSERT INTO public.drivers(id,user_id,license_number,license_expiry,taxi_license_number,taxi_license_expiry,status) VALUES
    (11,201,'QA-A',CURRENT_DATE+30,'QA-T-A',CURRENT_DATE+30,'pending'),
    (22,301,'QA-B',CURRENT_DATE+30,'QA-T-B',CURRENT_DATE+30,'approved');
    INSERT INTO public.vehicles(id,driver_id,license_plate,model,year,insurance_expiry) VALUES
    (61,201,'QA-A','Synthetic A',2026,CURRENT_DATE+30),(62,301,'QA-B','Synthetic B',2026,CURRENT_DATE+30);
    INSERT INTO public.pricing_zones(vehicle_class,base_fare,per_km,per_minute,minimum_fare)
    SELECT c,70,17,4,140 FROM unnest(enum_range(NULL::public.vehicle_class)) AS c;
    INSERT INTO public.rides(id,passenger_id,driver_id,pickup_address,dropoff_address,status,estimated_price) VALUES
    (71,401,201,'QA synthetic start','QA synthetic end','in_progress',217),
    (72,401,301,'QA synthetic start','QA synthetic end','accepted',259),
    (73,401,201,'QA synthetic start','QA synthetic end','completed',217),
    (74,401,NULL,'QA synthetic start','QA synthetic end','requested',217);`);
});
after(() => db.close());

async function as(subject, query, params = [], issuer = 'https://qa.example.invalid') {
  await db.exec('BEGIN; SET LOCAL ROLE snar_bb_gateway;');
  try {
    await db.query(`SELECT set_config('snar.auth_issuer',$1,true),set_config('snar.auth_subject',$2,true)`, [issuer, subject]);
    const result = await db.query(query, params);
    await db.exec('COMMIT');
    return result.rows[0]?.result;
  } catch (e) { await db.exec('ROLLBACK'); throw e; }
}
const call = (subject, fn, args = []) => as(subject,
  `SELECT snar_admin.${fn}(${args.map((_, i) => `$${i + 1}`).join(',')}) AS result`, args);
const denied = (fn, code) => assert.rejects(fn, e => e.code === code);
const save = (p = price, version = 0) => call('admin', 'save_price', ['SNAR', version, JSON.stringify(p)]);

test('gateway has no direct table reads, writes, or identity-helper execution', async () => {
  for (const q of ['SELECT * FROM public.users', "UPDATE public.drivers SET status='approved'", 'SELECT * FROM snar_admin.identities', 'SELECT snar_admin.actor()'])
    await denied(() => as('admin', q), '42501');
});
test('unknown, blocked, disabled and wrong-issuer identities fail closed', async () => {
  await denied(() => call('unknown', 'me'), '42501');
  await denied(() => call('blocked', 'me'), '42501');
  await denied(() => as('admin', 'SELECT snar_admin.me() AS result', [], 'https://other.example.invalid'), '42501');
  await db.exec("UPDATE snar_admin.identities SET enabled=false WHERE subject='admin'");
  await denied(() => call('admin', 'me'), '42501');
});
test('transaction-local identity never leaks to the next pooled request', async () => {
  assert.equal((await call('admin', 'me')).id, 101);
  await db.exec('BEGIN; SET LOCAL ROLE snar_bb_gateway;');
  await denied(() => db.query('SELECT snar_admin.me()'), '42501');
  await db.exec('ROLLBACK');
});
test('driver and passenger cannot use admin functions or mutations', async () => {
  for (const subject of ['driver-a', 'passenger']) {
    for (const fn of ['dashboard', 'drivers', 'vehicles', 'prices', 'active_rides'])
      await denied(() => call(subject, fn), '42501');
    await denied(() => call(subject, 'set_driver_status', [11, 0, 'approved', null]), '42501');
    await denied(() => call(subject, 'save_price', ['SNAR', 0, JSON.stringify(price)]), '42501');
  }
});
test('ownership uses users.id, not drivers.id; driver sees only own vehicles and rides', async () => {
  const a = await call('driver-a', 'my_vehicles');
  assert.deepEqual(a.rows.map(x => x.id), [61]);
  const b = await call('driver-b', 'my_vehicles');
  assert.deepEqual(b.rows.map(x => x.id), [62]);
  assert.deepEqual((await call('driver-a', 'my_rides')).rows.map(x => x.id), [73,71]);
  await denied(() => call('passenger', 'my_vehicles'), '42501');
});
test('dashboard and active rides reflect data, not static online text', async () => {
  const result = await call('admin', 'dashboard');
  assert.equal(result.pending_drivers, 1);
  assert.equal(result.active_rides, 2);
  assert.equal(result.requested_rides, 1);
  assert.deepEqual((await call('admin', 'active_rides')).rows.map(x => x.id), [72,71]);
});
test('lists support status, search, pagination and literal injection text', async () => {
  assert.equal((await call('admin', 'drivers')).total, 1);
  assert.equal((await call('admin', 'drivers', ['all', 'Driver', 1, 1])).rows[0].user_id, 201);
  assert.equal((await call('admin', 'drivers', ['all', "' OR true--", 25, 0])).total, 0);
  await denied(() => call('admin', 'drivers', ['anything', '', 25, 0]), '22023');
  await denied(() => call('admin', 'vehicles', ['all', 101, 0]), '22023');
});
test('driver approval records real actor and atomic audit', async () => {
  const row = await call('admin', 'set_driver_status', [11, 0, 'approved', null]);
  assert.equal(row.status, 'approved'); assert.equal(row.version, 1); assert.equal(row.approved_by_admin_id, 101);
  const { rows } = await db.query('SELECT actor_id,before_data,after_data FROM snar_admin.audit_log');
  assert.equal(rows.length, 1); assert.equal(rows[0].actor_id, 101);
  assert.equal(rows[0].before_data.status, 'pending'); assert.equal(rows[0].after_data.status, 'approved');
});
test('stale/repeated driver action is rejected without duplicate audit', async () => {
  await call('admin', 'set_driver_status', [11, 0, 'approved', null]);
  await denied(() => call('admin', 'set_driver_status', [11, 0, 'approved', null]), '40001');
  assert.equal((await db.query('SELECT count(*)::int AS n FROM snar_admin.audit_log')).rows[0].n, 1);
});
test('driver rejection and suspension require a reason and legal transition', async () => {
  await denied(() => call('admin', 'set_driver_status', [11, 0, 'rejected', ' ']), '22023');
  await denied(() => call('admin', 'set_driver_status', [11, 0, 'suspended', 'QA test']), '22023');
  assert.equal((await call('admin', 'set_driver_status', [11, 0, 'rejected', 'Manglende dokument'])).reject_reason, 'Manglende dokument');
  assert.equal((await call('admin', 'set_driver_status', [22, 0, 'suspended', 'QA test'])).status, 'suspended');
});
test('expired documents, blocked user and incorrect user role prevent approval', async () => {
  await db.exec('UPDATE public.drivers SET license_expiry=CURRENT_DATE-1 WHERE id=11');
  await denied(() => call('admin', 'set_driver_status', [11, 1, 'approved', null]), '22023');
  await db.exec('UPDATE public.drivers SET license_expiry=CURRENT_DATE+30 WHERE id=11; UPDATE public.users SET is_blocked=true WHERE id=201');
  await denied(() => call('admin', 'set_driver_status', [11, 2, 'approved', null]), '22023');
  await db.exec("UPDATE public.users SET is_blocked=false,role='PASSENGER' WHERE id=201");
  await denied(() => call('admin', 'set_driver_status', [11, 2, 'approved', null]), '22023');
});
test('vehicle approval requires correct approved driver and valid insurance', async () => {
  await denied(() => call('admin', 'set_vehicle_status', [61, 0, 'approved', null]), '22023');
  assert.equal((await call('admin', 'set_vehicle_status', [62, 0, 'approved', null])).status, 'approved');
  await db.exec('UPDATE public.vehicles SET insurance_expiry=CURRENT_DATE-1 WHERE id=61');
  await call('admin', 'set_driver_status', [11, 0, 'approved', null]);
  await denied(() => call('admin', 'set_vehicle_status', [61, 1, 'approved', null]), '22023');
});
test('vehicle rejection requires reason; missing and stale rows fail', async () => {
  await denied(() => call('admin', 'set_vehicle_status', [61, 0, 'rejected', '']), '22023');
  await denied(() => call('admin', 'set_vehicle_status', [999, 0, 'approved', null]), 'P0002');
  await call('admin', 'set_vehicle_status', [61, 0, 'rejected', 'QA dokument mangler']);
  await denied(() => call('admin', 'set_vehicle_status', [61, 0, 'approved', null]), '40001');
});
test('price writes are blocked until storage unit is explicitly confirmed', async () => {
  await denied(() => save(), '22023');
  assert.equal((await call('admin', 'prices')).price_unit, null);
});
test('price update preserves integer amounts and produces audit and version', async () => {
  await db.exec("UPDATE snar_admin.config SET price_unit='NOK',confirmed_at=clock_timestamp()");
  const row = await save();
  assert.equal(row.base_fare, 70); assert.equal(row.version, 1);
  await denied(() => save(), '40001');
  assert.equal((await db.query('SELECT count(*)::int AS n FROM snar_admin.audit_log')).rows[0].n, 1);
});
test('negative, fractional, overflow, string, null, extra and missing price values fail', async () => {
  await db.exec("UPDATE snar_admin.config SET price_unit='NOK'");
  for (const value of [-1, 1.2, 2147483648, '70', null])
    await assert.rejects(() => save({ ...price, base_fare: value }));
  await assert.rejects(() => save({ ...price, injected: true }));
  const { per_minute, ...missing } = price;
  await assert.rejects(() => save(missing));
  await assert.rejects(() => save({ ...price, minimum_fare: 1 }));
});
test('null versions and filters cannot bypass action and pagination checks', async () => {
  await denied(() => call('admin', 'set_driver_status', [11, null, 'approved', null]), '22023');
  await denied(() => call('admin', 'set_vehicle_status', [62, null, 'approved', null]), '22023');
  await denied(() => call('admin', 'drivers', ['all', '', null, 0]), '22023');
});
test('ordinary SQL writer also invalidates stale UI version', async () => {
  await db.exec("UPDATE public.drivers SET reject_reason='QA changed elsewhere' WHERE id=11");
  await denied(() => call('admin', 'set_driver_status', [11, 0, 'approved', null]), '40001');
});
test('migration can be rerun without deleting rows, identities or prices', async () => {
  await db.exec(await sqlFile('01_migration.sql'));
  await db.exec(await sqlFile('02_permissions.sql'));
  assert.equal((await call('admin', 'drivers', ['all', '', 25, 0])).total, 2);
  assert.equal((await call('driver-a', 'my_vehicles')).rows.length, 1);
});
