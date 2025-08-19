import React, { useState, useEffect } from 'react';
import { db } from '../../../config/firebase';
import { collection, addDoc, onSnapshot, query, orderBy, where, updateDoc, doc, getDocs, deleteDoc } from 'firebase/firestore';

// =====================================
// INTERFACES TYPESCRIPT
// =====================================

interface TimeTrialsPoints {
  id?: string;
  meetingId: string;
  category: string;
  year: number;
  driverId: string;
  driverName: string;
  carNumber: number;
  position: number;
  points: number;
  bestTime: number;
  createdAt: Date;
  updatedAt?: Date;
}

interface QualifyingPoints {
  id?: string;
  meetingId: string;
  category: string;
  year: number;
  raceId: string;
  raceName: string;
  driverId: string;
  driverName: string;
  carNumber: number;
  position: number;
  points: number;
  totalTime?: number;
  status: string;
  engagesPresents: number;
  createdAt: Date;
  updatedAt?: Date;
}

interface SemifinalPoints {
  id?: string;
  meetingId: string;
  category: string;
  year: number;
  raceId: string;
  raceName: string;
  driverId: string;
  driverName: string;
  carNumber: number;
  position: number;
  points: number;
  totalTime?: number;
  status: string;
  createdAt: Date;
  updatedAt?: Date;
}

interface FinalPoints {
  id?: string;
  meetingId: string;
  category: string;
  year: number;
  raceId: string;
  raceName: string;
  driverId: string;
  driverName: string;
  carNumber: number;
  position: number;
  points: number;
  totalTime?: number;
  status: string;
  createdAt: Date;
  updatedAt?: Date;
}

interface RaceResult {
  id: string;
  raceId: string;
  raceName: string;
  driverId: string;
  driverName: string;
  carNumber: number;
  totalTime?: number;
  finalTime?: number;
  penalties?: number;
  bestLap?: number;
  status: 'finished' | 'dnf' | 'dns' | 'dsq_race' | 'dsq_general';
  position?: number;
}

// =====================================
// SYSTÈME DE POINTS ESSAIS CHRONOS
// =====================================

const TIMETRIALS_POINTS_SYSTEM = {
  1: 5, 2: 4, 3: 3, 4: 2, 5: 1
};

const calculateTimeTrialsPoints = (position: number): number => {
  return TIMETRIALS_POINTS_SYSTEM[position as keyof typeof TIMETRIALS_POINTS_SYSTEM] || 0;
};

const deleteExistingTimeTrialsPoints = async (meetingId: string, category: string): Promise<void> => {
  try {
    const q = query(
      collection(db, 'timeTrialsPoints'),
      where('meetingId', '==', meetingId),
      where('category', '==', category)
    );
    
    const snapshot = await getDocs(q);
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
  } catch (error) {
    console.error('Erreur suppression anciens points:', error);
  }
};

// =====================================
// SYSTÈME DE POINTS MANCHES QUALIFICATIVES
// =====================================

const calculateQualifyingPoints = (position: number): number => {
  if (position <= 0) return 0;
  
  if (position === 1) return 50;
  if (position === 2) return 45;
  if (position === 3) return 42;
  if (position === 4) return 40;
  
  // À partir du 5ème : 39, 38, 37, 36, 35, etc.
  return Math.max(0, 40 - (position - 4));
};

const calculatePositionByStatus = (
  originalPosition: number, 
  status: string, 
  engagesPresents: number
): { position: number, points: number } => {
  
  switch (status) {
    case 'finished':
      return {
        position: originalPosition,
        points: calculateQualifyingPoints(originalPosition)
      };
      
    case 'dnf': // Abandon
      const positionDNF = engagesPresents + 1;
      return {
        position: positionDNF,
        points: calculateQualifyingPoints(positionDNF)
      };
      
    case 'dns': // Non partant
    case 'dsq_general': // Disqualifié
      return {
        position: 999,
        points: 0
      };
      
    case 'dsq_race': // Déclassé
      const positionDSQ = engagesPresents + 3;
      return {
        position: positionDSQ,
        points: calculateQualifyingPoints(positionDSQ)
      };
      
    default:
      return {
        position: originalPosition,
        points: calculateQualifyingPoints(originalPosition)
      };
  }
};

const deleteExistingQualifyingPoints = async (raceId: string): Promise<void> => {
  try {
    const q = query(
      collection(db, 'qualifyingPoints'),
      where('raceId', '==', raceId)
    );
    
    const snapshot = await getDocs(q);
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
  } catch (error) {
    console.error('Erreur suppression anciens points qualifs:', error);
  }
};

const saveQualifyingPoints = async (
  raceResults: any[], 
  selectedRace: any,
  selectedMeeting: string,
  selectedCategory: string,
  selectedYear: number
): Promise<void> => {
  try {
    console.log('🔄 Calcul points manche qualificative:', selectedRace.name);
    
    // Compter les "engagés présents"
    const engagesPresents = raceResults.filter(result => 
      result.status === 'finished' || 
      result.status === 'dnf' || 
      result.status === 'dns' || 
      result.status === 'dsq_race' || 
      result.status === 'dsq_general'
    ).length;
    
    console.log('👥 Engagés présents dans cette manche:', engagesPresents);
    
    // Trier les pilotes qui ont terminé par temps
    const finishedResults = raceResults
      .filter(result => result.status === 'finished' && result.totalTime)
      .sort((a, b) => (a.totalTime || 0) - (b.totalTime || 0));
    
    // Récupérer tous les résultats
    const allResults = raceResults.filter(result => 
      result.status && ['finished', 'dnf', 'dns', 'dsq_race', 'dsq_general'].includes(result.status)
    );
    
    // Supprimer les anciens points
    await deleteExistingQualifyingPoints(selectedRace.id);
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Calculer les points pour chaque pilote
    const pointsPromises = allResults.map(async (result) => {
      let originalPosition = 999;
      if (result.status === 'finished') {
        originalPosition = finishedResults.findIndex(r => r.id === result.id) + 1;
      }
      
      const { position, points } = calculatePositionByStatus(
        originalPosition, 
        result.status, 
        engagesPresents
      );
      
      const qualifyingPointsData: QualifyingPoints = {
        meetingId: selectedMeeting,
        category: selectedCategory,
        year: selectedYear,
        raceId: selectedRace.id,
        raceName: selectedRace.name,
        driverId: result.driverId,
        driverName: result.driverName,
        carNumber: result.carNumber,
        position: position,
        points: points,
        totalTime: result.totalTime || null,
        status: result.status,
        engagesPresents: engagesPresents,
        createdAt: new Date()
      };
      
      await addDoc(collection(db, 'qualifyingPoints'), qualifyingPointsData);
    });
    
    await Promise.all(pointsPromises);
    console.log('✅ Points manche qualificative sauvegardés');
    
  } catch (error) {
    console.error('❌ Erreur sauvegarde points qualifs:', error);
  }
};

// =====================================
// SYSTÈME DE POINTS DEMI-FINALES
// =====================================

const SEMIFINAL_POINTS_SYSTEM = {
  1: 10, 2: 8, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1
};

const calculateSemifinalPoints = (position: number): number => {
  return SEMIFINAL_POINTS_SYSTEM[position as keyof typeof SEMIFINAL_POINTS_SYSTEM] || 0;
};

const deleteExistingSemifinalPoints = async (raceId: string): Promise<void> => {
  try {
    const q = query(
      collection(db, 'semifinalPoints'),
      where('raceId', '==', raceId)
    );
    
    const snapshot = await getDocs(q);
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
  } catch (error) {
    console.error('Erreur suppression anciens points demi-finales:', error);
  }
};

