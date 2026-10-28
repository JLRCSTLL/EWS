import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, LockKeyhole } from 'lucide-react';
import { ApiError } from '../../lib/live-service';
import { ContactFields, EmergencyFields, profileDraft, type ProfileDraft } from './ProfileFields';

const steps = ['Account', 'Contact & area', 'Emergency profile'];
export function RegistrationForm({busy,onCreate}:{busy:boolean;onCreate:(fields:ProfileDraft & {name:string;username:string;password:string})=>Promise<void>}) {
  const [step,setStep]=useState(0), [profile,setProfile]=useState(profileDraft);
  const [account,setAccount]=useState({name:'',username:'',password:'',confirm:''});
  const [error,setError]=useState('');
  const heading=useRef<HTMLHeadingElement>(null),first=useRef(true);
  useEffect(()=>{if(first.current){first.current=false;return;} heading.current?.focus();},[step]);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault(); if(busy)return;setError('');
    if(step===0 && account.password!==account.confirm){setError('Your passwords do not match.');return;}
    if(step<2){setStep(value=>value+1);return;}
    try{await onCreate({...profile,name:account.name,username:account.username,password:account.password});}
    catch(error){setError(error instanceof Error ? error.message:'Unable to create your account.');if(error instanceof ApiError && error.status===409)setStep(0);}
  }
  return <form className="el-registration" onSubmit={submit}>
    <ol className="el-registration-steps" aria-label="Registration progress">{steps.map((label,index)=><li key={label} aria-current={index===step?'step':undefined} className={index<step?'is-complete':''}><span>{index<step?<Check size={13}/>:index+1}</span>{label}</li>)}</ol>
    <h3 ref={heading} tabIndex={-1}>Step {step+1} of 3 · {steps[step]}</h3>
    <fieldset disabled={busy} className="el-registration-content">
      {step===0 ? <>
        <label>Preferred name<input name="name" autoComplete="nickname" minLength={2} maxLength={80} required placeholder="Preferred name or call sign" value={account.name} onChange={e=>setAccount({...account,name:e.target.value})}/></label>
        <p className="el-field-note">Use the name operators should call you. A legal name is not required.</p>
        <label>Username<input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} pattern="[a-zA-Z0-9_]{3,30}" minLength={3} maxLength={30} required placeholder="Letters, numbers, and underscores" value={account.username} onChange={e=>setAccount({...account,username:e.target.value})}/></label>
        <label>Password<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required placeholder="At least 12 characters" value={account.password} onChange={e=>setAccount({...account,password:e.target.value})}/></label>
        <label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={account.confirm} onChange={e=>setAccount({...account,confirm:e.target.value})}/></label>
      </> : step===1 ? <ContactFields value={profile} onChange={setProfile}/> : <EmergencyFields value={profile} onChange={setProfile}/>}
    </fieldset>
    {error && <p className="el-error" role="alert">{error}</p>}
    <div className="el-registration-actions">{step>0&&<button type="button" className="el-secondary" disabled={busy} onClick={()=>{setStep(value=>value-1);setError('');}}><ArrowLeft size={16}/>Back</button>}<button className="el-primary" disabled={busy}>{busy?'Creating account…':step===2?'Create account':'Continue'}<ArrowRight size={17}/></button></div>
    <p className="el-registration-privacy"><LockKeyhole size={14}/>Only account details are required. You can edit your profile later. GPS starts only when you begin duty.</p>
  </form>;
}
