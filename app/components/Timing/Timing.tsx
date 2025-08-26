import React, { useState, useEffect } from 'react';
import { db } from '../../../config/firebase';
import { collection, addDoc, onSnapshot, query, orderBy, where, updateDoc, doc, getDocs, deleteDoc } from 'firebase/firestore';
import ImprovedTimeTrialsInput from './ImprovedTimeTrialsInput';

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

  // Fonctions utilitaires pour le style du tableau de classement
  const getTimingTableGradient = (type: string): string => {
    const gradients: { [key: string]: string } = {
      'timeTrials': 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
      'qualifying': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'semifinal': 'linear-gradient(135deg, #8e24aa 0%, #7b1fa2 100%)',
      'final': 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)'
    };
    return gradients[type] || 'linear-gradient(135deg, #1E3C72 0%, #2A5298 100%)';
  };

  const getTimingTableColor = (type: string): string => {
    const colors: { [key: string]: string } = {
      'timeTrials': '#28a745',
      'qualifying': '#667eea',
      'semifinal': '#8e24aa',
      'final': '#FFD700'
    };
    return colors[type] || '#1E3C72';
  };

  const getStatusIcon = (status: string): string => {
    const icons: { [key: string]: string } = {
      'dnf': '🔥',
      'dns': '❌',
      'dsq_race': '🚫',
      'dsq_general': '⛔'
    };
    return icons[status] || '⚠️';
  };

  const getStatusBadgeStyleInline = (status: string) => {
    const baseStyle = {
      padding: '0.2rem 0.5rem',
      borderRadius: '8px',
      fontSize: '0.7rem',
      fontWeight: '700' as const,
      color: 'white',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.3px'
    };

    const statusStyles: { [key: string]: any } = {
      'dnf': { ...baseStyle, background: 'linear-gradient(135deg, #dc3545, #c82333)' },
      'dns': { ...baseStyle, background: 'linear-gradient(135deg, #6c757d, #5a6268)' },
      'dsq_race': { ...baseStyle, background: 'linear-gradient(135deg, #fd7e14, #e55353)' },
      'dsq_general': { ...baseStyle, background: 'linear-gradient(135deg, #e83e8c, #d63384)' }
    };

    return statusStyles[status] || { ...baseStyle, background: '#333' };
};


  return (
    <div style={{ padding: '2rem' }}>
      {/* HEADER CHRONOMÉTRAGE MODERNE */}
      <div className="page-header page-header-timing">
        <h2 className="page-title">
          <span className="page-title-icon">⏱️</span>
          Chronométrage des Courses
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
                setSelectedRace(null);
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
                setSelectedRace(null);
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
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setSelectedRace(null);
              }}
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
                  {races.length}
                </div>
                <div className="stat-label">Sessions</div>
              </div>

              {selectedRace && (
                <div className="stat-card stat-card-secondary">
                  <div className="stat-number stat-number-secondary">
                    {driversInfo.length}
                  </div>
                  <div className="stat-label">Pilotes</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* SÉLECTION DE SESSION */}
      {selectedMeeting && selectedCategory && races.length > 0 && (
        <div className="filters-section">
          <div className="filter-item">
            <label className="filter-label">
              <span>🏁</span>
              Session à chronométrer :
            </label>
            <select
              value={selectedRace?.id || ''}
              onChange={(e) => {
                const race = races.find(r => r.id === e.target.value);
                setSelectedRace(race || null);
              }}
              className="select-modern"
              style={{ minWidth: '300px' }}
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
          </div>
          
          {/* CONTEXTE SESSION SÉLECTIONNÉE */}
          {selectedRace && (
            <div className="context-info context-success" style={{ marginTop: '1rem' }}>
              <strong>📋 Session sélectionnée :</strong> {selectedRace.name}
              <div className="context-info-text">
                {selectedRace.laps} tour(s) • {selectedRace.drivers.length} pilote(s) • {getSessionTypeLabel(selectedRace.type).label}
              </div>
            </div>
          )}
        </div>
      )}

      {/* INTERFACE DE CHRONOMÉTRAGE */}
      {selectedRace && driversInfo.length > 0 && (
        <div style={{ 
          background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.9) 100%)',
          backdropFilter: 'blur(12px)',
          border: '2px solid rgba(255, 193, 7, 0.3)',
          borderRadius: '20px',
          padding: '2rem',
          boxShadow: '0 12px 40px rgba(0,0,0,0.1)',
          position: 'relative',
          overflow: 'hidden',
          marginBottom: '2rem'
        }}>
          {/* Barre jaune chronométrage */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(135deg, #ffc107 0%, #fd7e14 100%)',
            borderRadius: '20px 20px 0 0'
          }} />

          <h3 style={{ 
            fontFamily: 'Orbitron, monospace',
            fontWeight: '700',
            color: '#1a1a1a',
            marginTop: 0, 
            marginBottom: '2rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            fontSize: '1.5rem'
          }}>
            <span style={{ fontSize: '2rem' }}>⏱️</span>
            Saisie des temps - {selectedRace.name}
          </h3>

          {selectedRace.type === 'timeTrials' ? (
            <ImprovedTimeTrialsInput 
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

      {/* CLASSEMENT EN TEMPS RÉEL MODERNISÉ */}
{selectedRace && raceResults.length > 0 && (
  <div className="points-table-container points-table-timing">
    {/* Barre de couleur selon le type */}
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '4px',
      background: getTimingTableGradient(selectedRace.type),
      borderRadius: '20px 20px 0 0'
    }} />

    <h3 className="points-table-header">
      <span style={{ fontSize: '1.8rem' }}>🏆</span>
      Classement - {selectedRace.name}
      <span className="points-table-badge">
        🔄 TEMPS RÉEL
      </span>
    </h3>
    
    <table className="points-table-modern">
      <thead>
        <tr>
          <th>POS.</th>
          <th>PILOTE</th>
          <th>TEMPS TOTAL</th>
          {selectedRace.type !== 'timeTrials' && selectedRace.type !== 'qualifying' && (
            <th>MEILLEUR TOUR</th>
          )}
        </tr>
      </thead>
      <tbody>
        {raceResults.filter(result => selectedRace.drivers.includes(result.driverId)).map((result, index) => (
          <tr key={result.id} className={
            result.status === 'finished' ? (
              index === 0 ? 'podium-1' : 
              index === 1 ? 'podium-2' : 
              index === 2 ? 'podium-3' : ''
            ) : 'no-points'
          }>
            <td>
              <span className={`position-cell ${
                result.status === 'finished' ? (
                  index === 0 ? 'position-1' : 
                  index === 1 ? 'position-2' : 
                  index === 2 ? 'position-3' : 'position-other'
                ) : 'position-other'
              }`}>
                {result.status === 'finished' ? (index + 1) : getStatusIcon(result.status)}
              </span>
            </td>
            <td>
              <div className="driver-info">
                <span className="driver-number">
                  #{result.carNumber}
                </span>
                <span className="driver-name">
                  {result.driverName}
                </span>
              </div>
            </td>
            <td>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                <span className="time-cell">
                  {result.status === 'finished' ? formatTime(result.totalTime) : ''}
                </span>
                {result.status !== 'finished' && (
                  <span style={getStatusBadgeStyleInline(result.status)}>
                    {getStatusLabel(result.status)}
                  </span>
                )}
              </div>
            </td>
            {selectedRace.type !== 'timeTrials' && selectedRace.type !== 'qualifying' && (
              <td>
                <span className="time-cell" style={{ fontSize: '1rem', color: '#666' }}>
                  {result.status === 'finished' ? formatTime(result.bestLap) : '-'}
                </span>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
    
    <div className="table-info-footer">
      🏁 <strong>Classement en direct</strong> - Mise à jour automatique après chaque validation
      <br />
      <small style={{ color: getTimingTableColor(selectedRace.type) }}>
        ⚡ Session : {getSessionTypeLabel(selectedRace.type).label} • {selectedRace.laps} tour(s)
      </small>
    </div>
  </div>
)}

      {/* AFFICHAGE DES POINTS (reste identique mais avec bordures modernisées) */}
      {selectedRace && selectedRace.type === 'timeTrials' && raceResults.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <TimeTrialsPointsDisplay 
            meetingId={selectedMeeting}
            category={selectedCategory}
            raceResults={raceResults}
            refreshKey={pointsRefreshKey}
          />
        </div>
      )}

      {selectedRace && selectedRace.type === 'qualifying' && raceResults.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <QualifyingPointsDisplay 
            raceId={selectedRace.id}
            raceName={selectedRace.name}
            category={selectedCategory}
            refreshKey={qualifyingPointsRefreshKey}
          />
        </div>
      )}

      {selectedRace && selectedRace.type === 'semifinal' && raceResults.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <SemifinalPointsDisplay 
            raceId={selectedRace.id}
            raceName={selectedRace.name}
            category={selectedCategory}
            refreshKey={semifinalPointsRefreshKey}
            selectedRace={selectedRace}
          />
        </div>
      )}

      {selectedRace && selectedRace.type === 'final' && raceResults.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <FinalPointsDisplay 
            raceId={selectedRace.id}
            raceName={selectedRace.name}
            category={selectedCategory}
            refreshKey={finalPointsRefreshKey}
            selectedRace={selectedRace}
          />
        </div>
      )}

      {/* ÉTATS VIDES */}
      {selectedMeeting && selectedCategory && races.length === 0 && (
        <div className="empty-state">
          <span className="empty-state-icon">⏱️</span>
          <div className="empty-state-title">Aucune session disponible</div>
          <div className="empty-state-text">
            Aucune session avec pilotes assignés trouvée pour ce meeting/catégorie
            <br />
            <small>Allez dans "🏁 Sessions" pour assigner des pilotes aux sessions</small>
          </div>
        </div>
      )}

      {!selectedMeeting && (
        <div className="empty-state">
          <span className="empty-state-icon">⏱️</span>
          <div className="empty-state-title">Sélectionnez un meeting et une catégorie</div>
          <div className="empty-state-text">
            Choisissez d'abord un meeting et une catégorie pour accéder au chronométrage
          </div>
        </div>
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
      <div className="empty-state">
        <span className="empty-state-icon">📊</span>
        <div className="empty-state-title">Aucun point attribué</div>
        <div className="empty-state-text">
          Aucun point attribué pour les essais chronométrés
        </div>
      </div>
    );
  }

  return (
    <div className="points-table-container points-table-timetrials">
      <h3 className="points-table-header">
        <span style={{ fontSize: '1.8rem' }}>🏁</span>
        Points Essais Chronométrés - {category}
        <span className="points-table-badge">
          🔄 Temps réel
        </span>
      </h3>
      
      <table className="points-table-modern">
        <thead>
          <tr>
            <th>Pos.</th>
            <th>Pilote</th>
            <th>Temps</th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point, index) => (
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
                }`}>
                  {point.position}
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
                <span className="time-cell">
                  {formatTime(point.bestTime)}
                </span>
              </td>
              <td>
                <span className={`points-cell ${point.points > 0 ? 'points-positive' : 'points-zero'}`}>
                  {point.points > 0 ? `${point.points} pts` : '-'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <div className="table-info-footer">
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

  const getStatusBadgeStyle = (status: string) => {
    const baseStyle = {
      padding: '0.25rem 0.6rem',
      borderRadius: '12px',
      fontSize: '0.8rem',
      fontWeight: '700',
      color: 'white',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.5px'
    };

    const statusStyles: { [key: string]: any } = {
      'finished': { ...baseStyle, background: 'linear-gradient(135deg, #28a745, #20c997)' },
      'dnf': { ...baseStyle, background: 'linear-gradient(135deg, #dc3545, #c82333)' },
      'dns': { ...baseStyle, background: 'linear-gradient(135deg, #6c757d, #5a6268)' },
      'dsq_race': { ...baseStyle, background: 'linear-gradient(135deg, #fd7e14, #e55353)' },
      'dsq_general': { ...baseStyle, background: 'linear-gradient(135deg, #e83e8c, #d63384)' }
    };

    return statusStyles[status] || { ...baseStyle, background: '#333' };
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
      <div className="empty-state">
        <span className="empty-state-icon">📊</span>
        <div className="empty-state-title">Aucun point attribué</div>
        <div className="empty-state-text">
          Aucun point attribué pour cette manche qualificative
        </div>
      </div>
    );
  }

  const engagesPresents = points[0]?.engagesPresents || 0;

  return (
    <div className="points-table-container points-table-qualifying">
      <h3 className="points-table-header">
        <span style={{ fontSize: '1.8rem' }}>🏃</span>
        Points {raceName} - {category}
        <span className="points-table-badge">
          🔄 Temps réel
        </span>
      </h3>
      
      <div style={{ 
        marginBottom: '1.5rem', 
        fontSize: '0.9rem', 
        color: '#666',
        background: 'rgba(248, 249, 250, 0.8)',
        backdrop: 'blur(8px)',
        padding: '1rem',
        borderRadius: '8px',
        border: '1px solid rgba(0,0,0,0.05)'
      }}>
        <div style={{ marginBottom: '0.5rem' }}>
          👥 <strong>{engagesPresents} engagés présents</strong> dans cette manche
        </div>
        <div style={{ marginBottom: '0.5rem' }}>
          📊 <strong>Barème :</strong> 1er=50pts • 2ème=45pts • 3ème=42pts • 4ème=40pts • 5ème=39pts • puis -1pt par position
        </div>
        <div>
          ⚖️ <strong>Pénalités :</strong> Abandon = +1 pos • Déclassé = +3 pos • Non partant/Disqualifié = 0pt
        </div>
      </div>
      
      <table className="points-table-modern">
        <thead>
          <tr>
            <th>Pos.</th>
            <th>Pilote</th>
            <th>Temps</th>
            <th>Statut</th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point, index) => (
            <tr key={point.id} className={
              point.status === 'finished' && index < 3 ?
                (index === 0 ? 'podium-1' : index === 1 ? 'podium-2' : 'podium-3') : 
                point.points === 0 ? 'no-points' : ''
            }>
              <td>
                <span className={`position-cell ${
                  point.status === 'finished' && index < 3 ? 
                    (index === 0 ? 'position-1' : index === 1 ? 'position-2' : 'position-3') : 
                    'position-other'
                }`}>
                  {point.status === 'finished' ? point.position : '-'}
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
                <span className="time-cell">
                  {formatTime(point.totalTime || 0)}
                </span>
              </td>
              <td>
                <span style={getStatusBadgeStyle(point.status)}>
                  {getStatusLabel(point.status)}
                </span>
              </td>
              <td>
                <span className={`points-cell ${point.points > 0 ? 'points-positive' : 'points-zero'}`}>
                  {point.points > 0 ? `${point.points} pts` : '0 pt'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <div className="table-info-footer">
        💡 <strong>Système de points qualificatifs :</strong> Récompense la régularité et la performance sur {engagesPresents} engagés
        <br />
        <small style={{ color: '#667eea' }}>🔄 Calcul automatique avec gestion des abandons et pénalités</small>
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
      <div className="empty-state">
        <span className="empty-state-icon">📊</span>
        <div className="empty-state-title">Aucun point attribué</div>
        <div className="empty-state-text">
          Aucun point attribué pour cette demi-finale
        </div>
      </div>
    );
  }

  return (
    <div className="points-table-container points-table-semifinal">
      <h3 className="points-table-header">
        <span style={{ fontSize: '1.8rem' }}>🥈</span>
        Points {raceName} - {category}
        <span className="points-table-badge">
          🔄 Temps réel
        </span>
      </h3>
      
      <div style={{ 
        marginBottom: '1.5rem', 
        fontSize: '0.9rem', 
        color: '#666',
        background: 'rgba(248, 249, 250, 0.8)',
        backdrop: 'blur(8px)',
        padding: '1rem',
        borderRadius: '8px',
        border: '1px solid rgba(0,0,0,0.05)'
      }}>
        <div style={{ marginBottom: '0.5rem' }}>
          📊 <strong>Barème :</strong> 1er=10pts • 2ème=8pts • 3ème=6pts • 4ème=5pts • 5ème=4pts • 6ème=3pts • 7ème=2pts • 8ème=1pt
        </div>
        <div>
          ⚖️ <strong>Règles :</strong> Non partant = classé après + 0pt
        </div>
      </div>
      
      <table className="points-table-modern">
        <thead>
          <tr>
            <th>Pos.</th>
            <th>Pilote</th>
            <th>Temps</th>
            <th>Statut</th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
          {points.filter(point => selectedRace?.drivers?.includes(point.driverId)).map((point, index) => (
            <tr key={point.id} className={
              point.status === 'finished' && index < 3 ?
                (index === 0 ? 'podium-1' : index === 1 ? 'podium-2' : 'podium-3') : 
                point.points === 0 ? 'no-points' : ''
            }>
              <td>
                <span className={`position-cell ${
                  point.status === 'finished' && index < 3 ? 
                    (index === 0 ? 'position-1' : index === 1 ? 'position-2' : 'position-3') : 
                    'position-other'
                }`}>
                  {point.position}
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
                <span className="time-cell">
                  {formatTime(point.totalTime || 0)}
                </span>
              </td>
              <td>
                <span style={{
                  background: point.status === 'finished' ? 'linear-gradient(135deg, #28a745, #20c997)' : 'linear-gradient(135deg, #6c757d, #5a6268)',
                  color: 'white',
                  padding: '0.25rem 0.6rem',
                  borderRadius: '12px',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  {point.status === 'finished' ? '✅ Terminé' : '❌ Non partant'}
                </span>
              </td>
              <td>
                <span className={`points-cell ${point.points > 0 ? 'points-positive' : 'points-zero'}`}>
                  {point.points > 0 ? `${point.points} pts` : '0 pt'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <div className="table-info-footer">
        🥈 <strong>Points demi-finale :</strong> Maximum 8 pilotes par demi-finale
        <br />
        <small style={{ color: '#8e24aa' }}>⚡ Les 4 premiers de chaque demi-finale accèdent à la finale</small>
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
      <div className="empty-state">
        <span className="empty-state-icon">📊</span>
        <div className="empty-state-title">Aucun point attribué</div>
        <div className="empty-state-text">
          Aucun point attribué pour cette finale
        </div>
      </div>
    );
  }

  return (
    <div className="points-table-container points-table-final">
      <h3 className="points-table-header">
        <span style={{ fontSize: '1.8rem' }}>🏆</span>
        Points {raceName} - {category}
        <span className="points-table-badge">
          🔄 Temps réel
        </span>
      </h3>
      
      <div style={{ 
        marginBottom: '1.5rem', 
        fontSize: '0.9rem', 
        color: '#666',
        background: 'rgba(248, 249, 250, 0.8)',
        backdrop: 'blur(8px)',
        padding: '1rem',
        borderRadius: '8px',
        border: '1px solid rgba(0,0,0,0.05)'
      }}>
        <div style={{ marginBottom: '0.5rem' }}>
          📊 <strong>Barème :</strong> 1er=15pts • 2ème=12pts • 3ème=10pts • 4ème=8pts • 5ème=6pts • 6ème=5pts • 7ème=4pts • 8ème=3pts
        </div>
        <div>
          🏆 <strong>Finale :</strong> Les 8 meilleurs pilotes des demi-finales • Maximum de points possible
        </div>
      </div>
      
      <table className="points-table-modern">
        <thead>
          <tr>
            <th>Pos.</th>
            <th>Pilote</th>
            <th>Temps</th>
            <th>Statut</th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
          {points.filter(point => selectedRace?.drivers?.includes(point.driverId)).map((point, index) => (
            <tr key={point.id} className={
              point.status === 'finished' && index < 3 ?
                (index === 0 ? 'podium-1' : index === 1 ? 'podium-2' : 'podium-3') : 
                point.points === 0 ? 'no-points' : ''
            }>
              <td>
                <span className={`position-cell ${
                  point.status === 'finished' && index < 3 ? 
                    (index === 0 ? 'position-1' : index === 1 ? 'position-2' : 'position-3') : 
                    'position-other'
                }`}>
                  {point.position}
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
                <span className="time-cell">
                  {formatTime(point.totalTime || 0)}
                </span>
              </td>
              <td>
                <span style={{
                  background: point.status === 'finished' ? 'linear-gradient(135deg, #28a745, #20c997)' : 'linear-gradient(135deg, #6c757d, #5a6268)',
                  color: 'white',
                  padding: '0.25rem 0.6rem',
                  borderRadius: '12px',
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  {point.status === 'finished' ? '✅ Terminé' : '❌ Non partant'}
                </span>
              </td>
              <td>
                <span className={`points-cell ${point.points > 0 ? 'points-positive' : 'points-zero'}`}>
                  {point.points > 0 ? `${point.points} pts` : '0 pt'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <div className="table-info-footer">
        🏆 <strong>Finale officielle :</strong> Course décisive du meeting
        <br />
        <small style={{ color: '#FFD700' }}>👑 Le vainqueur remporte 15 points bonus pour le championnat</small>
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
      {/* Info box avec la MÊME classe que les qualifs */}
      <div className="session-info-box">
        <div className="session-info-title">
          <span>ℹ️</span>
          <strong>Essais Chronométrés :</strong>
        </div>
        <div className="session-info-text">
          Saisissez le meilleur temps de chaque pilote (1 tour)
          <br />
          <small>Format : secondes.millisecondes (ex: 63.456) • Les 5 premiers marquent des points !</small>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
        [field]: parseTimeToSeconds(value), // ✨ Retire la gestion des pénalités
        inputValue: value
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
      finalTime: timeData.totalTime, // ✨ Pas de pénalité ajoutée
      penalties: 0, // ✨ Toujours 0
      bestLap: null,
      lapTimes: [],
      position: null,
      status: 'finished'
    });
  };

  return (
    <div>
      {/* Info box modernisée */}
      <div className="session-info-box qualifying">
        <div className="session-info-title">
          <span>ℹ️</span>
          Manche Qualificative ({race.laps} tours) :
        </div>
        <div className="session-info-text">
          Saisissez le temps total des {race.laps} tours
          <br />
          <small>Format : minutes:secondes.millisecondes (ex: 4:32.123) • Points selon barème 50-45-42-40-39...</small>
          <br />
          <strong style={{ color: '#1565c0' }}>📝 Pas de pénalités en manches qualificatives</strong>
        </div>
      </div>
      
      {/* Grille des pilotes uniformisée - SANS pénalités */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {drivers.sort((a: any, b: any) => a.carNumber - b.carNumber).map((driver: any) => (
          <div key={driver.id} className={`timing-input-container ${times[driver.id]?.totalTime ? 'has-time' : ''}`}>
            
            {/* Info pilote */}
            <div className="timing-driver-info">
              <div className="timing-driver-details">
                <div className="timing-driver-number">
                  #{driver.carNumber}
                </div>
                <div>
                  <div className="timing-driver-name">
                    {driver.name}
                  </div>
                  {driver.team && (
                    <div className="timing-driver-team">
                      🏁 {driver.team}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Grille de saisie SIMPLIFIÉE */}
            <div className="timing-inputs-grid" style={{ gridTemplateColumns: '1fr 200px 120px' }}> {/* ✨ 3 colonnes au lieu de 4 */}
              <div className="timing-input-group">
                <label className="timing-input-label">
                  <span>⏱️</span>
                  Temps total (MM:SS.mmm)
                </label>
                <input
                  type="text"
                  placeholder="4:32.123"
                  value={times[driver.id]?.inputValue || ''}
                  onChange={(e) => handleTimeChange(driver.id, 'totalTime', e.target.value)}
                  className="timing-input-field"
                />
              </div>
              
              {/* ✨ SUPPRIMÉ : Le champ pénalités */}
              
              <div className="timing-input-group">
                <label className="timing-input-label">
                  <span>📊</span>
                  Statut
                </label>
                <select
                  value={statuses[driver.id] || 'finished'}
                  onChange={(e) => handleStatusChange(driver.id, e.target.value)}
                  className="timing-select-field"
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
                className="timing-validate-btn"
              >
                <span>💾</span>
                Valider
              </button>
            </div>
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
      {/* Info box modernisée */}
      <div className="session-info-box race">
        <div className="session-info-title">
          <span>ℹ️</span>
          {isFinalPhase ? 'Phase Finale' : 'Course'} ({race.laps} tours) :
        </div>
        <div className="session-info-text">
          Saisissez le temps total de la course
          {isFinalPhase && (
            <>
              <br />
              <strong style={{ color: '#7b1fa2' }}>
                🚫 Pas de pénalités pour les {race.type === 'semifinal' ? 'demi-finales' : 'finales'}
              </strong>
            </>
          )}
          <br />
          <small>Format : minutes:secondes.millisecondes (ex: 7:32.123)</small>
        </div>
      </div>
      
      {/* Grille des pilotes uniformisée */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {drivers.sort((a: any, b: any) => a.carNumber - b.carNumber).map((driver: any) => (
          <div key={driver.id} className={`timing-input-container ${times[driver.id]?.totalTime ? 'has-time' : ''}`}>
            
            {/* Info pilote */}
            <div className="timing-driver-info">
              <div className="timing-driver-details">
                <div className="timing-driver-number">
                  #{driver.carNumber}
                </div>
                <div>
                  <div className="timing-driver-name">
                    {driver.name}
                  </div>
                  {driver.team && (
                    <div className="timing-driver-team">
                      🏁 {driver.team}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* Grille de saisie - AVEC ou SANS pénalités selon le type */}
            <div 
              className="timing-inputs-grid" 
              style={{ 
                gridTemplateColumns: isFinalPhase 
                  ? '1fr 200px 120px'        // Pas de pénalités pour finales
                  : '1fr 150px 200px 120px', // Avec pénalités pour autres courses
                gap: '2rem'
              }}
            >
              <div className="timing-input-group">
                <label className="timing-input-label">
                  <span>⏱️</span>
                  Temps total (MM:SS.mmm)
                </label>
                <input
                  type="text"
                  placeholder="7:32.123"
                  value={times[driver.id]?.inputValue || ''}
                  onChange={(e) => handleTimeChange(driver.id, 'totalTime', e.target.value)}
                  disabled={statuses[driver.id] && statuses[driver.id] !== 'finished'}
                  className="timing-input-field"
                />
              </div>

              {/* Champ pénalités SEULEMENT si pas finale */}
              {!isFinalPhase && (
                <div className="timing-input-group">
                  <label className="timing-input-label">
                    <span>⚠️</span>
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
                    className="timing-input-field"
                  />
                </div>
              )}
              
              <div className="timing-input-group">
                <label className="timing-input-label">
                  <span>📊</span>
                  Statut
                </label>
                <select
                  value={statuses[driver.id] || 'finished'}
                  onChange={(e) => handleStatusChange(driver.id, e.target.value)}
                  className="timing-select-field"
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
                disabled={
                  (statuses[driver.id] === 'finished' || !statuses[driver.id]) && 
                  !times[driver.id]?.totalTime
                }
                className="timing-validate-btn"
              >
                <span>💾</span>
                Valider
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}