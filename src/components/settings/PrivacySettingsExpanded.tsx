import React from 'react';
import { Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { Switch } from '../ui/Switch';
import type { PrivacySettings } from '@/types/privacy';

interface PrivacySettingsExpandedProps {
  privacy: PrivacySettings;
  onUpdate: (updates: Partial<PrivacySettings>) => Promise<void>;
  expanded: boolean;
  onToggle: () => void;
}

export default function PrivacySettingsExpanded({ privacy, onUpdate, expanded, onToggle }: PrivacySettingsExpandedProps) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center space-x-3 p-3 rounded-lg hover:theme-bg-secondary theme-text"
      >
        <Shield className="w-5 h-5" />
        <span>Privacy e Sicurezza</span>
        <div className={`ml-auto transform transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
          <ChevronDown className="w-4 h-4" />
        </div>
      </button>

      <div className={`
        overflow-hidden transition-all duration-200 ease-in-out
        ${expanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}
      `}>
        <div className="ml-8 mr-3 space-y-3 py-2">
          <select
            value={privacy.accountType}
            onChange={(e) => onUpdate({ accountType: e.target.value as 'public' | 'private' })}
            className="w-full p-1.5 text-sm rounded theme-bg-secondary theme-text"
          >
            <option value="public">Account Pubblico</option>
            <option value="private">Account Privato</option>
          </select>

          <select
            value={privacy.whoCanSeeMyPosts}
            onChange={(e) => onUpdate({ whoCanSeeMyPosts: e.target.value as 'everyone' | 'followers' | 'none' })}
            className="w-full p-1.5 text-sm rounded theme-bg-secondary theme-text"
          >
            <option value="everyone">Visibile a tutti</option>
            <option value="followers">Solo follower</option>
            <option value="none">Privato</option>
          </select>

          <div className="space-y-2">
            {[
              ['showLastSeen', 'Ultimo accesso'],
              ['showStatus', 'Stato online'],
              ['showBio', 'Biografia'],
              ['showPosts', 'Post'],
              ['showServices', 'Servizi']
            ].map(([key, label]) => (
              <div key={key} className="flex items-center justify-between text-sm">
                <span className="theme-text">{label}</span>
                <Switch
                  checked={privacy[key as keyof PrivacySettings] as boolean}
                  onCheckedChange={(checked) => onUpdate({ [key]: checked })}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}