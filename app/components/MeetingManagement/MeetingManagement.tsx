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
        style={{
          padding: '0.75rem 1.5rem',
          background: '#667eea',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          marginBottom: '2rem',
          cursor: 'pointer'
        }}
      >
        {showForm ? '❌ Annuler' : '➕ Créer un meeting'}
      </button>

      {/* Formulaire de création */}
      {showForm && (
        <div style={{ 
          background: '#f8f9fa', 
          padding: '1.5rem', 
          borderRadius: '8px', 
          marginBottom: '2rem',
          color: '#333' 
        }}>
          <h3>➕ Nouveau meeting</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#333' }}>Nom du meeting *</label>
                <input
                  type="text"
                  required
                  value={newMeeting.name}
                  onChange={(e) => setNewMeeting({...newMeeting, name: e.target.value})}
                  placeholder="ex: Meeting 1 - Lessay"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#333' }}>Lieu *</label>
                <input
                  type="text"
                  required
                  value={newMeeting.location}
                  onChange={(e) => setNewMeeting({...newMeeting, location: e.target.value})}
                  placeholder="ex: Circuit de Lessay"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#333' }}>Date *</label>
                <input
                  type="date"
                  required
                  value={newMeeting.date}
                  onChange={(e) => setNewMeeting({...newMeeting, date: e.target.value})}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#333' }}>Nombre de manches qualifs *</label>
                <select
                  required
                  value={newMeeting.qualifyingRounds}
                  onChange={(e) => setNewMeeting({...newMeeting, qualifyingRounds: parseInt(e.target.value)})}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                >
                  <option value={1}>1 manche (météo)</option>
                  <option value={2}>2 manches</option>
                  <option value={3}>3 manches</option>
                  <option value={4}>4 manches (standard)</option>
                </select>
              </div>
            </div>

            {/* Sélection des catégories */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#333' }}>
                Catégories participantes ({newMeeting.categories.length}/6) :
              </label>
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(3, 1fr)', 
                gap: '0.5rem',
                border: '1px solid #ccc',
                padding: '0.5rem',
                borderRadius: '4px',
                backgroundColor: 'white'
              }}>
                {CATEGORIES.map(category => (
                  <div
                    key={category}
                    onClick={() => toggleCategory(category)}
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      backgroundColor: newMeeting.categories.includes(category) ? '#667eea' : 'white',
                      color: newMeeting.categories.includes(category) ? 'white' : '#333',
                      transition: 'all 0.2s',
                      textAlign: 'center'
                    }}
                  >
                    {category}
                  </div>
                ))}
              </div>
              
              <small style={{ color: '#666', marginTop: '0.5rem', display: 'block' }}>
                Sessions créées par catégorie : Essais chronos + {newMeeting.qualifyingRounds} qualifs + 2 demi-finales + 1 finale = {newMeeting.qualifyingRounds + 4} sessions
              </small>
            </div>

            <button 
              type="submit" 
              disabled={newMeeting.categories.length === 0}
              style={{
                padding: '0.75rem 1.5rem',
                background: newMeeting.categories.length > 0 ? '#28a745' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: newMeeting.categories.length > 0 ? 'pointer' : 'not-allowed'
              }}
            >
              ➕ Créer le meeting
            </button>
          </form>
        </div>
      )}

      {/* Liste des meetings */}
      <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#667eea', color: 'white' }}>
              <th style={{ padding: '1rem', textAlign: 'left' }}>Meeting</th>
              <th style={{ padding: '1rem', textAlign: 'left' }}>Date</th>
              <th style={{ padding: '1rem', textAlign: 'left' }}>Lieu</th>
              <th style={{ padding: '1rem', textAlign: 'left' }}>Catégories</th>
              <th style={{ padding: '1rem', textAlign: 'left' }}>Sessions</th>
              <th style={{ padding: '1rem', textAlign: 'left' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {meetings.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
                  📅 Aucun meeting créé pour {selectedYear}
                </td>
              </tr>
            ) : (
              meetings.map((meeting) => (
                <tr key={meeting.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '1rem', fontWeight: '500', color: '#333' }}>{meeting.name}</td>
                  <td style={{ padding: '1rem', color: '#333' }}>
                    {new Date(meeting.date).toLocaleDateString('fr-FR')}
                  </td>
                  <td style={{ padding: '1rem', color: '#333' }}>{meeting.location}</td>
                  <td style={{ padding: '1rem', color: '#333' }}>
                    <div style={{ fontSize: '0.85rem' }}>
                      {meeting.categories.map((cat: string) => (
                        <span key={cat} style={{
                          display: 'inline-block',
                          background: '#f0f0f0',
                          padding: '0.15rem 0.4rem',
                          borderRadius: '3px',
                          marginRight: '0.25rem',
                          marginBottom: '0.25rem'
                        }}>
                          {cat}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td style={{ padding: '1rem', color: '#333' }}>
                    <div style={{ fontSize: '0.9rem' }}>
                      <div>Essais chronos: {meeting.categories.length}</div>
                      <div>Qualifs: {meeting.categories.length * meeting.qualifyingRounds}</div>
                      <div>1/2 finales: {meeting.categories.length * 2}</div>
                      <div>Finales: {meeting.categories.length}</div>
                      <strong>Total: {meeting.categories.length * (meeting.qualifyingRounds + 4)}</strong>
                    </div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <button
                      onClick={() => handleDeleteMeeting(meeting.id)}
                      style={{ 
                        padding: '0.25rem 0.5rem', 
                        background: '#dc3545', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '4px', 
                        cursor: 'pointer',
                        fontSize: '0.8rem'
                      }}
                    >
                      🗑️ Supprimer
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: '1rem', color: '#666' }}>
        📊 Saison {selectedYear} : {meetings.length} meeting(s)
      </p>
    </div>
  );
}