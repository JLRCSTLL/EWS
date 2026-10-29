import { useState } from 'react';
import { Bell, CheckCheck, ShieldCheck, Smartphone } from 'lucide-react';
import { GroupManager } from './GroupsWorkspace';
import { createPresentationState, changePresentationGroup, type PresentationTeam } from '../../lib/presentation-data';
import { EmergencyFields, profileDraft } from '../public/ProfileFields';

export function PresentationGroups({onBroadcast}:{onBroadcast:(team:PresentationTeam)=>void}) {
  const [state,setState] = useState(createPresentationState);
  const mutate = async (path:string,body:unknown = {},method = 'POST') => {
    const changed = changePresentationGroup(state,path,body as Record<string,unknown>,method);
    setState(changed.state);return changed.result;
  };
  return <><p className="el-connected-notice">Presentation workspace · fictional personnel · changes are discarded when the chapter ends.</p>
    <GroupManager service={{state,mutate}} onBroadcast={id=>{
      const group=state.teamGroups.find(g=>g.id===id)!;
      const ids=new Set(state.memberships.filter(m=>m.group_id===id).map(m=>m.user_id));
      onBroadcast({group,members:state.users.filter(p=>ids.has(p.id))});
    }}/></>;
}

export function PresentationPersonnel() {
  const [profile,setProfile]=useState(()=>profileDraft());
  const [saved,setSaved]=useState(false);
  return <div className="el-connected presentation-personnel">
    <p className="el-connected-notice">Fictional emergency profile · the same optional fields are available during registration and in Account.</p>
    <div className="presentation-person-card" data-demo="profile-privacy"><span className="groups-avatar">AL</span><div><h3>Alex · Demo</h3><p>Preferred name · email and phone masked</p><small>••••@example.invalid · •••• ••• 0100</small></div><ShieldCheck size={24}/></div>
    <form className="el-profile-form" onSubmit={event=>{event.preventDefault();setSaved(true);}}>
      <EmergencyFields value={profile} onChange={next=>{setProfile(next);setSaved(false);}}/>
      <button data-demo="save-profile" className="ops-secondary-button">Save sample profile</button>
      {saved&&<p className="el-connected-notice" data-demo="profile-saved" role="status">Sample profile saved for this chapter. Shared age range, PWD status and assistance needs support geofence planning. Contacts still require the person’s approval.</p>}
    </form>
  </div>;
}

export function PresentationGroupBroadcast({team}:{team:PresentationTeam}) {
  const [message,setMessage]=useState(''),[priority,setPriority]=useState('high'),[sent,setSent]=useState(false);
  return <div className="el-connected presentation-group-broadcast">
    <div className="el-connected-notice" data-demo="named-group-scope"><strong>#{team.group.tag}</strong><span>{team.members.length} sample members · named group audience</span><p>All group members are included, even outside the geofence or off duty. Live delivery still depends on their registered device and notification availability.</p></div>
    <div className="presentation-recipient-grid">{team.members.map((p,index)=><div className="presentation-person-card" key={p.id}><span className="groups-avatar">{p.name.slice(0,2).toUpperCase()}</span><div><strong>{p.name}</strong><small>{index===0?'Inside demo area':index===1?'Outside demo area':'Off duty · no shared position'} · included</small></div></div>)}</div>
    <form onSubmit={event=>{event.preventDefault();setSent(true);}}>
      <label>Priority<select aria-label="Group alert priority" value={priority} onChange={e=>setPriority(e.target.value)}><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option></select></label>
      <label>Message<textarea aria-label="Group alert message" rows={3} maxLength={500} required value={message} onChange={e=>{setMessage(e.target.value);setSent(false);}}/></label>
      <button className="ops-secondary-button" data-demo="send-group-preview" disabled={!message.trim()}><Bell size={16}/>Simulate group alert</button>
    </form>
    {sent&&<div className="ops-tour-delivery" data-demo="group-delivery" role="status"><strong>Demo delivery preview · {team.members.length} recipients</strong><p>{message}</p><small>#{team.group.tag} · {priority} priority · no message sent</small><div className="presentation-phone-receipt" data-demo="mobile-receipt"><Smartphone size={24}/><div><strong>Mobile Phone personnel app · sample notification</strong><p>{message}</p><small><CheckCheck size={14}/>Acknowledgment returns to the command center when a person reads the alert.</small></div></div></div>}
  </div>;
}
