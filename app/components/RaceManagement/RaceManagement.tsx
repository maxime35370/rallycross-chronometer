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
    const q = query(
      collection(db, 'races'),
      where('meetingId', '==', selectedMeeting),
      where('category', '==', selectedCategory)
      //orderBy('order')
    );
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
  
  querySnapshot.forEach((doc) => {
    const data = doc.data();
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

  // Fonctions utilitaires pour les couleurs des sessions
  const getSessionBorderColor = (type: string): string => {
    const colors: { [key: string]: string } = {
      'timeTrials': 'rgba(40, 167, 69, 0.3)',
      'qualifying': 'rgba(102, 126, 234, 0.3)',
      'semifinal': 'rgba(142, 36, 170, 0.3)',
      'final': 'rgba(255, 215, 0, 0.5)'
    };
    return colors[type] || 'rgba(0,0,0,0.1)';
  };

  const getSessionGradient = (type: string): string => {
    const gradients: { [key: string]: string } = {
      'timeTrials': 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
      'qualifying': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'semifinal': 'linear-gradient(135deg, #8e24aa 0%, #7b1fa2 100%)',
      'final': 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)'
    };
    return gradients[type] || 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)';
  };


  return (
    <div style={{ padding: '2rem' }}>
      {/* HEADER SESSIONS MODERNE */}
      <div className="page-header page-header-sessions">
        <h2 className="page-title">
          <span className="page-title-icon">🏁</span>
          Gestion des Sessions de Course
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
                  {engagedDrivers.length}
                </div>
                <div className="stat-label">Pilotes engagés</div>
              </div>

              <div className="stat-card stat-card-secondary">
                <div className="stat-number stat-number-secondary">
                  {races.length}
                </div>
                <div className="stat-label">Sessions</div>
              </div>
            </div>
          )}
        </div>

        {/* CONTEXTE INFORMATIF */}
        {selectedMeeting && selectedCategory && (
          <div className="context-info context-success">
            <strong>📋 Contexte :</strong> {selectedMeetingData?.name} • {selectedCategory} {selectedYear}
            <div className="context-info-text">
              {engagedDrivers.length} pilote(s) engagé(s) • {races.length} session(s) disponible(s) • Mise à jour temps réel
            </div>
          </div>
        )}
      </div>

      {/* CONTENU PRINCIPAL */}
      {selectedMeeting && selectedCategory ? (
        races.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">🏁</span>
            <div className="empty-state-title">Aucune session trouvée</div>
            <div className="empty-state-text">
              Aucune session trouvée pour ce meeting/catégorie
            </div>
          </div>
        ) : (
          <div className="content-section">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {races.map((race) => {
                const sessionType = getSessionTypeLabel(race.type);
                const assignedDrivers = race.drivers || [];
                
                return (
                  <div 
                    key={race.id}
                    style={{ 
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.9) 100%)',
                      backdropFilter: 'blur(12px)',
                      border: `2px solid ${getSessionBorderColor(race.type)}`,
                      borderRadius: '20px',
                      padding: '2rem',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                      position: 'relative',
                      overflow: 'hidden',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.15)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.1)';
                    }}
                  >
                    {/* Barre de couleur selon le type de session */}
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '4px',
                      background: getSessionGradient(race.type),
                      borderRadius: '20px 20px 0 0'
                    }} />

                    {/* En-tête de session modernisée */}
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'flex-start',
                      marginBottom: '1.5rem',
                      paddingBottom: '1rem',
                      borderBottom: '1px solid rgba(0,0,0,0.1)'
                    }}>
                      <div>
                        <h3 style={{ 
                          color: '#1a1a1a', 
                          margin: 0, 
                          marginBottom: '0.5rem',
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.75rem',
                          fontFamily: 'Orbitron, monospace',
                          fontWeight: '700',
                          fontSize: '1.3rem'
                        }}>
                          <span style={{ fontSize: '1.5rem' }}>{sessionType.emoji}</span>
                          {race.name}
                        </h3>
                        <div style={{ 
                          color: '#666',
                          fontSize: '0.95rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '1rem'
                        }}>
                          <span>🏃‍♂️ {race.laps} tour(s)</span>
                          <span>👥 {assignedDrivers.length}{(race.type === 'semifinal' || race.type === 'final') ? '/8' : ''} pilotes</span>
                          <span>{sessionType.label}</span>
                        </div>
                      </div>
                      
                      <div style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '20px',
                        fontSize: '0.85rem',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        background: race.isCompleted 
                          ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)'
                          : 'linear-gradient(135deg, #ffc107 0%, #fd7e14 100%)',
                        color: 'white',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}>
                        <span>{race.isCompleted ? '✅' : '⏳'}</span>
                        {race.isCompleted ? 'Terminée' : 'En attente'}
                      </div>
                    </div>

                    {/* Section des pilotes engagés */}
                    {engagedDrivers.length === 0 ? (
                      <div style={{ 
                        background: 'rgba(248, 249, 250, 0.8)',
                        backdropFilter: 'blur(8px)',
                        padding: '2rem', 
                        borderRadius: '12px',
                        textAlign: 'center',
                        color: '#666',
                        border: '2px dashed rgba(0,0,0,0.1)'
                      }}>
                        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👤</div>
                        <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>Aucun pilote engagé</div>
                        <small>Allez dans "📝 Engagements" pour engager des pilotes à ce meeting</small>
                      </div>
                    ) : (
                      <div>
                        <h4 style={{ 
                          color: '#333', 
                          marginTop: 0, 
                          marginBottom: '1rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          fontSize: '1.1rem'
                        }}>
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
                          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
                          gap: '0.75rem',
                          marginBottom: '1.5rem'
                        }}>
                          {engagedDrivers
                            .filter(driver => {
                              if (race.type === 'semifinal') {
                                const isInOtherSemifinal = races.some(r => 
                                  r.type === 'semifinal' && 
                                  r.id !== race.id && 
                                  r.category === race.category &&
                                  r.drivers?.includes(driver.id)
                                );
                                return !isInOtherSemifinal;
                              }
                              
                              if (race.type === 'final') {
                                const isInSemifinal = races.some(r => 
                                  r.type === 'semifinal' && 
                                  r.category === race.category &&
                                  r.drivers?.includes(driver.id)
                                );
                                return isInSemifinal;
                              }
                              
                              return true;
                            }).map(driver => (
                              <div
                                key={driver.id}
                                onClick={() => handleAssignDriver(race.id, driver.id)}
                                style={{
                                  padding: '0.75rem',
                                  border: '2px solid',
                                  borderColor: assignedDrivers.includes(driver.id) ? '#28a745' : 'rgba(0,0,0,0.1)',
                                  borderRadius: '12px',
                                  cursor: 'pointer',
                                  backgroundColor: assignedDrivers.includes(driver.id) 
                                    ? 'rgba(40, 167, 69, 0.1)' 
                                    : 'rgba(255,255,255,0.8)',
                                  transition: 'all 0.2s ease',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '0.75rem',
                                  boxShadow: assignedDrivers.includes(driver.id) 
                                    ? '0 4px 15px rgba(40, 167, 69, 0.2)' 
                                    : '0 2px 8px rgba(0,0,0,0.05)'
                                }}
                                onMouseEnter={(e) => {
                                  if (!assignedDrivers.includes(driver.id)) {
                                    e.currentTarget.style.borderColor = '#28a745';
                                    e.currentTarget.style.backgroundColor = 'rgba(40, 167, 69, 0.05)';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!assignedDrivers.includes(driver.id)) {
                                    e.currentTarget.style.borderColor = 'rgba(0,0,0,0.1)';
                                    e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.8)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                  }
                                }}
                              >
                                <span style={{
                                  width: '22px',
                                  height: '22px',
                                  borderRadius: '50%',
                                  background: assignedDrivers.includes(driver.id) ? '#28a745' : '#ddd',
                                  color: 'white',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '12px',
                                  fontWeight: 'bold',
                                  flexShrink: 0
                                }}>
                                  {assignedDrivers.includes(driver.id) ? '✓' : ''}
                                </span>
                                
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: '600', color: '#333' }}>
                                    #{driver.carNumber} {driver.name}
                                  </div>
                                  {driver.team && (
                                    <div style={{ fontSize: '0.8rem', color: '#666' }}>
                                      🏁 {driver.team}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>

                        {/* Récapitulatif des pilotes assignés */}
                        {assignedDrivers.length > 0 && (
                          <div style={{ 
                            padding: '1rem', 
                            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 51, 234, 0.1) 100%)',
                            borderRadius: '12px',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            marginBottom: '1rem'
                          }}>
                            <div style={{ 
                              fontWeight: '600', 
                              color: '#1565c0',
                              marginBottom: '0.5rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem'
                            }}>
                              🏁 Pilotes assignés à cette session ({assignedDrivers.length}{(race.type === 'semifinal' || race.type === 'final') ? '/8' : ''}) :
                            </div>
                            <div style={{ fontSize: '0.9rem', color: '#333' }}>
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
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
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
                            className="action-btn action-btn-secondary"
                            style={{
                              marginBottom: 0,
                              fontSize: '0.9rem',
                              padding: '0.8rem 1.5rem',
                              opacity: ((race.type === 'semifinal' || race.type === 'final') ? assignedDrivers.length >= 8 : assignedDrivers.length >= engagedDrivers.length) ? 0.5 : 1,
                              cursor: ((race.type === 'semifinal' || race.type === 'final') ? assignedDrivers.length >= 8 : assignedDrivers.length >= engagedDrivers.length) ? 'not-allowed' : 'pointer'
                            }}
                          >
                            <span>➕</span>
                            Remplir la grille
                          </button>
                          
                          <button
                            onClick={() => {
                              assignedDrivers.forEach((driverId: string) => {
                                handleAssignDriver(race.id, driverId);
                              });
                            }}
                            disabled={assignedDrivers.length === 0}
                            className="action-btn action-btn-cancel"
                            style={{
                              marginBottom: 0,
                              fontSize: '0.9rem',
                              padding: '0.8rem 1.5rem',
                              opacity: assignedDrivers.length === 0 ? 0.5 : 1,
                              cursor: assignedDrivers.length === 0 ? 'not-allowed' : 'pointer'
                            }}
                          >
                            <span>🗑️</span>
                            Vider la grille
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )
      ) : (
        <div className="empty-state">
          <span className="empty-state-icon">🏁</span>
          <div className="empty-state-title">Sélectionnez un meeting et une catégorie</div>
          <div className="empty-state-text">
            Choisissez d'abord un meeting et une catégorie pour gérer les sessions
          </div>
        </div>
      )}

      {/* Résumé en bas - reste identique mais modernisé */}
      {selectedMeeting && selectedCategory && races.length > 0 && (
        <div style={{ 
          marginTop: '2rem',
          background: 'rgba(248, 249, 250, 0.9)',
          backdropFilter: 'blur(8px)',
          padding: '1.5rem', 
          borderRadius: '16px',
          border: '1px solid rgba(0,0,0,0.1)'
        }}>
          <h4 style={{ color: '#333', marginTop: 0, marginBottom: '1rem' }}>📊 Résumé du meeting</h4>
          <div className="stats-grid">
            {['timeTrials', 'qualifying', 'semifinal', 'final'].map(type => {
              const sessionsOfType = races.filter(r => r.type === type);
              const totalAssigned = sessionsOfType.reduce((sum, race) => sum + (race.drivers?.length || 0), 0);
              const sessionType = getSessionTypeLabel(type);
              
              return sessionsOfType.length > 0 ? (
                <div key={type} className="stat-item-modern">
                  <div style={{ fontWeight: '700', color: '#333', marginBottom: '0.25rem' }}>
                    {sessionType.emoji} {sessionType.label}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#666' }}>
                    {sessionsOfType.length} session(s)
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#666' }}>
                    {totalAssigned} pilote(s)
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