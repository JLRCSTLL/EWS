import { AlertCircle, MapPin, MessageSquare, Send, Users } from 'lucide-react';
import { useState } from 'react';
import { geoFenceOptions, messageTemplates, targetGroups, type MessagePriority } from '../lib/dashboard-data';
import { formatCompactNumber, formatFullNumber } from '../lib/formatting';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';

const MESSAGE_LIMIT = 500;

export interface OutboundMessageDraft {
  content: string;
  category: string;
  targetGroupId: string;
  priority: MessagePriority;
  geoFenceId: string;
  templateLabel?: string;
}

interface MessagingPanelProps {
  onSendMessage: (draft: OutboundMessageDraft) => void;
  pendingCount: number;
}

const getPriorityColor = (priority: MessagePriority) => {
  switch (priority) {
    case 'critical':
      return 'bg-red-500/20 text-red-400 border-red-500';
    case 'high':
      return 'bg-orange-500/20 text-orange-400 border-orange-500';
    case 'normal':
      return 'bg-white/10 text-zinc-300 border-white/20';
    default:
      return 'bg-slate-500/20 text-slate-400 border-slate-500';
  }
};

export function MessagingPanel({ onSendMessage, pendingCount }: MessagingPanelProps) {
  const [message, setMessage] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [targetGroup, setTargetGroup] = useState('all');
  const [priority, setPriority] = useState<MessagePriority>('normal');
  const [geoFence, setGeoFence] = useState('all-areas');

  const target = targetGroups.find((group) => group.id === targetGroup) ?? targetGroups[0];
  const selectedGeoFence = geoFenceOptions.find((option) => option.id === geoFence) ?? geoFenceOptions[0];
  const remainingCharacters = MESSAGE_LIMIT - message.length;
  const estimatedRecipients = Math.max(1, Math.round(target.audience * selectedGeoFence.coverage));
  const activeTemplate = messageTemplates.find((template) => template.id === selectedTemplate);

  const handleTemplateSelect = (templateId: string) => {
    const template = messageTemplates.find((candidate) => candidate.id === templateId);
    if (!template) {
      return;
    }

    setSelectedTemplate(templateId);
    setMessage(template.content.slice(0, MESSAGE_LIMIT));
    setPriority(template.category === 'Evacuation' || template.category === 'Medical Alert' ? 'critical' : 'high');
  };

  const handleSend = () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      return;
    }

    onSendMessage({
      content: trimmedMessage,
      category: activeTemplate?.category ?? 'Manual Broadcast',
      targetGroupId: targetGroup,
      priority,
      geoFenceId: geoFence,
      templateLabel: activeTemplate?.label,
    });

    setMessage('');
    setSelectedTemplate('');
    setPriority('normal');
  };

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-white/8 bg-[#111111]">
      <div className="shrink-0 border-b border-white/10 bg-white/[0.01] p-3">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <MessageSquare className="h-5 w-5 shrink-0 text-zinc-200" />
            <h2 className="truncate font-mono tracking-wider text-zinc-100">BROADCAST CONTROL</h2>
          </div>
          {pendingCount > 0 && (
            <Badge variant="outline" className="border-yellow-900/50 text-xs text-yellow-400">
              {pendingCount} QUEUED
            </Badge>
          )}
        </div>
      </div>

      <div className="min-h-0 min-w-0 flex-1 overflow-auto">
        <div className="space-y-4 p-3">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(90px,1fr))] gap-3 rounded-xl border border-white/10 bg-[#141416] p-3 text-xs">
            <div>
              <div className="mb-1 text-slate-500">Target Reach</div>
              <div className="font-mono text-slate-200">{formatCompactNumber(target.audience)}</div>
            </div>
            <div>
              <div className="mb-1 text-slate-500">Geo Scope</div>
              <div className="font-mono text-zinc-300">{Math.round(selectedGeoFence.coverage * 100)}%</div>
            </div>
            <div>
              <div className="mb-1 text-slate-500">Estimated Delivery</div>
              <div className="font-mono text-green-400">{formatCompactNumber(estimatedRecipients)}</div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-mono text-zinc-400">MESSAGE TEMPLATES</Label>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2">
              {messageTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleTemplateSelect(template.id)}
                  className={`rounded border p-2 text-left text-xs transition-colors ${
                    selectedTemplate === template.id
                      ? 'border-white/30 bg-white/10 text-zinc-100'
                      : 'border-white/10 bg-[#141416] text-zinc-400 hover:border-white/20 hover:bg-[#18181b]'
                  }`}
                >
                  <div className="font-medium">{template.label}</div>
                  <div className="mt-1 text-[10px] text-slate-500">{template.category}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-mono text-zinc-400">MESSAGE CONTENT</Label>
            <Textarea
              value={message}
              onChange={(event) => setMessage(event.target.value.slice(0, MESSAGE_LIMIT))}
              placeholder="Enter emergency broadcast message..."
              className="min-h-[88px] resize-none border-white/15 bg-[#121214] text-zinc-100"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="min-w-0 flex-1 text-slate-500">
                Messages are written to the outbound queue and audit trail immediately.
              </div>
              <div className={remainingCharacters < 50 ? 'font-mono text-orange-400' : 'font-mono text-slate-500'}>
                {remainingCharacters} remaining
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-mono text-zinc-400">TARGET GROUP</Label>
            <Select value={targetGroup} onValueChange={setTargetGroup}>
              <SelectTrigger className="border-white/15 bg-[#121214] text-zinc-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/15 bg-[#16161a] text-zinc-100">
                {targetGroups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    <div className="flex w-full min-w-0 items-center justify-between gap-3">
                      <span className="truncate">{group.label}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {formatCompactNumber(group.audience)}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-xs font-mono text-zinc-400">
              <MapPin className="h-3 w-3" />
              GEO-FENCE TARGETING
            </Label>
            <Select value={geoFence} onValueChange={setGeoFence}>
              <SelectTrigger className="border-white/15 bg-[#121214] text-zinc-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/15 bg-[#16161a] text-zinc-100">
                {geoFenceOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    <div className="flex w-full min-w-0 items-center justify-between gap-3">
                      <span className="truncate">{option.label}</span>
                      <span className="text-[10px] text-slate-500">{Math.round(option.coverage * 100)}%</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-xs font-mono text-zinc-400">
              <AlertCircle className="h-3 w-3" />
              PRIORITY LEVEL
            </Label>
            <Select value={priority} onValueChange={(value) => setPriority(value as MessagePriority)}>
              <SelectTrigger className="border-white/15 bg-[#121214] text-zinc-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-white/15 bg-[#16161a] text-zinc-100">
                <SelectItem value="critical">
                  <Badge className={getPriorityColor('critical')}>CRITICAL</Badge>
                </SelectItem>
                <SelectItem value="high">
                  <Badge className={getPriorityColor('high')}>HIGH</Badge>
                </SelectItem>
                <SelectItem value="normal">
                  <Badge className={getPriorityColor('normal')}>NORMAL</Badge>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#141416] p-3 text-xs">
            <div className="mb-2 flex items-center gap-2 text-slate-400">
              <Users className="h-3 w-3" />
              Delivery Preview
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-2">
              <div>
                <div className="text-slate-500">Selected Group</div>
                <div className="text-slate-300">{target.label}</div>
              </div>
              <div>
                <div className="text-slate-500">Recipients</div>
                <div className="font-mono text-zinc-200">{formatFullNumber(estimatedRecipients)}</div>
              </div>
            </div>
          </div>

          <Button
            onClick={handleSend}
            disabled={!message.trim()}
            className="w-full rounded-full border border-white/20 bg-white/10 text-zinc-100 hover:bg-white/15"
          >
            <Send className="mr-2 h-4 w-4" />
            SEND BROADCAST
          </Button>
        </div>
      </div>
    </div>
  );
}