const saveSemifinalPoints = async (
  raceResults: any[], 
  selectedRace: any,
  selectedMeeting: string,
  selectedCategory: string,
  selectedYear: number
): Promise<void> => {
  try {
    console.log('🔄 Calcul points demi-finale:', selectedRace.name);
    
    // Filtrer seulement les résultats des pilotes assignés à cette demi-finale
    const raceSpecificResults = raceResults.filter(result => 
      selectedRace.drivers.includes(result.driverId)
    );
    
    // Trier les pilotes qui ont terminé par temps
    const finishedResults = raceSpecificResults
      .filter(result => result.status === 'finished' && result.totalTime)
      .sort((a, b) => (a.totalTime || 0) - (b.totalTime || 0));
    
    // Pilotes non partants de cette demi-finale
    const dnsResults = raceSpecificResults.filter(result => result.status === 'dns');
    
    // Pilotes déclassés de cette demi-finale
    const dsqResults = raceSpecificResults.filter(result => 
      result.status === 'dsq_race' || result.status === 'dsq_general'
    );
    
    // Supprimer les anciens points
    await deleteExistingSemifinalPoints(selectedRace.id);
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Calculer les points pour les pilotes qui ont terminé
    const finishedPointsPromises = finishedResults.map(async (result, index) => {
      const position = index + 1;
      const points = calculateSemifinalPoints(position);
      
      const semifinalPointsData: SemifinalPoints = {
        meetingId: selectedMeeting,
        category: selectedCategory,
        year: selectedYear,
        raceId: selectedRace.id,
        raceName: selectedRace.name,
        driverId: result.driverId,
        driverName: result.driverName,
        carNumber: result.carNumber,
        position: position,
        points: points,
        totalTime: result.totalTime,
        status: 'finished',
        createdAt: new Date()
      };
      
      await addDoc(collection(db, 'semifinalPoints'), semifinalPointsData);
    });
    
    // Calculer les points pour les non partants (0 pts, classés après les terminés)
    const dnsPointsPromises = dnsResults.map(async (result, index) => {
      const position = finishedResults.length + index + 1;
      
      const semifinalPointsData: SemifinalPoints = {
        meetingId: selectedMeeting,
        category: selectedCategory,
        year: selectedYear,
        raceId: selectedRace.id,
        raceName: selectedRace.name,
        driverId: result.driverId,
        driverName: result.driverName,
        carNumber: result.carNumber,
        position: position,
        points: 0,
        totalTime: null,
        status: 'dns',
        createdAt: new Date()
      };
      
      await addDoc(collection(db, 'semifinalPoints'), semifinalPointsData);
    });
    
    // Calculer les points pour les déclassés (0 pts, classés après les non partants)
    const dsqPointsPromises = dsqResults.map(async (result, index) => {
      const position = finishedResults.length + dnsResults.length + index + 1;
      
      const semifinalPointsData: SemifinalPoints = {
        meetingId: selectedMeeting,
        category: selectedCategory,
        year: selectedYear,
        raceId: selectedRace.id,
        raceName: selectedRace.name,
        driverId: result.driverId,
        driverName: result.driverName,
        carNumber: result.carNumber,
        position: position,
        points: 0,
        totalTime: result.totalTime || null,
        status: result.status,
        createdAt: new Date()
      };
      
      await addDoc(collection(db, 'semifinalPoints'), semifinalPointsData);
    });
    
    await Promise.all([...finishedPointsPromises, ...dnsPointsPromises, ...dsqPointsPromises]);
    console.log('✅ Points demi-finale sauvegardés');
    
  } catch (error) {
    console.error('❌ Erreur sauvegarde points demi-finale:', error);
  }
};

// =====================================
// SYSTÈME DE POINTS FINALES
// =====================================

const FINAL_POINTS_SYSTEM = {
  1: 15, 2: 12, 3: 10, 4: 8, 5: 6, 6: 5, 7: 4, 8: 3
};

const calculateFinalPoints = (position: number): number => {
  return FINAL_POINTS_SYSTEM[position as keyof typeof FINAL_POINTS_SYSTEM] || 0;
};

const deleteExistingFinalPoints = async (raceId: string): Promise<void> => {
  try {
    const q = query(
      collection(db, 'finalPoints'),
      where('raceId', '==', raceId)
    );
    
    const snapshot = await getDocs(q);
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
  } catch (error) {
    console.error('Erreur suppression anciens points finales:', error);
  }
};

const saveFinalPoints = async (
  raceResults: any[], 
  selectedRace: any,
  selectedMeeting: string,
  selectedCategory: string,
  selectedYear: number
): Promise<void> => {
  try {
    console.log('🔄 Calcul points finale:', selectedRace.name);
    const raceSpecificResults = raceResults.filter(result => 
        selectedRace.drivers.includes(result.driverId)
    );
    // Trier les pilotes qui ont terminé par temps
    const finishedResults = raceSpecificResults
      .filter(result => result.status === 'finished' && result.totalTime)
      .sort((a, b) => (a.totalTime || 0) - (b.totalTime || 0));
    
    // Pilotes non partants
    const dnsResults = raceSpecificResults.filter(result => result.status === 'dns');
    
    // Supprimer les anciens points
    await deleteExistingFinalPoints(selectedRace.id);
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Calculer les points pour les pilotes qui ont terminé
    const finishedPointsPromises = finishedResults.map(async (result, index) => {
      const position = index + 1;
      const points = calculateFinalPoints(position);
      
      const finalPointsData: FinalPoints = {
        meetingId: selectedMeeting,
        category: selectedCategory,
        year: selectedYear,
        raceId: selectedRace.id,
        raceName: selectedRace.name,
        driverId: result.driverId,
        driverName: result.driverName,
        carNumber: result.carNumber,
        position: position,
        points: points,
        totalTime: result.totalTime,
        status: 'finished',
        createdAt: new Date()
      };
      
      await addDoc(collection(db, 'finalPoints'), finalPointsData);
    });
    
    // Calculer les points pour les non partants (0 pts, classés après)
    const dnsPointsPromises = dnsResults.map(async (result, index) => {
      const position = finishedResults.length + index + 1;
      
      const finalPointsData: FinalPoints = {
        meetingId: selectedMeeting,
        category: selectedCategory,
        year: selectedYear,
        raceId: selectedRace.id,
        raceName: selectedRace.name,
        driverId: result.driverId,
        driverName: result.driverName,
        carNumber: result.carNumber,
        position: position,
        points: 0,
        totalTime: null,
        status: 'dns',
        createdAt: new Date()
      };
      
      await addDoc(collection(db, 'finalPoints'), finalPointsData);
    });
    
    await Promise.all([...finishedPointsPromises, ...dnsPointsPromises]);
    console.log('✅ Points finale sauvegardés');
    
  } catch (error) {
    console.error('❌ Erreur sauvegarde points finale:', error);
  }
};

// =====================================
// COMPOSANT PRINCIPAL TIMING
// =====================================

