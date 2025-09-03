import React, { useState } from 'react';
import DriverList from '../components/DriverManagement/DriverList';
import RaceManagement from '../components/RaceManagement/RaceManagement';
import MeetingManagement from '../components/MeetingManagement/MeetingManagement';
import EngagementManagement from '../components/EngagementManagement/EngagementManagement';
import Timing from '../components/Timing/Timing';
import MeetingStandingsManagement from '../components/MeetingStandingsManagement/MeetingStandingsManagement';
import ChampionshipStandings from '../components/ChampionshipStandings/ChampionshipStandings';
// IMPORT CORRIGÉ - Chemin relatif depuis routes vers components
import Breadcrumb from '../components/Navigation/Breadcrumb';

export default function Index() {
  const [activeTab, setActiveTab] = useState('drivers');

  // Configuration des onglets
  const tabs = [
    { key: 'drivers', label: '👥 Pilotes', icon: '🏎️' },
    { key: 'meetings', label: '📅 Meetings', icon: '🏁' },
    { key: 'engagements', label: '📝 Engagements', icon: '✍️' },
    { key: 'races', label: '🏁 Sessions', icon: '🏃‍♂️' },
    { key: 'timing', label: '⏱️ Chronométrage', icon: '⚡' },
    { key: 'standings', label: '📊 Classements', icon: '🏆' },
    { key: 'championship', label: '🏆 Championnat', icon: '👑' }
  ];

  return (
    <div style={{ 
      minHeight: '100vh',
      background: 'transparent',
      padding: '2rem',
      fontFamily: 'Inter, sans-serif'
    }}>
      {/* HEADER RALLYCROSS */}
      <div className="card" style={{
        marginBottom: '2rem',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.85) 100%)',
        border: '2px solid rgba(255, 107, 53, 0.3)',
        textAlign: 'center',
        padding: '2rem'
      }}>
        <h1 className="racing-title" style={{ 
          fontSize: '3rem',
          marginBottom: '0.5rem',
          textShadow: '2px 2px 8px rgba(255, 107, 53, 0.3)'
        }}>
          🏁 RALLYCROSS TIMER
        </h1>
        <p style={{ 
          color: '#666',
          fontSize: '1.1rem',
          fontWeight: '500',
          letterSpacing: '1px'
        }}>
          ⚡ Chronométrage Professionnel • 🏆 Gestion des Courses • 📊 Classements Temps Réel
        </p>
      </div>
      
      {/* BREADCRUMB NAVIGATION */}
      <Breadcrumb activeTab={activeTab} onNavigate={setActiveTab} />
      
      {/* NAVIGATION MODERNE */}
      <nav className="card" style={{
        marginBottom: '2rem',
        padding: '1.5rem',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.8) 100%)'
      }}>
        <div style={{
          marginBottom: '1rem',
          textAlign: 'center',
          color: '#666',
          fontSize: '0.9rem',
          fontWeight: '500'
        }}>
          🧭 Navigation Rapide
        </div>
        
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem'
        }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={activeTab === tab.key ? 'btn-primary' : 'btn-secondary'}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                justifyContent: 'center',
                fontSize: '0.95rem',
                fontWeight: '600',
                padding: '1rem',
                borderRadius: '12px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                background: activeTab === tab.key 
                  ? 'linear-gradient(135deg, #FF6B35 0%, #F7931E 100%)'
                  : 'linear-gradient(135deg, #1E3C72 0%, #2A5298 100%)',
                color: 'white',
                boxShadow: activeTab === tab.key
                  ? '0 6px 20px rgba(255, 107, 53, 0.4)'
                  : '0 4px 15px rgba(30, 60, 114, 0.3)',
                transform: activeTab === tab.key ? 'translateY(-2px)' : 'translateY(0)'
              }}
              onMouseEnter={(e) => {
                if (activeTab !== tab.key) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 25px rgba(30, 60, 114, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab.key) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(30, 60, 114, 0.3)';
                }
              }}
            >
              <span style={{ fontSize: '1.2rem' }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* CONTENU AVEC CARD MODERNE */}
      <div className="card" style={{
        padding: '2rem',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.9) 100%)',
        minHeight: '400px'
      }}>
        {/* Contenu selon l'onglet */}
        {activeTab === 'drivers' && <DriverList />}
        {activeTab === 'meetings' && <MeetingManagement />}
        {activeTab === 'engagements' && <EngagementManagement />}
        {activeTab === 'races' && <RaceManagement />}
        {activeTab === 'timing' && <Timing />}
        {activeTab === 'standings' && <MeetingStandingsManagement />}
        {activeTab === 'championship' && <ChampionshipStandings />}
      </div>
    </div>
  );
}