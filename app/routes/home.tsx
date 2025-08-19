import React, { useState } from 'react';
import DriverList from '../components/DriverManagement/DriverList';
import RaceManagement from '../components/RaceManagement/RaceManagement';
import MeetingManagement from '../components/MeetingManagement/MeetingManagement';
import EngagementManagement from '../components/EngagementManagement/EngagementManagement';
import Timing from '../components/Timing/Timing';
import MeetingStandingsManagement from '../components/MeetingStandingsManagement/MeetingStandingsManagement';
import ChampionshipStandings from '../components/ChampionshipStandings/ChampionshipStandings';

export default function Index() {
  const [activeTab, setActiveTab] = useState('drivers');

  return (
    <div style={{ padding: '2rem' }}>
      <h1 style={{ color: '#1e3c72', marginBottom: '2rem' }}>🏁 Rallycross Timer</h1>
      
      {/* Navigation par onglets */}
      <nav style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveTab('drivers')}
          style={{
            padding: '0.75rem 1.5rem',
            background: activeTab === 'drivers' ? '#667eea' : '#f8f9fa',
            color: activeTab === 'drivers' ? 'white' : '#333',
            border: '1px solid #ddd',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          👥 Pilotes
        </button>
        <button
          onClick={() => setActiveTab('meetings')}
          style={{
            padding: '0.75rem 1.5rem',
            background: activeTab === 'meetings' ? '#667eea' : '#f8f9fa',
            color: activeTab === 'meetings' ? 'white' : '#333',
            border: '1px solid #ddd',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          📅 Meetings
        </button>
        <button
          onClick={() => setActiveTab('engagements')}
          style={{
            padding: '0.75rem 1.5rem',
            background: activeTab === 'engagements' ? '#667eea' : '#f8f9fa',
            color: activeTab === 'engagements' ? 'white' : '#333',
            border: '1px solid #ddd',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          📝 Engagements
        </button>
        <button
          onClick={() => setActiveTab('races')}
          style={{
            padding: '0.75rem 1.5rem',
            background: activeTab === 'races' ? '#667eea' : '#f8f9fa',
            color: activeTab === 'races' ? 'white' : '#333',
            border: '1px solid #ddd',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          🏁 Sessions
        </button>
        <button
          onClick={() => setActiveTab('timing')}
          style={{
            padding: '0.75rem 1.5rem',
            background: activeTab === 'timing' ? '#667eea' : '#f8f9fa',
            color: activeTab === 'timing' ? 'white' : '#333',
            border: '1px solid #ddd',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          ⏱️ Chronométrage
        </button>
        <button
          onClick={() => setActiveTab('standings')}
          style={{
            padding: '0.75rem 1.5rem',
            background: activeTab === 'standings' ? '#667eea' : '#f8f9fa',
            color: activeTab === 'standings' ? 'white' : '#333',
            border: '1px solid #ddd',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          📊 Classements
        </button>
        <button
          onClick={() => setActiveTab('championship')}
          style={{
            padding: '0.75rem 1.5rem',
            background: activeTab === 'championship' ? '#667eea' : '#f8f9fa',
            color: activeTab === 'championship' ? 'white' : '#333',
            border: '1px solid #ddd',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          🏆 Championnat
        </button>
      </nav>

      {/* Contenu selon l'onglet */}
      {activeTab === 'drivers' && <DriverList />}
      {activeTab === 'meetings' && <MeetingManagement />}
      {activeTab === 'engagements' && <EngagementManagement />}
      {activeTab === 'races' && <RaceManagement />}
      {activeTab === 'timing' && <Timing />}
      {activeTab === 'standings' && <MeetingStandingsManagement />}
      {activeTab === 'championship' && <ChampionshipStandings />}
    </div>
  );
}