import { Shield, UserCheck } from 'lucide-react';
import { roleSummaries, users, type UserAccount } from '../lib/dashboard-data';
import { formatRelativeTime } from '../lib/formatting';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

const getRoleColor = (role: UserAccount['role']) => {
  switch (role) {
    case 'admin':
      return 'bg-red-500/20 text-red-400 border-red-500';
    case 'lgu-official':
      return 'bg-blue-500/20 text-blue-400 border-blue-500';
    case 'responder':
      return 'bg-green-500/20 text-green-400 border-green-500';
    case 'operator':
      return 'bg-purple-500/20 text-purple-400 border-purple-500';
    default:
      return 'bg-slate-500/20 text-slate-400 border-slate-500';
  }
};

export function UserManagement() {
  const activeUsers = users.filter((user) => user.status === 'active').length;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-cyan-900/30 bg-slate-950">
      <div className="shrink-0 border-b border-cyan-900/30 bg-gradient-to-r from-slate-900 to-slate-950 p-3">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Shield className="h-5 w-5 shrink-0 text-blue-400" />
            <h2 className="truncate font-mono tracking-wider text-blue-400">USER MANAGEMENT (RBAC)</h2>
          </div>
          <Badge variant="outline" className="border-blue-900/50 text-xs text-blue-400">
            {activeUsers} ACTIVE
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="users" className="min-h-0 min-w-0 flex-1">
        <TabsList className="h-auto w-full shrink-0 flex-wrap justify-start rounded-none border-b border-cyan-900/30 bg-slate-900/50 p-2">
          <TabsTrigger value="users" className="data-[state=active]:bg-cyan-900/30 data-[state=active]:text-cyan-400">
            Active Users
          </TabsTrigger>
          <TabsTrigger value="roles" className="data-[state=active]:bg-cyan-900/30 data-[state=active]:text-cyan-400">
            Role Distribution
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-0 min-h-0 flex-1">
          <ScrollArea className="h-full min-h-0">
            <div className="space-y-3 p-3">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/50 p-3 transition-colors hover:border-cyan-900/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-slate-400" />
                        <h3 className="text-sm font-medium text-slate-200">{user.name}</h3>
                      </div>
                      <div className="text-xs text-slate-500">{user.organization}</div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                      <Badge className={getRoleColor(user.role)}>{user.role.toUpperCase()}</Badge>
                      <div className={`h-2 w-2 rounded-full ${user.status === 'active' ? 'bg-green-400' : 'bg-slate-600'}`} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs text-slate-500">Permissions</div>
                    <div className="flex flex-wrap gap-1">
                      {user.permissions.map((permission) => (
                        <div key={permission} className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-400">
                          {permission}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-slate-800 pt-2 font-mono text-xs text-cyan-400/70">
                    Last active {formatRelativeTime(user.lastActiveAt)}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="roles" className="mt-0 min-h-0 flex-1 overflow-auto">
          <div className="space-y-3 p-3">
            {roleSummaries.map((role) => (
              <div
                key={role.id}
                className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 transition-colors hover:border-cyan-900/50"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h3 className={`text-sm font-medium ${role.color}`}>{role.label}</h3>
                  <Badge variant="outline" className="border-cyan-900/50 text-cyan-400">
                    {role.count} users
                  </Badge>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                  <div className={`h-full ${role.color.replace('text-', 'bg-')}`} style={{ width: `${(role.count / 196) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
