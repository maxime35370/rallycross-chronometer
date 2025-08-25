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

// Helper pour les couleurs de catégories
  const getCategoryBadgeClass = (category: string): string => {
    const badgeClasses: { [key: string]: string } = {
      'Supercar': 'badge-supercar',
      'Super1600': 'badge-super1600', 
      'Juniors': 'badge-juniors',
      'Féminines': 'badge-feminines',
      'D3': 'badge-d3',
      'D4': 'badge-d4'
    };
    return badgeClasses[category] || 'badge-supercar';
  };

  return (
    <div style={{ padding: '2rem' }}>
      {/* HEADER PILOTES MODERNE */}
      <div className="page-header page-header-drivers">
        <h2 className="page-title">
          <span className="page-title-icon">👥</span>
          Gestion des Pilotes
        </h2>
      </div>

      {/* FILTRES HARMONISÉS */}
      <div className="filters-section">
        <div className="filters-grid">
          <div className="filter-group">
            <label className="filter-label">
              <span>🏆</span>
              Catégorie
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="select-modern"
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          
          <div className="filter-group">
            <label className="filter-label">
              <span>📅</span>
              Saison
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="select-modern"
            >
              <option value={2024}>🏁 2024</option>
              <option value={2025}>🏁 2025</option>
              <option value={2026}>🏁 2026</option>
            </select>
          </div>

          <div className="stat-item-modern">
            <div className="stat-number stat-number-primary">
              {drivers.length}
            </div>
            <div className="stat-label">
              Pilote(s) {selectedCategory}
            </div>
          </div>
        </div>
      </div>

      {/* Bouton d'ajout modernisé */}
      <button
        onClick={() => setShowForm(!showForm)}
        className={`action-btn ${showForm ? 'action-btn-cancel' : 'action-btn-primary'}`}
        style={{ marginBottom: showForm ? '2rem' : '3rem' }} // ✨ Style conditionnel
      >
        <span className="btn-icon">
          {showForm ? '❌' : '➕'}
        </span>
        {showForm ? 'Annuler' : 'Ajouter un pilote'}
      </button>

      {/* Formulaire d'ajout */}
      {showForm && (
          <div className="modern-form">
            <h3 className="form-title">
              <span>🏎️</span>
              Nouveau Pilote
            </h3>
            
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label required">
                    <span>👤</span>
                    Nom du pilote
                  </label>
                  <input
                    type="text"
                    required
                    value={newDriver.name}
                    onChange={(e) => setNewDriver({...newDriver, name: e.target.value})}
                    placeholder="ex: Jean Dupont"
                    className="modern-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label required">
                    <span>🔢</span>
                    Numéro de voiture
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="999"
                    value={newDriver.carNumber}
                    onChange={(e) => setNewDriver({...newDriver, carNumber: e.target.value})}
                    placeholder="ex: 23"
                    className="modern-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label required">
                    <span>🏆</span>
                    Catégorie
                  </label>
                  <select
                    required
                    value={newDriver.category}
                    onChange={(e) => setNewDriver({...newDriver, category: e.target.value})}
                    className="modern-select"
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    <span>🏁</span>
                    Équipe
                  </label>
                  <input
                    type="text"
                    value={newDriver.team}
                    onChange={(e) => setNewDriver({...newDriver, team: e.target.value})}
                    placeholder="ex: Team Racing Pro"
                    className="modern-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label required">
                    <span>📅</span>
                    Saison
                  </label>
                  <input
                    type="number"
                    required
                    min="2020"
                    max="2030"
                    value={newDriver.year}
                    onChange={(e) => setNewDriver({...newDriver, year: parseInt(e.target.value)})}
                    className="modern-input"
                  />
                </div>
              </div>

              <div className="form-actions">
                <button 
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="cancel-btn"
                >
                  <span>❌</span>
                  Annuler
                </button>
                
                <button 
                  type="submit" 
                  className="submit-btn"
                >
                  <span>💾</span>
                  {editingDriver ? 'Modifier' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
      )}

      {/* Liste des pilotes en cartes */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', 
        gap: '1.5rem'
      }}>
        {drivers.length === 0 ? (
          <div style={{ 
            gridColumn: '1 / -1',
            background: 'rgba(255,255,255,0.9)',
            borderRadius: '16px',
            padding: '3rem',
            textAlign: 'center',
            color: '#666',
            backdropFilter: 'blur(12px)',
            border: '2px dashed #ccc'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏎️</div>
            <h3 style={{ color: '#333', marginBottom: '0.5rem' }}>Aucun pilote enregistré</h3>
            <p>Cliquez sur "Ajouter un pilote" pour commencer</p>
          </div>
        ) : (
          drivers.map((driver) => (
            <div key={driver.id} className="pilot-card">
              {/* Numéro et nom */}
              <div className="pilot-number">
                <span>🏎️</span>
                #{driver.carNumber}
              </div>
              
              <div className="pilot-name">
                {driver.name}
              </div>
              
              {/* Informations */}
              <div className="pilot-info">
                <span className={`pilot-badge ${getCategoryBadgeClass(driver.category)}`}>
                  🏆 {driver.category}
                </span>
                
                {driver.team && (
                  <span className="pilot-badge" style={{ 
                    background: 'linear-gradient(135deg, #e3f2fd, #bbdefb)', 
                    color: '#1565c0' 
                  }}>
                    🏁 {driver.team}
                  </span>
                )}
                
                <span className="pilot-badge" style={{ 
                  background: 'linear-gradient(135deg, #f3e5f5, #e1bee7)', 
                  color: '#7b1fa2' 
                }}>
                  📅 {driver.year}
                </span>
                
                <span className="pilot-badge badge-engaged">
                  ✅ Actif
                </span>
              </div>
              
              {/* Actions */}
              <div className="pilot-actions">
                <button
                  onClick={() => handleEdit(driver)}
                  style={{
                    background: 'linear-gradient(135deg, #ffc107, #ff9800)',
                    color: 'white'
                  }}
                  title="Modifier le pilote"
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleDelete(driver.id)}
                  style={{
                    background: 'linear-gradient(135deg, #f44336, #d32f2f)',
                    color: 'white'
                  }}
                  title="Supprimer le pilote"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <p style={{ marginTop: '1rem', color: '#666' }}>
        📊 Total : {drivers.length} pilote(s)
      </p>
    </div>
  );
}