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
      return 'bg-blue-500/20 text-blue-400 border-blue-500';
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
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-cyan-900/30 bg-slate-950">
      <div className="border-b border-cyan-900/30 bg-gradient-to-r from-slate-900 to-slate-950 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-purple-400" />
            <h2 className="font-mono tracking-wider text-purple-400">BROADCAST CONTROL</h2>
          </div>
          {pendingCount > 0 && (
            <Badge variant="outline" className="border-yellow-900/50 text-xs text-yellow-400">
              {pendingCount} QUEUED
            </Badge>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="space-y-4 p-3">
          <div className="grid grid-cols-3 gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-xs">
            <div>
              <div className="mb-1 text-slate-500">Target Reach</div>
              <div className="font-mono text-slate-200">{formatCompactNumber(target.audience)}</div>
            </div>
            <div>
              <div className="mb-1 text-slate-500">Geo Scope</div>
              <div className="font-mono text-cyan-400">{Math.round(selectedGeoFence.coverage * 100)}%</div>
            </div>
            <div>
              <div className="mb-1 text-slate-500">Estimated Delivery</div>
              <div className="font-mono text-green-400">{formatCompactNumber(estimatedRecipients)}</div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-mono text-cyan-400/70">MESSAGE TEMPLATES</Label>
            <div className="grid grid-cols-2 gap-2">
              {messageTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleTemplateSelect(template.id)}
                  className={`rounded border p-2 text-left text-xs transition-colors ${
                    selectedTemplate === template.id
                      ? 'border-cyan-500 bg-cyan-900/30 text-cyan-300'
                      : 'border-slate-800 bg-slate-900/50 text-slate-400 hover:border-cyan-900/50'
                  }`}
                >
                  <div className="font-medium">{template.label}</div>
                  <div className="mt-1 text-[10px] text-slate-500">{template.category}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-mono text-cyan-400/70">MESSAGE CONTENT</Label>
            <Textarea
              value={message}
              onChange={(event) => setMessage(event.target.value.slice(0, MESSAGE_LIMIT))}
              placeholder="Enter emergency broadcast message..."
              className="min-h-[110px] resize-none border-cyan-900/30 bg-slate-900 text-slate-200"
            />
            <div className="flex items-center justify-between text-xs">
              <div className="text-slate-500">
                Messages are written to the outbound queue and audit trail immediately.
              </div>
              <div className={remainingCharacters < 50 ? 'font-mono text-orange-400' : 'font-mono text-slate-500'}>
                {remainingCharacters} remaining
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-mono text-cyan-400/70">TARGET GROUP</Label>
            <Select value={targetGroup} onValueChange={setTargetGroup}>
              <SelectTrigger className="border-cyan-900/30 bg-slate-900 text-slate-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-cyan-900/30 bg-slate-800">
                {targetGroups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    <div className="flex w-full items-center justify-between gap-3">
                      <span>{group.label}</span>
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
            <Label className="flex items-center gap-2 text-xs font-mono text-cyan-400/70">
              <MapPin className="h-3 w-3" />
              GEO-FENCE TARGETING
            </Label>
            <Select value={geoFence} onValueChange={setGeoFence}>
              <SelectTrigger className="border-cyan-900/30 bg-slate-900 text-slate-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-cyan-900/30 bg-slate-800">
                {geoFenceOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    <div className="flex w-full items-center justify-between gap-3">
                      <span>{option.label}</span>
                      <span className="text-[10px] text-slate-500">{Math.round(option.coverage * 100)}%</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-xs font-mono text-cyan-400/70">
              <AlertCircle className="h-3 w-3" />
              PRIORITY LEVEL
            </Label>
            <Select value={priority} onValueChange={(value) => setPriority(value as MessagePriority)}>
              <SelectTrigger className="border-cyan-900/30 bg-slate-900 text-slate-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-cyan-900/30 bg-slate-800">
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

          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-xs">
            <div className="mb-2 flex items-center gap-2 text-slate-400">
              <Users className="h-3 w-3" />
              Delivery Preview
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-slate-500">Selected Group</div>
                <div className="text-slate-300">{target.label}</div>
              </div>
              <div>
                <div className="text-slate-500">Recipients</div>
                <div className="font-mono text-cyan-400">{formatFullNumber(estimatedRecipients)}</div>
              </div>
            </div>
          </div>

          <Button
            onClick={handleSend}
            disabled={!message.trim()}
            className="w-full bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:from-purple-500 hover:to-purple-600"
          >
            <Send className="mr-2 h-4 w-4" />
            SEND BROADCAST
          </Button>
        </div>
      </div>
    </div>
  );
}
