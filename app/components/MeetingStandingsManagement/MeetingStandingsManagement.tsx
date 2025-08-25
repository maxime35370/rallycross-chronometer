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
    {/* HEADER CLASSEMENTS MODERNE */}
    <div className="page-header page-header-standings">
      <h2 className="page-title">
        <span className="page-title-icon">📊</span>
        Classements Meeting
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
                {meeting.name} - {meeting.date ? new Date(meeting.date).toLocaleDateString('fr-FR') : 'Date non définie'}
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
                {qualifyingRaces.length}
              </div>
              <div className="stat-label">Manches</div>
            </div>

            <div className="stat-card stat-card-secondary">
              <div className="stat-number stat-number-secondary">
                {engagedDrivers.length}
              </div>
              <div className="stat-label">Pilotes</div>
            </div>
          </div>
        )}
      </div>

      {/* CONTEXTE INFORMATIF */}
      {selectedMeeting && selectedCategory && qualifyingRaces.length > 0 && (
        <div className="context-info context-success">
          <strong>📋 Contexte :</strong> {selectedMeetingData?.name} • {selectedCategory} {selectedYear}
          <div className="context-info-text">
            {qualifyingRaces.length} manche(s) qualificative(s) • {engagedDrivers.length} pilote(s) engagé(s) • Mise à jour temps réel
          </div>
        </div>
      )}
    </div>

      {/* Classements */}
      {selectedMeeting && selectedCategory && qualifyingRaces.length > 0 && (
        <div className="content-section">
          
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
              <div className="action-buttons-container">
                <button
                  onClick={saveIntermedaireMeetingPoints}
                  className="action-btn action-btn-primary"
                >
                  <span>💾</span>
                  Sauvegarder Points Finaux Meeting
                </button>
              </div>

              {/* Affichage des points finaux sauvegardés */}
              {finalMeetingPoints.length > 0 && (
                <div className="points-table-container" style={{ border: '2px solid #28a745' }}>
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '4px',
                    background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                    borderRadius: '20px 20px 0 0'
                  }} />

                  <h3 className="points-table-header">
                    <span style={{ fontSize: '1.8rem' }}>✅</span>
                    Points Finaux Sauvegardés - {selectedCategory}
                    <span className="points-table-badge" style={{ background: '#28a745' }}>
                      SAUVEGARDÉS
                    </span>
                  </h3>
                  
                  <table className="points-table-modern">
                    <thead>
                      <tr>
                        <th>Position</th>
                        <th>Pilote</th>
                        <th>Points Meeting</th>
                      </tr>
                    </thead>
                    <tbody>
                      {finalMeetingPoints.map((point) => (
                        <tr key={point.id} className={
                          point.finalPosition === 1 ? 'podium-1' : 
                          point.finalPosition === 2 ? 'podium-2' : 
                          point.finalPosition === 3 ? 'podium-3' : ''
                        }>
                          <td>
                            <span className={`position-cell ${
                              point.finalPosition <= 3 ? 'position-' + point.finalPosition : 'position-other'
                            }`}>
                              {point.finalPosition}
                            </span>
                          </td>
                          <td>
                            <div className="driver-info">
                              <span className="driver-number">
                                #{point.carNumber}
                              </span>
                              <span className="driver-name">
                                {point.driverName}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className="points-cell points-positive" style={{ fontSize: '1.3rem' }}>
                              {point.points} pts
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  
                  <div className="table-info-footer">
                    ✅ Points finaux du meeting sauvegardés et prêts pour le championnat
                  </div>
                </div>
              )}
            </>
          )}

          {/* RÉCAPITULATIF POINTS DEMI-FINALES */}
          {semifinalPoints.length > 0 && (
            <div className="points-table-container points-table-semifinal">
              <h3 className="points-table-header">
                <span style={{ fontSize: '1.8rem' }}>🥈</span>
                Récapitulatif Points Demi-finales - {selectedCategory}
              </h3>
              
              <table className="points-table-modern">
                <thead>
                  <tr>
                    <th>Pilote</th>
                    <th>Demi-finale</th>
                    <th>Position</th>
                    <th>Points</th>
                  </tr>
                </thead>
                <tbody>
                  {semifinalPoints
                    .sort((a, b) => b.points - a.points || a.position - b.position)
                    .map((point) => (
                      <tr key={point.id} className={
                        point.points >= 8 ? 'podium-1' : 
                        point.points >= 5 ? 'podium-2' : 
                        point.points > 0 ? 'podium-3' : 'no-points'
                      }>
                        <td>
                          <div className="driver-info">
                            <span className="driver-number">
                              #{point.carNumber}
                            </span>
                            <span className="driver-name">
                              {point.driverName}
                            </span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', color: '#666' }}>
                          {point.raceName}
                        </td>
                        <td>
                          <span className={`position-cell ${
                            point.position <= 3 ? 'position-' + point.position : 'position-other'
                          }`}>
                            {point.position}
                          </span>
                        </td>
                        <td>
                          <span className={`points-cell ${point.points > 0 ? 'points-positive' : 'points-zero'}`}>
                            {point.points} pts
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              
              <div className="table-info-footer">
                🥈 Points des deux demi-finales combinées pour la qualification en finale
              </div>
            </div>
          )}

          {/* RÉCAPITULATIF POINTS FINALE */}
          {finalPoints.length > 0 && (
            <div className="points-table-container points-table-final">
              <h3 className="points-table-header">
                <span style={{ fontSize: '1.8rem' }}>🏆</span>
                Récapitulatif Points Finale - {selectedCategory}
              </h3>
              
              <table className="points-table-modern">
                <thead>
                  <tr>
                    <th>Pilote</th>
                    <th>Position</th>
                    <th>Points</th>
                  </tr>
                </thead>
                <tbody>
                  {finalPoints
                    .sort((a, b) => a.position - b.position)
                    .map((point) => (
                      <tr key={point.id} className={
                        point.position === 1 ? 'podium-1' : 
                        point.position === 2 ? 'podium-2' : 
                        point.position === 3 ? 'podium-3' : 
                        point.points > 0 ? '' : 'no-points'
                      }>
                        <td>
                          <div className="driver-info">
                            <span className="driver-number">
                              #{point.carNumber}
                            </span>
                            <span className="driver-name">
                              {point.driverName}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className={`position-cell ${
                            point.position <= 3 ? 'position-' + point.position : 'position-other'
                          }`}>
                            {point.position}
                          </span>
                        </td>
                        <td>
                          <span className={`points-cell ${point.points > 0 ? 'points-positive' : 'points-zero'}`}>
                            {point.points} pts
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              
              <div className="table-info-footer">
                🏆 Points de la finale officielle du meeting
              </div>
            </div>
          )}

          {/* BOUTON GÉNÉRATION POINTS CHAMPIONNAT */}
          {engagedDrivers.length > 0 && (
            <div className="action-buttons-container">
              <button
                onClick={saveChampionshipMeetingPoints}
                className="action-btn action-btn-secondary"
              >
                <span>🏆</span>
                Générer Points Championnat Meeting
              </button>
              
              <div className="action-btn-info">
                Combine qualifications + demi-finales + finale pour le championnat
                <br />
                <strong>Inclut TOUS les {engagedDrivers.length} pilotes engagés au meeting</strong>
              </div>
            </div>
          )}

          {/* RÉCAPITULATIF FINAL CHAMPIONNAT */}
          {championshipMeetingPoints.length > 0 && (
            <div className="points-table-container" style={{ border: '3px solid #e74c3c' }}>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)',
                borderRadius: '20px 20px 0 0'
              }} />
              
              <h3 className="points-table-header">
                <span style={{ fontSize: '1.8rem' }}>🏆</span>
                POINTS CHAMPIONNAT - {selectedCategory}
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
              
              <table className="points-table-modern">
                <thead>
                  <tr>
                    <th>Pos.</th>
                    <th>Pilote</th>
                    <th>Pts Intermédiaires</th>
                    <th>Pts Demi</th>
                    <th>Pts Finale</th>
                    <th style={{ background: '#c0392b' }}>TOTAL MEETING</th>
                  </tr>
                </thead>
                <tbody>
                  {championshipMeetingPoints
                    .sort((a, b) => b.totalMeetingPoints - a.totalMeetingPoints)
                    .map((point, index) => (
                      <tr key={point.id} className={
                        index === 0 ? 'podium-1' : 
                        index === 1 ? 'podium-2' : 
                        index === 2 ? 'podium-3' : ''
                      }>
                        <td>
                          <span className={`position-cell ${
                            index === 0 ? 'position-1' : 
                            index === 1 ? 'position-2' : 
                            index === 2 ? 'position-3' : 'position-other'
                          }`} style={{ fontSize: '1.3rem' }}>
                            {index + 1}
                          </span>
                        </td>
                        <td>
                          <div className="driver-info">
                            <span className="driver-number">
                              #{point.carNumber}
                            </span>
                            <span className="driver-name">
                              {point.driverName}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className={`points-cell ${point.qualifyingPoints > 0 ? 'points-positive' : 'points-zero'}`}>
                            {point.qualifyingPoints > 0 ? point.qualifyingPoints : '-'}
                          </span>
                        </td>
                        <td>
                          <span className={`points-cell ${point.semifinalPoints > 0 ? 'points-positive' : 'points-zero'}`}>
                            {point.semifinalPoints > 0 ? point.semifinalPoints : '-'}
                          </span>
                        </td>
                        <td>
                          <span className={`points-cell ${point.finalPoints > 0 ? 'points-positive' : 'points-zero'}`}>
                            {point.finalPoints > 0 ? point.finalPoints : '-'}
                          </span>
                        </td>
                        <td style={{ 
                          background: index < 3 ? 'rgba(231, 76, 60, 0.1)' : 'transparent'
                        }}>
                          <span className="points-cell" style={{ 
                            fontSize: '1.4rem',
                            fontWeight: '800',
                            color: index < 3 ? '#e74c3c' : '#333'
                          }}>
                            {point.totalMeetingPoints}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>

              <div className="table-info-footer">
                💡 Ces points seront utilisés pour le classement général du championnat
                <br />
                <small>Points intermédiaires = classement qualifications • Points demi/finale = bonus phases finales</small>
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
      <div className="empty-state">
        <span className="empty-state-icon">📊</span>
        <div className="empty-state-title">{title} - Aucune donnée disponible</div>
      </div>
    );
  }

  return (
    <div className="points-table-container" style={{ position: 'relative', marginBottom: '2rem' }}>
      {/* Barre de couleur dynamique */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '4px',
        background: color,
        borderRadius: '20px 20px 0 0'
      }} />

      <h3 className="points-table-header">
        <span style={{ fontSize: '1.8rem' }}>
          {title.includes('Essais') ? '⏱️' : 
           title.includes('Final') ? '🏅' : 
           title.includes('Intermédiaire') ? '📈' : '📊'}
        </span>
        {title}
        <span className="points-table-badge">
          🔄 Temps réel
        </span>
      </h3>
      
      <table className="points-table-modern">
        <thead>
          <tr>
            <th>Pos.</th>
            <th>Pilote</th>
            {showBreakdown && <th>Essais</th>}
            {showBreakdown && qualifyingRaces.map((race, index) => (
              <th key={race.id}>
                Q{index + 1}
              </th>
            ))}
            {showTotal && <th>Total</th>}
            {showFinalPoints && <th>Pts Meeting</th>}
            {!showTotal && <th>Points</th>}
          </tr>
        </thead>
        <tbody>
          {standings.map((pilot, index) => (
            <tr key={pilot.driverId} className={
              index < 3 ? (index === 0 ? 'podium-1' : index === 1 ? 'podium-2' : 'podium-3') : ''
            }>
              <td>
                <span className={`position-cell ${
                  index === 0 ? 'position-1' : 
                  index === 1 ? 'position-2' : 
                  index === 2 ? 'position-3' : 'position-other'
                }`}>
                  {pilot.finalPosition || pilot.position}
                </span>
              </td>
              <td>
                <div className="driver-info">
                  <span className="driver-number">
                    #{pilot.carNumber}
                  </span>
                  <span className="driver-name">
                    {pilot.driverName}
                  </span>
                </div>
              </td>
              {showBreakdown && (
                <td>
                  <span className={`points-cell ${pilot.timeTrialsPoints > 0 ? 'points-positive' : 'points-zero'}`}>
                    {pilot.timeTrialsPoints || 0}
                  </span>
                </td>
              )}
              {showBreakdown && qualifyingRaces.map((race) => (
                <td key={race.id}>
                  <span className={`points-cell ${(pilot.qualifyingPoints?.[race.id] || 0) > 0 ? 'points-positive' : 'points-zero'}`}>
                    {pilot.qualifyingPoints?.[race.id] || 0}
                  </span>
                </td>
              ))}
              {showTotal && (
                <td>
                  <span className="points-cell points-positive" style={{ 
                    fontSize: '1.3rem',
                    color: color.includes('gradient') ? '#1e3c72' : color
                  }}>
                    {pilot.totalPoints}
                  </span>
                </td>
              )}
              {showFinalPoints && (
                <td>
                  <span className="points-cell" style={{ fontSize: '1.2rem', color: '#8e24aa' }}>
                    {Math.max(0, 17 - (pilot.finalPosition || 1))}
                  </span>
                </td>
              )}
              {!showTotal && (
                <td>
                  <span className="points-cell points-positive">
                    {pilot.points || pilot.totalPoints}
                  </span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      
      <div className="table-info-footer">
        📊 <strong>Classement calculé en temps réel</strong> selon les résultats du chronométrage
        <br />
        <small style={{ color: color.includes('gradient') ? '#666' : color }}>
          ⚡ Mise à jour automatique après chaque validation de temps
        </small>
      </div>
    </div>
  );
};