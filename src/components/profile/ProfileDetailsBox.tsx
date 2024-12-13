import React, { useState } from 'react';
import { ChevronDown, Phone, Mail, MapPin, Calendar, Globe, Github, Linkedin, Twitter, Facebook, Instagram, Send, Music, Lock, Eye, EyeOff, Clock, User, Link } from 'lucide-react';

interface ProfileDetailsBoxProps {
  profileData: {
    displayName?: string;
    photoURL?: string;
    bio?: string;
    phoneNumbers?: string[];
    secondaryEmail?: string;
    socialLinks?: {
      facebook?: string;
      instagram?: string;
      telegram?: string;
      tiktok?: string;
      github?: string;
      linkedin?: string;
      twitter?: string;
    };
    birthYear?: string;
    country?: string;
    platform?: string;
    location?: {
      latitude: number;
      longitude: number;
    };
  };
  privacy: {
    accountType?: 'public' | 'private';
    showLastSeen?: boolean;
    showStatus?: boolean;
    showBio?: boolean;
    showPosts?: boolean;
    showServices?: boolean;
    fieldVisibility?: {
      displayName?: boolean;
      bio?: boolean;
      phoneNumbers?: boolean;
      secondaryEmail?: boolean;
      socialLinks?: boolean;
      birthYear?: boolean;
      country?: boolean;
    };
  };
}

