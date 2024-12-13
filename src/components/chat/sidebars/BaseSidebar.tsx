import React from 'react';
import { X } from 'lucide-react';

export interface BaseSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export default function BaseSidebar({ isOpen, onClose, children, className = '' }: React.PropsWithChildren<BaseSidebarProps>) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay scuro */}
      <div 
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div className={`relative ml-auto w-full max-w-sm theme-bg-primary shadow-xl transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      } ${className}`}>
        {/* Header della sidebar */}
        <div className="flex items-center justify-between p-4 border-b theme-divide">
          <h2 className="text-lg font-semibold theme-text">Opzioni</h2>
          <button
            onClick={onClose}
            className="p-2 hover:theme-bg-secondary rounded-full transition-colors theme-text"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenuto della sidebar */}
        <div className="p-4 overflow-y-auto max-h-[calc(100vh-64px)]">
          {children}
        </div>
      </div>
    </div>
  );
}
