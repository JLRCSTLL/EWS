import { useState, type FormEvent } from 'react';
import { api, useLive } from '../../lib/live-service';
import { ContactFields, EmergencyFields, profileDraft } from './ProfileFields';

export function ProfileForm(){
  const {state,mutate}=useLive(),user=state!.user;
  const [name,setName]=useState(user.name),[profile,setProfile]=useState(()=>profileDraft(user));
  const [note,setNote]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy)return;setBusy(true);setNote('');setError('');
    try{if (!(await api('/config')).registrationProfileReady) throw new Error('Profile editing is being updated. Please try again shortly.'); await mutate('/profile',{...profile,name,groups:user.groups},'PUT');setNote('Profile saved. Changed contact details revoke previous visibility approvals.');}
    catch(error){setError(error instanceof Error?error.message:'Unable to save your profile.');}
    finally{setBusy(false);}
  }
  return <form className="el-profile-form" onSubmit={save}><fieldset disabled={busy}>
    <label>Preferred name<input name="name" value={name} onChange={e=>setName(e.target.value)} autoComplete="nickname" minLength={2} maxLength={80} required/></label>
    <ContactFields value={profile} onChange={setProfile}/>
    <h3 className="el-profile-section-heading">Emergency profile</h3><EmergencyFields value={profile} onChange={setProfile}/>
  </fieldset><button className="el-primary" disabled={busy}>{busy?'Saving…':'Save profile'}</button>{error&&<p className="el-error" role="alert">{error}</p>}{note&&<p className="el-notice" role="status">{note}</p>}</form>;
}
