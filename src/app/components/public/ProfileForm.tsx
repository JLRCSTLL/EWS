import { useState, type FormEvent } from 'react';
import { api, useLive } from '../../lib/live-service';
import { ContactFields, EmergencyFields, profileDraft } from './ProfileFields';

export function ProfileForm(){
  const {state,mutate}=useLive(),user=state!.user;
  const supportsEmergency = Object.hasOwn(user,'emergencyProfile');
  const [name,setName]=useState(user.name),[profile,setProfile]=useState(()=>profileDraft(user));
  const [note,setNote]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy)return;setBusy(true);setNote('');setError('');
    try{if (supportsEmergency && !(await api('/config')).registrationProfileReady) throw new Error('Profile editing is being updated. Please try again shortly.'); const payload=supportsEmergency?{...profile,name,groups:user.groups}:{name,email:profile.email,phone:profile.phone,municipality:user.municipality,groups:user.groups}; await mutate('/profile',payload,'PUT');setNote('Profile saved. Changed contact details revoke previous visibility approvals.');}
    catch(error){setError(error instanceof Error?error.message:'Unable to save your profile.');}
    finally{setBusy(false);}
  }
  return <form className="el-profile-form" onSubmit={save}><fieldset disabled={busy}>
    <label>Preferred name<input name="name" value={name} onChange={e=>setName(e.target.value)} autoComplete="nickname" minLength={2} maxLength={80} required/></label>
    {supportsEmergency ? <><ContactFields value={profile} onChange={setProfile}/><h3 className="el-profile-section-heading">Emergency profile</h3><EmergencyFields value={profile} onChange={setProfile}/></> : <>
      <label>Email · optional<input name="email" type="email" autoComplete="email" maxLength={254} value={profile.email} onChange={e=>setProfile({...profile,email:e.target.value})}/></label>
      <label>Phone · optional<input name="phone" type="tel" autoComplete="tel" maxLength={30} value={profile.phone} onChange={e=>setProfile({...profile,phone:e.target.value})}/></label>
      <p className="el-caption">Contacts stay masked until you approve access. Emergency profile setup is temporarily unavailable.</p>
    </>}
  </fieldset><button className="el-primary" disabled={busy}>{busy?'Saving…':'Save profile'}</button>{error&&<p className="el-error" role="alert">{error}</p>}{note&&<p className="el-notice" role="status">{note}</p>}</form>;
}
