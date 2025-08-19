import React, { useState, useEffect } from 'react';
import { db } from '../../../config/firebase';
import { collection, onSnapshot, query, where, orderBy, getDocs } from 'firebase/firestore';

// =====================================
// INTERFACES
// =====================================

interface ChampionshipDriver {
  driverId: string;
  driverName: string;
  carNumber: number;
  meetingPoints: { [meetingId: string]: number }; // meetingId -> points
  meetingNames: { [meetingId: string]: string }; // meetingId -> meeting name
  totalPoints: number;
  meetingsParticipated: number;
  position: number;
}

interface MeetingInfo {
  id: string;
  name: string;
  date: string;
  location: string;
}

// =====================================
// COMPOSANT PRINCIPAL
// =====================================

export default function ChampionshipStandings() {
  const [meetings, setMeetings] = useState<MeetingInfo[]>([]);
  const [championshipPoints, setChampionshipPoints] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [championshipStandings, setChampionshipStandings] = useState<ChampionshipDriver[]>([]);
  
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedCategory, setSelectedCategory] = useState<string>('Supercar');

  const CATEGORIES = [
    'Supercar',
    'Super1600', 
    'Juniors',
    'Féminines',
    'D3',
    'D4'
  ];

  // Récupérer les meetings de la saison
  useEffect(() => {
    if (!selectedYear) return;

    const q = query(
      collection(db, 'meetings'), 
      where('year', '==', selectedYear),
      orderBy('date', 'asc')
    );
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const meetingsData: MeetingInfo[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        meetingsData.push({ 
          id: doc.id, 
          name: data.name,
          date: data.date,
          location: data.location
        });
      });
      setMeetings(meetingsData);
    });

    return () => unsubscribe();
  }, [selectedYear]);

  // Récupérer tous les points championnat de la saison/catégorie
  useEffect(() => {
    if (!selectedYear || !selectedCategory) {
      setChampionshipPoints([]);
      return;
    }

    const q = query(
      collection(db, 'championshipMeetingPoints'),
      where('year', '==', selectedYear),
      where('category', '==', selectedCategory)
    );
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const pointsData: any[] = [];
      querySnapshot.forEach((doc) => {
        pointsData.push({ id: doc.id, ...doc.data() });
      });
      setChampionshipPoints(pointsData);
    });

    return () => unsubscribe();
  }, [selectedYear, selectedCategory]);

  // Récupérer tous les pilotes de la catégorie/année
  useEffect(() => {
    if (!selectedYear || !selectedCategory) {
      setDrivers([]);
      return;
    }

    const fetchDrivers = async () => {
      try {
        const q = query(
          collection(db, 'drivers'),
          where('year', '==', selectedYear),
          where('category', '==', selectedCategory)
        );
        
        const snapshot = await getDocs(q);
        const driversData: any[] = [];
        
        snapshot.forEach((doc) => {
          driversData.push({ id: doc.id, ...doc.data() });
        });
        
        setDrivers(driversData);
      } catch (error) {
        console.error('Erreur récupération pilotes:', error);
        setDrivers([]);
      }
    };

    fetchDrivers();
  }, [selectedYear, selectedCategory]);

  // Calculer le classement championnat
  useEffect(() => {
    if (championshipPoints.length === 0 || drivers.length === 0) {
      setChampionshipStandings([]);
      return;
    }

    const standings: { [key: string]: ChampionshipDriver } = {};

    // Initialiser tous les pilotes de la catégorie
    drivers.forEach(driver => {
      standings[driver.id] = {
        driverId: driver.id,
        driverName: driver.name,
        carNumber: driver.carNumber,
        meetingPoints: {},
        meetingNames: {},
        totalPoints: 0,
        meetingsParticipated: 0,
        position: 0
      };
    });

    // Ajouter les points des meetings
    championshipPoints.forEach(point => {
      if (standings[point.driverId]) {
        standings[point.driverId].meetingPoints[point.meetingId] = point.totalMeetingPoints;
        
        // Trouver le nom du meeting
        const meeting = meetings.find(m => m.id === point.meetingId);
        standings[point.driverId].meetingNames[point.meetingId] = meeting ? meeting.name : 'Meeting inconnu';
        
        standings[point.driverId].totalPoints += point.totalMeetingPoints;
        if (point.totalMeetingPoints > 0) {
          standings[point.driverId].meetingsParticipated++;
        }
      }
    });

    // Trier par points totaux décroissants
    const sortedStandings = Object.values(standings).sort((a, b) => {
      if (a.totalPoints !== b.totalPoints) {
        return b.totalPoints - a.totalPoints;
      }
      
      // Départage par nombre de meetings participés
      if (a.meetingsParticipated !== b.meetingsParticipated) {
        return b.meetingsParticipated - a.meetingsParticipated;
      }
      
      // Départage alphabétique
      return a.driverName.localeCompare(b.driverName);
    });

    // Attribuer les positions
    let currentPosition = 1;
    for (let i = 0; i < sortedStandings.length; i++) {
      if (i > 0 && sortedStandings[i].totalPoints !== sortedStandings[i - 1].totalPoints) {
        currentPosition = i + 1;
      }
      sortedStandings[i].position = currentPosition;
    }

    setChampionshipStandings(sortedStandings);
  }, [championshipPoints, drivers, meetings]);

  // Filtrer les meetings qui ont au moins un pilote avec des points
  const activeMeetings = meetings.filter(meeting => 
    championshipPoints.some(point => point.meetingId === meeting.id)
  );

  return (
    <div style={{ padding: '2rem' }}>
      <h2 style={{ color: '#1e3c72', marginBottom: '1.5rem' }}>
        🏆 Championnat par Saison
      </h2>

      {/* Sélection année et catégorie */}
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
              📅 Saison :
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
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
              <option value={2024}>2024</option>
              <option value={2025}>2025</option>
              <option value={2026}>2026</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>
              🏆 Catégorie :
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
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
              {CATEGORIES.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
        </div>

        {activeMeetings.length > 0 && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: '#28a745', color: 'white', borderRadius: '8px' }}>
            <strong>📋 Championnat :</strong> {selectedCategory} {selectedYear}
            <br />
            <small style={{ opacity: 0.9 }}>
              {activeMeetings.length} meeting(s) comptabilisé(s) • {championshipStandings.filter(s => s.totalPoints > 0).length} pilote(s) au classement
            </small>
          </div>
        )}
      </div>

      {/* Statistiques de la saison */}
      {activeMeetings.length > 0 && (
        <div style={{ 
          background: '#e3f2fd', 
          padding: '1rem', 
          borderRadius: '8px', 
          marginBottom: '2rem',
          border: '1px solid #2196f3'
        }}>
          <h4 style={{ color: '#1565c0', marginTop: 0, marginBottom: '0.5rem' }}>
            📊 Statistiques de la saison
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div>
              <strong>Meetings organisés :</strong> {activeMeetings.length}
            </div>
            <div>
              <strong>Pilotes participants :</strong> {championshipStandings.filter(s => s.totalPoints > 0).length}
            </div>
            <div>
              <strong>Pilotes inscrits :</strong> {drivers.length}
            </div>
            <div>
              <strong>Leader actuel :</strong> {championshipStandings.length > 0 ? 
                `#${championshipStandings[0].carNumber} ${championshipStandings[0].driverName}` : 
                'Aucun'
              }
            </div>
          </div>
        </div>
      )}

      {/* Tableau principal du championnat */}
      {championshipStandings.length > 0 ? (
        <div style={{ 
          background: 'white', 
          borderRadius: '8px', 
          padding: '1.5rem',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          border: '3px solid #ffd700'
        }}>
          <h3 style={{ 
            color: '#ffd700', 
            marginTop: 0, 
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            🏆 CLASSEMENT CHAMPIONNAT {selectedYear} - {selectedCategory}
            <span style={{ 
              fontSize: '0.8rem', 
              background: '#ffd700', 
              color: 'black', 
              padding: '0.25rem 0.5rem', 
              borderRadius: '12px' 
            }}>
              {activeMeetings.length} MEETING(S)
            </span>
          </h3>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#ffd700', color: 'black' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'center', position: 'sticky', left: 0, background: '#ffd700', zIndex: 10 }}>Pos.</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', position: 'sticky', left: '60px', background: '#ffd700', zIndex: 10 }}>Pilote</th>
                  {activeMeetings.map((meeting, index) => (
                    <th key={meeting.id} style={{ 
                      padding: '0.75rem', 
                      textAlign: 'center',
                      minWidth: '100px',
                      fontSize: '0.9rem'
                    }}>
                      M{index + 1}
                      <br />
                      <small style={{ fontSize: '0.7rem', opacity: 0.8 }}>
                        {meeting.name.length > 15 ? meeting.name.substring(0, 15) + '...' : meeting.name}
                      </small>
                    </th>
                  ))}
                  <th style={{ padding: '0.75rem', textAlign: 'center', background: '#ffcc02', fontWeight: 'bold' }}>TOTAL</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.8rem' }}>Meetings</th>
                </tr>
              </thead>
              <tbody>
                {championshipStandings.map((driver, index) => (
                  <tr key={driver.driverId} style={{ 
                    borderBottom: '1px solid #ddd',
                    backgroundColor: index < 3 ? '#fffbf0' : 'white'
                  }}>
                    <td style={{ 
                      padding: '0.75rem', 
                      textAlign: 'center',
                      fontWeight: 'bold',
                      fontSize: '1.2rem',
                      color: index === 0 ? '#ffd700' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : '#333',
                      position: 'sticky',
                      left: 0,
                      background: index < 3 ? '#fffbf0' : 'white',
                      zIndex: 5
                    }}>
                      {driver.position}
                    </td>
                    <td style={{ 
                      padding: '0.75rem',
                      position: 'sticky',
                      left: '60px',
                      background: index < 3 ? '#fffbf0' : 'white',
                      zIndex: 5,
                      borderRight: '2px solid #ffd700'
                    }}>
                      <div style={{ fontWeight: '500', color: '#333' }}>
                        #{driver.carNumber} {driver.driverName}
                      </div>
                    </td>
                    {activeMeetings.map((meeting) => {
                      const points = driver.meetingPoints[meeting.id] || 0;
                      return (
                        <td key={meeting.id} style={{ 
                          padding: '0.75rem', 
                          textAlign: 'center',
                          fontWeight: 'bold',
                          color: points > 0 ? '#28a745' : '#ccc'
                        }}>
                          {points > 0 ? points : '-'}
                        </td>
                      );
                    })}
                    <td style={{ 
                      padding: '0.75rem', 
                      textAlign: 'center',
                      fontWeight: 'bold',
                      fontSize: '1.4rem',
                      color: index === 0 ? '#ffd700' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : '#333',
                      background: index < 3 ? 'rgba(255, 215, 0, 0.2)' : 'transparent'
                    }}>
                      {driver.totalPoints}
                    </td>
                    <td style={{ 
                      padding: '0.75rem', 
                      textAlign: 'center',
                      fontSize: '0.9rem',
                      color: '#666'
                    }}>
                      {driver.meetingsParticipated}/{activeMeetings.length}
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
            🏆 <strong>Classement officiel du championnat {selectedYear}</strong>
            <br />
            <small>M1, M2, M3... = Meetings dans l'ordre chronologique • Total = Somme des points de tous les meetings</small>
          </div>
        </div>
      ) : (
        <div style={{ 
          background: '#f8f9fa', 
          borderRadius: '8px', 
          padding: '3rem',
          textAlign: 'center', 
          color: '#666',
          border: '2px dashed #ccc'
        }}>
          <h3 style={{ color: '#999', marginTop: 0 }}>🏆 Aucun point championnat trouvé</h3>
          <p>
            Pour voir le classement du championnat, vous devez d'abord :
          </p>
          <ol style={{ textAlign: 'left', display: 'inline-block', color: '#555' }}>
            <li>Créer des meetings pour {selectedYear}</li>
            <li>Engager des pilotes dans ces meetings</li>
            <li>Faire du chronométrage</li>
            <li>Générer les points championnat dans chaque meeting</li>
          </ol>
          <p style={{ marginTop: '1rem' }}>
            <small>Allez dans "📊 Classements" puis "🏆 Générer Points Championnat Meeting" pour chaque meeting.</small>
          </p>
        </div>
      )}
    </div>
  );
}