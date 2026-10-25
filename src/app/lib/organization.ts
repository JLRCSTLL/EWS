export interface TeamGroup {
  id: string;
  name: string;
  tag: string;
  description: string;
  project_id: string | null;
  parent_id: string | null;
  head_id: string | null;
  archived: boolean;
}
export interface GroupMember {
  group_id: string;
  user_id: string;
  title: string;
  category: string;
  is_leader?: boolean;
}
export interface Project {
  id: string;
  name: string;
  objective: string;
  status: "planned" | "active" | "completed";
  lead_id: string | null;
  starts_at: string | null;
  ends_at: string | null;
}
export interface ProjectTask {
  id: string;
  project_id: string;
  title: string;
  group_id: string | null;
  assignee_id: string | null;
  status: "todo" | "in_progress" | "blocked" | "done";
  due_at: string | null;
}
export interface ContactRequest {
  id: string;
  user_id: string;
  requester_id: string;
  requester_name: string;
  reason: string;
  fields: ("email" | "phone")[];
  status: "pending" | "approved" | "denied" | "revoked";
  expires_at: string | null;
  created_at: string;
}
export function groupTags(content: string): string[] {
  return [
    ...new Set(
      [
        ...content.matchAll(
          /(?:^|[\s(])#([a-z][a-z0-9_-]{0,39})(?![a-z0-9_-])/gi,
        ),
      ].map((match) => match[1].toLowerCase()),
    ),
  ];
}
export function groupBranch(groups: TeamGroup[], roots: string[]): Set<string> {
  const active = groups.filter((group) => !group.archived),
    ids = new Set(
      roots.filter((id) => active.some((group) => group.id === id)),
    );
  let changed = true;
  while (changed) {
    changed = false;
    for (const group of active)
      if (group.parent_id && ids.has(group.parent_id) && !ids.has(group.id)) {
        ids.add(group.id);
        changed = true;
      }
  }
  return ids;
}
export function memberIds(
  groups: TeamGroup[],
  memberships: GroupMember[],
  roots: string[],
): Set<string> {
  const ids = groupBranch(groups, roots);
  return new Set(
    memberships
      .filter((member) => ids.has(member.group_id))
      .map((member) => member.user_id),
  );
}