export function ProfileDetailsBox({ profileData, privacy }: ProfileDetailsBoxProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Se i dati non sono ancora stati caricati, mostra un placeholder
  if (!profileData || !privacy) {
    return (
      <div className="w-full mt-4 px-6">
        <div className="animate-pulse">
          <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
        </div>
      </div>
    );
  }

  const renderPrivacyIcon = () => {
    switch (privacy.accountType) {
      case 'public':
        return <Globe size={18} className="text-green-500" />;
      case 'private':
        return <Lock size={18} className="text-red-500" />;
      default:
        return <EyeOff size={18} className="text-gray-500" />;
    }
  };

  return (
    <div className="w-full mt-4 px-6">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
      >
        <div className="flex items-center space-x-2">
          <span className="font-medium">
            {isExpanded ? 'Nascondi dettagli profilo' : 'Mostra dettagli profilo'}
          </span>
          {renderPrivacyIcon()}
        </div>
        <ChevronDown 
          className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          size={20}
        />
      </button>

      {isExpanded && (
        <div className="mt-2 theme-bg-primary rounded-lg p-6 space-y-6 animate-in slide-in-from-top-4 shadow-lg">
          {/* Nome utente */}
          {privacy.fieldVisibility?.displayName && profileData.displayName && (
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center space-x-2">
                <User size={18} />
                <span>{profileData.displayName}</span>
              </h3>
            </div>
          )}

          {/* Bio */}
          {privacy.showBio && privacy.fieldVisibility?.bio && profileData.bio && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Bio</h3>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">{profileData.bio}</p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Colonna sinistra - Informazioni personali */}
            <div className="space-y-6">
              {/* Contatti */}
              {((privacy.fieldVisibility?.phoneNumbers && profileData.phoneNumbers?.length > 0) || 
                (privacy.fieldVisibility?.secondaryEmail && profileData.secondaryEmail)) && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Contatti</h3>
                  <div className="space-y-3">
                    {privacy.fieldVisibility?.phoneNumbers && profileData.phoneNumbers?.map((phone, index) => (
                      phone && (
                        <div key={index} className="flex items-center space-x-3 text-gray-600 dark:text-gray-300">
                          <Phone size={18} />
                          <span>{phone}</span>
                        </div>
                      )
                    ))}
                    {privacy.fieldVisibility?.secondaryEmail && profileData.secondaryEmail && (
                      <div className="flex items-center space-x-3 text-gray-600 dark:text-gray-300">
                        <Mail size={18} />
                        <span>{profileData.secondaryEmail}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Informazioni geografiche e personali */}
              <div className="space-y-3">
                {privacy.fieldVisibility?.country && profileData.country && (
                  <div className="flex items-center space-x-3 text-gray-600 dark:text-gray-300">
                    <MapPin size={18} />
                    <span>{profileData.country}</span>
                  </div>
                )}
                {privacy.fieldVisibility?.birthYear && profileData.birthYear && (
                  <div className="flex items-center space-x-3 text-gray-600 dark:text-gray-300">
                    <Calendar size={18} />
                    <span>{profileData.birthYear}</span>
                  </div>
                )}
                {profileData.platform && (
                  <div className="flex items-center space-x-3 text-gray-600 dark:text-gray-300">
                    <Globe size={18} />
                    <span>{profileData.platform}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Colonna destra - Social Links */}
            {privacy.fieldVisibility?.socialLinks && profileData.socialLinks && Object.keys(profileData.socialLinks).length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Social Links</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {profileData.socialLinks.facebook && (
                    <a href={profileData.socialLinks.facebook} target="_blank" rel="noopener noreferrer" 
                       className="flex items-center space-x-3 text-blue-500 hover:text-blue-600 transition-colors">
                      <Facebook size={18} />
                      <span>Facebook</span>
                    </a>
                  )}
                  {profileData.socialLinks.instagram && (
                    <a href={profileData.socialLinks.instagram} target="_blank" rel="noopener noreferrer"
                       className="flex items-center space-x-3 text-pink-500 hover:text-pink-600 transition-colors">
                      <Instagram size={18} />
                      <span>Instagram</span>
                    </a>
                  )}
                  {profileData.socialLinks.twitter && (
                    <a href={profileData.socialLinks.twitter} target="_blank" rel="noopener noreferrer"
                       className="flex items-center space-x-3 text-sky-500 hover:text-sky-600 transition-colors">
                      <Twitter size={18} />
                      <span>Twitter</span>
                    </a>
                  )}
                  {profileData.socialLinks.linkedin && (
                    <a href={profileData.socialLinks.linkedin} target="_blank" rel="noopener noreferrer"
                       className="flex items-center space-x-3 text-blue-700 hover:text-blue-800 transition-colors">
                      <Linkedin size={18} />
                      <span>LinkedIn</span>
                    </a>
                  )}
                  {profileData.socialLinks.github && (
                    <a href={profileData.socialLinks.github} target="_blank" rel="noopener noreferrer"
                       className="flex items-center space-x-3 text-gray-800 dark:text-gray-200 hover:text-gray-600 dark:hover:text-gray-400 transition-colors">
                      <Github size={18} />
                      <span>GitHub</span>
                    </a>
                  )}
                  {profileData.socialLinks.telegram && (
                    <a href={profileData.socialLinks.telegram} target="_blank" rel="noopener noreferrer"
                       className="flex items-center space-x-3 text-blue-400 hover:text-blue-500 transition-colors">
                      <Send size={18} />
                      <span>Telegram</span>
                    </a>
                  )}
                  {profileData.socialLinks.tiktok && (
                    <a href={profileData.socialLinks.tiktok} target="_blank" rel="noopener noreferrer"
                       className="flex items-center space-x-3 text-gray-800 dark:text-gray-200 hover:text-gray-600 dark:hover:text-gray-400 transition-colors">
                      <Music size={18} />
                      <span>TikTok</span>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Impostazioni privacy */}
          <div className="mt-6 pt-6 border-t theme-border">
            <div className="flex flex-wrap gap-4">
              {privacy.showLastSeen && (
                <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-300">
                  <Clock size={16} />
                  <span>Ultimo accesso visibile</span>
                </div>
              )}
              {privacy.showStatus && (
                <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-300">
                  <Eye size={16} />
                  <span>Stato visibile</span>
                </div>
              )}
              {privacy.showPosts && (
                <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-300">
                  <Globe size={16} />
                  <span>Post pubblici</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
