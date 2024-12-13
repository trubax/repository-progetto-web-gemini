import React, { useState } from 'react';
import { ChevronDown, ChevronUp, MapPin, Globe, Calendar, Monitor, Phone, Mail } from 'lucide-react';

interface DemographicInfoProps {
  userData: {
    birthYear?: string;
    country?: string;
    platform?: string;
    location?: {
      latitude: number;
      longitude: number;
    };
    email?: string;
    phone?: string;
    secondaryEmail?: string;
  };
  isExpanded?: boolean;
}

export default function DemographicInfo({ userData, isExpanded: defaultExpanded = false }: DemographicInfoProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const getAge = (birthYear: string) => {
    const currentYear = new Date().getFullYear();
    return currentYear - parseInt(birthYear);
  };

  const formatLocation = (location: { latitude: number; longitude: number }) => {
    return `${location.latitude.toFixed(2)}°, ${location.longitude.toFixed(2)}°`;
  };

  return (
    <div className="w-full bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between theme-bg-secondary hover:opacity-90 transition-opacity"
      >
        <span className="font-medium theme-text">Informazioni Personali</span>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 theme-text" />
        ) : (
          <ChevronDown className="w-5 h-5 theme-text" />
        )}
      </button>

      {isExpanded && (
        <div className="p-4 space-y-4 theme-bg-primary">
          {userData.birthYear && (
            <div className="flex items-center space-x-3">
              <Calendar className="w-5 h-5 text-blue-500" />
              <div>
                <span className="text-sm font-medium theme-text">Età</span>
                <p className="text-sm theme-text opacity-80">{getAge(userData.birthYear)} anni</p>
              </div>
            </div>
          )}

          {userData.country && (
            <div className="flex items-center space-x-3">
              <Globe className="w-5 h-5 text-green-500" />
              <div>
                <span className="text-sm font-medium theme-text">Paese</span>
                <p className="text-sm theme-text opacity-80">{userData.country}</p>
              </div>
            </div>
          )}

          {userData.platform && (
            <div className="flex items-center space-x-3">
              <Monitor className="w-5 h-5 text-purple-500" />
              <div>
                <span className="text-sm font-medium theme-text">Piattaforma</span>
                <p className="text-sm theme-text opacity-80">{userData.platform}</p>
              </div>
            </div>
          )}

          {userData.location && (
            <div className="flex items-center space-x-3">
              <MapPin className="w-5 h-5 text-red-500" />
              <div>
                <span className="text-sm font-medium theme-text">Posizione</span>
                <p className="text-sm theme-text opacity-80">{formatLocation(userData.location)}</p>
              </div>
            </div>
          )}

          {userData.email && (
            <div className="flex items-center space-x-3">
              <Mail className="w-5 h-5 text-yellow-500" />
              <div>
                <span className="text-sm font-medium theme-text">Email</span>
                <p className="text-sm theme-text opacity-80">{userData.email}</p>
              </div>
            </div>
          )}

          {userData.secondaryEmail && (
            <div className="flex items-center space-x-3">
              <Mail className="w-5 h-5 text-yellow-500" />
              <div>
                <span className="text-sm font-medium theme-text">Email Secondaria</span>
                <p className="text-sm theme-text opacity-80">{userData.secondaryEmail}</p>
              </div>
            </div>
          )}

          {userData.phone && (
            <div className="flex items-center space-x-3">
              <Phone className="w-5 h-5 text-indigo-500" />
              <div>
                <span className="text-sm font-medium theme-text">Telefono</span>
                <p className="text-sm theme-text opacity-80">{userData.phone}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
