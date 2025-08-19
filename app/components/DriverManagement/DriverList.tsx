import React, { useState, useEffect } from 'react';
import { db } from '../../../config/firebase';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, where, getDocs } from 'firebase/firestore';

const CATEGORIES = [
  'Supercar',
  'Super1600', 
  'Juniors',
  'Féminines',
  'D3',
  'D4'
];

export default function DriverList() {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingDriver, setEditingDriver] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('Supercar');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [newDriver, setNewDriver] = useState({
    name: '',
    carNumber: '',
    category: selectedCategory,
    team: '',
    year: new Date().getFullYear()
  });
  
  useEffect(() => {
  setNewDriver(prev => ({
    ...prev,
    category: selectedCategory
  }));
}, [selectedCategory]);
  
  useEffect(() => {
  const q = query(collection(db, 'drivers'), orderBy('carNumber'));
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const driversData: any[] = [];
    querySnapshot.forEach((doc) => {
      const driverData = { id: doc.id, ...doc.data() } as any;
      // Filtrer par catégorie ET par année
      if (driverData.category === selectedCategory && driverData.year === selectedYear) {
        driversData.push(driverData);
      }
    });
    setDrivers(driversData);
  });

  return () => unsubscribe();
}, [selectedCategory, selectedYear]);


  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  try {
    if (editingDriver) {
      // Modifier le pilote existant
      await updateDoc(doc(db, 'drivers', editingDriver.id), {
        ...newDriver,
        carNumber: parseInt(newDriver.carNumber),
        updatedAt: new Date()
      });
    } else {
      // Ajouter un nouveau pilote
      await addDoc(collection(db, 'drivers'), {
        ...newDriver,
        carNumber: parseInt(newDriver.carNumber),
        createdAt: new Date()
      });
    }

    // Reset du formulaire
    setNewDriver({
    name: '',
    carNumber: '',
    category: selectedCategory,  
    team: '',
    year: selectedYear          
});
    setShowForm(false);
    setEditingDriver(null);
  } catch (error) {
    console.error('Erreur:', error);
    alert('Erreur lors de la sauvegarde');
  }
};
const handleEdit = (driver: any) => {
  setEditingDriver(driver);
  setNewDriver({
    name: driver.name,
    carNumber: driver.carNumber.toString(),
    category: driver.category,
    team: driver.team || '',
    year: driver.year || new Date().getFullYear()
  });
  setShowForm(true);
};

const handleDelete = async (driverId: string) => {
  // Vérifier si le pilote est engagé dans un meeting
  const engagementsQuery = query(
    collection(db, 'engagements'),
    where('driverIds', 'array-contains', driverId)
  );
  
  try {
    const engagementsSnapshot = await getDocs(engagementsQuery);
    
    if (!engagementsSnapshot.empty) {
      alert('❌ Impossible de supprimer ce pilote !\nIl est engagé dans un ou plusieurs meetings.');
      return;
    }

    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce pilote ?')) {
      await deleteDoc(doc(db, 'drivers', driverId));
    }
  } catch (error) {
    console.error('Erreur lors de la suppression:', error);
    alert('Erreur lors de la suppression du pilote');
  }
};

  return (
    <div style={{ padding: '2rem' }}>
      <h2 style={{ color: '#1e3c72', marginBottom: '1.5rem' }}>
        👥 Gestion des Pilotes
      </h2>
      <div style={{ 
  background: '#f8f9fa', 
  padding: '1rem', 
  borderRadius: '8px', 
  marginBottom: '1.5rem',
  border: '1px solid #e9ecef'
}}>
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'end' }}>
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
        {CATEGORIES.map(cat => (
          <option key={cat} value={cat}>{cat}</option>
        ))}
      </select>
    </div>
    
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
  </div>
</div>
        

      {/* Bouton d'ajout */}
      <button
        onClick={() => {
            setShowForm(!showForm);
            }}
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
        {showForm ? '❌ Annuler' : '➕ Ajouter un pilote'}
      </button>

      {/* Formulaire d'ajout */}
      {showForm && (
        <div style={{ 
          background: '#f8f9fa', 
          padding: '1.5rem', 
          borderRadius: '8px', 
          marginBottom: '2rem',
          color: '#333' 
        }}>
          <h3>➕ Nouveau pilote</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#333' }}>Nom du pilote *</label>
                <input
                  type="text"
                  required
                  value={newDriver.name}
                  onChange={(e) => setNewDriver({...newDriver, name: e.target.value})}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#333' }}>N° de voiture *</label>
                <input
                  type="number"
                  required
                  min="1"
                  max="999"
                  value={newDriver.carNumber}
                  onChange={(e) => setNewDriver({...newDriver, carNumber: e.target.value})}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#333' }}>Catégorie *</label>
                <select
                  required
                  value={newDriver.category}
                  onChange={(e) => setNewDriver({...newDriver, category: e.target.value})}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#333' }}>Équipe</label>
                <input
                  type="text"
                  value={newDriver.team}
                  onChange={(e) => setNewDriver({...newDriver, team: e.target.value})}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>
                <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#333' }}>Année *</label>
                    <input
                        type="number"
                        required
                        min="2020"
                        max="2030"
                        value={newDriver.year}
                        onChange={(e) => setNewDriver({...newDriver, year: parseInt(e.target.value)})}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                </div>
            </div>

            <button 
              type="submit" 
              style={{
                marginTop: '1rem',
                padding: '0.75rem 1.5rem',
                background: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              ➕ Ajouter
            </button>
          </form>
        </div>
      )}

      {/* Liste des pilotes */}
      <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#667eea', color: 'white' }}>
              <th style={{ padding: '1rem', textAlign: 'left' }}>N° Voiture</th>
              <th style={{ padding: '1rem', textAlign: 'left' }}>Pilote</th>
              <th style={{ padding: '1rem', textAlign: 'left' }}>Catégorie</th>
              <th style={{ padding: '1rem', textAlign: 'left' }}>Équipe</th>
              <th style={{ padding: '1rem', textAlign: 'left' }}>Année</th>
              <th style={{ padding: '1rem', textAlign: 'left' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {drivers.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
                  👤 Aucun pilote enregistré
                </td>
              </tr>
            ) : (
              drivers.map((driver) => (
                <tr key={driver.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ 
                      background: '#667eea', 
                      color: 'white', 
                      padding: '0.25rem 0.75rem', 
                      borderRadius: '20px', 
                      fontWeight: 'bold' 
                    }}>
                      #{driver.carNumber}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', fontWeight: '500', color: '#333'  }}>{driver.name}</td>
                  <td style={{ padding: '1rem' , color: '#333' }}>{driver.category}</td>
                  <td style={{ padding: '1rem', color: '#333'  }}>{driver.team || '—'}</td>
                  <td style={{ padding: '1rem', color: '#333' }}>{driver.year}</td>
                  <td style={{ padding: '1rem' }}>
  <button
    onClick={() => handleEdit(driver)}
    style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', background: '#ffc107', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
  >
    ✏️ Modifier
  </button>
  <button
    onClick={() => handleDelete(driver.id)}
    style={{ padding: '0.25rem 0.5rem', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
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
        📊 Total : {drivers.length} pilote(s)
      </p>
    </div>
  );
}