import React, { useState, useEffect } from 'react';
import { db } from '../../../config/firebase';
import { collection, addDoc, onSnapshot, query, orderBy, where, updateDoc, doc, getDocs } from 'firebase/firestore';

export default function EngagementManagement() {
  const [meetings, setMeetings] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [engagements, setEngagements] = useState<any[]>([]);
  
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMeeting, setSelectedMeeting] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [engagedDrivers, setEngagedDrivers] = useState<string[]>([]);

  // Récupérer les meetings de l'année
  useEffect(() => {
    const q = query(
      collection(db, 'meetings'), 
      where('year', '==', selectedYear),
      orderBy('date', 'desc')
    );
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const meetingsData: any[] = [];
      querySnapshot.forEach((doc) => {
        meetingsData.push({ id: doc.id, ...doc.data() });
      });
      setMeetings(meetingsData);
      
      // Reset la sélection si le meeting n'existe plus
      if (selectedMeeting && !meetingsData.find(m => m.id === selectedMeeting)) {
        setSelectedMeeting('');
        setSelectedCategory('');
      }
    });

    return () => unsubscribe();
  }, [selectedYear]);

  // Récupérer les pilotes éligibles
  useEffect(() => {
    if (!selectedMeeting || !selectedCategory) {
      setDrivers([]);
      return;
    }

    const q = query(
      collection(db, 'drivers'),
      where('year', '==', selectedYear),
      where('category', '==', selectedCategory),
      orderBy('carNumber')
    );
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const driversData: any[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
            driversData.push({ id: doc.id, ...doc.data() });
      });
      setDrivers(driversData);
    });

    return () => unsubscribe();
  }, [selectedMeeting, selectedCategory, selectedYear]);

  // Récupérer les engagements existants
  useEffect(() => {
    if (!selectedMeeting || !selectedCategory) {
      setEngagedDrivers([]);
      return;
    }

    const q = query(
      collection(db, 'engagements'),
      where('meetingId', '==', selectedMeeting),
      where('category', '==', selectedCategory)
    );
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      if (!querySnapshot.empty) {
        const engagement = querySnapshot.docs[0].data();
        setEngagedDrivers(engagement.driverIds || []);
      } else {
        setEngagedDrivers([]);
      }
    });

    return () => unsubscribe();
  }, [selectedMeeting, selectedCategory]);

  const handleSaveEngagements = async () => {
    if (!selectedMeeting || !selectedCategory) {
      alert('Veuillez sélectionner un meeting et une catégorie !');
      return;
    }

    try {
      // Vérifier s'il existe déjà un engagement pour ce meeting/catégorie
      const q = query(
        collection(db, 'engagements'),
        where('meetingId', '==', selectedMeeting),
        where('category', '==', selectedCategory)
      );
      console.log('Filtre pilotes:', {
  selectedYear,
  selectedCategory,
  selectedMeeting
});
      const existingEngagements = await getDocs(q);
      
      const meeting = meetings.find(m => m.id === selectedMeeting);
      
      if (!existingEngagements.empty) {
        // Mettre à jour l'engagement existant
        const engagementDoc = existingEngagements.docs[0];
        await updateDoc(doc(db, 'engagements', engagementDoc.id), {
          driverIds: engagedDrivers,
          updatedAt: new Date()
        });
      } else {
        // Créer un nouvel engagement
        await addDoc(collection(db, 'engagements'), {
          meetingId: selectedMeeting,
          meetingName: meeting?.name,
          category: selectedCategory,
          year: selectedYear,
          driverIds: engagedDrivers,
          createdAt: new Date()
        });
      }

      alert(`✅ Engagements sauvegardés !\n${engagedDrivers.length} pilote(s) engagé(s) en ${selectedCategory}`);
    } catch (error) {
      console.error('Erreur:', error);
      alert('Erreur lors de la sauvegarde des engagements');
    }
  };

  const toggleDriverEngagement = (driverId: string) => {
    setEngagedDrivers(prev => 
      prev.includes(driverId)
        ? prev.filter(id => id !== driverId)
        : [...prev, driverId]
    );
  };

  const selectedMeetingData = meetings.find(m => m.id === selectedMeeting);
  const availableCategories = selectedMeetingData?.categories || [];

  return (
  <div style={{ padding: '2rem' }}>
    {/* HEADER ENGAGEMENTS MODERNE */}
    <div className="page-header page-header-engagements">
      <h2 className="page-title">
        <span className="page-title-icon">📝</span>
        Gestion des Engagements
      </h2>

      {/* FILTRES INTÉGRÉS DANS LE HEADER */}
      <div className="filter-row">
        <div className="filter-item">
          <label className="filter-label-modern">
            <span>📅</span>
            Saison :
          </label>
          <select
            value={selectedYear}
            onChange={(e) => {
              setSelectedYear(parseInt(e.target.value));
              setSelectedMeeting('');
              setSelectedCategory('');
            }}
            className="select-modern"
          >
            <option value={2024}>🏁 2024</option>
            <option value={2025}>🏁 2025</option>
            <option value={2026}>🏁 2026</option>
          </select>
        </div>

        <div className="filter-item">
          <label className="filter-label-modern">
            <span>🏁</span>
            Meeting :
          </label>
          <select
            value={selectedMeeting}
            onChange={(e) => {
              setSelectedMeeting(e.target.value);
              setSelectedCategory('');
            }}
            className="select-modern"
            style={{ minWidth: '200px' }}
          >
            <option value="">Sélectionnez un meeting</option>
            {meetings.map(meeting => (
              <option key={meeting.id} value={meeting.id}>
                {meeting.name} - {new Date(meeting.date).toLocaleDateString('fr-FR')}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-item">
          <label className="filter-label-modern">
            <span>🏆</span>
            Catégorie :
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            disabled={!selectedMeeting}
            className="select-modern"
            style={{ 
              opacity: selectedMeeting ? 1 : 0.6,
              cursor: selectedMeeting ? 'pointer' : 'not-allowed'
            }}
          >
            <option value="">Sélectionnez une catégorie</option>
            {availableCategories.map((category: string) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>

        {/* STATS À DROITE */}
        {selectedMeeting && selectedCategory && (
          <div className="stats-container">
            <div className="stat-card stat-card-primary">
              <div className="stat-number stat-number-primary">
                {drivers.length}
              </div>
              <div className="stat-label">Éligibles</div>
            </div>

            <div className="stat-card stat-card-secondary">
              <div className="stat-number stat-number-secondary">
                {engagedDrivers.length}
              </div>
              <div className="stat-label">Engagés</div>
            </div>
          </div>
        )}
      </div>

      {/* CONTEXTE INFORMATIF */}
      {selectedMeeting && selectedCategory && (
        <div className="context-info context-success">
          <strong>📋 Contexte :</strong> {selectedMeetingData?.name} • {selectedCategory} {selectedYear}
          <div className="context-info-text">
            Pilotes éligibles : même année ({selectedYear}) et même catégorie ({selectedCategory})
          </div>
        </div>
      )}
    </div>

    {/* CONTENU PRINCIPAL */}
    {selectedMeeting && selectedCategory ? (
      <div className="content-section">
        <div style={{ 
          background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.9) 100%)',
          backdropFilter: 'blur(12px)',
          border: '2px solid rgba(40, 167, 69, 0.3)',
          borderRadius: '20px',
          padding: '2rem',
          boxShadow: '0 12px 40px rgba(0,0,0,0.1)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Barre verte en haut */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
            borderRadius: '20px 20px 0 0'
          }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h3 style={{ 
              fontFamily: 'Orbitron, monospace',
              fontWeight: '700',
              color: '#1a1a1a',
              margin: 0,
              fontSize: '1.3rem'
            }}>
              👥 Pilotes {selectedCategory} {selectedYear} ({engagedDrivers.length}/{drivers.length} engagés)
            </h3>
            
            <button
              onClick={handleSaveEngagements}
              className="action-btn action-btn-secondary"
              style={{ marginBottom: 0 }}
            >
              <span className="btn-icon">💾</span>
              Sauvegarder
            </button>
          </div>

          {drivers.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state-icon">👤</span>
              <div className="empty-state-title">Aucun pilote trouvé</div>
              <div className="empty-state-text">
                Aucun pilote disponible pour {selectedCategory} {selectedYear}
              </div>
            </div>
          ) : (
            <>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                gap: '1rem',
                marginBottom: '2rem'
              }}>
                {drivers.map(driver => (
                  <div
                    key={driver.id}
                    onClick={() => toggleDriverEngagement(driver.id)}
                    style={{
                      padding: '1rem',
                      border: '2px solid',
                      borderColor: engagedDrivers.includes(driver.id) ? '#28a745' : 'rgba(0,0,0,0.1)',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      backgroundColor: engagedDrivers.includes(driver.id) ? 'rgba(40, 167, 69, 0.1)' : 'white',
                      transition: 'all 0.3s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      boxShadow: engagedDrivers.includes(driver.id) ? '0 4px 15px rgba(40, 167, 69, 0.2)' : '0 2px 8px rgba(0,0,0,0.05)'
                    }}
                    onMouseEnter={(e) => {
                      if (!engagedDrivers.includes(driver.id)) {
                        e.currentTarget.style.borderColor = '#28a745';
                        e.currentTarget.style.backgroundColor = 'rgba(40, 167, 69, 0.05)';
                        e.currentTarget.style.transform = 'translateY(-2px)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!engagedDrivers.includes(driver.id)) {
                        e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)';
                        e.currentTarget.style.backgroundColor = 'white';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }
                    }}
                  >
                    <span style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: engagedDrivers.includes(driver.id) ? '#28a745' : '#ddd',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      flexShrink: 0
                    }}>
                      {engagedDrivers.includes(driver.id) ? '✓' : ''}
                    </span>
                    
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', color: '#333', fontSize: '1.1rem' }}>
                        #{driver.carNumber} {driver.name}
                      </div>
                      {driver.team && (
                        <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.25rem' }}>
                          🏁 {driver.team}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Boutons rapides */}
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <button
                  onClick={() => setEngagedDrivers(drivers.map(d => d.id))}
                  className="action-btn action-btn-secondary"
                  style={{ marginBottom: 0, fontSize: '0.9rem', padding: '0.8rem 1.5rem' }}
                >
                  <span>✅</span>
                  Tout sélectionner
                </button>
                <button
                  onClick={() => setEngagedDrivers([])}
                  className="action-btn action-btn-cancel"
                  style={{ marginBottom: 0, fontSize: '0.9rem', padding: '0.8rem 1.5rem' }}
                >
                  <span>❌</span>
                  Tout désélectionner
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    ) : (
      <div className="empty-state">
        <span className="empty-state-icon">📝</span>
        <div className="empty-state-title">Sélectionnez un meeting et une catégorie</div>
        <div className="empty-state-text">
          Choisissez d'abord un meeting et une catégorie pour gérer les engagements
        </div>
      </div>
    )}

    {/* Récapitulatif en bas - reste identique */}
    {selectedMeeting && (
      <div style={{ 
        background: 'rgba(248, 249, 250, 0.9)',
        backdropFilter: 'blur(8px)',
        padding: '1.5rem', 
        borderRadius: '16px',
        border: '1px solid rgba(0,0,0,0.1)',
        marginTop: '2rem'
      }}>
        <h4 style={{ color: '#333', marginTop: 0, marginBottom: '1rem' }}>📊 Récapitulatif du meeting</h4>
        <p style={{ color: '#666', margin: 0, marginBottom: '0.5rem' }}>
          <strong>{selectedMeetingData?.name}</strong> • {selectedMeetingData?.location} • {selectedMeetingData && new Date(selectedMeetingData.date).toLocaleDateString('fr-FR')}
        </p>
        <div>
          <strong>Catégories :</strong> {availableCategories.join(', ')}
        </div>
      </div>
    )}
  </div>
);
}