import React, { useState, useEffect } from 'react';
import { db } from '../../../config/firebase';
import { collection, addDoc, onSnapshot, query, orderBy, where, updateDoc, doc, getDocs, deleteDoc } from 'firebase/firestore';

// =====================================
// INTERFACES
// =====================================

interface PilotStanding {
  driverId: string;
  driverName: string;
  carNumber: number;
  timeTrialsPoints: number;
  timeTrialsPosition: number | null;
  qualifyingPoints: { [key: string]: number };
  qualifyingPositions: { [key: string]: number };
  totalPoints: number;
  finalPosition: number;
}

interface IntermedaireMeetingPoints {
  id?: string;
  meetingId: string;
  category: string;
  year: number;
  driverId: string;
  driverName: string;
  carNumber: number;
  finalPosition: number;
  points: number;
  createdAt: Date;
}

interface ChampionshipMeetingPoints {
  id?: string;
  meetingId: string;
  category: string;
  year: number;
  driverId: string;
  driverName: string;
  carNumber: number;
  qualifyingPoints: number;
  semifinalPoints: number;
  finalPoints: number;
  totalMeetingPoints: number;
  finalPosition: number;
  createdAt: Date;
}

// =====================================
// COMPOSANT PRINCIPAL
// =====================================

export default function MeetingStandingsManagement() {
  const [meetings, setMeetings] = useState<any[]>([]);
  const [races, setRaces] = useState<any[]>([]);
  const [timeTrialsPoints, setTimeTrialsPoints] = useState<any[]>([]);
  const [qualifyingPoints, setQualifyingPoints] = useState<any[]>([]);
  const [finalMeetingPoints, setFinalMeetingPoints] = useState<any[]>([]);
  const [semifinalPoints, setSemifinalPoints] = useState<any[]>([]);
  const [finalPoints, setFinalPoints] = useState<any[]>([]);
  const [championshipMeetingPoints, setChampionshipMeetingPoints] = useState<any[]>([]);
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
    });

    return () => unsubscribe();
  }, [selectedYear]);

  // Récupérer les pilotes engagés dans le meeting
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

  // Récupérer les sessions qualificatives du meeting/catégorie
  useEffect(() => {
    if (!selectedMeeting || !selectedCategory) {
      setRaces([]);
      return;
    }

    const q = query(
      collection(db, 'races'),
      where('meetingId', '==', selectedMeeting),
      where('category', '==', selectedCategory),
      where('type', 'in', ['timeTrials', 'qualifying'])
    );
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const racesData: any[] = [];
      querySnapshot.forEach((doc) => {
        racesData.push({ id: doc.id, ...doc.data() });
      });
      
      // Trier : essais chronos en premier, puis qualifs par ordre
      racesData.sort((a, b) => {
        if (a.type === 'timeTrials' && b.type !== 'timeTrials') return -1;
        if (a.type !== 'timeTrials' && b.type === 'timeTrials') return 1;
        return (a.order || 0) - (b.order || 0);
      });
      
      setRaces(racesData);
    });

    return () => unsubscribe();
  }, [selectedMeeting, selectedCategory]);

  // Récupérer tous les points nécessaires
  useEffect(() => {
    if (!selectedMeeting || !selectedCategory) {
      setTimeTrialsPoints([]);
      setQualifyingPoints([]);
      setFinalMeetingPoints([]);
      setSemifinalPoints([]);
      setFinalPoints([]);
      setChampionshipMeetingPoints([]);
      return;
    }

    // Points essais chronométrés
    const timeTrialsQuery = query(
      collection(db, 'timeTrialsPoints'),
      where('meetingId', '==', selectedMeeting),
      where('category', '==', selectedCategory)
    );
    const unsubscribeTimeTrials = onSnapshot(timeTrialsQuery, (querySnapshot) => {
      const pointsData: any[] = [];
      querySnapshot.forEach((doc) => {
        pointsData.push({ id: doc.id, ...doc.data() });
      });
      setTimeTrialsPoints(pointsData);
    });

    // Points qualificatives
    const qualifyingQuery = query(
      collection(db, 'qualifyingPoints'),
      where('meetingId', '==', selectedMeeting),
      where('category', '==', selectedCategory)
    );
    const unsubscribeQualifying = onSnapshot(qualifyingQuery, (querySnapshot) => {
      const pointsData: any[] = [];
      querySnapshot.forEach((doc) => {
        pointsData.push({ id: doc.id, ...doc.data() });
      });
      setQualifyingPoints(pointsData);
    });

    // Points finaux meeting (qualifs)
    const finalMeetingQuery = query(
      collection(db, 'finalMeetingPoints'),
      where('meetingId', '==', selectedMeeting),
      where('category', '==', selectedCategory),
      orderBy('finalPosition', 'asc')
    );
    const unsubscribeFinalMeeting = onSnapshot(finalMeetingQuery, (querySnapshot) => {
      const pointsData: any[] = [];
      querySnapshot.forEach((doc) => {
        pointsData.push({ id: doc.id, ...doc.data() });
      });
      setFinalMeetingPoints(pointsData);
    });

    // Points demi-finales
    const semifinalQuery = query(
      collection(db, 'semifinalPoints'),
      where('meetingId', '==', selectedMeeting),
      where('category', '==', selectedCategory)
    );
    const unsubscribeSemifinal = onSnapshot(semifinalQuery, (querySnapshot) => {
      const pointsData: any[] = [];
      querySnapshot.forEach((doc) => {
        pointsData.push({ id: doc.id, ...doc.data() });
      });
      setSemifinalPoints(pointsData);
    });

    // Points finales
    const finalQuery = query(
      collection(db, 'finalPoints'),
      where('meetingId', '==', selectedMeeting),
      where('category', '==', selectedCategory)
    );
    const unsubscribeFinal = onSnapshot(finalQuery, (querySnapshot) => {
      const pointsData: any[] = [];
      querySnapshot.forEach((doc) => {
        pointsData.push({ id: doc.id, ...doc.data() });
      });
      setFinalPoints(pointsData);
    });

    // Points championnat meeting
    const championshipQuery = query(
      collection(db, 'championshipMeetingPoints'),
      where('meetingId', '==', selectedMeeting),
      where('category', '==', selectedCategory),
      orderBy('totalMeetingPoints', 'desc')
    );
    const unsubscribeChampionship = onSnapshot(championshipQuery, (querySnapshot) => {
      const pointsData: any[] = [];
      querySnapshot.forEach((doc) => {
        pointsData.push({ id: doc.id, ...doc.data() });
      });
      setChampionshipMeetingPoints(pointsData);
    });

    return () => {
      unsubscribeTimeTrials();
      unsubscribeQualifying();
      unsubscribeFinalMeeting();
      unsubscribeSemifinal();
      unsubscribeFinal();
      unsubscribeChampionship();
    };
  }, [selectedMeeting, selectedCategory]);

  // =====================================
  // CALCUL DES CLASSEMENTS
  // =====================================

  const calculateIntermediateStandings = (upToRaceIndex: number): PilotStanding[] => {
    // Vérifications de sécurité
    if (engagedDrivers.length === 0) {
      return [];
    }

    const standings: { [key: string]: PilotStanding } = {};
    
    const qualifyingRaces = races.filter(race => race.type === 'qualifying').slice(0, upToRaceIndex + 1);
    
    // Initialiser TOUS les pilotes engagés
    engagedDrivers.forEach(driver => {
      standings[driver.id] = {
        driverId: driver.id,
        driverName: driver.name,
        carNumber: driver.carNumber,
        timeTrialsPoints: 0,
        timeTrialsPosition: null,
        qualifyingPoints: {},
        qualifyingPositions: {},
        totalPoints: 0,
        finalPosition: 0
      };
    });

    // Ajouter les points des essais chronométrés
    timeTrialsPoints.forEach(point => {
      if (standings[point.driverId]) {
        standings[point.driverId].timeTrialsPoints = point.points;
        standings[point.driverId].timeTrialsPosition = point.position;
      }
    });

    // Ajouter les points des manches qualificatives
    qualifyingPoints.forEach(point => {
      if (standings[point.driverId]) {
        const raceIndex = qualifyingRaces.findIndex(race => race.id === point.raceId);
        if (raceIndex !== -1 && raceIndex <= upToRaceIndex) {
          standings[point.driverId].qualifyingPoints[point.raceId] = point.points;
          standings[point.driverId].qualifyingPositions[point.raceId] = point.position;
        }
      }
    });

    // Calculer les points totaux
    Object.values(standings).forEach(pilot => {
      pilot.totalPoints = pilot.timeTrialsPoints + 
        Object.values(pilot.qualifyingPoints).reduce((sum, points) => sum + points, 0);
    });

    // Trier selon les règles de départage
    const sortedStandings = Object.values(standings).sort((a, b) => {
      // 1. Par points totaux (décroissant)
      if (a.totalPoints !== b.totalPoints) {
        return b.totalPoints - a.totalPoints;
      }

      // 2. Départage par les manches qualificatives (de la plus récente à la plus ancienne)
      for (let i = upToRaceIndex; i >= 0; i--) {
        const raceId = qualifyingRaces[i]?.id;
        if (raceId) {
          const pointsA = a.qualifyingPoints[raceId] || 0;
          const pointsB = b.qualifyingPoints[raceId] || 0;
          
          if (pointsA !== pointsB) {
            return pointsB - pointsA;
          }
        }
      }

      // 3. Départage par les essais chronométrés
      if (a.timeTrialsPoints !== b.timeTrialsPoints) {
        return b.timeTrialsPoints - a.timeTrialsPoints;
      }

      // 4. Si vraiment égalité parfaite, conserver l'ordre alphabétique
      return a.driverName.localeCompare(b.driverName);
    });

    // Attribuer les positions avec gestion des égalités
    let currentPosition = 1;
    for (let i = 0; i < sortedStandings.length; i++) {
      if (i > 0) {
        const current = sortedStandings[i];
        const previous = sortedStandings[i - 1];
        
        // Vérifier si égalité parfaite (même points sur tout)
        const isCompletelyEqual = 
          current.totalPoints === previous.totalPoints &&
          current.timeTrialsPoints === previous.timeTrialsPoints &&
          qualifyingRaces.every(race => 
            (current.qualifyingPoints[race.id] || 0) === (previous.qualifyingPoints[race.id] || 0)
          );

        if (!isCompletelyEqual) {
          currentPosition = i + 1;
        }
      }
      
      sortedStandings[i].finalPosition = currentPosition;
    }

    return sortedStandings;
  };

  // Calculer le classement final avec attribution des points meeting
  const calculateFinalStandings = (): PilotStanding[] => {
    const qualifyingRaces = races.filter(race => race.type === 'qualifying');
    if (qualifyingRaces.length === 0) {
      return [];
    }
    return calculateIntermediateStandings(qualifyingRaces.length - 1);
  };

  // Sauvegarder les points finaux du meeting
  const saveIntermedaireMeetingPoints = async () => {
    try {
      const intermedaireStandings = calculateFinalStandings();
      
      if (intermedaireStandings.length === 0) {
        alert('Aucun classement à sauvegarder !');
        return;
      }

      // Supprimer les anciens points
      const existingQuery = query(
        collection(db, 'finalMeetingPoints'),
        where('meetingId', '==', selectedMeeting),
        where('category', '==', selectedCategory)
      );
      
      const existingSnapshot = await getDocs(existingQuery);
      const deletePromises = existingSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      // Sauvegarder les nouveaux points
      const savePromises = intermedaireStandings.map(async (pilot) => {
        const meetingPoints = Math.max(0, 17 - pilot.finalPosition); // 16-15-14-13...0
        
        const intermedairePointsData: IntermedaireMeetingPoints = {
          meetingId: selectedMeeting,
          category: selectedCategory,
          year: selectedYear,
          driverId: pilot.driverId,
          driverName: pilot.driverName,
          carNumber: pilot.carNumber,
          finalPosition: pilot.finalPosition,
          points: meetingPoints,
          createdAt: new Date()
        };

        await addDoc(collection(db, 'finalMeetingPoints'), intermedairePointsData);
      });

      await Promise.all(savePromises);
      alert('✅ Points Intermédiaires du meeting sauvegardés !');
      
    } catch (error) {
      console.error('Erreur sauvegarde points Intermédiaires:', error);
      alert('❌ Erreur lors de la sauvegarde');
    }
  };

  // Sauvegarder les points championnat du meeting
  const saveChampionshipMeetingPoints = async () => {
    try {
      console.log('🏆 Calcul des points championnat du meeting...');

      // Utiliser TOUS les pilotes engagés
      const allEngagedDriversData = engagedDrivers;
      
      if (allEngagedDriversData.length === 0) {
        alert('❌ Aucun pilote engagé dans ce meeting/catégorie !\nAllez d\'abord dans "📝 Engagements" pour engager des pilotes.');
        return;
      }

      // Récupérer les points qualificatives finaux (s'ils existent)
      const qualifyingMeetingPoints = finalMeetingPoints;

      // Supprimer les anciens points championnat
      const existingQuery = query(
        collection(db, 'championshipMeetingPoints'),
        where('meetingId', '==', selectedMeeting),
        where('category', '==', selectedCategory)
      );
      
      const existingSnapshot = await getDocs(existingQuery);
      const deletePromises = existingSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      // Calculer et sauvegarder pour TOUS les pilotes engagés
      const savePromises = allEngagedDriversData.map(async (driver) => {
        // Points des qualifications (s'ils ont été sauvegardés)
        const qualifyingPoint = qualifyingMeetingPoints.find(p => p.driverId === driver.id);
        const qualifyingPts = qualifyingPoint ? qualifyingPoint.points : 0;

        // Points des demi-finales pour ce pilote
        const semifinalPoint = semifinalPoints.find(p => p.driverId === driver.id);
        const semifinalPts = semifinalPoint ? semifinalPoint.points : 0;

        // Points de la finale pour ce pilote
        const finalPoint = finalPoints.find(p => p.driverId === driver.id);
        const finalPts = finalPoint ? finalPoint.points : 0;

        // Total des points du meeting pour le championnat
        const totalMeetingPoints = qualifyingPts + semifinalPts + finalPts;

        // Position finale (basée sur les qualifications ou ordre alphabétique si pas de points)
        const finalPos = qualifyingPoint ? qualifyingPoint.finalPosition : 999;

        const championshipPointsData: ChampionshipMeetingPoints = {
          meetingId: selectedMeeting,
          category: selectedCategory,
          year: selectedYear,
          driverId: driver.id,
          driverName: driver.name,
          carNumber: driver.carNumber,
          qualifyingPoints: qualifyingPts,
          semifinalPoints: semifinalPts,
          finalPoints: finalPts,
          totalMeetingPoints: totalMeetingPoints,
          finalPosition: finalPos,
          createdAt: new Date()
        };

        await addDoc(collection(db, 'championshipMeetingPoints'), championshipPointsData);
      });

      await Promise.all(savePromises);
      
      alert(`✅ Points championnat sauvegardés !\n${allEngagedDriversData.length} pilote(s) engagé(s) • Catégorie: ${selectedCategory}\n\nTous les pilotes du meeting sont inclus, même ceux sans points.`);
      
    } catch (error) {
      console.error('❌ Erreur sauvegarde points championnat:', error);
      alert('❌ Erreur lors de la sauvegarde des points championnat');
    }
  };

  const selectedMeetingData = meetings.find(m => m.id === selectedMeeting);
  const availableCategories = selectedMeetingData?.categories || [];
  const qualifyingRaces = races.filter(race => race.type === 'qualifying');

  return (
    <div style={{ padding: '2rem' }}>
      <h2 style={{ color: '#1e3c72', marginBottom: '1.5rem' }}>
        📊 Classements Meeting
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
                  {meeting.name} - {meeting.date ? new Date(meeting.date).toLocaleDateString('fr-FR') : 'Date non définie'}
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
              {qualifyingRaces.length} manche(s) qualificative(s) • {engagedDrivers.length} pilote(s) engagé(s) • Mise à jour temps réel
            </small>
          </div>
        )}
      </div>

      {/* Classements */}
      {selectedMeeting && selectedCategory && qualifyingRaces.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Essais Chronométrés */}
          <StandingDisplay 
            title="⏱️ Essais Chronométrés"
            standings={timeTrialsPoints
              .map(point => ({
                driverId: point.driverId,
                driverName: point.driverName,
                carNumber: point.carNumber,
                position: point.position,
                points: point.points,
                totalPoints: point.points
              }))
              .sort((a, b) => {
                // Trier par points décroissants, puis par position croissante
                if (a.points !== b.points) {
                  return b.points - a.points;
                }
                return a.position - b.position;
              })
            }
            showTotal={false}
            color="#28a745"
          />

          {/* Classements Intermédiaires */}
          {qualifyingRaces.map((race, index) => (
            <StandingDisplay 
              key={race.id}
              title={`📈 Intermédiaire ${index + 1} (après ${race.name})`}
              standings={calculateIntermediateStandings(index)}
              showTotal={true}
              color="#667eea"
              showBreakdown={true}
              qualifyingRaces={qualifyingRaces.slice(0, index + 1)}
            />
          ))}

          {/* Classement Final */}
          {qualifyingRaces.length > 0 && (
            <>
              <StandingDisplay 
                title="🏅 Classement Final Meeting"
                standings={calculateFinalStandings()}
                showTotal={true}
                color="#8e24aa"
                showBreakdown={true}
                qualifyingRaces={qualifyingRaces}
                showFinalPoints={true}
              />

              {/* Bouton sauvegarde points finaux */}
              <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                <button
                  onClick={saveIntermedaireMeetingPoints}
                  style={{
                    padding: '1rem 2rem',
                    background: '#8e24aa',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '1.1rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(142, 36, 170, 0.3)'
                  }}
                >
                  💾 Sauvegarder Points Finaux Meeting
                </button>
              </div>

              {/* Affichage des points finaux sauvegardés */}
              {finalMeetingPoints.length > 0 && (
                <div style={{ 
                  background: 'white', 
                  borderRadius: '8px', 
                  padding: '1.5rem',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                  border: '2px solid #28a745'
                }}>
                  <h3 style={{ color: '#28a745', marginTop: 0, marginBottom: '1rem' }}>
                    ✅ Points Finaux Sauvegardés - {selectedCategory}
                  </h3>
                  
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: '#28a745', color: 'white' }}>
                          <th style={{ padding: '0.75rem', textAlign: 'center' }}>Position</th>
                          <th style={{ padding: '0.75rem', textAlign: 'left' }}>Pilote</th>
                          <th style={{ padding: '0.75rem', textAlign: 'center' }}>Points Meeting</th>
                        </tr>
                      </thead>
                      <tbody>
                        {finalMeetingPoints.map((point) => (
                          <tr key={point.id} style={{ borderBottom: '1px solid #ddd' }}>
                            <td style={{ 
                              padding: '0.75rem', 
                              textAlign: 'center',
                              fontWeight: 'bold',
                              color: point.finalPosition <= 3 ? '#ffd700' : '#333'
                            }}>
                              {point.finalPosition}
                            </td>
                            <td style={{ padding: '0.75rem' }}>
                              <div style={{ fontWeight: '500', color: '#333' }}>
                                #{point.carNumber} {point.driverName}
                              </div>
                            </td>
                            <td style={{ 
                              padding: '0.75rem', 
                              textAlign: 'center',
                              fontWeight: 'bold',
                              fontSize: '1.2rem',
                              color: '#28a745'
                            }}>
                              {point.points} pts
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* RÉCAPITULATIF POINTS DEMI-FINALES */}
          {semifinalPoints.length > 0 && (
            <div style={{ 
              background: 'white', 
              borderRadius: '8px', 
              padding: '1.5rem',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              border: '2px solid #8e24aa'
            }}>
              <h3 style={{ 
                color: '#8e24aa', 
                marginTop: 0, 
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                🥈 Récapitulatif Points Demi-finales - {selectedCategory}
              </h3>
              
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#8e24aa', color: 'white' }}>
                      <th style={{ padding: '0.75rem', textAlign: 'left' }}>Pilote</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center' }}>Demi-finale</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center' }}>Position</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center' }}>Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {semifinalPoints
                      .sort((a, b) => b.points - a.points || a.position - b.position)
                      .map((point) => (
                        <tr key={point.id} style={{ borderBottom: '1px solid #ddd' }}>
                          <td style={{ padding: '0.75rem' }}>
                            <div style={{ fontWeight: '500', color: '#333' }}>
                              #{point.carNumber} {point.driverName}
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem', textAlign: 'center', color: '#666' }}>
                            {point.raceName}
                          </td>
                          <td style={{ 
                            padding: '0.75rem', 
                            textAlign: 'center',
                            fontWeight: 'bold',
                            color: point.position <= 3 ? '#ffd700' : '#333'
                          }}>
                            {point.position}
                          </td>
                          <td style={{ 
                            padding: '0.75rem', 
                            textAlign: 'center',
                            fontWeight: 'bold',
                            fontSize: '1.2rem',
                            color: point.points > 0 ? '#8e24aa' : '#dc3545'
                          }}>
                            {point.points} pts
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* RÉCAPITULATIF POINTS FINALE */}
          {finalPoints.length > 0 && (
            <div style={{ 
              background: 'white', 
              borderRadius: '8px', 
              padding: '1.5rem',
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              border: '2px solid #ffd700'
            }}>
              <h3 style={{ 
                color: '#ffd700', 
                marginTop: 0, 
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                🏆 Récapitulatif Points Finale - {selectedCategory}
              </h3>
              
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#ffd700', color: 'black' }}>
                      <th style={{ padding: '0.75rem', textAlign: 'left' }}>Pilote</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center' }}>Position</th>
                      <th style={{ padding: '0.75rem', textAlign: 'center' }}>Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {finalPoints
                      .sort((a, b) => a.position - b.position)
                      .map((point) => (
                        <tr key={point.id} style={{ borderBottom: '1px solid #ddd' }}>
                          <td style={{ padding: '0.75rem' }}>
                            <div style={{ fontWeight: '500', color: '#333' }}>
                              #{point.carNumber} {point.driverName}
                            </div>
                          </td>
                          <td style={{ 
                            padding: '0.75rem', 
                            textAlign: 'center',
                            fontWeight: 'bold',
                            color: point.position <= 3 ? '#ffd700' : '#333'
                          }}>
                            {point.position}
                          </td>
                          <td style={{ 
                            padding: '0.75rem', 
                            textAlign: 'center',
                            fontWeight: 'bold',
                            fontSize: '1.2rem',
                            color: point.points > 0 ? '#ffd700' : '#dc3545'
                          }}>
                            {point.points} pts
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* BOUTON GÉNÉRATION POINTS CHAMPIONNAT */}
          {engagedDrivers.length > 0 && (
            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
              <button
                onClick={saveChampionshipMeetingPoints}
                style={{
                  padding: '1rem 2rem',
                  background: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1.1rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(231, 76, 60, 0.3)'
                }}
              >
                🏆 Générer Points Championnat Meeting
              </button>
              <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                Combine qualifications + demi-finales + finale pour le championnat
                <br />
                <strong>Inclut TOUS les {engagedDrivers.length} pilotes engagés au meeting</strong>
              </div>
            </div>
          )}

          {/* RÉCAPITULATIF FINAL CHAMPIONNAT */}
            {/* RÉCAPITULATIF FINAL CHAMPIONNAT */}
            {championshipMeetingPoints.length > 0 && (
            <div style={{ 
                background: 'white', 
                borderRadius: '8px', 
                padding: '1.5rem',
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
                border: '3px solid #e74c3c'
            }}>
                <h3 style={{ 
                color: '#e74c3c', 
                marginTop: 0, 
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
                }}>
                🏆 POINTS CHAMPIONNAT - {selectedCategory}
                <span style={{ 
                    fontSize: '0.8rem', 
                    background: '#e74c3c', 
                    color: 'white', 
                    padding: '0.25rem 0.5rem', 
                    borderRadius: '12px' 
                }}>
                    MEETING {selectedMeetingData?.name}
                </span>
                </h3>
                
                <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                    <tr style={{ background: '#e74c3c', color: 'white' }}>
                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>Pos.</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left' }}>Pilote</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>Pts Intermédiaires</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>Pts Demi</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>Pts Finale</th>
                        <th style={{ padding: '0.75rem', textAlign: 'center' }}>TOTAL MEETING</th>
                    </tr>
                    </thead>
                    <tbody>
                    {championshipMeetingPoints
                        .sort((a, b) => b.totalMeetingPoints - a.totalMeetingPoints)
                        .map((point, index) => (
                        <tr key={point.id} style={{ 
                            borderBottom: '1px solid #ddd',
                            backgroundColor: index < 3 ? '#fff5f5' : 'white'
                        }}>
                            <td style={{ 
                            padding: '0.75rem', 
                            textAlign: 'center',
                            fontWeight: 'bold',
                            fontSize: '1.2rem',
                            color: index === 0 ? '#ffd700' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : '#333'
                            }}>
                            {index + 1}
                            </td>
                            <td style={{ padding: '0.75rem' }}>
                            <div style={{ fontWeight: '500', color: '#333' }}>
                                #{point.carNumber} {point.driverName}
                            </div>
                            </td>
                            <td style={{ 
                            padding: '0.75rem', 
                            textAlign: 'center',
                            fontWeight: 'bold',
                            color: point.qualifyingPoints > 0 ? '#17a2b8' : '#ccc'
                            }}>
                            {point.qualifyingPoints > 0 ? point.qualifyingPoints : '-'}
                            </td>
                            <td style={{ 
                            padding: '0.75rem', 
                            textAlign: 'center',
                            fontWeight: 'bold',
                            color: point.semifinalPoints > 0 ? '#8e24aa' : '#ccc'
                            }}>
                            {point.semifinalPoints > 0 ? point.semifinalPoints : '-'}
                            </td>
                            <td style={{ 
                            padding: '0.75rem', 
                            textAlign: 'center',
                            fontWeight: 'bold',
                            color: point.finalPoints > 0 ? '#ffd700' : '#ccc'
                            }}>
                            {point.finalPoints > 0 ? point.finalPoints : '-'}
                            </td>
                            <td style={{ 
                            padding: '0.75rem', 
                            textAlign: 'center',
                            fontWeight: 'bold',
                            fontSize: '1.4rem',
                            color: index === 0 ? '#ffd700' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : '#e74c3c',
                            background: index < 3 ? 'rgba(231, 76, 60, 0.1)' : 'transparent'
                            }}>
                            {point.totalMeetingPoints}
                            </td>
                        </tr>
                        ))}
                    </tbody>
                </table>
                </div>

                <div style={{ 
                marginTop: '1rem', 
                fontSize: '0.9rem', 
                color: '#666',
                textAlign: 'center',
                background: '#f8f9fa',
                padding: '0.75rem',
                borderRadius: '4px'
                }}>
                💡 <strong>Ces points seront utilisés pour le classement général du championnat</strong>
                <br />
                <small>Points intermédiaires = classement qualifications sauvegardé • Points demi/finale = bonus phases finales</small>
                </div>
            </div>
            )}

        </div>
      )}

      {/* Message si pas de données */}
      {selectedMeeting && selectedCategory && qualifyingRaces.length === 0 && (
        <div style={{ 
          background: '#f8f9fa', 
          borderRadius: '8px', 
          padding: '2rem',
          textAlign: 'center', 
          color: '#666' 
        }}>
          📊 Aucune manche qualificative trouvée pour ce meeting/catégorie
          <br />
          <small>Allez dans "⏱️ Chronométrage" pour saisir les temps des manches</small>
        </div>
      )}
    </div>
  );
}

// =====================================
// COMPOSANT D'AFFICHAGE DES CLASSEMENTS
// =====================================

interface StandingDisplayProps {
  title: string;
  standings: any[];
  showTotal: boolean;
  color: string;
  showBreakdown?: boolean;
  qualifyingRaces?: any[];
  showFinalPoints?: boolean;
}

const StandingDisplay: React.FC<StandingDisplayProps> = ({
  title,
  standings,
  showTotal,
  color,
  showBreakdown = false,
  qualifyingRaces = [],
  showFinalPoints = false
}) => {
  if (standings.length === 0) {
    return (
      <div style={{ 
        background: '#f8f9fa', 
        borderRadius: '8px', 
        padding: '2rem',
        textAlign: 'center', 
        color: '#666' 
      }}>
        📊 {title} - Aucune donnée disponible
      </div>
    );
  }

  return (
    <div style={{ 
      background: 'white', 
      borderRadius: '8px', 
      padding: '1.5rem',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      border: `2px solid ${color}`
    }}>
      <h3 style={{ 
        color: color, 
        marginTop: 0, 
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        {title}
        <span style={{ 
          fontSize: '0.8rem', 
          background: color, 
          color: 'white', 
          padding: '0.25rem 0.5rem', 
          borderRadius: '12px' 
        }}>
          🔄 Temps réel
        </span>
      </h3>
      
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: color, color: 'white' }}>
              <th style={{ padding: '0.75rem', textAlign: 'center' }}>Pos.</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Pilote</th>
              {showBreakdown && <th style={{ padding: '0.75rem', textAlign: 'center' }}>Essais</th>}
              {showBreakdown && qualifyingRaces.map((race, index) => (
                <th key={race.id} style={{ padding: '0.75rem', textAlign: 'center' }}>
                  Q{index + 1}
                </th>
              ))}
              {showTotal && <th style={{ padding: '0.75rem', textAlign: 'center' }}>Total</th>}
              {showFinalPoints && <th style={{ padding: '0.75rem', textAlign: 'center' }}>Pts Meeting</th>}
              {!showTotal && <th style={{ padding: '0.75rem', textAlign: 'center' }}>Points</th>}
            </tr>
          </thead>
          <tbody>
            {standings.map((pilot, index) => (
              <tr key={pilot.driverId} style={{ 
                borderBottom: '1px solid #ddd',
                backgroundColor: index < 3 ? '#f0fff0' : 'white'
              }}>
                <td style={{ 
                  padding: '0.75rem', 
                  textAlign: 'center',
                  fontWeight: 'bold',
                  color: index === 0 ? '#ffd700' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : '#333'
                }}>
                  {pilot.finalPosition || pilot.position}
                </td>
                <td style={{ padding: '0.75rem' }}>
                  <div style={{ fontWeight: '500', color: '#333' }}>
                    #{pilot.carNumber} {pilot.driverName}
                  </div>
                </td>
                {showBreakdown && (
                  <td style={{ 
                    padding: '0.75rem', 
                    textAlign: 'center',
                    fontWeight: 'bold',
                    color: pilot.timeTrialsPoints > 0 ? '#28a745' : '#6c757d'
                  }}>
                    {pilot.timeTrialsPoints || 0}
                  </td>
                )}
                {showBreakdown && qualifyingRaces.map((race) => (
                  <td key={race.id} style={{ 
                    padding: '0.75rem', 
                    textAlign: 'center',
                    fontWeight: 'bold',
                    color: (pilot.qualifyingPoints?.[race.id] || 0) > 0 ? '#667eea' : '#6c757d'
                  }}>
                    {pilot.qualifyingPoints?.[race.id] || 0}
                  </td>
                ))}
                {showTotal && (
                  <td style={{ 
                    padding: '0.75rem', 
                    textAlign: 'center',
                    fontWeight: 'bold',
                    fontSize: '1.2rem',
                    color: color
                  }}>
                    {pilot.totalPoints}
                  </td>
                )}
                {showFinalPoints && (
                  <td style={{ 
                    padding: '0.75rem', 
                    textAlign: 'center',
                    fontWeight: 'bold',
                    fontSize: '1.2rem',
                    color: '#8e24aa'
                  }}>
                    {Math.max(0, 17 - (pilot.finalPosition || 1))}
                  </td>
                )}
                {!showTotal && (
                  <td style={{ 
                    padding: '0.75rem', 
                    textAlign: 'center',
                    fontWeight: 'bold',
                    fontSize: '1.2rem',
                    color: color
                  }}>
                    {pilot.points || pilot.totalPoints}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};