export default function Timing() {
  const [meetings, setMeetings] = useState<any[]>([]);
  const [races, setRaces] = useState<any[]>([]);
  const [selectedRace, setSelectedRace] = useState<any>(null);
  const [raceResults, setRaceResults] = useState<any[]>([]);
  
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMeeting, setSelectedMeeting] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  
  // States pour forcer le rechargement des tableaux de points
  const [pointsRefreshKey, setPointsRefreshKey] = useState(0);
  const [qualifyingPointsRefreshKey, setQualifyingPointsRefreshKey] = useState(0);
  const [semifinalPointsRefreshKey, setSemifinalPointsRefreshKey] = useState(0);
  const [finalPointsRefreshKey, setFinalPointsRefreshKey] = useState(0);

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

  // Récupérer les sessions avec pilotes assignés
  useEffect(() => {
    if (!selectedMeeting || !selectedCategory) {
      setRaces([]);
      return;
    }

    const q = query(
      collection(db, 'races'),
      where('meetingId', '==', selectedMeeting),
      where('category', '==', selectedCategory)
    );
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const racesData: any[] = [];
      querySnapshot.forEach((doc) => {
        const docData = doc.data();
        const raceData = { id: doc.id, ...docData };
        
        if (docData.drivers && 
            Array.isArray(docData.drivers) && 
            docData.drivers.length > 0) {
          racesData.push(raceData);
        }
      });
      
      racesData.sort((a, b) => (a.order || 0) - (b.order || 0));
      setRaces(racesData);
    });

    return () => unsubscribe();
  }, [selectedMeeting, selectedCategory]);

  // Récupérer les résultats de la course sélectionnée
  useEffect(() => {
    if (!selectedRace) {
      setRaceResults([]);
      return;
    }

    const q = query(
      collection(db, 'results'),
      where('raceId', '==', selectedRace.id)
    );
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const results: any[] = [];
      querySnapshot.forEach((doc) => {
        results.push({ id: doc.id, ...doc.data() });
      });
      
      results.sort((a, b) => {
        const statusOrder: { [key: string]: number } = {
          'finished': 1,
          'dnf': 2,
          'dns': 3,
          'dsq_race': 4,
          'dsq_general': 5
        };
        
        const getStatusOrder = (status: string): number => statusOrder[status] || 999;
        const statusA = a.status || 'finished';
        const statusB = b.status || 'finished';
        
        if (statusA === statusB) {
          if (statusA === 'finished' && a.totalTime && b.totalTime) {
            return a.totalTime - b.totalTime;
          }
          return 0;
        }
        
        return getStatusOrder(statusA) - getStatusOrder(statusB);
      });
      
      setRaceResults(results);
    });

    return () => unsubscribe();
  }, [selectedRace]);

  const getDriverInfo = async (driverId: string) => {
    try {
      const driversQuery = query(
        collection(db, 'drivers'),
        where('__name__', '==', driverId)
      );
      const snapshot = await getDocs(driversQuery);
      
      if (!snapshot.empty) {
        const driverData = snapshot.docs[0].data();
        return {
          id: driverId,
          name: driverData.name,
          carNumber: driverData.carNumber,
          team: driverData.team
        };
      }
    } catch (error) {
      console.error('Erreur récupération pilote:', error);
    }
    
    return { id: driverId, name: 'Pilote inconnu', carNumber: '?', team: '' };
  };

  const [driversInfo, setDriversInfo] = useState<any[]>([]);

  useEffect(() => {
    if (!selectedRace || !selectedRace.drivers) {
      setDriversInfo([]);
      return;
    }

    const fetchDriversInfo = async () => {
      const drivers = await Promise.all(
        selectedRace.drivers.map((driverId: string) => getDriverInfo(driverId))
      );
      setDriversInfo(drivers);
    };

    fetchDriversInfo();
  }, [selectedRace]);

  // FONCTION de recalcul immédiat des points essais chronos
  const recalculateTimeTrialsPointsImmediate = async () => {
    try {
      console.log('🔄 Recalcul immédiat des points essais chronos...');
      
      const q = query(
        collection(db, 'results'),
        where('raceId', '==', selectedRace.id)
      );
      
      const snapshot = await getDocs(q);
      const freshResults: any[] = [];
      
      snapshot.forEach((doc) => {
        freshResults.push({ id: doc.id, ...doc.data() });
      });
      
      const finishedResults = freshResults
        .filter(result => result.status === 'finished' && result.totalTime)
        .sort((a, b) => (a.totalTime || 0) - (b.totalTime || 0));

      await deleteExistingTimeTrialsPoints(selectedMeeting, selectedCategory);
      await new Promise(resolve => setTimeout(resolve, 200));

      const pointsPromises = finishedResults.map(async (result, index) => {
        const position = index + 1;
        const points = calculateTimeTrialsPoints(position);

        const timeTrialsPointsData: TimeTrialsPoints = {
          meetingId: selectedMeeting,
          category: selectedCategory,
          year: selectedYear,
          driverId: result.driverId,
          driverName: result.driverName,
          carNumber: result.carNumber,
          position: position,
          points: points,
          bestTime: result.totalTime || 0,
          createdAt: new Date()
        };

        await addDoc(collection(db, 'timeTrialsPoints'), timeTrialsPointsData);
      });

      await Promise.all(pointsPromises);
      setPointsRefreshKey(prev => prev + 1);
      console.log('✅ Points essais chronos recalculés');
      
    } catch (error) {
      console.error('❌ Erreur recalcul points essais chronos:', error);
    }
  };

  // FONCTION de recalcul immédiat des points qualificatives
  const recalculateQualifyingPointsImmediate = async () => {
    try {
      console.log('🔄 Recalcul immédiat des points qualificatives...');
      
      const q = query(
        collection(db, 'results'),
        where('raceId', '==', selectedRace.id)
      );
      
      const snapshot = await getDocs(q);
      const freshResults: any[] = [];
      
      snapshot.forEach((doc) => {
        freshResults.push({ id: doc.id, ...doc.data() });
      });

      await saveQualifyingPoints(
        freshResults,
        selectedRace,
        selectedMeeting,
        selectedCategory,
        selectedYear
      );
      
      setQualifyingPointsRefreshKey(prev => prev + 1);
      console.log('✅ Points qualificatives recalculés');
      
    } catch (error) {
      console.error('❌ Erreur recalcul points qualifs:', error);
    }
  };

  // FONCTION de recalcul immédiat des points demi-finales
  const recalculateSemifinalPointsImmediate = async () => {
    try {
      console.log('🔄 Recalcul immédiat des points demi-finale...');
      
      const q = query(
        collection(db, 'results'),
        where('raceId', '==', selectedRace.id)
      );
      
      const snapshot = await getDocs(q);
      const freshResults: any[] = [];
      
      snapshot.forEach((doc) => {
        freshResults.push({ id: doc.id, ...doc.data() });
      });

      await saveSemifinalPoints(
        freshResults,
        selectedRace,
        selectedMeeting,
        selectedCategory,
        selectedYear
      );
      
      setSemifinalPointsRefreshKey(prev => prev + 1);
      console.log('✅ Points demi-finale recalculés');
      
    } catch (error) {
      console.error('❌ Erreur recalcul points demi-finale:', error);
    }
  };

  // FONCTION de recalcul immédiat des points finales
  const recalculateFinalPointsImmediate = async () => {
    try {
      console.log('🔄 Recalcul immédiat des points finale...');
      
      const q = query(
        collection(db, 'results'),
        where('raceId', '==', selectedRace.id)
      );
      
      const snapshot = await getDocs(q);
      const freshResults: any[] = [];
      
      snapshot.forEach((doc) => {
        freshResults.push({ id: doc.id, ...doc.data() });
      });

      await saveFinalPoints(
        freshResults,
        selectedRace,
        selectedMeeting,
        selectedCategory,
        selectedYear
      );
      
      setFinalPointsRefreshKey(prev => prev + 1);
      console.log('✅ Points finale recalculés');
      
    } catch (error) {
      console.error('❌ Erreur recalcul points finale:', error);
    }
  };

  // ✅ FONCTION DE SAUVEGARDE AVEC GESTION DE TOUS LES TYPES DE POINTS
  const handleTimeSubmit = async (driverData: any, timeData: any) => {
    try {
      const existingResult = raceResults.find(r => r.driverId === driverData.id);
      
      const resultData = {
        raceId: selectedRace.id,
        raceName: selectedRace.name,
        driverId: driverData.id,
        driverName: driverData.name,
        carNumber: driverData.carNumber,
        meetingId: selectedMeeting,
        category: selectedCategory,
        year: selectedYear,
        status: timeData.status,
        ...timeData,
        updatedAt: new Date()
      };

      // 1️⃣ SAUVEGARDER LE TEMPS
      if (existingResult) {
        await updateDoc(doc(db, 'results', existingResult.id), resultData);
      } else {
        await addDoc(collection(db, 'results'), {
          ...resultData,
          createdAt: new Date()
        });
      }

      // 2️⃣ RECALCULER LES POINTS SELON LE TYPE DE SESSION
      if (selectedRace.type === 'timeTrials') {
        await recalculateTimeTrialsPointsImmediate();
      } else if (selectedRace.type === 'qualifying') {
        await recalculateQualifyingPointsImmediate();
      } else if (selectedRace.type === 'semifinal') {
        await recalculateSemifinalPointsImmediate();
      } else if (selectedRace.type === 'final') {
        await recalculateFinalPointsImmediate();
      }

      alert('✅ Temps enregistré !');
    } catch (error) {
      console.error('Erreur sauvegarde temps:', error);
      alert('❌ Erreur lors de la sauvegarde');
    }
  };

  const getStatusLabel = (status: string): string => {
    const statusLabels: { [key: string]: string } = {
      'dnf': 'ABD',
      'dns': 'NP',
      'dsq_race': 'DECL',
      'dsq_general': 'DISQ'
    };
    return statusLabels[status] || status;
  };

  const getSessionTypeLabel = (type: string) => {
    const types: { [key: string]: { label: string; emoji: string } } = {
      'timeTrials': { label: 'Essais Chronométrés', emoji: '⏱️' },
      'qualifying': { label: 'Manche Qualificative', emoji: '🏃' },
      'semifinal': { label: '1/2 Finale', emoji: '🥈' },
      'final': { label: 'Finale', emoji: '🏆' }
    };
    
    return types[type] || { label: type, emoji: '🏁' };
  };

  const formatTime = (seconds: number): string => {
    if (!seconds) return '--:--:---';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.round((seconds % 1) * 1000);
    return `${minutes}:${secs.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  };

  const selectedMeetingData = meetings.find(m => m.id === selectedMeeting);
  const availableCategories = selectedMeetingData?.categories || [];

  return (
    <div style={{ padding: '2rem' }}>
      <h2 style={{ color: '#1e3c72', marginBottom: '1.5rem' }}>
        ⏱️ Chronométrage des Courses
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
            setSelectedRace(null);
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
                setSelectedRace(null);
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
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setSelectedRace(null);
              }}
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
      </div>

      {/* Sélection de session */}
      {selectedMeeting && selectedCategory && races.length > 0 && (
        <div style={{ 
          background: '#f8f9fa', 
          padding: '1rem', 
          borderRadius: '8px', 
          marginBottom: '1.5rem',
          border: '1px solid #e9ecef'
        }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#333' }}>
            🏁 Session à chronométrer :
          </label>
          <select
            value={selectedRace?.id || ''}
            onChange={(e) => {
              const race = races.find(r => r.id === e.target.value);
              setSelectedRace(race || null);
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
            <option value="">Sélectionnez une session</option>
            {races.map(race => {
              const sessionType = getSessionTypeLabel(race.type);
              return (
                <option key={race.id} value={race.id}>
                  {sessionType.emoji} {race.name} ({race.drivers.length} pilotes)
                </option>
              );
            })}
          </select>
          
          {selectedRace && (
            <div style={{ marginTop: '1rem', padding: '1rem', background: '#28a745', color: 'white', borderRadius: '8px' }}>
              <strong>📋 Session sélectionnée :</strong> {selectedRace.name}
              <br />
              <small style={{ opacity: 0.9 }}>
                {selectedRace.laps} tour(s) • {selectedRace.drivers.length} pilote(s) • {getSessionTypeLabel(selectedRace.type).label}
              </small>
            </div>
          )}
        </div>
      )}

      {/* Interface de chronométrage */}
      {selectedRace && driversInfo.length > 0 && (
        <div style={{ 
          background: 'white', 
          borderRadius: '8px', 
          padding: '1.5rem',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          marginBottom: '2rem'
        }}>
          <h3 style={{ color: '#333', marginTop: 0, marginBottom: '1.5rem' }}>
            ⏱️ Saisie des temps - {selectedRace.name}
          </h3>

          {selectedRace.type === 'timeTrials' ? (
            <TimeTrialsInput 
              key={selectedRace.id}
              drivers={driversInfo}
              existingResults={raceResults}
              onTimeSubmit={handleTimeSubmit}
              formatTime={formatTime}
              selectedRace={selectedRace}
            />
          ) : selectedRace.type === 'qualifying' ? (
            <QualifyingInput 
              key={selectedRace.id}
              drivers={driversInfo}
              race={selectedRace}
              existingResults={raceResults}
              onTimeSubmit={handleTimeSubmit}
              formatTime={formatTime}
            />
          ) : (
            <RaceInput 
              key={selectedRace.id}
              drivers={driversInfo}
              race={selectedRace}
              existingResults={raceResults}
              onTimeSubmit={handleTimeSubmit}
              formatTime={formatTime}
            />
          )}
        </div>
      )}

      {/* Classement en temps réel */}
      {selectedRace && raceResults.length > 0 && (
        <div style={{ 
          background: 'white', 
          borderRadius: '8px', 
          padding: '1.5rem',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          marginBottom: '2rem'
        }}>
          <h3 style={{ color: '#333', marginTop: 0, marginBottom: '1rem' }}>
            🏆 Classement - {selectedRace.name}
          </h3>
          
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#667eea', color: 'white' }}>
                  <th style={{ padding: '0.75rem', textAlign: 'center' }}>Pos.</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left' }}>Pilote</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center' }}>Temps Total</th>
                  {selectedRace.type !== 'timeTrials' && selectedRace.type !== 'qualifying' && (
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Meilleur Tour</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {raceResults.filter(result => selectedRace.drivers.includes(result.driverId)).map((result, index) => (
                  <tr key={result.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ 
                      padding: '0.75rem', 
                      textAlign: 'center',
                      fontWeight: 'bold',
                      color: result.status === 'finished' 
                        ? (index === 0 ? '#ffd700' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : '#333')
                        : '#dc3545'
                    }}>
                      {result.status === 'finished' ? (index + 1) : getStatusLabel(result.status)}
                    </td>
                    <td style={{ padding: '0.75rem', color: '#333' }}>
                      <div style={{ fontWeight: '500' }}>
                        #{result.carNumber} {result.driverName}
                      </div>
                    </td>
                    <td style={{ 
                      padding: '0.75rem', 
                      textAlign: 'center',
                      fontFamily: 'monospace',
                      fontSize: '1.1rem',
                      fontWeight: 'bold',
                      color: '#1e3c72'
                    }}>
                      {result.status === 'finished' ? formatTime(result.totalTime) : getStatusLabel(result.status)}
                    </td>
                    {selectedRace.type !== 'timeTrials' && selectedRace.type !== 'qualifying' && (
                      <td style={{ 
                        padding: '0.75rem', 
                        textAlign: 'center',
                        fontFamily: 'monospace',
                        color: '#666'
                      }}>
                        {result.status === 'finished' ? formatTime(result.bestLap) : '-'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ✅ AFFICHAGE DES POINTS ESSAIS CHRONOMÉTRÉS */}
      {selectedRace && selectedRace.type === 'timeTrials' && raceResults.length > 0 && (
        <TimeTrialsPointsDisplay 
          meetingId={selectedMeeting}
          category={selectedCategory}
          raceResults={raceResults}
          refreshKey={pointsRefreshKey}
        />
      )}

      {/* ✅ AFFICHAGE DES POINTS MANCHES QUALIFICATIVES */}
      {selectedRace && selectedRace.type === 'qualifying' && raceResults.length > 0 && (
        <QualifyingPointsDisplay 
          raceId={selectedRace.id}
          raceName={selectedRace.name}
          category={selectedCategory}
          refreshKey={qualifyingPointsRefreshKey}
        />
      )}

      {/* ✅ AFFICHAGE DES POINTS DEMI-FINALES */}
      {selectedRace && selectedRace.type === 'semifinal' && raceResults.length > 0 && (
        <SemifinalPointsDisplay 
          raceId={selectedRace.id}
          raceName={selectedRace.name}
          category={selectedCategory}
          refreshKey={semifinalPointsRefreshKey}
          selectedRace={selectedRace}
        />
      )}

      {/* ✅ AFFICHAGE DES POINTS FINALES */}
      {selectedRace && selectedRace.type === 'final' && raceResults.length > 0 && (
        <FinalPointsDisplay 
          raceId={selectedRace.id}
          raceName={selectedRace.name}
          category={selectedCategory}
          refreshKey={finalPointsRefreshKey}
          selectedRace={selectedRace}
        />
      )}
    </div>
  );
}

// =====================================
// COMPOSANT D'AFFICHAGE DES POINTS ESSAIS CHRONOS
// =====================================

interface TimeTrialsPointsDisplayProps {
  meetingId: string;
  category: string;
  raceResults: any[];
  refreshKey?: number;
}

const TimeTrialsPointsDisplay: React.FC<TimeTrialsPointsDisplayProps> = ({
  meetingId,
  category,
  raceResults,
  refreshKey = 0
}) => {
  const [points, setPoints] = useState<TimeTrialsPoints[]>([]);

  useEffect(() => {
    if (!meetingId || !category) {
      setPoints([]);
      return;
    }

    console.log('🔄 Rechargement points essais chronos (refreshKey:', refreshKey, ')');

    const q = query(
      collection(db, 'timeTrialsPoints'),
      where('meetingId', '==', meetingId),
      where('category', '==', category),
      orderBy('position', 'asc')
    );
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const pointsData: TimeTrialsPoints[] = [];
      
      querySnapshot.forEach(doc => {
        pointsData.push({ id: doc.id, ...doc.data() } as TimeTrialsPoints);
      });
      
      console.log('🔄 Points essais chronos mis à jour:', pointsData.length);
      setPoints(pointsData);
    });

    return () => unsubscribe();
  }, [meetingId, category, refreshKey]);

  const formatTime = (seconds: number): string => {
    if (!seconds) return '--:--:---';
    const secs = Math.floor(seconds);
    const milliseconds = Math.round((seconds % 1) * 1000);
    return `${secs}.${milliseconds.toString().padStart(3, '0')}`;
  };

  if (points.length === 0) {
    return (
      <div style={{ 
        background: '#f8f9fa', 
        borderRadius: '8px', 
        padding: '2rem',
        textAlign: 'center', 
        color: '#666' 
      }}>
        📊 Aucun point attribué pour les essais chronométrés
      </div>
    );
  }

  return (
    <div style={{ 
      background: 'white', 
      borderRadius: '8px', 
      padding: '1.5rem',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      border: '2px solid #28a745'
    }}>
      <h3 style={{ 
        color: '#28a745', 
        marginTop: 0, 
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        🏁 Points Essais Chronométrés - {category}
        <span style={{ 
          fontSize: '0.8rem', 
          background: '#28a745', 
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
            <tr style={{ background: '#28a745', color: 'white' }}>
              <th style={{ padding: '0.75rem', textAlign: 'center' }}>Pos.</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Pilote</th>
              <th style={{ padding: '0.75rem', textAlign: 'center' }}>Temps</th>
              <th style={{ padding: '0.75rem', textAlign: 'center' }}>Points</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point, index) => (
              <tr key={point.id} style={{ 
                borderBottom: '1px solid #ddd',
                backgroundColor: point.points > 0 ? '#f0fff0' : 'white'
              }}>
                <td style={{ 
                  padding: '0.75rem', 
                  textAlign: 'center',
                  fontWeight: 'bold',
                  color: index === 0 ? '#ffd700' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : '#333'
                }}>
                  {point.position}
                </td>
                <td style={{ padding: '0.75rem' }}>
                  <div style={{ fontWeight: '500', color: '#333' }}>
                    #{point.carNumber} {point.driverName}
                  </div>
                </td>
                <td style={{ 
                  padding: '0.75rem', 
                  textAlign: 'center',
                  fontFamily: 'monospace',
                  fontSize: '1.1rem',
                  color: '#1e3c72'
                }}>
                  {formatTime(point.bestTime)}
                </td>
                <td style={{ 
                  padding: '0.75rem', 
                  textAlign: 'center',
                  fontWeight: 'bold',
                  fontSize: '1.2rem',
                  color: point.points > 0 ? '#28a745' : '#6c757d'
                }}>
                  {point.points > 0 ? `${point.points} pts` : '-'}
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
        💡 <strong>Barème :</strong> 1er = 5pts • 2ème = 4pts • 3ème = 3pts • 4ème = 2pts • 5ème = 1pt • 6ème+ = 0pt
        <br />
        <small style={{ color: '#28a745' }}>🔄 Mise à jour automatique en temps réel</small>
      </div>
    </div>
  );
};

// =====================================
// COMPOSANT D'AFFICHAGE DES POINTS QUALIFICATIVES
// =====================================

interface QualifyingPointsDisplayProps {
  raceId: string;
  raceName: string;
  category: string;
  refreshKey?: number;
}

const QualifyingPointsDisplay: React.FC<QualifyingPointsDisplayProps> = ({
  raceId,
  raceName,
  category,
  refreshKey = 0
}) => {
  const [points, setPoints] = useState<QualifyingPoints[]>([]);

  useEffect(() => {
    if (!raceId) {
      setPoints([]);
      return;
    }

    console.log('🔄 Rechargement points qualifs (refreshKey:', refreshKey, ')');

    const q = query(
      collection(db, 'qualifyingPoints'),
      where('raceId', '==', raceId),
      orderBy('points', 'desc')
    );
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const pointsData: QualifyingPoints[] = [];
      
      querySnapshot.forEach(doc => {
        pointsData.push({ id: doc.id, ...doc.data() } as QualifyingPoints);
      });
      
      console.log('🔄 Points qualifs mis à jour:', pointsData.length);
      setPoints(pointsData);
    });

    return () => unsubscribe();
  }, [raceId, refreshKey]);

  const getStatusLabel = (status: string): string => {
    const labels: { [key: string]: string } = {
      'finished': 'Terminé',
      'dnf': 'Abandon',
      'dns': 'Non partant',
      'dsq_race': 'Déclassé',
      'dsq_general': 'Disqualifié'
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string): string => {
    const colors: { [key: string]: string } = {
      'finished': '#28a745',
      'dnf': '#dc3545',
      'dns': '#6c757d',
      'dsq_race': '#fd7e14',
      'dsq_general': '#e83e8c'
    };
    return colors[status] || '#333';
  };

  const formatTime = (seconds: number): string => {
    if (!seconds) return '-';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.round((seconds % 1) * 1000);
    return `${minutes}:${secs.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  };

  if (points.length === 0) {
    return (
      <div style={{ 
        background: '#f8f9fa', 
        borderRadius: '8px', 
        padding: '2rem',
        textAlign: 'center', 
        color: '#666' 
      }}>
        📊 Aucun point attribué pour cette manche qualificative
      </div>
    );
  }

  const engagesPresents = points[0]?.engagesPresents || 0;

  return (
    <div style={{ 
      background: 'white', 
      borderRadius: '8px', 
      padding: '1.5rem',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      border: '2px solid #667eea'
    }}>
      <h3 style={{ 
        color: '#667eea', 
        marginTop: 0, 
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        🏃 Points {raceName} - {category}
        <span style={{ 
          fontSize: '0.8rem', 
          background: '#667eea', 
          color: 'white', 
          padding: '0.25rem 0.5rem', 
          borderRadius: '12px' 
        }}>
          🔄 Temps réel
        </span>
      </h3>
      
      <div style={{ 
        marginBottom: '1rem', 
        fontSize: '0.9rem', 
        color: '#666',
        background: '#f8f9fa',
        padding: '0.75rem',
        borderRadius: '4px'
      }}>
        👥 <strong>{engagesPresents} engagés présents</strong> dans cette manche
        <br />
        📊 Barème : 1er=50pts • 2ème=45pts • 3ème=42pts • 4ème=40pts • 5ème=39pts • puis -1pt par position
        <br />
        ⚖️ Abandon = +1 pos • Déclassé = +3 pos • Non partant/Disqualifié = 0pt
      </div>
      
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#667eea', color: 'white' }}>
              <th style={{ padding: '0.75rem', textAlign: 'center' }}>Pos.</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Pilote</th>
              <th style={{ padding: '0.75rem', textAlign: 'center' }}>Temps</th>
              <th style={{ padding: '0.75rem', textAlign: 'center' }}>Statut</th>
              <th style={{ padding: '0.75rem', textAlign: 'center' }}>Points</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point, index) => (
              <tr key={point.id} style={{ 
                borderBottom: '1px solid #ddd',
                backgroundColor: point.points > 0 ? '#f0f8ff' : '#fff5f5'
              }}>
                <td style={{ 
                  padding: '0.75rem', 
                  textAlign: 'center',
                  fontWeight: 'bold',
                  color: point.status === 'finished' && index < 3 
                    ? (index === 0 ? '#ffd700' : index === 1 ? '#c0c0c0' : '#cd7f32') 
                    : '#333'
                }}>
                  {point.status === 'finished' ? point.position : '-'}
                </td>
                <td style={{ padding: '0.75rem' }}>
                  <div style={{ fontWeight: '500', color: '#333' }}>
                    #{point.carNumber} {point.driverName}
                  </div>
                </td>
                <td style={{ 
                  padding: '0.75rem', 
                  textAlign: 'center',
                  fontFamily: 'monospace',
                  fontSize: '1rem',
                  color: '#1e3c72'
                }}>
                  {formatTime(point.totalTime || 0)}
                </td>
                <td style={{ 
                  padding: '0.75rem', 
                  textAlign: 'center',
                  color: getStatusColor(point.status),
                  fontWeight: '500'
                }}>
                  {getStatusLabel(point.status)}
                </td>
                <td style={{ 
                  padding: '0.75rem', 
                  textAlign: 'center',
                  fontWeight: 'bold',
                  fontSize: '1.2rem',
                  color: point.points > 0 ? '#667eea' : '#dc3545'
                }}>
                  {point.points > 0 ? `${point.points} pts` : '0 pt'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// =====================================
// COMPOSANT D'AFFICHAGE DES POINTS DEMI-FINALES
// =====================================

interface SemifinalPointsDisplayProps {
  raceId: string;
  raceName: string;
  category: string;
  refreshKey?: number;
  selectedRace?: any;
}

const SemifinalPointsDisplay: React.FC<SemifinalPointsDisplayProps> = ({
  raceId,
  raceName,
  category,
  refreshKey = 0,
  selectedRace
}) => {
  const [points, setPoints] = useState<SemifinalPoints[]>([]);

  useEffect(() => {
    if (!raceId) {
      setPoints([]);
      return;
    }

    console.log('🔄 Rechargement points demi-finale (refreshKey:', refreshKey, ')');

    const q = query(
      collection(db, 'semifinalPoints'),
      where('raceId', '==', raceId),
      orderBy('position', 'asc')
    );
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const pointsData: SemifinalPoints[] = [];
      
      querySnapshot.forEach(doc => {
        pointsData.push({ id: doc.id, ...doc.data() } as SemifinalPoints);
      });
      
      console.log('🔄 Points demi-finale mis à jour:', pointsData.length);
      setPoints(pointsData);
    });

    return () => unsubscribe();
  }, [raceId, refreshKey]);

  const formatTime = (seconds: number): string => {
    if (!seconds) return '-';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.round((seconds % 1) * 1000);
    return `${minutes}:${secs.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  };

  if (points.length === 0) {
    return (
      <div style={{ 
        background: '#f8f9fa', 
        borderRadius: '8px', 
        padding: '2rem',
        textAlign: 'center', 
        color: '#666' 
      }}>
        📊 Aucun point attribué pour cette demi-finale
      </div>
    );
  }

  return (
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
        🥈 Points {raceName} - {category}
        <span style={{ 
          fontSize: '0.8rem', 
          background: '#8e24aa', 
          color: 'white', 
          padding: '0.25rem 0.5rem', 
          borderRadius: '12px' 
        }}>
          🔄 Temps réel
        </span>
      </h3>
      
      <div style={{ 
        marginBottom: '1rem', 
        fontSize: '0.9rem', 
        color: '#666',
        background: '#f8f9fa',
        padding: '0.75rem',
        borderRadius: '4px'
      }}>
        📊 Barème : 1er=10pts • 2ème=8pts • 3ème=6pts • 4ème=5pts • 5ème=4pts • 6ème=3pts • 7ème=2pts • 8ème=1pt
        <br />
        ⚖️ Non partant = classé après + 0pt
      </div>
      
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#8e24aa', color: 'white' }}>
              <th style={{ padding: '0.75rem', textAlign: 'center' }}>Pos.</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Pilote</th>
              <th style={{ padding: '0.75rem', textAlign: 'center' }}>Temps</th>
              <th style={{ padding: '0.75rem', textAlign: 'center' }}>Statut</th>
              <th style={{ padding: '0.75rem', textAlign: 'center' }}>Points</th>
            </tr>
          </thead>
          <tbody>
            {points.filter(point => selectedRace?.drivers?.includes(point.driverId)).map((point, index) => (
              <tr key={point.id} style={{ 
                borderBottom: '1px solid #ddd',
                backgroundColor: point.points > 0 ? '#faf0ff' : '#fff5f5'
              }}>
                <td style={{ 
                  padding: '0.75rem', 
                  textAlign: 'center',
                  fontWeight: 'bold',
                  color: point.status === 'finished' && index < 3 
                    ? (index === 0 ? '#ffd700' : index === 1 ? '#c0c0c0' : '#cd7f32') 
                    : '#333'
                }}>
                  {point.position}
                </td>
                <td style={{ padding: '0.75rem' }}>
                  <div style={{ fontWeight: '500', color: '#333' }}>
                    #{point.carNumber} {point.driverName}
                  </div>
                </td>
                <td style={{ 
                  padding: '0.75rem', 
                  textAlign: 'center',
                  fontFamily: 'monospace',
                  fontSize: '1rem',
                  color: '#1e3c72'
                }}>
                  {formatTime(point.totalTime || 0)}
                </td>
                <td style={{ 
                  padding: '0.75rem', 
                  textAlign: 'center',
                  color: point.status === 'finished' ? '#28a745' : '#dc3545',
                  fontWeight: '500'
                }}>
                  {point.status === 'finished' ? 'Terminé' : 'Non partant'}
                </td>
                <td style={{ 
                  padding: '0.75rem', 
                  textAlign: 'center',
                  fontWeight: 'bold',
                  fontSize: '1.2rem',
                  color: point.points > 0 ? '#8e24aa' : '#dc3545'
                }}>
                  {point.points > 0 ? `${point.points} pts` : '0 pt'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// =====================================
// COMPOSANT D'AFFICHAGE DES POINTS FINALES
// =====================================

interface FinalPointsDisplayProps {
  raceId: string;
  raceName: string;
  category: string;
  refreshKey?: number;
  selectedRace?: any;
}

const FinalPointsDisplay: React.FC<FinalPointsDisplayProps> = ({
  raceId,
  raceName,
  category,
  refreshKey = 0,
  selectedRace
}) => {
  const [points, setPoints] = useState<FinalPoints[]>([]);

  useEffect(() => {
    if (!raceId) {
      setPoints([]);
      return;
    }

    console.log('🔄 Rechargement points finale (refreshKey:', refreshKey, ')');

    const q = query(
      collection(db, 'finalPoints'),
      where('raceId', '==', raceId),
      orderBy('position', 'asc')
    );
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const pointsData: FinalPoints[] = [];
      
      querySnapshot.forEach(doc => {
        pointsData.push({ id: doc.id, ...doc.data() } as FinalPoints);
      });
      
      console.log('🔄 Points finale mis à jour:', pointsData.length);
      setPoints(pointsData);
    });

    return () => unsubscribe();
  }, [raceId, refreshKey]);

  const formatTime = (seconds: number): string => {
    if (!seconds) return '-';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.round((seconds % 1) * 1000);
    return `${minutes}:${secs.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
  };

  if (points.length === 0) {
    return (
      <div style={{ 
        background: '#f8f9fa', 
        borderRadius: '8px', 
        padding: '2rem',
        textAlign: 'center', 
        color: '#666' 
      }}>
        📊 Aucun point attribué pour cette finale
      </div>
    );
  }

  return (
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
        🏆 Points {raceName} - {category}
        <span style={{ 
          fontSize: '0.8rem', 
          background: '#ffd700', 
          color: 'black', 
          padding: '0.25rem 0.5rem', 
          borderRadius: '12px' 
        }}>
          🔄 Temps réel
        </span>
      </h3>
      
      <div style={{ 
        marginBottom: '1rem', 
        fontSize: '0.9rem', 
        color: '#666',
        background: '#f8f9fa',
        padding: '0.75rem',
        borderRadius: '4px'
      }}>
        📊 Barème : 1er=15pts • 2ème=12pts • 3ème=10pts • 4ème=8pts • 5ème=6pts • 6ème=5pts • 7ème=4pts • 8ème=3pts
        <br />
        ⚖️ Non partant = classé après + 0pt
      </div>
      
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#ffd700', color: 'black' }}>
              <th style={{ padding: '0.75rem', textAlign: 'center' }}>Pos.</th>
              <th style={{ padding: '0.75rem', textAlign: 'left' }}>Pilote</th>
              <th style={{ padding: '0.75rem', textAlign: 'center' }}>Temps</th>
              <th style={{ padding: '0.75rem', textAlign: 'center' }}>Statut</th>
              <th style={{ padding: '0.75rem', textAlign: 'center' }}>Points</th>
            </tr>
          </thead>
          <tbody>
            {points.filter(point => selectedRace?.drivers?.includes(point.driverId)).map((point, index) => (
              <tr key={point.id} style={{ 
                borderBottom: '1px solid #ddd',
                backgroundColor: point.points > 0 ? '#fffbf0' : '#fff5f5'
              }}>
                <td style={{ 
                  padding: '0.75rem', 
                  textAlign: 'center',
                  fontWeight: 'bold',
                  color: point.status === 'finished' && index < 3 
    ? (index === 0 ? '#ffd700' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : '#333')
    : '#333'
                }}>
                  {point.position}
                </td>
                <td style={{ padding: '0.75rem' }}>
                  <div style={{ fontWeight: '500', color: '#333' }}>
                    #{point.carNumber} {point.driverName}
                  </div>
                </td>
                <td style={{ 
                  padding: '0.75rem', 
                  textAlign: 'center',
                  fontFamily: 'monospace',
                  fontSize: '1rem',
                  color: '#1e3c72'
                }}>
                  {formatTime(point.totalTime || 0)}
                </td>
                <td style={{ 
                  padding: '0.75rem', 
                  textAlign: 'center',
                  color: point.status === 'finished' ? '#28a745' : '#dc3545',
                  fontWeight: '500'
                }}>
                  {point.status === 'finished' ? 'Terminé' : 'Non partant'}
                </td>
                <td style={{ 
                  padding: '0.75rem', 
                  textAlign: 'center',
                  fontWeight: 'bold',
                  fontSize: '1.2rem',
                  color: point.points > 0 ? '#ffd700' : '#dc3545'
                }}>
                  {point.points > 0 ? `${point.points} pts` : '0 pt'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// =====================================
// COMPOSANTS DE SAISIE
// =====================================

function TimeTrialsInput({ drivers, existingResults, onTimeSubmit, formatTime, selectedRace }: any) {
  const [times, setTimes] = useState<any>({});
  
  const formatTimeForTimeTrials = (seconds: number): string => {
    if (!seconds) return '';
    const secs = Math.floor(seconds);
    const milliseconds = Math.round((seconds % 1) * 1000);
    return `${secs}.${milliseconds.toString().padStart(3, '0')}`;
  };

  useEffect(() => {
    const newTimes = { ...times };
    
    existingResults.forEach((result: any) => {
      if (result.raceId === selectedRace?.id) {
        if (!newTimes[result.driverId]?.inputValue) {
          newTimes[result.driverId] = {
            totalTime: result.totalTime,
            penalties: result.penalties || 0,
            inputValue: formatTimeForTimeTrials(result.totalTime),
            penaltyValue: (result.penalties || 0).toString()
          };
        }
      }
    });
    
    setTimes(newTimes);
  }, [existingResults, selectedRace?.id]);

  const handleTimeChange = (driverId: string, field: string, value: string) => {
    setTimes((prev: any) => ({
      ...prev,
      [driverId]: {
        ...prev[driverId],
        [field]: field === 'penalties' ? parseFloat(value) || 0 : parseTimeToSeconds(value),
        inputValue: field === 'totalTime' ? value : prev[driverId]?.inputValue,
        penaltyValue: field === 'penalties' ? value : prev[driverId]?.penaltyValue
      }
    }));
  };

  const parseTimeToSeconds = (timeString: string): number => {
    if (!timeString) return 0;
    
    const parts = timeString.split(':');
    let totalSeconds = 0;
    
    if (parts.length === 2) {
      const minutes = parseInt(parts[0]) || 0;
      const secondsParts = parts[1].split('.');
      const seconds = parseInt(secondsParts[0]) || 0;
      const milliseconds = parseInt(secondsParts[1]?.padEnd(3, '0')) || 0;
      totalSeconds = minutes * 60 + seconds + milliseconds / 1000;
    } else {
      const secondsParts = timeString.split('.');
      const seconds = parseInt(secondsParts[0]) || 0;
      const milliseconds = parseInt(secondsParts[1]?.padEnd(3, '0')) || 0;
      totalSeconds = seconds + milliseconds / 1000;
    }
    
    return totalSeconds;
  };

  const handleSubmit = (driverId: string) => {
    const driverData = drivers.find((d: any) => d.id === driverId);
    const timeData = times[driverId];
    
    if (!timeData?.totalTime) {
      alert('Veuillez saisir un temps !');
      return;
    }
    
    onTimeSubmit(driverData, {
      totalTime: timeData.totalTime,
      finalTime: timeData.totalTime,
      penalties: 0,
      bestLap: timeData.totalTime,
      position: null,
      status: 'finished'
    });
  };

  return (
    <div>
      <div style={{ 
        marginBottom: '1rem', 
        padding: '1rem', 
        background: '#28a745', 
        color: 'white', 
        borderRadius: '8px',
        border: '1px solid #1e7e34'
      }}>
        <strong>ℹ️ Essais Chronométrés :</strong> Saisissez le meilleur temps de chaque pilote (1 tour)
        <br />
        <small style={{ opacity: 0.9 }}>Format : secondes.millisecondes (ex: 63.456) • Les 5 premiers marquent des points !</small>
      </div>
      
      <div style={{ display: 'grid', gap: '1rem' }}>
        {drivers.sort((a: any, b: any) => a.carNumber - b.carNumber).map((driver: any) => (
          <div key={driver.id} style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 150px 120px', 
            gap: '1rem', 
            alignItems: 'center',
            padding: '1rem',
            border: '1px solid #ddd',
            borderRadius: '8px',
            backgroundColor: times[driver.id]?.totalTime ? '#f0fff0' : 'white'
          }}>
            <div>
              <div style={{ fontWeight: '500', color: '#333' }}>
                #{driver.carNumber} {driver.name}
              </div>
              {driver.team && (
                <div style={{ fontSize: '0.85rem', color: '#666' }}>
                  {driver.team}
                </div>
              )}
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>
                Temps (SS.mmm)
              </label>
              <input
                type="text"
                placeholder="63.456"
                value={times[driver.id]?.inputValue || ''}
                onChange={(e) => handleTimeChange(driver.id, 'totalTime', e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '0.5rem', 
                  border: '1px solid #ccc', 
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  color: '#333',
                  backgroundColor: 'white'
                }}
              />
            </div>
                       
            <button
              onClick={() => handleSubmit(driver.id)}
              disabled={!times[driver.id]?.totalTime}
              style={{
                padding: '0.5rem 1rem',
                background: times[driver.id]?.totalTime ? '#28a745' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: times[driver.id]?.totalTime ? 'pointer' : 'not-allowed',
                fontSize: '0.85rem'
              }}
            >
              💾 Valider
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function QualifyingInput({ drivers, race, existingResults, onTimeSubmit, formatTime }: any) {
  const [times, setTimes] = useState<any>({});
  const [statuses, setStatuses] = useState<{[key: string]: string}>({});

  const STATUS_OPTIONS = [
    { value: 'finished', label: '✅ Terminé', color: '#28a745' },
    { value: 'dnf', label: '🔥 Abandon', color: '#dc3545' },
    { value: 'dns', label: '❌ Non partant', color: '#6c757d' },
    { value: 'dsq_race', label: '🚫 Déclassement', color: '#fd7e14' },
    { value: 'dsq_general', label: '⛔ Disqualifié', color: '#e83e8c' }
  ];

  useEffect(() => {
    const newTimes = { ...times };
    const newStatuses = { ...statuses };
    
    existingResults.forEach((result: any) => {
      if (result.raceId === race.id) {
        if (!newTimes[result.driverId]?.inputValue) {
          const formatTimeForInput = (seconds: number): string => {
            if (!seconds) return '';
            const minutes = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            const milliseconds = Math.round((seconds % 1) * 1000);
            return `${minutes}:${secs.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
          };
          newStatuses[result.driverId] = result.status || 'finished';
          
          newTimes[result.driverId] = {
            totalTime: result.totalTime,
            penalties: result.penalties || 0,
            inputValue: formatTimeForInput(result.totalTime),
            penaltyValue: (result.penalties || 0).toString()
          };
        }
      }
    });
    
    setTimes(newTimes);
    setStatuses(newStatuses);
  }, [existingResults, race.id]);

  const handleTimeChange = (driverId: string, field: string, value: string) => {
    setTimes((prev: any) => ({
      ...prev,
      [driverId]: {
        ...prev[driverId],
        [field]: field === 'penalties' ? parseFloat(value) || 0 : parseTimeToSeconds(value),
        inputValue: field === 'totalTime' ? value : prev[driverId]?.inputValue,
        penaltyValue: field === 'penalties' ? value : prev[driverId]?.penaltyValue
      }
    }));
  };

  const handleStatusChange = (driverId: string, status: string) => {
    setStatuses((prev: any) => ({
      ...prev,
      [driverId]: status
    }));
    
    if (status !== 'finished') {
      setTimes((prev: any) => ({
        ...prev,
        [driverId]: {
          ...prev[driverId],
          totalTime: 0,
          inputValue: '',
          penaltyValue: ''
        }
      }));
    }
  };

  const parseTimeToSeconds = (timeString: string): number => {
    if (!timeString) return 0;
    
    const parts = timeString.split(':');
    let totalSeconds = 0;
    
    if (parts.length === 2) {
      const minutes = parseInt(parts[0]) || 0;
      const secondsParts = parts[1].split('.');
      const seconds = parseInt(secondsParts[0]) || 0;
      const milliseconds = parseInt(secondsParts[1]?.padEnd(3, '0')) || 0;
      totalSeconds = minutes * 60 + seconds + milliseconds / 1000;
    }
    
    return totalSeconds;
  };

  const handleSubmit = (driverId: string) => {
    const driverData = drivers.find((d: any) => d.id === driverId);
    const timeData = times[driverId];
    const status = statuses[driverId] || 'finished';
    
    if (status !== 'finished') {
      onTimeSubmit(driverData, {
        totalTime: null,
        finalTime: null,
        penalties: 0,
        bestLap: null,
        lapTimes: [],
        position: null,
        status: status
      });
      return;
    }
    
    if (!timeData?.totalTime) {
      alert('Veuillez saisir un temps pour un pilote qui a terminé !');
      return;
    }

    const finalTime = timeData.totalTime + (timeData.penalties || 0);
    
    onTimeSubmit(driverData, {
      totalTime: timeData.totalTime,
      finalTime: finalTime,
      penalties: timeData.penalties || 0,
      bestLap: null,
      lapTimes: [],
      position: null,
      status: 'finished'
    });
  };

  return (
    <div>
      <div style={{ 
        marginBottom: '1rem', 
        padding: '1rem', 
        background: '#667eea', 
        color: 'white', 
        borderRadius: '8px',
        border: '1px solid #5a67d8'
      }}>
        <strong>ℹ️ Manche Qualificative ({race.laps} tours) :</strong> Saisissez le temps total des {race.laps} tours
        <br />
        <small style={{ opacity: 0.9 }}>Format : minutes:secondes.millisecondes (ex: 4:32.123) • Points selon barème 50-45-42-40-39...</small>
      </div>
      
      <div style={{ display: 'grid', gap: '1rem' }}>
        {drivers.sort((a: any, b: any) => a.carNumber - b.carNumber).map((driver: any) => (
          <div key={driver.id} style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 200px 150px 100px 120px', 
            gap: '1rem', 
            alignItems: 'center',
            padding: '1rem',
            border: '1px solid #ddd',
            borderRadius: '8px',
            backgroundColor: times[driver.id]?.totalTime ? '#f0fff0' : 'white'
          }}>
            <div>
              <div style={{ fontWeight: '500', color: '#333' }}>
                #{driver.carNumber} {driver.name}
              </div>
              {driver.team && (
                <div style={{ fontSize: '0.85rem', color: '#666' }}>
                  {driver.team}
                </div>
              )}
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>
                Temps total (MM:SS.mmm)
              </label>
              <input
                type="text"
                placeholder="4:32.123"
                value={times[driver.id]?.inputValue || ''}
                onChange={(e) => handleTimeChange(driver.id, 'totalTime', e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '0.5rem', 
                  border: '1px solid #ccc', 
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  color: '#333',
                  backgroundColor: 'white'
                }}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>
                Pénalité (s)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                placeholder="0"
                value={times[driver.id]?.penalties || ''}
                onChange={(e) => handleTimeChange(driver.id, 'penalties', e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '0.5rem', 
                  border: '1px solid #ccc', 
                  borderRadius: '4px',
                  color: '#333'
                }}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>
                Statut
              </label>
              <select
                value={statuses[driver.id] || 'finished'}
                onChange={(e) => handleStatusChange(driver.id, e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '0.5rem', 
                  border: '1px solid #ccc', 
                  borderRadius: '4px',
                  color: '#333',
                  backgroundColor: 'white',
                  fontSize: '0.85rem'
                }}
              >
                {STATUS_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            
            <button
              onClick={() => handleSubmit(driver.id)}
              disabled={statuses[driver.id] === 'finished' && !times[driver.id]?.totalTime}
              style={{
                padding: '0.5rem 1rem',
                background: (statuses[driver.id] !== 'finished' || times[driver.id]?.totalTime) ? '#28a745' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: (statuses[driver.id] !== 'finished' || times[driver.id]?.totalTime) ? 'pointer' : 'not-allowed',
                fontSize: '0.85rem'
              }}
            >
              💾 Valider
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function RaceInput({ drivers, race, existingResults, onTimeSubmit, formatTime }: any) {
  const [times, setTimes] = useState<any>({});
  const [statuses, setStatuses] = useState<any>({});

  const STATUS_OPTIONS = [
    { value: 'finished', label: '✅ Terminé', color: '#28a745' },
    { value: 'dnf', label: '🔥 Abandon', color: '#dc3545' },
    { value: 'dns', label: '❌ Non partant', color: '#6c757d' },
    { value: 'dsq_race', label: '🚫 Déclassé manche', color: '#fd7e14' },
    { value: 'dsq_general', label: '⛔ Déclassé général', color: '#e83e8c' }
  ];

  const isFinalPhase = race.type === 'semifinal' || race.type === 'final';

  useEffect(() => {
    const newTimes = { ...times };
    const newStatuses = { ...statuses };
    
    existingResults.forEach((result: any) => {
      if (result.raceId === race.id) {
        if (!newTimes[result.driverId]?.inputValue) {
          const formatTimeForInput = (seconds: number): string => {
            if (!seconds) return '';
            const minutes = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            const milliseconds = Math.round((seconds % 1) * 1000);
            return `${minutes}:${secs.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
          };
          
          newTimes[result.driverId] = {
            totalTime: result.totalTime,
            penalties: isFinalPhase ? 0 : (result.penalties || 0),
            inputValue: result.totalTime ? formatTimeForInput(result.totalTime) : '',
            penaltyValue: isFinalPhase ? '0' : (result.penalties || 0).toString()
          };
          
          newStatuses[result.driverId] = result.status || 'finished';
        }
      }
    });
    
    setTimes(newTimes);
    setStatuses(newStatuses);
  }, [existingResults, race.id, isFinalPhase]);

  const handleTimeChange = (driverId: string, field: string, value: string) => {
    setTimes((prev: any) => ({
      ...prev,
      [driverId]: {
        ...prev[driverId],
        [field]: field === 'penalties' ? (isFinalPhase ? 0 : parseFloat(value) || 0) : parseTimeToSeconds(value),
        inputValue: field === 'totalTime' ? value : prev[driverId]?.inputValue,
        penaltyValue: field === 'penalties' ? (isFinalPhase ? '0' : value) : prev[driverId]?.penaltyValue
      }
    }));
  };

  const handleStatusChange = (driverId: string, status: string) => {
    setStatuses((prev: any) => ({
      ...prev,
      [driverId]: status
    }));
    
    if (status !== 'finished') {
      setTimes((prev: any) => ({
        ...prev,
        [driverId]: {
          ...prev[driverId],
          totalTime: 0,
          inputValue: '',
          penaltyValue: isFinalPhase ? '0' : ''
        }
      }));
    }
  };

  const parseTimeToSeconds = (timeString: string): number => {
    if (!timeString) return 0;
    
    const parts = timeString.split(':');
    let totalSeconds = 0;
    
    if (parts.length === 2) {
      const minutes = parseInt(parts[0]) || 0;
      const secondsParts = parts[1].split('.');
      const seconds = parseInt(secondsParts[0]) || 0;
      const milliseconds = parseInt(secondsParts[1]?.padEnd(3, '0')) || 0;
      totalSeconds = minutes * 60 + seconds + milliseconds / 1000;
    } else {
      const secondsParts = timeString.split('.');
      const seconds = parseInt(secondsParts[0]) || 0;
      const milliseconds = parseInt(secondsParts[1]?.padEnd(3, '0')) || 0;
      totalSeconds = seconds + milliseconds / 1000;
    }
    
    return totalSeconds;
  };

  const handleSubmit = (driverId: string) => {
    const driverData = drivers.find((d: any) => d.id === driverId);
    const timeData = times[driverId];
    const status = statuses[driverId] || 'finished';
    
    if (status !== 'finished') {
      onTimeSubmit(driverData, {
        totalTime: null,
        finalTime: null,
        penalties: 0,
        bestLap: null,
        lapTimes: [],
        position: null,
        status: status
      });
      return;
    }
    
    if (!timeData?.totalTime) {
      alert('Veuillez saisir un temps pour un pilote qui a terminé !');
      return;
    }

    const finalTime = timeData.totalTime + (isFinalPhase ? 0 : (timeData.penalties || 0));
    
    onTimeSubmit(driverData, {
      totalTime: timeData.totalTime,
      finalTime: finalTime,
      penalties: isFinalPhase ? 0 : (timeData.penalties || 0),
      bestLap: timeData.totalTime,
      lapTimes: [],
      position: null,
      status: 'finished'
    });
  };

  return (
    <div>
      <div style={{ 
        marginBottom: '1rem', 
        padding: '1rem', 
        background: isFinalPhase ? '#8e24aa' : '#1e3c72',
        color: 'white', 
        borderRadius: '8px',
        border: isFinalPhase ? '1px solid #7b1fa2' : '1px solid #0d47a1'
      }}>
        <strong>ℹ️ {isFinalPhase ? 'Phase Finale' : 'Course'} ({race.laps} tours) :</strong> Saisissez le temps total de la course
        {isFinalPhase && (
          <>
            <br />
            <small style={{ opacity: 0.9, fontWeight: 'bold' }}>
              🚫 Pas de pénalités pour les {race.type === 'semifinal' ? 'demi-finales' : 'finales'}
            </small>
          </>
        )}
        <br />
        <small style={{ opacity: 0.9 }}>Format : minutes:secondes.millisecondes (ex: 7:32.123)</small>
      </div>
      
      <div style={{ display: 'grid', gap: '1rem' }}>
        {drivers.sort((a: any, b: any) => a.carNumber - b.carNumber).map((driver: any) => (
          <div key={driver.id} style={{ 
            display: 'grid', 
            gridTemplateColumns: isFinalPhase 
              ? '1fr 200px 150px 120px'
              : '1fr 200px 150px 100px 120px',
            gap: '1rem', 
            alignItems: 'center',
            padding: '1rem',
            border: '1px solid #ddd',
            borderRadius: '8px',
            backgroundColor: times[driver.id]?.totalTime ? '#f0fff0' : 'white'
          }}>
            <div>
              <div style={{ fontWeight: '500', color: '#333' }}>
                #{driver.carNumber} {driver.name}
              </div>
              {driver.team && (
                <div style={{ fontSize: '0.85rem', color: '#666' }}>
                  {driver.team}
                </div>
              )}
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>
                Temps total (MM:SS.mmm)
              </label>
              <input
                type="text"
                placeholder="7:32.123"
                value={times[driver.id]?.inputValue || ''}
                onChange={(e) => handleTimeChange(driver.id, 'totalTime', e.target.value)}
                disabled={statuses[driver.id] && statuses[driver.id] !== 'finished'}
                style={{ 
                  width: '100%', 
                  padding: '0.5rem', 
                  border: '1px solid #ccc', 
                  borderRadius: '4px',
                  fontFamily: 'monospace',
                  color: '#333',
                  backgroundColor: (statuses[driver.id] && statuses[driver.id] !== 'finished') ? '#f5f5f5' : 'white',
                  cursor: (statuses[driver.id] && statuses[driver.id] !== 'finished') ? 'not-allowed' : 'text'
                }}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>
                Statut
              </label>
              <select
                value={statuses[driver.id] || 'finished'}
                onChange={(e) => handleStatusChange(driver.id, e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '0.5rem', 
                  border: '1px solid #ccc', 
                  borderRadius: '4px',
                  color: '#333',
                  backgroundColor: 'white',
                  fontSize: '0.85rem'
                }}
              >
                {STATUS_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            
            {!isFinalPhase && (
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>
                  Pénalité (s)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="0"
                  value={times[driver.id]?.penaltyValue || ''}
                  onChange={(e) => handleTimeChange(driver.id, 'penalties', e.target.value)}
                  disabled={statuses[driver.id] && statuses[driver.id] !== 'finished'}
                  style={{ 
                    width: '100%', 
                    padding: '0.5rem', 
                    border: '1px solid #ccc', 
                    borderRadius: '4px',
                    color: '#333',
                    backgroundColor: (statuses[driver.id] && statuses[driver.id] !== 'finished') ? '#f5f5f5' : 'white',
                    cursor: (statuses[driver.id] && statuses[driver.id] !== 'finished') ? 'not-allowed' : 'text'
                  }}
                />
              </div>
            )}
            
            <button
              onClick={() => handleSubmit(driver.id)}
              disabled={
                (statuses[driver.id] === 'finished' || !statuses[driver.id]) && 
                !times[driver.id]?.totalTime
              }
              style={{
                padding: '0.5rem 1rem',
                background: (
                  (statuses[driver.id] !== 'finished' && statuses[driver.id]) || 
                  times[driver.id]?.totalTime
                ) ? '#28a745' : '#ccc',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: (
                  (statuses[driver.id] !== 'finished' && statuses[driver.id]) || 
                  times[driver.id]?.totalTime
                ) ? 'pointer' : 'not-allowed',
                fontSize: '0.85rem'
              }}
            >
              💾 Valider
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}