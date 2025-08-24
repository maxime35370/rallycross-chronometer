import React, { useState, useEffect } from 'react';
import { db } from '../../../config/firebase';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';

const CATEGORIES = [
  'Supercar',
  'Super1600', 
  'Juniors',
  'Féminines',
  'D3',
  'D4'
];

export default function MeetingManagement() {
  const [meetings, setMeetings] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  
  const [newMeeting, setNewMeeting] = useState({
    name: '',
    location: '',
    date: '',
    year: new Date().getFullYear(),
    qualifyingRounds: 4, // Nombre de manches qualifs (flexible)
    categories: [] as string[] // Catégories participantes
  });

  // Récupérer les meetings
  useEffect(() => {
    const q = query(collection(db, 'meetings'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const meetingsData: any[] = [];
      querySnapshot.forEach((doc) => {
        const meetingData = { id: doc.id, ...doc.data() } as any;
        if (meetingData.year === selectedYear) {
          meetingsData.push(meetingData);
        }
      });
      setMeetings(meetingsData);
    });

    return () => unsubscribe();
  }, [selectedYear]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newMeeting.categories.length === 0) {
      alert('Veuillez sélectionner au moins une catégorie !');
      return;
    }

    try {
      // Créer le meeting
      const meetingDoc = await addDoc(collection(db, 'meetings'), {
        ...newMeeting,
        isActive: true,
        createdAt: new Date()
      });

      // Créer automatiquement toutes les sessions pour chaque catégorie
      await createSessionsForMeeting(meetingDoc.id, newMeeting);

      alert(`Meeting "${newMeeting.name}" créé avec succès !\n${newMeeting.categories.length} catégories × ${6 + newMeeting.qualifyingRounds} sessions = ${newMeeting.categories.length * (6 + newMeeting.qualifyingRounds)} sessions créées.`);

      // Reset du formulaire
      setNewMeeting({
        name: '',
        location: '',
        date: '',
        year: selectedYear,
        qualifyingRounds: 4,
        categories: []
      });
      setShowForm(false);
    } catch (error) {
      console.error('Erreur:', error);
      alert('Erreur lors de la création du meeting');
    }
  };

  const createSessionsForMeeting = async (meetingId: string, meetingData: any) => {
    const sessions = [];

    for (const category of meetingData.categories) {
      // 1. Essais chronométrés
      sessions.push({
        meetingId,
        name: `Essais Chronos - ${category}`,
        type: 'timeTrials',
        category,
        year: meetingData.year,
        laps: 1, // À ajuster selon vos besoins
        drivers: [],
        isCompleted: false,
        order: 1
      });

      // 2. Manches qualificatives
      for (let i = 1; i <= meetingData.qualifyingRounds; i++) {
        sessions.push({
          meetingId,
          name: `Manche Qualificative ${i} - ${category}`,
          type: 'qualifying',
          category,
          year: meetingData.year,
          laps: 4,
          drivers: [],
          isCompleted: false,
          order: 1 + i
        });
      }

      // 3. Demi-finales (2)
      for (let i = 1; i <= 2; i++) {
        sessions.push({
          meetingId,
          name: `1/2 Finale ${i} - ${category}`,
          type: 'semifinal',
          category,
          year: meetingData.year,
          laps: 6,
          drivers: [],
          isCompleted: false,
          order: 1 + meetingData.qualifyingRounds + i
        });
      }

      // 4. Finale
      sessions.push({
        meetingId,
        name: `Finale - ${category}`,
        type: 'final',
        category,
        year: meetingData.year,
        laps: 7,
        drivers: [],
        isCompleted: false,
        order: 1 + meetingData.qualifyingRounds + 3
      });
    }

    // Sauvegarder toutes les sessions
    for (const session of sessions) {
      await addDoc(collection(db, 'races'), session);
    }
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    if (window.confirm('⚠️ ATTENTION : Cela supprimera le meeting ET toutes ses sessions (courses, temps, etc.). Continuer ?')) {
      try {
        // TODO: Supprimer aussi toutes les sessions liées
        await deleteDoc(doc(db, 'meetings', meetingId));
        alert('Meeting supprimé !');
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        alert('Erreur lors de la suppression du meeting');
      }
    }
  };

  const toggleCategory = (category: string) => {
    setNewMeeting(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category]
    }));
  };

  // Helper pour les icônes de catégories
  const getCategoryIcon = (category: string): string => {
    const icons: { [key: string]: string } = {
      'Supercar': '🏎️',
      'Super1600': '🚗',
      'Juniors': '🏃‍♂️',
      'Féminines': '🏃‍♀️',
      'D3': '🚙',
      'D4': '🚐'
    };
    return icons[category] || '🏁';
  };

  // Helper pour les classes CSS des catégories
  const getCategoryClass = (category: string): string => {
    const classes: { [key: string]: string } = {
      'Supercar': 'badge-supercar',
      'Super1600': 'badge-super1600',
      'Juniors': 'badge-juniors',
      'Féminines': 'badge-feminines',
      'D3': 'badge-d3',
      'D4': 'badge-d4'
    };
    return classes[category] || 'badge-supercar';
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2 style={{ color: '#1e3c72', marginBottom: '1.5rem' }}>
        📅 Gestion des Meetings (Week-ends de course)
      </h2>

      {/* Filtre par année */}
      <div style={{ 
        background: '#f8f9fa', 
        padding: '1rem', 
        borderRadius: '8px', 
        marginBottom: '1.5rem',
        border: '1px solid #e9ecef'
      }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>
          📅 Saison :
        </label>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          style={{ 
            padding: '0.5rem', 
            borderRadius: '4px', 
            border: '1px solid #ccc',
            fontSize: '1rem',
            color: '#333',
            backgroundColor: 'white',
            minWidth: '150px'
          }}
        >
          <option value={2024}>2024</option>
          <option value={2025}>2025</option>
          <option value={2026}>2026</option>
        </select>
      </div>

      {/* Bouton création */}
      <button
        onClick={() => setShowForm(!showForm)}
        className={showForm ? 'cancel-btn' : 'modern-btn'}
        style={{ marginBottom: '2rem' }}
      >
        <span>{showForm ? '❌' : '🏁'}</span>
        {showForm ? 'Annuler' : 'Créer un meeting'}
      </button>

      {/* Formulaire de création */}
      {showForm && (
        <div className="modern-form">
          <h3 className="form-title">
            <span>🏁</span>
            Nouveau Meeting
          </h3>
          
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label required">
                  <span>🏆</span>
                  Nom du meeting
                </label>
                <input
                  type="text"
                  required
                  value={newMeeting.name}
                  onChange={(e) => setNewMeeting({...newMeeting, name: e.target.value})}
                  placeholder="ex: Meeting 1 - Lessay"
                  className="modern-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label required">
                  <span>📍</span>
                  Lieu
                </label>
                <input
                  type="text"
                  required
                  value={newMeeting.location}
                  onChange={(e) => setNewMeeting({...newMeeting, location: e.target.value})}
                  placeholder="ex: Circuit de Lessay"
                  className="modern-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label required">
                  <span>📅</span>
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={newMeeting.date}
                  onChange={(e) => setNewMeeting({...newMeeting, date: e.target.value})}
                  className="modern-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label required">
                  <span>🏃</span>
                  Nombre de manches qualifs
                </label>
                <select
                  required
                  value={newMeeting.qualifyingRounds}
                  onChange={(e) => setNewMeeting({...newMeeting, qualifyingRounds: parseInt(e.target.value)})}
                  className="modern-select"
                >
                  <option value={1}>1 manche (météo)</option>
                  <option value={2}>2 manches</option>
                  <option value={3}>3 manches</option>
                  <option value={4}>4 manches (standard)</option>
                </select>
              </div>
            </div>
            {/* Sélection des catégories avec nouveau style */}
            <div className="form-group" style={{ marginBottom: '2rem' }}>
              <label className="form-label">
                <span>🏆</span>
                Catégories participantes ({newMeeting.categories.length}/6)
              </label>
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(3, 1fr)', 
                gap: '1rem',
                marginTop: '1rem'
              }}>
                {CATEGORIES.map(category => (
                  <div
                    key={category}
                    onClick={() => toggleCategory(category)}
                    style={{
                      padding: '1rem',
                      border: '2px solid',
                      borderColor: newMeeting.categories.includes(category) 
                        ? 'rgba(255, 107, 53, 0.8)' 
                        : 'rgba(30, 60, 114, 0.3)',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      background: newMeeting.categories.includes(category)
                        ? 'linear-gradient(135deg, rgba(255, 107, 53, 0.1) 0%, rgba(247, 147, 30, 0.1) 100%)'
                        : 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.7) 100%)',
                      backdropFilter: 'blur(8px)',
                      transition: 'all 0.3s ease',
                      textAlign: 'center',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem'
                    }}
                    onMouseEnter={(e) => {
                      if (!newMeeting.categories.includes(category)) {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 8px 25px rgba(30, 60, 114, 0.2)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!newMeeting.categories.includes(category)) {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = 'none';
                      }
                    }}
                  >
                    <span>{getCategoryIcon(category)}</span>
                    {category}
                    {newMeeting.categories.includes(category) && (
                      <span style={{ color: '#FF6B35', marginLeft: '0.5rem' }}>✓</span>
                    )}
                  </div>
                ))}
              </div>
              
              <div style={{ 
                marginTop: '1rem', 
                fontSize: '0.9rem', 
                color: '#666',
                textAlign: 'center',
                background: 'rgba(102, 126, 234, 0.1)',
                padding: '0.75rem',
                borderRadius: '8px'
              }}>
                💡 Sessions créées par catégorie : Essais chronos + {newMeeting.qualifyingRounds} qualifs + 2 demi-finales + 1 finale = {newMeeting.qualifyingRounds + 4} sessions
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="cancel-btn"
              >
                <span>❌</span>
                Annuler
              </button>
              
              <button 
                type="submit" 
                disabled={newMeeting.categories.length === 0}
                className="submit-btn"
                style={{
                  opacity: newMeeting.categories.length > 0 ? 1 : 0.5,
                  cursor: newMeeting.categories.length > 0 ? 'pointer' : 'not-allowed'
                }}
              >
                <span>🏁</span>
                Créer le meeting
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Liste des meetings */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {meetings.length === 0 ? (
          <div style={{ 
            background: 'rgba(255,255,255,0.9)',
            borderRadius: '16px',
            padding: '3rem',
            textAlign: 'center',
            color: '#666',
            backdropFilter: 'blur(12px)',
            border: '2px dashed #ccc'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏁</div>
            <h3 style={{ color: '#333', marginBottom: '0.5rem' }}>Aucun meeting créé pour {selectedYear}</h3>
            <p>Cliquez sur "Créer un meeting" pour commencer</p>
          </div>
        ) : (
          meetings.map((meeting) => {
            const totalSessions = meeting.categories.length * (meeting.qualifyingRounds + 4);
            const currentDate = new Date();
            const meetingDate = new Date(meeting.date);
            const status = meetingDate > currentDate ? 'upcoming' : 'completed';
            
            return (
              <div key={meeting.id} className="meeting-card">
                <div className="meeting-header">
                  <div>
                    <div className="meeting-title">
                      🏁 {meeting.name}
                    </div>
                    <div className="meeting-date">
                      <span>📅</span>
                      {new Date(meeting.date).toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>
                    <div className="meeting-location">
                      <span>📍</span> {meeting.location}
                    </div>
                  </div>
                  
                  <div className={`meeting-status status-${status}`}>
                    {status === 'upcoming' ? '🔮 À venir' : '✅ Terminé'}
                  </div>
                </div>

                <div className="meeting-categories">
                  {meeting.categories.map((cat: string) => (
                    <span key={cat} className={`category-pill ${getCategoryClass(cat)}`}>
                      {getCategoryIcon(cat)} {cat}
                    </span>
                  ))}
                </div>

                <div className="meeting-stats">
                  <div className="stat-item">
                    <span className="stat-number">{meeting.categories.length}</span>
                    <span className="stat-label">Catégories</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-number">{meeting.qualifyingRounds}</span>
                    <span className="stat-label">Qualifs</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-number">{meeting.categories.length * 2}</span>
                    <span className="stat-label">Demi-finales</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-number">{totalSessions}</span>
                    <span className="stat-label">Total Sessions</span>
                  </div>
                </div>

                <div className="meeting-actions">
                  <button
                    onClick={() => handleDeleteMeeting(meeting.id)}
                    className="delete-btn"
                    title="Supprimer le meeting"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <p style={{ marginTop: '1rem', color: '#666' }}>
        📊 Saison {selectedYear} : {meetings.length} meeting(s)
      </p>
    </div>
  );
}