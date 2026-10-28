import { ageRanges, pwdStatuses, assistanceOptions, contactRelationships } from '../src/app/lib/emergency-profile.ts';

const fail = message => { throw Object.assign(new Error(message), { status: 400 }); };
const text = (value, max, label) => typeof value === 'string' && value.trim().length <= max ? value.trim() : fail(`Check ${label}.`);
const pick = (value, choices, label) => typeof value === 'string' && Object.hasOwn(choices, value) ? value : fail(`Choose a valid ${label}.`);
const bool = (value, label) => typeof value === 'boolean' ? value : fail(`Check ${label}.`);
export const validPhone = value => /^\+?[0-9 ()-]+$/.test(value) && value.replace(/\D/g, '').length >= 7 && value.replace(/\D/g, '').length <= 15;

export function normalizeProfile(input, previous = {}) {
  const field = (key, max, label = key) => text(input[key] === undefined ? previous[key] || '' : input[key], max, label);
  const email = field('email', 254), phone = field('phone', 30);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Enter a valid email or leave it empty.');
  if (phone && !validPhone(phone)) fail('Enter a valid phone number with 7–15 digits or leave it empty.');
  let groups = input.groups === undefined ? previous.groups || [] : input.groups;
  if (!Array.isArray(groups) || groups.length > 5 || groups.some(g => !['pwd','children','seniors','pregnant','responders'].includes(g)) || (groups.includes('children') && groups.includes('seniors'))) fail('Select valid profile groups.');
  let emergencyProfile = previous.emergency_profile || {};
  if (input.emergencyProfile !== undefined) {
    const p = input.emergencyProfile;
    if (!p || typeof p !== 'object' || Array.isArray(p) || p.version !== 1) fail('Check your emergency profile.');
    const needs = p.assistanceNeeds;
    if (!Array.isArray(needs) || needs.length > 5 || needs.some(n => typeof n !== 'string' || !Object.hasOwn(assistanceOptions, n))) fail('Choose valid assistance needs.');
    const contact = p.emergencyContact;
    if (!contact || typeof contact !== 'object' || Array.isArray(contact)) fail('Check your emergency contact.');
    const name = text(contact.name, 80, 'emergency contact name');
    const contactPhone = text(contact.phone, 30, 'emergency contact phone');
    const relationship = pick(contact.relationship, contactRelationships, 'emergency contact relationship');
    const contactConsent = bool(p.contactConsent, 'emergency contact permission');
    const hasContact = !!(name || contactPhone || relationship);
    if (hasContact && (name.length < 2 || !validPhone(contactPhone) || !relationship)) fail('Complete the emergency contact name, relationship, and phone, or leave all three empty.');
    if (hasContact && !contactConsent) fail('Confirm that your emergency contact agreed to be listed.');
    emergencyProfile = {
      version: 1,
      ageRange: pick(p.ageRange, ageRanges, 'age range'),
      pwdStatus: pick(p.pwdStatus, pwdStatuses, 'PWD status'),
      assistanceNeeds: [...new Set(needs)],
      shareWithOperators: bool(p.shareWithOperators, 'emergency profile sharing'),
      emergencyContact: { name, phone: contactPhone, relationship },
      contactConsent: hasContact && contactConsent,
    };
  }
  // Legacy clients preserve the saved profile. New profiles control demographic targeting
  // only when the person explicitly shares those details with the command center.
  if (emergencyProfile.version === 1) {
    groups = groups.filter(g => !['pwd','children','seniors'].includes(g));
    if (emergencyProfile.shareWithOperators) {
      if (emergencyProfile.pwdStatus === 'yes') groups.push('pwd');
      if (emergencyProfile.ageRange === 'under18') groups.push('children');
      if (emergencyProfile.ageRange === '60plus') groups.push('seniors');
    }
  }
  return { email, phone, municipality: field('municipality',80,'city or municipality'), province: field('province',80,'province'), barangay: field('barangay',100,'barangay'), groups:[...new Set(groups)], emergencyProfile };
}
