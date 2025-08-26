import React, { useState, useEffect, useRef } from 'react';

interface ImprovedQualifyingInputProps {
  drivers: any[];
  race: any;
  existingResults: any[];
  onTimeSubmit: (driverData: any, timeData: any) => void;
  formatTime: (seconds: number) => string;
}

export default function ImprovedQualifyingInput({ 
  drivers, 
  race,
  existingResults, 
  onTimeSubmit, 
  formatTime
}: ImprovedQualifyingInputProps) {
  const [times, setTimes] = useState<any>({});
  const [statuses, setStatuses] = useState<any>({});
  const [currentFocusDriverId, setCurrentFocusDriverId] = useState<string>('');
  const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const STATUS_OPTIONS = [
    { value: 'finished', label: '✅ Terminé', color: '#28a745' },
    { value: 'dnf', label: '🔥 Abandon', color: '#dc3545' },
    { value: 'dns', label: '❌ Non partant', color: '#6c757d' },
    { value: 'dsq_race', label: '🚫 Déclassement', color: '#fd7e14' },
    { value: 'dsq_general', label: '⛔ Disqualifié', color: '#e83e8c' }
  ];

  const formatTimeForInput = (seconds: number): string => {
    if (!seconds) return '';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.round((seconds % 1) * 1000);
    return `${minutes}:${secs.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
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

  // Initialiser les temps et statuts depuis les résultats existants
  useEffect(() => {
    const newTimes: any = {};
    const newStatuses: any = {};
    
    // Initialiser avec les résultats existants
    existingResults.forEach((result: any) => {
      if (result.raceId === race.id) {
        newTimes[result.driverId] = {
          totalTime: result.totalTime,
          inputValue: result.totalTime ? formatTimeForInput(result.totalTime) : '',
          hasResult: true
        };
        newStatuses[result.driverId] = result.status || 'finished';
      }
    });
    
    // Initialiser les pilotes assignés à cette session sans résultats
    if (race.drivers && Array.isArray(race.drivers)) {
      race.drivers.forEach((driverId: string) => {
        if (!newTimes[driverId]) {
          newTimes[driverId] = {
            totalTime: 0,
            inputValue: '',
            hasResult: false
          };
        }
        if (!newStatuses[driverId]) {
          newStatuses[driverId] = 'finished';
        }
      });
    }
    
    setTimes(newTimes);
    setStatuses(newStatuses);
    
    // Focus sur le premier pilote sans résultat
    if (race.drivers && Array.isArray(race.drivers)) {
      const driversWithoutResults = race.drivers
        .filter((driverId: string) => !newTimes[driverId]?.hasResult)
        .sort((a: string, b: string) => {
          const driverA = drivers.find(d => d.id === a);
          const driverB = drivers.find(d => d.id === b);
          return (driverA?.carNumber || 0) - (driverB?.carNumber || 0);
        });
        
      if (driversWithoutResults.length > 0 && !currentFocusDriverId) {
        setCurrentFocusDriverId(driversWithoutResults[0]);
      }
    }
  }, [existingResults, race.id, race.drivers, drivers]);

  // Séparer les pilotes en 2 groupes
  const separateDrivers = () => {
    if (!race.drivers || !Array.isArray(race.drivers)) {
      return { driversWithoutResults: [], driversWithResults: [] };
    }

    const driversWithoutResults: any[] = [];
    const driversWithResults: any[] = [];

    race.drivers.forEach((driverId: string) => {
      const driver = drivers.find(d => d.id === driverId);
      if (!driver) return;

      const driverTime = times[driverId];
      const driverStatus = statuses[driverId];
      
      const driverData = {
        ...driver,
        totalTime: driverTime?.totalTime || 0,
        inputValue: driverTime?.inputValue || '',
        hasResult: driverTime?.hasResult || false,
        status: driverStatus || 'finished'
      };

      if (driverTime?.hasResult) {
        driversWithResults.push(driverData);
      } else {
        driversWithoutResults.push(driverData);
      }
    });

    // Trier les pilotes sans résultats par numéro de voiture
    driversWithoutResults.sort((a, b) => a.carNumber - b.carNumber);

    // Trier les pilotes avec résultats par temps (classement)
    driversWithResults.sort((a, b) => {
      if (a.status !== 'finished') return 1;
      if (b.status !== 'finished') return -1;
      return (a.totalTime || 0) - (b.totalTime || 0);
    });

    return { driversWithoutResults, driversWithResults };
  };

  const handleTimeChange = (driverId: string, value: string) => {
    setTimes((prev: any) => ({
      ...prev,
      [driverId]: {
        ...prev[driverId],
        inputValue: value,
        totalTime: parseTimeToSeconds(value)
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
          inputValue: ''
        }
      }));
    }
  };

  const saveResult = async (driverId: string) => {
    const driverData = drivers.find(d => d.id === driverId);
    const timeData = times[driverId];
    const status = statuses[driverId] || 'finished';
    
    if (!driverData) return;

    if (status === 'finished' && !timeData?.totalTime) {
      return;
    }

    const finalTime = timeData?.totalTime || 0;
    
    await onTimeSubmit(driverData, {
      totalTime: status === 'finished' ? finalTime : null,
      finalTime: status === 'finished' ? finalTime : null,
      penalties: 0, // Pas de pénalités selon votre mise à jour
      bestLap: null,
      lapTimes: [],
      position: null,
      status: status
    });

    // Marquer comme ayant un résultat
    setTimes((prev: any) => ({
      ...prev,
      [driverId]: {
        ...prev[driverId],
        hasResult: true
      }
    }));

    focusNextDriver();
  };

  const focusNextDriver = () => {
    const { driversWithoutResults } = separateDrivers();
    
    if (driversWithoutResults.length > 0) {
      const currentIndex = driversWithoutResults.findIndex(driver => driver.id === currentFocusDriverId);
      let nextIndex = currentIndex + 1;
      
      if (nextIndex >= driversWithoutResults.length) {
        nextIndex = 0;
      }
      
      const nextDriver = driversWithoutResults[nextIndex];
      setCurrentFocusDriverId(nextDriver.id);
      
      setTimeout(() => {
        const nextInput = inputRefs.current[nextDriver.id];
        if (nextInput) {
          nextInput.focus();
          nextInput.select();
        }
      }, 100);
    }
  };

  const handleFocusDriver = (driverId: string) => {
    setCurrentFocusDriverId(driverId);
  };

  const handleKeyPress = (event: React.KeyboardEvent, driverId: string) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveResult(driverId);
    }
  };

  const handleBlur = (driverId: string) => {
    // Auto-save désactivé pour éviter les doublons
    // Utiliser uniquement ENTRÉE pour valider
  };

  const getStatusLabel = (status: string): string => {
    const option = STATUS_OPTIONS.find(opt => opt.value === status);
    return option ? option.label : status;
  };

  const getStatusColor = (status: string): string => {
    const option = STATUS_OPTIONS.find(opt => opt.value === status);
    return option ? option.color : '#666';
  };

  const { driversWithoutResults, driversWithResults } = separateDrivers();

  return (
    <div>
      <div style={{ 
        marginBottom: '2rem', 
        padding: '1rem', 
        background: 'linear-gradient(135deg, #667eea, #764ba2)', 
        color: 'white', 
        borderRadius: '8px',
        border: '1px solid #5a67d8'
      }}>
        <strong>🏃 Manche Qualificative - Interface Optimisée ({race.laps} tours)</strong>
        <br />
        <small style={{ opacity: 0.9 }}>
          🎯 {driversWithoutResults.length} pilote(s) à chronométrer • ✅ {driversWithResults.length} pilote(s) validé(s)
          <br />
          💡 Saisissez le temps + ENTRÉE pour valider et passer au suivant • 📊 Barème: 50-45-42-40-39...
        </small>
      </div>

      {/* SECTION 1 : PILOTES À CHRONOMÉTRER */}
      {driversWithoutResults.length > 0 && (
        <div style={{ marginBottom: '3rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%)',
            border: '2px solid #ff6b35',
            borderRadius: '12px',
            padding: '1.5rem',
            boxShadow: '0 8px 32px rgba(255, 107, 53, 0.2)'
          }}>
            <h3 style={{ 
              color: '#e55a2b', 
              marginTop: 0, 
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              🔴 À CHRONOMÉTRER ({driversWithoutResults.length} pilotes)
              <span style={{ 
                fontSize: '0.8rem', 
                background: '#ff6b35', 
                color: 'white', 
                padding: '0.25rem 0.5rem', 
                borderRadius: '12px',
                animation: 'pulse 2s infinite'
              }}>
                PRIORITÉ
              </span>
            </h3>
            
            <div style={{ display: 'grid', gap: '1rem' }}>
              {driversWithoutResults.map((driver) => (
                <div key={driver.id} style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 250px 180px', 
                  gap: '1rem', 
                  alignItems: 'center',
                  padding: '1.25rem',
                  border: '2px solid rgba(255, 107, 53, 0.3)',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  transition: 'all 0.3s ease',
                  boxShadow: driver.id === currentFocusDriverId ? '0 4px 20px rgba(255, 107, 53, 0.4)' : '0 2px 10px rgba(0,0,0,0.1)',
                  transform: driver.id === currentFocusDriverId ? 'scale(1.02)' : 'scale(1)'
                }}>
                  <div>
                    <div style={{ 
                      fontWeight: '700', 
                      color: '#e55a2b',
                      fontSize: '1.1rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}>
                      {driver.id === currentFocusDriverId && <span style={{ color: '#ff6b35', fontSize: '1.2rem' }}>👉</span>}
                      #{driver.carNumber} {driver.name}
                    </div>
                    {driver.team && (
                      <div style={{ fontSize: '0.85rem', color: '#666' }}>
                        🏁 {driver.team}
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <input
                      ref={el => inputRefs.current[driver.id] = el}
                      type="text"
                      placeholder="4:32.123"
                      value={times[driver.id]?.inputValue || ''}
                      onChange={(e) => handleTimeChange(driver.id, e.target.value)}
                      onKeyPress={(e) => handleKeyPress(e, driver.id)}
                      onBlur={() => handleBlur(driver.id)}
                      onFocus={() => handleFocusDriver(driver.id)}
                      disabled={statuses[driver.id] && statuses[driver.id] !== 'finished'}
                      style={{ 
                        width: '100%', 
                        padding: '0.75rem', 
                        border: driver.id === currentFocusDriverId ? '3px solid #ff6b35' : '2px solid #ff6b35', 
                        borderRadius: '8px',
                        fontFamily: 'monospace',
                        fontSize: '1.2rem',
                        fontWeight: 'bold',
                        color: '#333',
                        backgroundColor: driver.id === currentFocusDriverId ? '#fffbf0' : 
                                       (statuses[driver.id] && statuses[driver.id] !== 'finished') ? '#f5f5f5' : 'white',
                        textAlign: 'center',
                        transition: 'all 0.3s ease',
                        cursor: (statuses[driver.id] && statuses[driver.id] !== 'finished') ? 'not-allowed' : 'text'
                      }}
                    />
                    <div style={{ fontSize: '0.7rem', color: '#666', textAlign: 'center', marginTop: '0.25rem' }}>
                      MM:SS.mmm + ENTRÉE
                    </div>
                  </div>

                  <div>
                    <select
                      value={statuses[driver.id] || 'finished'}
                      onChange={(e) => handleStatusChange(driver.id, e.target.value)}
                      onKeyPress={(e) => handleKeyPress(e, driver.id)}
                      onFocus={() => handleFocusDriver(driver.id)}
                      style={{ 
                        width: '100%', 
                        padding: '0.75rem', 
                        border: driver.id === currentFocusDriverId ? '3px solid #ff6b35' : '2px solid #ff6b35', 
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        color: '#333',
                        backgroundColor: driver.id === currentFocusDriverId ? '#fffbf0' : 'white',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      {STATUS_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2 : PILOTES CHRONOMÉTRÉS */}
      {driversWithResults.length > 0 && (
        <div>
          <div style={{
            background: 'linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%)',
            border: '2px solid #28a745',
            borderRadius: '12px',
            padding: '1.5rem',
            boxShadow: '0 8px 32px rgba(40, 167, 69, 0.2)'
          }}>
            <h3 style={{ 
              color: '#1e7e34', 
              marginTop: 0, 
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              ✅ CHRONOMÉTRÉS ({driversWithResults.length} pilotes)
              <span style={{ 
                fontSize: '0.8rem', 
                background: '#28a745', 
                color: 'white', 
                padding: '0.25rem 0.5rem', 
                borderRadius: '12px' 
              }}>
                CLASSEMENT - MODIFIABLE
              </span>
            </h3>
            
            <div style={{ display: 'grid', gap: '1rem' }}>
              {driversWithResults.map((driver, index) => (
                <div key={driver.id} style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '60px 1fr 250px 180px 120px', 
                  gap: '1rem', 
                  alignItems: 'center',
                  padding: '1.25rem',
                  border: '2px solid rgba(40, 167, 69, 0.4)',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  boxShadow: '0 4px 15px rgba(40, 167, 69, 0.15)'
                }}>
                  <div style={{ 
                    textAlign: 'center',
                    fontWeight: 'bold',
                    fontSize: '1.4rem',
                    color: index === 0 ? '#ffd700' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : '#28a745',
                    background: index < 3 ? 'rgba(255, 215, 0, 0.1)' : 'transparent',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto'
                  }}>
                    {driver.status === 'finished' ? (index + 1) : '—'}
                  </div>
                  
                  <div>
                    <div style={{ fontWeight: '700', color: '#1e7e34', fontSize: '1.1rem' }}>
                      #{driver.carNumber} {driver.name}
                    </div>
                    {driver.team && (
                      <div style={{ fontSize: '0.85rem', color: '#666' }}>
                        🏁 {driver.team}
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <input
                      type="text"
                      placeholder="4:32.123"
                      value={times[driver.id]?.inputValue || ''}
                      onChange={(e) => handleTimeChange(driver.id, e.target.value)}
                      onKeyPress={(e) => handleKeyPress(e, driver.id)}
                      onBlur={() => handleBlur(driver.id)}
                      disabled={statuses[driver.id] && statuses[driver.id] !== 'finished'}
                      style={{ 
                        width: '100%', 
                        padding: '0.75rem', 
                        border: '2px solid #28a745', 
                        borderRadius: '8px',
                        fontFamily: 'monospace',
                        fontSize: '1.2rem',
                        fontWeight: 'bold',
                        color: '#1e7e34',
                        backgroundColor: (statuses[driver.id] && statuses[driver.id] !== 'finished') ? '#f5f5f5' : 'white',
                        textAlign: 'center',
                        cursor: (statuses[driver.id] && statuses[driver.id] !== 'finished') ? 'not-allowed' : 'text'
                      }}
                    />
                    <div style={{ fontSize: '0.7rem', color: '#666', textAlign: 'center', marginTop: '0.25rem' }}>
                      Correction possible
                    </div>
                  </div>

                  <div>
                    <select
                      value={statuses[driver.id] || 'finished'}
                      onChange={(e) => handleStatusChange(driver.id, e.target.value)}
                      onKeyPress={(e) => handleKeyPress(e, driver.id)}
                      style={{ 
                        width: '100%', 
                        padding: '0.75rem', 
                        border: '2px solid #28a745', 
                        borderRadius: '8px',
                        fontSize: '0.85rem',
                        fontWeight: '600',
                        color: '#1e7e34',
                        backgroundColor: 'white'
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
                    onClick={() => saveResult(driver.id)}
                    style={{
                      padding: '0.75rem 1rem',
                      background: 'linear-gradient(135deg, #28a745, #20c997)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      transition: 'all 0.3s ease',
                      boxShadow: '0 4px 15px rgba(40, 167, 69, 0.3)'
                    }}
                  >
                    💾 Corriger
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}