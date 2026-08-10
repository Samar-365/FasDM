import React, { useState, useEffect } from 'react';
import { UserProfile, AppView } from './types';
import { dbEngine } from './services/db';
import { SplashScreen } from './components/SplashScreen';
import { ProfileSetup } from './components/ProfileSetup';
import { Dashboard } from './components/Dashboard';
import { Navbar } from './components/Navbar';
import { Radio } from 'lucide-react';

export const App: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [currentView, setCurrentView] = useState<AppView>('splash');
  const [isLoading, setIsLoading] = useState(true);

  // Load existing profile from IndexedDB on application start
  useEffect(() => {
    async function loadSavedProfile() {
      try {
        const savedProfile = await dbEngine.getProfile();
        if (savedProfile) {
          setProfile(savedProfile);
          setCurrentView('dashboard');
        } else {
          setCurrentView('splash');
        }
      } catch (err) {
        console.error('Error opening IndexedDB profile:', err);
        setCurrentView('splash');
      } finally {
        setIsLoading(false);
      }
    }

    loadSavedProfile();
  }, []);

  const handleStartSetup = () => {
    setCurrentView('setup');
  };

  const handleProfileCreated = (newProfile: UserProfile) => {
    setProfile(newProfile);
    setCurrentView('dashboard');
  };

  const handleEditProfile = () => {
    setCurrentView('setup');
  };

  const handleResetProfile = async () => {
    if (window.confirm('Are you sure you want to reset your local profile identity and keys?')) {
      await dbEngine.clearAllData();
      setProfile(null);
      setCurrentView('splash');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-mesh-grid flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400 animate-bounce">
            <Radio size={32} />
          </div>
          <p className="text-slate-400 text-xs font-mono tracking-wider animate-pulse">
            INITIALIZING INDEXEDDB & WEB CRYPTO ENGINE...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar
        profile={profile}
        onEditProfile={handleEditProfile}
        onResetProfile={handleResetProfile}
      />

      {/* Main View Router */}
      <main className="flex-1">
        {currentView === 'splash' && (
          <SplashScreen onStartSetup={handleStartSetup} />
        )}

        {currentView === 'setup' && (
          <ProfileSetup
            onProfileCreated={handleProfileCreated}
            onBackToSplash={profile ? () => setCurrentView('dashboard') : () => setCurrentView('splash')}
          />
        )}

        {currentView === 'dashboard' && profile && (
          <Dashboard
            profile={profile}
            onEditProfile={handleEditProfile}
          />
        )}
      </main>
    </div>
  );
};

export default App;
