import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt);
export const digest = value => createHash('sha256').update(value).digest('hex');
export const randomToken = () => randomBytes(32).toString('base64url');
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 });
  return `scrypt:${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password, encoded) {
  const [, salt, hex] = (encoded || '').split(':');
  const expected = Buffer.from(hex || '00'.repeat(64), 'hex');
  const key = await derive(password, salt || '00000000000000000000000000000000', 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 });
  return expected.length === key.length && timingSafeEqual(key, expected) && !!encoded;
}
export const maskEmail = value => value ? `${value[0]}***@${value.split('@')[1]?.[0] || '*'}***` : '';
export const maskPhone = value => value ? `•••• ••• ${value.replace(/\D/g,'').slice(-2)}` : '';
export const publicUser = (row, { self = false, visible = [] } = {}) => ({
  id: row.id, ...(self ? {username:row.username} : {}), name: row.name, role: row.role,
  operatorRequested: row.operator_requested, groups: self ? row.groups : [], municipality: self ? row.municipality : '',
  alertsEnabled: row.alerts_enabled, locationSharing: !!row.on_duty && row.location_sharing,
  onDuty: !!row.on_duty, dutyAt: row.duty_at || null, dutyProjectId: row.duty_project_id || null,
  email: self || visible.includes('email') ? row.email || '' : maskEmail(row.email),
  phone: self || visible.includes('phone') ? row.phone || '' : maskPhone(row.phone),
  contactVisible: self ? ['email','phone'] : visible,
  location: row.on_duty && row.location_sharing && row.lat !== null ? { lat: row.lat, lng: row.lng, accuracy: row.accuracy, updatedAt: row.location_at } : null,
  safeAt: row.safe_at, createdAt: row.created_at,
});
export const isOperator = user => ['operator', 'admin'].includes(user?.role);
