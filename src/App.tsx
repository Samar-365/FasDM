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

  // Load profile with per-tab sessionStorage isolation & URL param support
  useEffect(() => {
    async function loadTabProfile() {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const userParam = urlParams.get('user') || urlParams.get('node');

        // Check tab-isolated sessionStorage first
        const tabSession = sessionStorage.getItem('fasdm_tab_profile');
        if (tabSession) {
          const parsed = JSON.parse(tabSession);
          setProfile(parsed);
          setCurrentView('dashboard');
          setIsLoading(false);
          return;
        }

        // If URL has ?user=Alex or ?node=2
        if (userParam) {
          const handle = userParam.length > 2 ? userParam : `Node_${userParam}`;
          const autoProfile: UserProfile = {
            userId: `usr_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
            username: handle,
            avatar: '#0284c7',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          sessionStorage.setItem('fasdm_tab_profile', JSON.stringify(autoProfile));
          await dbEngine.saveProfile(autoProfile);
          setProfile(autoProfile);
          setCurrentView('dashboard');
          setIsLoading(false);
          return;
        }

        // Otherwise check IndexedDB
        const savedProfile = await dbEngine.getProfile();
        if (savedProfile) {
          sessionStorage.setItem('fasdm_tab_profile', JSON.stringify(savedProfile));
          setProfile(savedProfile);
          setCurrentView('dashboard');
        } else {
          setCurrentView('splash');
        }
      } catch (err) {
        console.error('Error loading tab profile:', err);
        setCurrentView('splash');
      } finally {
        setIsLoading(false);
      }
    }

    loadTabProfile();
  }, []);

  const handleStartSetup = () => {
    setCurrentView('setup');
  };

  const handleProfileCreated = (newProfile: UserProfile) => {
    sessionStorage.setItem('fasdm_tab_profile', JSON.stringify(newProfile));
    setProfile(newProfile);
    setCurrentView('dashboard');
  };

  const handleEditProfile = () => {
    setCurrentView('setup');
  };

  const handleNewTabNode = () => {
    sessionStorage.removeItem('fasdm_tab_profile');
    setProfile(null);
    setCurrentView('setup');
  };

  const handleResetProfile = async () => {
    if (window.confirm('Are you sure you want to reset local data for this tab?')) {
      sessionStorage.removeItem('fasdm_tab_profile');
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
            INITIALIZING INDEXEDDB & P2P MESH ENGINE...
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
        onNewTabNode={handleNewTabNode}
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
