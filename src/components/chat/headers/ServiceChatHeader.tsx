import React, { useState } from 'react';
import { Star, ArrowLeft, MoreVertical } from 'lucide-react';
import ServiceChatSidebar from '../sidebars/ServiceChatSidebar';

interface ServiceChatHeaderProps {
  onClose: () => void;
  name: string;
  photoURL: string;
  serviceType: string;
  availability: string;
  rating?: number;
  chatData: any;
  onRate: (rating: number) => Promise<void>;
  onReport: () => Promise<void>;
  onDeleteChat: () => Promise<void>;
  onToggleMute: () => Promise<void>;
  onSchedule: () => Promise<void>;
}

export default function ServiceChatHeader({
  onClose,
  name,
  photoURL,
  serviceType,
  availability,
  rating,
  chatData,
  onRate,
  onReport,
  onDeleteChat,
  onToggleMute,
  onSchedule
}: ServiceChatHeaderProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <>
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
            <div className="flex items-center gap-2">
              <span className="text-sm theme-text opacity-70">
                {serviceType} • {availability}
              </span>
              {rating && (
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm theme-text">{rating.toFixed(1)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 hover:theme-bg-secondary rounded-full transition-colors theme-text"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      <ServiceChatSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        chatData={chatData}
        onRate={onRate}
        onReport={onReport}
        onDeleteChat={onDeleteChat}
        onToggleMute={onToggleMute}
        onSchedule={onSchedule}
      />
    </>
  );
}
