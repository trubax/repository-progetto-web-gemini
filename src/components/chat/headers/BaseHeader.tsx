import React from 'react';
import { ArrowLeft, MoreVertical } from 'lucide-react';

export interface BaseHeaderProps {
  onClose: () => void;
  name: string;
  photoURL: string;
  onShowOptions: () => void;
}

export default function BaseHeader({ onClose, name, photoURL, onShowOptions }: BaseHeaderProps) {
  return (
    <div className="theme-bg-primary h-[64px] flex items-center justify-between px-4 shadow-md">
      <div className="flex items-center gap-4">
        <button
          onClick={onClose}
          className="p-2 hover:theme-bg-secondary rounded-full transition-colors theme-text"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <img
          src={photoURL}
          alt={name}
          className="w-10 h-10 rounded-full object-cover"
        />
        <div className="flex flex-col">
          <h2 className="font-semibold theme-text text-base">{name}</h2>
        </div>
      </div>
      <div className="flex items-center">
        <button 
          onClick={onShowOptions}
          className="p-2 hover:theme-bg-secondary rounded-full transition-colors theme-text"
        >
          <MoreVertical className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
