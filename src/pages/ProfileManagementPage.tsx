import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { updateProfile } from 'firebase/auth';
import { updateDemographicStats } from '../utils/demographics';
import { Phone, Mail, Github, Linkedin, Twitter, Facebook, Instagram, Send, Music } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';

interface ProfileData {
  displayName: string;
  photoURL: string;
  bio: string;
  phoneNumbers: string[];
  secondaryEmail: string;
  socialLinks: {
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
  privacySettings: {
    profileVisibility: 'public' | 'private' | 'contacts';
    showLastSeen: boolean;
    showStatus: boolean;
    showBio: boolean;
    showPosts: boolean;
    showServices: boolean;
    fieldVisibility: {
      displayName: boolean;
      bio: boolean;
      phoneNumbers: boolean;
      secondaryEmail: boolean;
      socialLinks: boolean;
      birthYear: boolean;
      country: boolean;
    };
  };
}

export default function ProfileManagementPage() {
  const { currentUser, isAnonymous } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<ProfileData>({
    displayName: '',
    photoURL: '',
    bio: '',
    phoneNumbers: [''],
    secondaryEmail: '',
    socialLinks: {},
    birthYear: '',
    country: '',
    privacySettings: {
      profileVisibility: 'public',
      showLastSeen: true,
      showStatus: true,
      showBio: true,
      showPosts: true,
      showServices: true,
      fieldVisibility: {
        displayName: true,
        bio: true,
        phoneNumbers: true,
        secondaryEmail: true,
        socialLinks: true,
        birthYear: true,
        country: true
      }
    }
  });
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfileData = async () => {
      if (!currentUser) return;

      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setProfileData({
            displayName: userData.displayName || '',
            photoURL: userData.photoURL || '',
            bio: userData.bio || '',
            phoneNumbers: userData.phoneNumbers || [''],
            secondaryEmail: userData.secondaryEmail || '',
            socialLinks: userData.socialLinks || {},
            birthYear: userData.birthYear || '',
            country: userData.country || '',
            privacySettings: {
              profileVisibility: userData.privacySettings?.profileVisibility || 'public',
              showLastSeen: userData.privacySettings?.showLastSeen ?? true,
              showStatus: userData.privacySettings?.showStatus ?? true,
              showBio: userData.privacySettings?.showBio ?? true,
              showPosts: userData.privacySettings?.showPosts ?? true,
              showServices: userData.privacySettings?.showServices ?? true,
              fieldVisibility: {
                displayName: userData.privacySettings?.fieldVisibility?.displayName ?? true,
                bio: userData.privacySettings?.fieldVisibility?.bio ?? true,
                phoneNumbers: userData.privacySettings?.fieldVisibility?.phoneNumbers ?? true,
                secondaryEmail: userData.privacySettings?.fieldVisibility?.secondaryEmail ?? true,
                socialLinks: userData.privacySettings?.fieldVisibility?.socialLinks ?? true,
                birthYear: userData.privacySettings?.fieldVisibility?.birthYear ?? true,
                country: userData.privacySettings?.fieldVisibility?.country ?? true
              }
            }
          });
        }
      } catch (error) {
        console.error('Errore nel caricamento del profilo:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, [currentUser]);

  const handleSave = async () => {
    if (!currentUser) return;

    try {
      setLoading(true);
      const userRef = doc(db, 'users', currentUser.uid);
      
      await updateDoc(userRef, {
        ...profileData,
        updatedAt: serverTimestamp()
      });

      await updateProfile(currentUser, {
        displayName: profileData.displayName,
        photoURL: profileData.photoURL
      });

      await updateDemographicStats(currentUser.uid, {
        birthYear: profileData.birthYear,
        country: profileData.country,
        platform: detectPlatform(),
        location: profileData.location || null
      });

      navigate('/profile');

    } catch (error) {
      console.error('Errore durante il salvataggio:', error);
      alert('Errore durante il salvataggio delle modifiche');
    } finally {
      setLoading(false);
    }
  };

  const handlePrivacyToggle = (field: keyof ProfileData['privacySettings']['fieldVisibility']) => {
    setProfileData(prev => ({
      ...prev,
      privacySettings: {
        ...prev.privacySettings,
        fieldVisibility: {
          ...prev.privacySettings.fieldVisibility,
          [field]: !prev.privacySettings.fieldVisibility[field]
        }
      }
    }));
  };

  const PrivacyToggle = ({ field, label }: { field: keyof ProfileData['privacySettings']['fieldVisibility'], label: string }) => (
    <div className="flex items-center justify-between p-2 rounded theme-bg-secondary">
      <span className="theme-text">{label}</span>
      <button
        onClick={() => handlePrivacyToggle(field)}
        className={`px-4 py-2 rounded-lg transition-colors ${
          profileData.privacySettings.fieldVisibility[field]
            ? 'bg-green-500 hover:bg-green-600'
            : 'bg-gray-500 hover:bg-gray-600'
        } text-white`}
      >
        {profileData.privacySettings.fieldVisibility[field] ? 'Pubblico' : 'Privato'}
      </button>
    </div>
  );

  if (isAnonymous) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return <div>Caricamento...</div>;
  }

  return (
    <div className="page-layout">
      <div className="fixed-header">
        <div className="bg-opacity-80 backdrop-blur-sm theme-bg-base p-4 border-b theme-border">
          <div className="container mx-auto max-w-4xl flex justify-between items-center">
            <h1 className="text-xl font-bold theme-text">Modifica Profilo</h1>
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-4 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Salvataggio...' : 'Salva modifiche'}
            </button>
          </div>
        </div>
      </div>

      <div className="scroll-view mt-[64px]">
        <div className="container mx-auto max-w-4xl p-4 pb-[120px]">
          <div className="max-w-2xl mx-auto space-y-8">
            <div className="space-y-6 bg-opacity-20 theme-bg-secondary p-6 rounded-lg">
              <div className="space-y-4">
                <h2 className="text-xl font-semibold theme-text">Informazioni Base</h2>
                
                <div className="space-y-2">
                  <label className="block text-sm font-medium theme-text">Nome utente</label>
                  <input
                    type="text"
                    value={profileData.displayName}
                    onChange={(e) => setProfileData(prev => ({ ...prev, displayName: e.target.value }))}
                    className="w-full p-3 rounded-lg theme-bg-secondary theme-text border theme-border"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium theme-text">Anno di nascita</label>
                  <select
                    value={profileData.birthYear}
                    onChange={(e) => setProfileData(prev => ({ ...prev, birthYear: e.target.value }))}
                    className="w-full p-3 rounded-lg theme-bg-secondary theme-text border theme-border"
                  >
                    <option value="">Seleziona anno</option>
                    {Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i).map(year => (
                      <option key={year} value={year.toString()}>{year}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium theme-text">Paese</label>
                  <select
                    value={profileData.country}
                    onChange={(e) => setProfileData(prev => ({ ...prev, country: e.target.value }))}
                    className="w-full p-3 rounded-lg theme-bg-secondary theme-text border theme-border"
                  >
                    <option value="">Seleziona paese</option>
                    <option value="IT">Italia</option>
                    <option value="US">Stati Uniti</option>
                    <option value="GB">Regno Unito</option>
                    <option value="DE">Germania</option>
                    <option value="FR">Francia</option>
                    <option value="ES">Spagna</option>
                    <option value="PT">Portogallo</option>
                    <option value="NL">Paesi Bassi</option>
                    <option value="BE">Belgio</option>
                    <option value="CH">Svizzera</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium theme-text">Biografia</label>
                  <textarea
                    value={profileData.bio}
                    onChange={(e) => setProfileData(prev => ({ ...prev, bio: e.target.value }))}
                    className="w-full p-3 rounded-lg theme-bg-secondary theme-text border theme-border min-h-[100px]"
                  />
                </div>
              </div>

              {/* Contatti */}
              <div className="space-y-4">
                <h2 className="text-xl font-semibold theme-text">Contatti</h2>
                {profileData.phoneNumbers.map((phone, index) => (
                  <div key={index} className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium theme-text">
                      <Phone className="w-4 h-4" />
                      Telefono {index + 1}
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => {
                        const newPhones = [...profileData.phoneNumbers];
                        newPhones[index] = e.target.value;
                        setProfileData(prev => ({ ...prev, phoneNumbers: newPhones }));
                      }}
                      className="w-full p-3 rounded-lg theme-bg-secondary theme-text border theme-border"
                    />
                  </div>
                ))}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium theme-text">
                    <Mail className="w-4 h-4" />
                    Email secondaria
                  </label>
                  <input
                    type="email"
                    value={profileData.secondaryEmail}
                    onChange={(e) => setProfileData(prev => ({ ...prev, secondaryEmail: e.target.value }))}
                    className="w-full p-3 rounded-lg theme-bg-secondary theme-text border theme-border"
                  />
                </div>
              </div>

              {/* Social Links */}
              <div className="space-y-4">
                <h2 className="text-xl font-semibold theme-text">Social</h2>
                {Object.entries({
                  facebook: { icon: Facebook, label: 'Facebook' },
                  instagram: { icon: Instagram, label: 'Instagram' },
                  telegram: { icon: Send, label: 'Telegram' },
                  tiktok: { icon: Music, label: 'TikTok' },
                  github: { icon: Github, label: 'GitHub' },
                  linkedin: { icon: Linkedin, label: 'LinkedIn' },
                  twitter: { icon: Twitter, label: 'Twitter' }
                }).map(([key, { icon: Icon, label }]) => (
                  <div key={key} className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium theme-text">
                      <Icon className="w-4 h-4" />
                      {label}
                    </label>
                    <input
                      type="url"
                      value={profileData.socialLinks[key as keyof typeof profileData.socialLinks] || ''}
                      onChange={(e) => setProfileData(prev => ({
                        ...prev,
                        socialLinks: {
                          ...prev.socialLinks,
                          [key]: e.target.value
                        }
                      }))}
                      className="w-full p-3 rounded-lg theme-bg-secondary theme-text border theme-border"
                      placeholder={`https://${key}.com/username`}
                    />
                  </div>
                ))}
              </div>

              {/* Impostazioni Privacy */}
              <div className="mt-8">
                <h2 className="text-xl font-semibold mb-4 theme-text">Impostazioni Privacy</h2>
                
                <div className="space-y-4">
                  <div className="p-4 rounded-lg theme-bg-primary">
                    <h3 className="font-medium mb-4 theme-text">Visibilità dei campi</h3>
                    <div className="space-y-2">
                      <PrivacyToggle field="displayName" label="Nome visualizzato" />
                      <PrivacyToggle field="bio" label="Biografia" />
                      <PrivacyToggle field="phoneNumbers" label="Numeri di telefono" />
                      <PrivacyToggle field="secondaryEmail" label="Email secondaria" />
                      <PrivacyToggle field="socialLinks" label="Link social" />
                      <PrivacyToggle field="birthYear" label="Anno di nascita" />
                      <PrivacyToggle field="country" label="Paese" />
                    </div>
                  </div>

                  <div className="p-4 rounded-lg theme-bg-primary">
                    <h3 className="font-medium mb-4 theme-text">Visibilità profilo</h3>
                    <select
                      value={profileData.privacySettings.profileVisibility}
                      onChange={(e) => setProfileData(prev => ({
                        ...prev,
                        privacySettings: {
                          ...prev.privacySettings,
                          profileVisibility: e.target.value as 'public' | 'private' | 'contacts'
                        }
                      }))}
                      className="w-full p-2 rounded theme-bg-secondary theme-text"
                    >
                      <option value="public">Pubblico</option>
                      <option value="contacts">Solo contatti</option>
                      <option value="private">Privato</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function detectPlatform() {
  // Implementazione della funzione per rilevare la piattaforma
  // Esempio:
  if (navigator.userAgent.includes('Windows')) {
    return 'Windows';
  } else if (navigator.userAgent.includes('Macintosh')) {
    return 'MacOS';
  } else if (navigator.userAgent.includes('Linux')) {
    return 'Linux';
  } else {
    return 'Unknown';
  }
}