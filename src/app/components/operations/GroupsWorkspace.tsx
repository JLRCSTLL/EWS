import { useEffect, useState, type FormEvent } from 'react';
import { Archive, Crown, Plus, Search, Send, Settings2, UserPlus, Users, X } from 'lucide-react';
import { useLive } from '../../lib/live-service';
import { groupBranch, type TeamGroup } from '../../lib/organization';
import { Projects } from './StructureWorkspace';
import '../../../styles/connected-operations.css';
import '../../../styles/command-refinement.css';

export function GroupsWorkspace({ onBroadcast }: { onBroadcast: (id: string) => void }) {
  const { state } = useLive();
  if (!state || !['admin', 'operator'].includes(state.user.role)) return <p className="el-connected-notice">Sign in through Personnel with approved operator access to create groups and assign members.</p>;
  return <GroupManager onBroadcast={onBroadcast} />;
}

function GroupManager({ onBroadcast }: { onBroadcast: (id: string) => void }) {
  const live = useLive(), state = live.state!;
  const groups = state.teamGroups || [], memberships = state.memberships || [], people = state.users;
  const [selected, setSelected] = useState(groups.find(g => !g.archived)?.id || '');
  const [query, setQuery] = useState(''), [archived, setArchived] = useState(false);
  const [mode, setMode] = useState<'view' | 'create' | 'edit' | 'members'>('view');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [memberQuery, setMemberQuery] = useState(''), [picks, setPicks] = useState<string[]>([]);
  const group = groups.find(g => g.id === selected);
  const direct = memberships.filter(m => m.group_id === selected);
  const directIds = new Set(direct.map(m => m.user_id));
  const leaders = direct.filter(m => m.is_leader || m.user_id === group?.head_id);
  const shown = groups.filter(g => g.archived === archived && `${g.name} ${g.tag}`.toLowerCase().includes(query.trim().toLowerCase()));
  useEffect(() => { if (!selected && groups.length) setSelected(groups.find(g => !g.archived)?.id || groups[0].id); }, [groups, selected]);
  async function save(path: string, body: unknown, method: string, message: string, done?: (r: any) => void) {
    setBusy(true); setError(''); setNotice('');
    try { const result = await live.mutate(path, body, method); setNotice(message); done?.(result); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to save. Please try again.'); }
    finally { setBusy(false); }
  }
  function select(id: string) { if (busy) return; setSelected(id); setMode('view'); setError(''); setNotice(''); }
  function addMembers() { setPicks([]); setMemberQuery(''); setMode('members'); setNotice(''); }
  const candidates = people.filter(p => !directIds.has(p.id) && p.name.toLowerCase().includes(memberQuery.toLowerCase()));
  return <div className="el-connected groups-workspace">
    <div className="groups-toolbar"><div><h3>Your groups</h3><p>Create teams, assign leaders, and reach every member with one alert.</p></div><button disabled={busy} onClick={() => { setMode('create'); setError(''); setNotice(''); }}><Plus size={16} />Create group</button></div>
    {error && <p className="el-connected-error" role="alert">{error}</p>}
    {notice && <p className="el-connected-notice" role="status">{notice}</p>}
    <div className="groups-layout">
      <aside>
        <label className="groups-search"><Search size={16} /><input aria-label="Find a group" placeholder="Find a group…" value={query} onChange={e => setQuery(e.target.value)} /></label>
        <label className="el-connected-check"><input type="checkbox" checked={archived} onChange={e => { setArchived(e.target.checked); setMode('view'); setSelected(groups.find(g => g.archived === e.target.checked)?.id || ''); }} />Show archived groups</label>
        <div className="groups-list" aria-label="Groups">{shown.map(g => <button key={g.id} disabled={busy} className={g.id === selected && mode !== 'create' ? 'is-selected' : ''} aria-pressed={g.id === selected && mode !== 'create'} onClick={() => select(g.id)}><strong>{g.name}</strong><span>{memberships.filter(m => m.group_id === g.id).length}</span><small>#{g.tag}</small></button>)}</div>
        {!shown.length && <p className="el-connected-caption">{query ? 'No groups match this search.' : archived ? 'No archived groups.' : 'Your groups will appear here.'}</p>}
      </aside>
      <section className="groups-detail">
        {(mode === 'create' || mode === 'edit') ? <GroupForm key={mode === 'create' ? 'new' : selected} group={mode === 'edit' ? group : undefined} groups={groups} people={people} busy={busy} onCancel={() => setMode('view')} onSave={body => void save(mode === 'create' ? '/groups' : `/groups/${selected}`, body, mode === 'create' ? 'POST' : 'PUT', 'Group saved.', result => { setSelected(result.id); setArchived(Boolean(body.archived)); setMode('view'); })} />
        : !group ? <div className="groups-empty"><Users size={32} /><h3>Build your first group</h3><p>Start with a name. Then add registered personnel and choose who leads.</p><button onClick={() => setMode('create')}><Plus size={15} />Create group</button></div>
        : <>
          <header className="groups-detail-header"><div><span className="groups-tag">#{group.tag}{group.archived && ' · Archived'}</span><h3>{group.name}</h3><p>{group.description || 'Add a purpose for this team in group settings.'}</p></div><button disabled={busy} onClick={() => { setMode('edit'); setNotice(''); }}><Settings2 size={15} />Settings</button></header>
          <div className="groups-meta"><span><Users size={14} />{direct.length} members</span><span><Crown size={14} />{leaders.length} {leaders.length === 1 ? 'leader' : 'leaders'}</span><span>{people.filter(p => directIds.has(p.id) && p.onDuty).length} on duty</span></div>
          {group.parent_id && <p className="el-connected-caption">Part of {groups.find(g => g.id === group.parent_id)?.name || 'another group'}</p>}
          {group.project_id && <p className="el-connected-caption">Existing operation: {state.projects?.find(p => p.id === group.project_id)?.name || 'Linked operation'}</p>}
          {!group.archived && <div className="groups-actions"><button disabled={busy} onClick={addMembers}><UserPlus size={15} />Add members</button><button disabled={!direct.length || busy} onClick={() => onBroadcast(group.id)}><Send size={15} />Message group</button></div>}
          {mode === 'members' ? <form className="groups-edit" onSubmit={e => { e.preventDefault(); void save(`/groups/${selected}/members`, { userIds: picks }, 'PUT', `${picks.length} ${picks.length === 1 ? 'member added' : 'members added'}.`, () => setMode('view')); }}>
            <h3>Add registered personnel</h3><label>Find a preferred name<input autoFocus type="search" value={memberQuery} onChange={e => setMemberQuery(e.target.value)} placeholder="Search personnel…" /></label>
            <div className="groups-picker">{candidates.map(p => <label key={p.id}><input type="checkbox" checked={picks.includes(p.id)} disabled={busy || (!picks.includes(p.id) && picks.length >= 100)} onChange={e => setPicks(old => e.target.checked ? [...old,p.id] : old.filter(id => id !== p.id))} /><span><strong>{p.name}</strong><small>{p.onDuty ? 'On duty' : 'Off duty'}</small></span></label>)}{!candidates.length && <p>{memberQuery ? 'No matching personnel.' : 'All registered personnel are already members.'}</p>}</div>
            <div className="groups-actions"><button disabled={!picks.length || busy}>{busy ? 'Adding…' : `Add ${picks.length || ''} ${picks.length === 1 ? 'member' : 'members'}`}</button><button type="button" disabled={busy} onClick={() => setMode('view')}>Cancel</button></div>
          </form> : <>
            {!direct.length && <div className="groups-empty"><UserPlus size={26} /><h3>No members yet</h3><p>Add personnel to make this group available for targeted alerts.</p></div>}
            {[...direct].sort((a,b) => Number(b.user_id === group.head_id || b.is_leader) - Number(a.user_id === group.head_id || a.is_leader)).map(m => {
              const person = people.find(p => p.id === m.user_id), primary = m.user_id === group.head_id;
              return <div className="groups-member" key={m.user_id}><span className="groups-avatar">{person?.name.slice(0,2).toUpperCase() || '—'}</span><div><strong>{person?.name || 'Personnel'}</strong><small>{primary ? 'Primary leader · ' : ''}{[m.title && m.title !== 'Head' ? m.title : '',m.category, person?.onDuty ? 'On duty' : 'Off duty'].filter(Boolean).join(' · ')}</small></div>
                <select aria-label={`Group role for ${person?.name || 'personnel'}`} value={m.is_leader || primary ? 'leader' : 'member'} disabled={busy || group.archived || primary} onChange={e => void save(`/groups/${selected}/members/${m.user_id}`,{title:m.title,category:m.category,isLeader:e.target.value === 'leader'},'PUT','Group role updated.')}><option value="member">Member</option><option value="leader">Leader</option></select>
                {!group.archived && <button disabled={busy || primary} aria-label={`Remove ${person?.name || 'personnel'} from group`} title={primary ? 'Change the primary leader in Settings first' : 'Remove from this group'} onClick={() => void save(`/groups/${selected}/members/${m.user_id}`,{},'DELETE','Member removed from this group.')}><X size={15} /></button>}
              </div>;
            })}
            {!!direct.length && <p className="el-connected-caption">Leader is a group responsibility. It does not grant command-center access. Group alerts can reach members outside the geofence.</p>}
          </>}
        </>}
      </section>
    </div>
    {!!state.projects?.length && <details className="groups-legacy"><summary>Existing operation assignments ({state.projects.length})</summary><p>Your previous project records and tasks are kept here. New teams can be created directly as groups.</p><Projects /></details>}
  </div>;
}

function GroupForm({ group, groups, people, busy, onCancel, onSave }: { group?: TeamGroup; groups: TeamGroup[]; people: {id:string;name:string}[]; busy:boolean; onCancel:()=>void; onSave:(body:{name:string;tag:string;description:FormDataEntryValue|null;headId:FormDataEntryValue|null;parentId:FormDataEntryValue|null;projectId:string|null;archived:boolean})=>void }) {
  const [name,setName] = useState(group?.name || ''), [tag,setTag] = useState(group?.tag || ''), [tagEdited,setTagEdited] = useState(!!group);
  const descendants = group ? groupBranch(groups.map(g => ({...g,archived:false})), [group.id]) : new Set<string>();
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    onSave({name,tag,description:f.get('description'),headId:f.get('headId'),parentId:f.get('parentId'),projectId:group?.project_id || null,archived:f.get('archived') === 'on'});
  }
  return <form className="groups-edit" onSubmit={submit}>
    <h3>{group ? 'Group settings' : 'Create a group'}</h3>
    <label>Group name<input autoFocus required maxLength={80} value={name} onChange={e => { setName(e.target.value); if (!tagEdited) setTag(e.target.value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^[^a-z]+|^-+|-+$/g,'').slice(0,40)); }} placeholder="e.g. Flood response team" /></label>
    <div className="el-connected-fields"><label>Broadcast tag<input required pattern="[a-zA-Z][a-zA-Z0-9_-]{0,39}" maxLength={40} value={tag} onChange={e => {setTagEdited(true);setTag(e.target.value.replace(/^#/,''));}} placeholder="flood-response" /></label>
    <label>Primary leader<select name="headId" defaultValue={group?.head_id || ''}><option value="">Assign later</option>{people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label></div>
    <p className="el-connected-caption">The primary leader is added as a member automatically. You can assign additional leaders in the member list.</p>
    <label>Purpose / description<textarea name="description" rows={3} maxLength={500} defaultValue={group?.description || ''} placeholder="What does this group do?" /></label>
    <details><summary>Optional organization</summary><label>Parent group<select name="parentId" defaultValue={group?.parent_id || ''}><option value="">Independent group</option>{groups.filter(g => !g.archived && !descendants.has(g.id) && g.project_id === (group?.project_id || null)).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>{group && <label className="el-connected-check"><input name="archived" type="checkbox" defaultChecked={group.archived} /><Archive size={14} />Archive group</label>}</details>
    <div className="groups-actions"><button disabled={busy}>{busy ? 'Saving…' : group ? 'Save changes' : 'Create group'}</button><button type="button" disabled={busy} onClick={onCancel}>Cancel</button></div>
  </form>;
}
