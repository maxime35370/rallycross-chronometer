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
      <h2 style={{ color: '#1e3c72', marginBottom: '1.5rem' }}>
        📝 Gestion des Engagements
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
          <div style={{ marginTop: '1rem', padding: '1rem', background: '#28a745', color: 'white', borderRadius: '8px', border: '1px solid #1e7e34' }}>
  <strong>📋 Contexte :</strong> {selectedMeetingData?.name} • {selectedCategory} {selectedYear}
  <br />
  <small style={{ opacity: 0.9 }}>Pilotes éligibles : même année ({selectedYear}) et même catégorie ({selectedCategory})</small>
</div>
        )}
      </div>

      {/* Liste des pilotes à engager */}
      {selectedMeeting && selectedCategory && (
        <div style={{ 
          background: 'white', 
          borderRadius: '8px', 
          padding: '1.5rem',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          marginBottom: '1.5rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ color: '#333', margin: 0 }}>
              👥 Pilotes {selectedCategory} {selectedYear} ({engagedDrivers.length}/{drivers.length} engagés)
            </h3>
            <button
              onClick={handleSaveEngagements}
              style={{
                padding: '0.5rem 1rem',
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              💾 Sauvegarder
            </button>
          </div>

          {drivers.length === 0 ? (
            <p style={{ color: '#666', textAlign: 'center', padding: '2rem' }}>
              👤 Aucun pilote trouvé pour {selectedCategory} {selectedYear}
            </p>
          ) : (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
              gap: '0.5rem'
            }}>
              {drivers.map(driver => (
                <div
                  key={driver.id}
                  onClick={() => toggleDriverEngagement(driver.id)}
                  style={{
                    padding: '0.75rem',
                    border: '2px solid',
                    borderColor: engagedDrivers.includes(driver.id) ? '#28a745' : '#ddd',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: engagedDrivers.includes(driver.id) ? '#d4edda' : 'white',
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
                    background: engagedDrivers.includes(driver.id) ? '#28a745' : '#ddd',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    {engagedDrivers.includes(driver.id) ? '✓' : ''}
                  </span>
                  
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '500', color: '#333' }}>
                      #{driver.carNumber} {driver.name}
                    </div>
                    {driver.team && (
                      <div style={{ fontSize: '0.85rem', color: '#666' }}>
                        {driver.team}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {drivers.length > 0 && (
            <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => setEngagedDrivers(drivers.map(d => d.id))}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                ✅ Tout sélectionner
              </button>
              <button
                onClick={() => setEngagedDrivers([])}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                ❌ Tout désélectionner
              </button>
            </div>
          )}
        </div>
      )}

      {/* Récapitulatif */}
      {selectedMeeting && (
        <div style={{ 
          background: '#f8f9fa', 
          padding: '1rem', 
          borderRadius: '8px',
          border: '1px solid #e9ecef'
        }}>
          <h4 style={{ color: '#333', marginTop: 0 }}>📊 Récapitulatif du meeting</h4>
          <p style={{ color: '#666', margin: 0 }}>
            <strong>{selectedMeetingData?.name}</strong> • {selectedMeetingData?.location} • {selectedMeetingData && new Date(selectedMeetingData.date).toLocaleDateString('fr-FR')}
          </p>
          <div style={{ marginTop: '0.5rem' }}>
            <strong>Catégories :</strong> {availableCategories.join(', ')}
          </div>
        </div>
      )}
    </div>
  );
}