import { ageRanges, pwdStatuses, assistanceOptions, contactRelationships, emptyEmergencyProfile, type EmergencyProfile } from '../../lib/emergency-profile';
import type { LiveUser } from '../../lib/live-model';
import '../../../styles/registration-profile.css';

export interface ProfileDraft {
  email: string; phone: string; municipality: string; province: string; barangay: string;
  emergencyProfile: EmergencyProfile;
}
export function profileDraft(user?: LiveUser): ProfileDraft {
  const empty = emptyEmergencyProfile();
  const legacy = !user?.emergencyProfile?.version ? { ageRange:user?.groups.includes('children')?'under18' as const:user?.groups.includes('seniors')?'60plus' as const:'' as const, pwdStatus:user?.groups.includes('pwd')?'yes' as const:'' as const } : {};
  return { email:user?.email || '', phone:user?.phone || '', municipality:user?.municipality || '', province:user?.province || '', barangay:user?.barangay || '', emergencyProfile:{...empty,...legacy,...user?.emergencyProfile,emergencyContact:{...empty.emergencyContact,...user?.emergencyProfile?.emergencyContact}} };
}
type Props = { value: ProfileDraft; onChange: (value: ProfileDraft) => void };
export function ContactFields({ value, onChange }: Props) {
  const change = (key: keyof Omit<ProfileDraft,'emergencyProfile'>, next: string) => onChange({...value,[key]:next});
  return <div className="el-profile-details">
    <p className="el-field-note">Optional contact details help an authorized admin reach you. They stay masked until you approve access. These contacts are not verified and do not replace your recovery code.</p>
    <div className="el-profile-grid">
      <label>Mobile number <small>Optional</small><input type="tel" name="phone" autoComplete="tel" inputMode="tel" maxLength={30} placeholder="09XX XXX XXXX" value={value.phone} onChange={e=>change('phone',e.target.value)} /></label>
      <label>Email address <small>Optional</small><input type="email" name="email" autoComplete="email" autoCapitalize="none" maxLength={254} placeholder="you@example.com" value={value.email} onChange={e=>change('email',e.target.value)} /></label>
    </div>
    <fieldset><legend>Home area <small>Optional</small></legend><p className="el-field-note">For your profile only. This does not start GPS tracking or set your current map location. A street address is not needed.</p>
      <label>Province / Metro Manila<input name="province" autoComplete="address-level1" maxLength={80} placeholder="e.g. Rizal" value={value.province} onChange={e=>change('province',e.target.value)} /></label>
      <div className="el-profile-grid">
        <label>City / municipality<input name="municipality" autoComplete="address-level2" maxLength={80} placeholder="e.g. Cainta" value={value.municipality} onChange={e=>change('municipality',e.target.value)} /></label>
        <label>Barangay<input name="barangay" autoComplete="address-level3" maxLength={100} placeholder="e.g. San Juan" value={value.barangay} onChange={e=>change('barangay',e.target.value)} /></label>
      </div>
    </fieldset>
  </div>;
}
export function EmergencyFields({ value, onChange }: Props) {
  const p = value.emergencyProfile;
  const update = (next: Partial<EmergencyProfile>) => onChange({...value,emergencyProfile:{...p,...next}});
  const contact = p.emergencyContact;
  const hasContact = !!(contact.name.trim() || contact.phone.trim() || contact.relationship);
  return <div className="el-profile-details">
    <p className="el-field-note">All fields are optional. Share only what helps your command center plan assistance. No diagnosis, ID number, or exact date of birth is needed.</p>
    <div className="el-profile-grid">
      <label>Age range<select name="ageRange" value={p.ageRange} onChange={e=>update({ageRange:e.target.value as EmergencyProfile['ageRange']})}>{Object.entries(ageRanges).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
      <label>Person with disability (PWD)<select name="pwdStatus" value={p.pwdStatus} onChange={e=>update({pwdStatus:e.target.value as EmergencyProfile['pwdStatus']})}>{Object.entries(pwdStatuses).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    </div>
    <fieldset><legend>Assistance you may need</legend><div className="el-assistance-options">{Object.entries(assistanceOptions).map(([key,label])=><label className="el-profile-check" key={key}><input data-demo={`need-${key}`} type="checkbox" checked={p.assistanceNeeds.includes(key as keyof typeof assistanceOptions)} onChange={e=>update({assistanceNeeds:e.target.checked ? [...p.assistanceNeeds,key as keyof typeof assistanceOptions] : p.assistanceNeeds.filter(n=>n!==key)})}/><span>{label}</span></label>)}</div></fieldset>
    <label className="el-profile-check el-sharing-choice"><input data-demo="share-emergency-profile" type="checkbox" checked={p.shareWithOperators} onChange={e=>update({shareWithOperators:e.target.checked})}/><span>Share my emergency profile with approved command-center operators<small>Allows them to see my age range, PWD status and assistance needs, and include these in geofence counts and targeted alerts. I can turn this off in Account.</small></span></label>
    <fieldset><legend>Emergency contact <small>Optional</small></legend><p className="el-field-note">A trusted person to contact if you need help. Their details stay private until you approve a specific admin’s access request.</p>
      <label>Contact’s preferred name<input name="emergencyContactName" autoComplete="off" maxLength={80} minLength={2} required={hasContact} value={contact.name} onChange={e=>update({emergencyContact:{...contact,name:e.target.value}})}/></label>
      <div className="el-profile-grid">
        <label>Relationship<select name="emergencyContactRelationship" required={hasContact} value={contact.relationship} onChange={e=>update({emergencyContact:{...contact,relationship:e.target.value as typeof contact.relationship}})}>{Object.entries(contactRelationships).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        <label>Contact’s mobile number<input type="tel" name="emergencyContactPhone" autoComplete="off" inputMode="tel" maxLength={30} required={hasContact} value={contact.phone} onChange={e=>update({emergencyContact:{...contact,phone:e.target.value}})}/></label>
      </div>
      {hasContact && <><label className="el-profile-check"><input type="checkbox" required checked={p.contactConsent} onChange={e=>update({contactConsent:e.target.checked})}/><span>This person agreed to be listed as my emergency contact.</span></label><button type="button" className="el-profile-clear" onClick={()=>update({emergencyContact:{name:'',phone:'',relationship:''},contactConsent:false})}>Remove emergency contact</button></>}
    </fieldset>
  </div>;
}
