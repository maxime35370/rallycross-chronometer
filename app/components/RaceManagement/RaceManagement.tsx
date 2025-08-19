import React, { useState, useEffect } from 'react';
import { db } from '../../../config/firebase';
import { collection, onSnapshot, query, orderBy, where, updateDoc, doc, getDocs } from 'firebase/firestore';

export default function RaceManagement() {
  const [meetings, setMeetings] = useState<any[]>([]);
  const [races, setRaces] = useState<any[]>([]);
  const [engagedDrivers, setEngagedDrivers] = useState<any[]>([]);
  
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMeeting, setSelectedMeeting] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // Récupérer les meetings
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
      
      // Reset si le meeting n'existe plus
      if (selectedMeeting && !meetingsData.find(m => m.id === selectedMeeting)) {
        setSelectedMeeting('');
        setSelectedCategory('');
      }
    });

    return () => unsubscribe();
  }, [selectedYear]);

  // Récupérer les sessions du meeting/catégorie
  useEffect(() => {
    if (!selectedMeeting || !selectedCategory) {
      setRaces([]);
      return;
    }

    console.log('Recherche sessions:', {
    meetingId: selectedMeeting,
    category: selectedCategory
  });
    const q = query(
      collection(db, 'races'),
      where('meetingId', '==', selectedMeeting),
      where('category', '==', selectedCategory)
      //orderBy('order')
    );
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
  console.log('=== COMPARAISON ===');
  console.log('selectedMeeting:', selectedMeeting);
  console.log('selectedCategory:', selectedCategory);
  console.log('Sessions trouvées:', querySnapshot.size);
  
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    console.log('Session trouvée:', {
      name: data.name,
      meetingId: data.meetingId,
      category: data.category,
      matchMeeting: data.meetingId === selectedMeeting,
      matchCategory: data.category === selectedCategory
    });
  });
  
  const racesData: any[] = [];
  querySnapshot.forEach((doc) => {
    racesData.push({ id: doc.id, ...doc.data() });
  });
  setRaces(racesData);
});

    return () => unsubscribe();
  }, [selectedMeeting, selectedCategory]);

  // Récupérer les pilotes engagés
  useEffect(() => {
    if (!selectedMeeting || !selectedCategory) {
      setEngagedDrivers([]);
      return;
    }

    const getEngagedDrivers = async () => {
      try {
        // Récupérer l'engagement
        const engagementQuery = query(
          collection(db, 'engagements'),
          where('meetingId', '==', selectedMeeting),
          where('category', '==', selectedCategory)
        );
        
        const engagementSnapshot = await getDocs(engagementQuery);
        
        if (engagementSnapshot.empty) {
          setEngagedDrivers([]);
          return;
        }

        const engagement = engagementSnapshot.docs[0].data();
        const driverIds = engagement.driverIds || [];

        if (driverIds.length === 0) {
          setEngagedDrivers([]);
          return;
        }

        // Récupérer les détails des pilotes
        const driversQuery = query(
          collection(db, 'drivers'),
          where('year', '==', selectedYear),
          where('category', '==', selectedCategory)
        );
        
        const driversSnapshot = await getDocs(driversQuery);
        const allDrivers: any[] = [];
        
        driversSnapshot.forEach((doc) => {
          allDrivers.push({ id: doc.id, ...doc.data() });
        });

        // Filtrer seulement les pilotes engagés
        const engaged = allDrivers.filter(driver => driverIds.includes(driver.id));
        setEngagedDrivers(engaged);
        
      } catch (error) {
        console.error('Erreur récupération pilotes engagés:', error);
        setEngagedDrivers([]);
      }
    };

    getEngagedDrivers();
  }, [selectedMeeting, selectedCategory, selectedYear]);

  const handleAssignDriver = async (raceId: string, driverId: string) => {
  try {
    const race = races.find(r => r.id === raceId);
    if (!race) return;

    const currentDrivers = race.drivers || [];
    let updatedDrivers;

    if (currentDrivers.includes(driverId)) {
      // Retirer le pilote
      updatedDrivers = currentDrivers.filter((id: string) => id !== driverId);
    } else {
      // NOUVELLE VÉRIFICATION : Si c'est une demi-finale, vérifier que le pilote n'est pas dans l'autre
      if (race.type === 'semifinal') {
        const otherSemifinal = races.find(r => 
          r.type === 'semifinal' && 
          r.id !== raceId && 
          r.category === race.category &&
          r.drivers?.includes(driverId)
        );
        
        if (otherSemifinal) {
          alert(`❌ Ce pilote est déjà dans l'autre demi-finale !\n"${otherSemifinal.name}"`);
          return;
        }
      }

      // Limite de 8 seulement pour les 1/2 finales et finales
      if (race.type !== 'qualifying' && race.type !== 'timeTrials' && currentDrivers.length >= 8) {
        alert('Maximum 8 pilotes pour les 1/2 finales et finales !');
        return;
      }
      updatedDrivers = [...currentDrivers, driverId];
    }

    await updateDoc(doc(db, 'races', raceId), {
      drivers: updatedDrivers,
      updatedAt: new Date()
    });

  } catch (error) {
    console.error('Erreur assignation pilote:', error);
    alert('Erreur lors de l\'assignation du pilote');
  }
};

  const getDriverName = (driverId: string) => {
    const driver = engagedDrivers.find(d => d.id === driverId);
    return driver ? `#${driver.carNumber} ${driver.name}` : 'Pilote inconnu';
  };

  const getSessionTypeLabel = (type: string) => {
    const types: any = {
      'timeTrials': { label: 'Essais Chronométrés', emoji: '⏱️' },
      'qualifying': { label: 'Manche Qualificative', emoji: '🏃' },
      'semifinal': { label: '1/2 Finale', emoji: '🥈' },
      'final': { label: 'Finale', emoji: '🏆' }
    };
    
    return types[type] || { label: type, emoji: '🏁' };
  };

  const selectedMeetingData = meetings.find(m => m.id === selectedMeeting);
  const availableCategories = selectedMeetingData?.categories || [];

  return (
    <div style={{ padding: '2rem' }}>
      <h2 style={{ color: '#1e3c72', marginBottom: '1.5rem' }}>
        🏁 Gestion des Sessions de Course
      </h2>

      {/* Sélection année */}
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
          onChange={(e) => {
            setSelectedYear(parseInt(e.target.value));
            setSelectedMeeting('');
            setSelectedCategory('');
          }}
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

      {/* Sélection meeting et catégorie */}
      <div style={{ 
        background: '#f8f9fa', 
        padding: '1rem', 
        borderRadius: '8px', 
        marginBottom: '1.5rem',
        border: '1px solid #e9ecef'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>
              🏁 Meeting :
            </label>
            <select
              value={selectedMeeting}
              onChange={(e) => {
                setSelectedMeeting(e.target.value);
                setSelectedCategory('');
              }}
              style={{ 
                width: '100%',
                padding: '0.5rem', 
                borderRadius: '4px', 
                border: '1px solid #ccc',
                fontSize: '1rem',
                color: '#333',
                backgroundColor: 'white'
              }}
            >
              <option value="">Sélectionnez un meeting</option>
              {meetings.map(meeting => (
                <option key={meeting.id} value={meeting.id}>
                  {meeting.name} - {new Date(meeting.date).toLocaleDateString('fr-FR')}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>
              🏆 Catégorie :
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              disabled={!selectedMeeting}
              style={{ 
                width: '100%',
                padding: '0.5rem', 
                borderRadius: '4px', 
                border: '1px solid #ccc',
                fontSize: '1rem',
                color: '#333',
                backgroundColor: selectedMeeting ? 'white' : '#f5f5f5'
              }}
            >
              <option value="">Sélectionnez une catégorie</option>
              {availableCategories.map((category: string) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
        </div>

        {selectedMeeting && selectedCategory && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: '#28a745', color: 'white', borderRadius: '8px' }}>
            <strong>📋 Contexte :</strong> {selectedMeetingData?.name} • {selectedCategory} {selectedYear}
            <br />
            <small style={{ opacity: 0.9 }}>
              {engagedDrivers.length} pilote(s) engagé(s) • {races.length} session(s) disponible(s)
            </small>
          </div>
        )}
      </div>

      {/* Sessions de course */}
      {selectedMeeting && selectedCategory && (
        <>
          {races.length === 0 ? (
            <div style={{ 
              background: 'white', 
              borderRadius: '8px', 
              padding: '2rem',
              textAlign: 'center',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              color: '#666'
            }}>
              🏁 Aucune session trouvée pour ce meeting/catégorie
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {races.map((race) => {
                const sessionType = getSessionTypeLabel(race.type);
                const assignedDrivers = race.drivers || [];
                
                return (
                  <div 
                    key={race.id}
                    style={{ 
                      background: 'white', 
                      borderRadius: '8px', 
                      padding: '1.5rem',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                      border: '1px solid #e9ecef'
                    }}
                  >
                    {/* En-tête de session */}
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      marginBottom: '1rem',
                      paddingBottom: '0.5rem',
                      borderBottom: '1px solid #eee'
                    }}>
                      <div>
                        <h3 style={{ color: '#333', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {sessionType.emoji} {race.name}
                        </h3>
                        <small style={{ color: '#666' }}>
  {race.laps} tour(s) • {assignedDrivers.length}
  {(race.type === 'semifinal' || race.type === 'final') ? '/8' : ''} pilotes assignés
</small>
                      </div>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '20px',
                        fontSize: '0.8rem',
                        backgroundColor: race.isCompleted ? '#28a745' : '#ffc107',
                        color: 'white',
                        fontWeight: 'bold'
                      }}>
                        {race.isCompleted ? '✅ Terminée' : '⏳ En attente'}
                      </span>
                    </div>

                    {/* Pilotes engagés disponibles */}
                    {engagedDrivers.length === 0 ? (
                      <div style={{ 
                        background: '#f8f9fa', 
                        padding: '1rem', 
                        borderRadius: '4px',
                        textAlign: 'center',
                        color: '#666'
                      }}>
                        👤 Aucun pilote engagé dans cette catégorie
                        <br />
                        <small>Allez dans "📝 Engagements" pour engager des pilotes à ce meeting</small>
                      </div>
                    ) : (
                      <div>
                        <h4 style={{ color: '#333', marginTop: 0, marginBottom: '0.5rem' }}>
  👥 Pilotes engagés ({engagedDrivers.filter(driver => {
    if (race.type === 'semifinal') {
      const isInOtherSemifinal = races.some(r => 
        r.type === 'semifinal' && 
        r.id !== race.id && 
        r.category === race.category &&
        r.drivers?.includes(driver.id)
      );
      return !isInOtherSemifinal;
    }
    return true;
  }).length}) :
</h4>
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                          gap: '0.5rem'
                        }}>
                          {engagedDrivers
  .filter(driver => {
    // Si c'est une demi-finale, masquer les pilotes de l'autre demi-finale
    if (race.type === 'semifinal') {
      const isInOtherSemifinal = races.some(r => 
        r.type === 'semifinal' && 
        r.id !== race.id && 
        r.category === race.category &&
        r.drivers?.includes(driver.id)
      );
      return !isInOtherSemifinal;
    }
    
    // Si c'est une finale, afficher seulement les pilotes qui ont fait une demi-finale
    if (race.type === 'final') {
      const isInSemifinal = races.some(r => 
        r.type === 'semifinal' && 
        r.category === race.category &&
        r.drivers?.includes(driver.id)
      );
      return isInSemifinal;
    }
    
    return true; // Afficher tous les pilotes pour les autres types de course
  }).map(driver => (
                            <div
                              key={driver.id}
                              onClick={() => handleAssignDriver(race.id, driver.id)}
                              style={{
                                padding: '0.5rem',
                                border: '2px solid',
                                borderColor: assignedDrivers.includes(driver.id) ? '#28a745' : '#ddd',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                backgroundColor: assignedDrivers.includes(driver.id) ? '#d4edda' : 'white',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                              }}
                            >
                              <span style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                background: assignedDrivers.includes(driver.id) ? '#28a745' : '#ddd',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '12px',
                                fontWeight: 'bold'
                              }}>
                                {assignedDrivers.includes(driver.id) ? '✓' : ''}
                              </span>
                              
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: '500', color: '#333' }}>
                                  #{driver.carNumber} {driver.name}
                                </div>
                                {driver.team && (
                                  <div style={{ fontSize: '0.8rem', color: '#666' }}>
                                    {driver.team}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Récapitulatif des pilotes assignés */}
                        {assignedDrivers.length > 0 && (
                          <div style={{ 
                            marginTop: '1rem', 
                            padding: '0.75rem', 
                            background: '#e3f2fd', 
                            borderRadius: '4px'
                          }}>
                            <strong style={{ color: '#1565c0' }}>
                                🏁 Pilotes assignés à cette session ({assignedDrivers.length}{(race.type === 'semifinal' || race.type === 'final') ? '/8' : ''}) :
                            </strong>
                            <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#333' }}>
                              {assignedDrivers.map((driverId: string, index: number) => (
                                <span key={driverId}>
                                  {getDriverName(driverId)}
                                  {index < assignedDrivers.length - 1 ? ' • ' : ''}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Boutons rapides */}
                        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={() => {
                                const limit = (race.type === 'semifinal' || race.type === 'final') ? 8 : engagedDrivers.length;
                                engagedDrivers.slice(0, limit).forEach(driver => {
                                if (!assignedDrivers.includes(driver.id)) {
                                    handleAssignDriver(race.id, driver.id);
                                }
                                });
                            }}
                            disabled={(race.type === 'semifinal' || race.type === 'final') ? assignedDrivers.length >= 8 : assignedDrivers.length >= engagedDrivers.length}
                            style={{
                                padding: '0.5rem 1rem',
                                background: ((race.type === 'semifinal' || race.type === 'final') ? assignedDrivers.length >= 8 : assignedDrivers.length >= engagedDrivers.length) ? '#ccc' : '#667eea',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: ((race.type === 'semifinal' || race.type === 'final') ? assignedDrivers.length >= 8 : assignedDrivers.length >= engagedDrivers.length) ? 'not-allowed' : 'pointer',
                                fontSize: '0.85rem'
                            }}
                            >
                            ➕ Remplir la grille
                            </button>
                          
                          <button
                            onClick={() => {
                              assignedDrivers.forEach((driverId: string) => {
                                handleAssignDriver(race.id, driverId);
                              });
                            }}
                            disabled={assignedDrivers.length === 0}
                            style={{
                              padding: '0.5rem 1rem',
                              background: assignedDrivers.length === 0 ? '#ccc' : '#dc3545',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: assignedDrivers.length === 0 ? 'not-allowed' : 'pointer',
                              fontSize: '0.85rem'
                            }}
                          >
                            🗑️ Vider la grille
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Résumé */}
      {selectedMeeting && selectedCategory && races.length > 0 && (
        <div style={{ 
          marginTop: '2rem',
          background: '#f8f9fa', 
          padding: '1rem', 
          borderRadius: '8px',
          border: '1px solid #e9ecef'
        }}>
          <h4 style={{ color: '#333', marginTop: 0 }}>📊 Résumé du meeting</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {['timeTrials', 'qualifying', 'semifinal', 'final'].map(type => {
              const sessionsOfType = races.filter(r => r.type === type);
              const totalAssigned = sessionsOfType.reduce((sum, race) => sum + (race.drivers?.length || 0), 0);
              const sessionType = getSessionTypeLabel(type);
              
              return sessionsOfType.length > 0 ? (
                <div key={type} style={{ background: 'white', padding: '0.75rem', borderRadius: '4px', textAlign: 'center' }}>
                  <div style={{ fontWeight: 'bold', color: '#333' }}>
                    {sessionType.emoji} {sessionType.label}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#666' }}>
                    {sessionsOfType.length} session(s)
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#666' }}>
                    {totalAssigned} pilote(s) assigné(s)
                  </div>
                </div>
              ) : null;
            })}
          </div>
        </div>
      )}
    </div>
  );
}