import React, { useState, useEffect, useRef } from 'react';

interface ImprovedTimeTrialsInputProps {
  drivers: any[];
  existingResults: any[];
  onTimeSubmit: (driverData: any, timeData: any) => void;
  formatTime: (seconds: number) => string;
  selectedRace: any;
}

export default function ImprovedTimeTrialsInput({ 
  drivers, 
  existingResults, 
  onTimeSubmit, 
  formatTime, 
  selectedRace 
}: ImprovedTimeTrialsInputProps) {
  const [times, setTimes] = useState<any>({});
  const [currentFocusDriverId, setCurrentFocusDriverId] = useState<string>('');
  const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  const formatTimeForInput = (seconds: number): string => {
    if (!seconds) return '';
    const secs = Math.floor(seconds);
    const milliseconds = Math.round((seconds % 1) * 1000);
    return `${secs}.${milliseconds.toString().padStart(3, '0')}`;
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

  // Initialiser les temps depuis les résultats existants
  useEffect(() => {
    const newTimes: any = {};
    
    existingResults.forEach((result: any) => {
      if (result.raceId === selectedRace?.id) {
        newTimes[result.driverId] = {
          totalTime: result.totalTime,
          status: result.status || 'finished',
          inputValue: result.totalTime ? formatTimeForInput(result.totalTime) : '',
          hasResult: true
        };
      }
    });
    
    drivers.forEach(driver => {
      if (!newTimes[driver.id]) {
        newTimes[driver.id] = {
          totalTime: 0,
          status: 'finished',
          inputValue: '',
          hasResult: false
        };
      }
    });
    
    setTimes(newTimes);
    
    // Focus sur le premier pilote sans résultat
    const driversWithoutResults = drivers
      .filter(driver => !newTimes[driver.id]?.hasResult)
      .sort((a, b) => a.carNumber - b.carNumber);
      
    if (driversWithoutResults.length > 0 && !currentFocusDriverId) {
      setCurrentFocusDriverId(driversWithoutResults[0].id);
    }
  }, [existingResults, selectedRace?.id, drivers, currentFocusDriverId]);

  // Séparer les pilotes en 2 groupes
  const separateDrivers = () => {
    const driversWithoutResults: any[] = [];
    const driversWithResults: any[] = [];

    drivers.forEach(driver => {
      const driverTime = times[driver.id];
      
      if (driverTime?.hasResult) {
        driversWithResults.push({ ...driver, ...driverTime });
      } else {
        driversWithoutResults.push({ ...driver, ...driverTime });
      }
    });

    driversWithoutResults.sort((a, b) => a.carNumber - b.carNumber);
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
    setTimes((prev: any) => ({
      ...prev,
      [driverId]: {
        ...prev[driverId],
        status: status,
        inputValue: status !== 'finished' ? '' : prev[driverId]?.inputValue || '',
        totalTime: status !== 'finished' ? 0 : prev[driverId]?.totalTime || 0
      }
    }));
  };

  const saveResult = async (driverId: string) => {
    const driverData = drivers.find(d => d.id === driverId);
    const timeData = times[driverId];
    
    if (!driverData || !timeData) return;

    if (timeData.status === 'finished' && !timeData.totalTime) {
      return;
    }

    await onTimeSubmit(driverData, {
      totalTime: timeData.totalTime || null,
      finalTime: timeData.totalTime || null,
      penalties: 0,
      bestLap: timeData.totalTime || null,
      position: null,
      status: timeData.status || 'finished'
    });

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
    const input = inputRefs.current[driverId];
    if (input) {
      input.focus();
      input.select();
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent, driverId: string) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      saveResult(driverId);
    }
  };

  const handleBlur = (driverId: string) => {
    const timeData = times[driverId];
    if (timeData?.inputValue && timeData.totalTime > 0) {
      saveResult(driverId);
    }
  };

  const { driversWithoutResults, driversWithResults } = separateDrivers();

  return (
    <div>
      <div style={{ 
        marginBottom: '2rem', 
        padding: '1rem', 
        background: '#28a745', 
        color: 'white', 
        borderRadius: '8px',
        border: '1px solid #1e7e34'
      }}>
        <strong>⚡ Essais Chronométrés - Interface Optimisée</strong>
        <br />
        <small style={{ opacity: 0.9 }}>
          🎯 {driversWithoutResults.length} pilote(s) à chronométrer • ✅ {driversWithResults.length} pilote(s) validé(s)
          <br />
          💡 Saisissez le temps + ENTRÉE pour valider et passer au suivant
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
                  gridTemplateColumns: '1fr 200px 150px', 
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
                      placeholder="63.456"
                      value={times[driver.id]?.inputValue || ''}
                      onChange={(e) => handleTimeChange(driver.id, e.target.value)}
                      onKeyPress={(e) => handleKeyPress(e, driver.id)}
                      onBlur={() => handleBlur(driver.id)}
                      onFocus={() => handleFocusDriver(driver.id)}
                      style={{ 
                        width: '100%', 
                        padding: '0.75rem', 
                        border: driver.id === currentFocusDriverId ? '3px solid #ff6b35' : '2px solid #ff6b35', 
                        borderRadius: '8px',
                        fontFamily: 'monospace',
                        fontSize: '1.2rem',
                        fontWeight: 'bold',
                        color: '#333',
                        backgroundColor: driver.id === currentFocusDriverId ? '#fffbf0' : 'white',
                        textAlign: 'center',
                        transition: 'all 0.3s ease'
                      }}
                    />
                    <div style={{ fontSize: '0.7rem', color: '#666', textAlign: 'center', marginTop: '0.25rem' }}>
                      SS.mmm + ENTRÉE
                    </div>
                  </div>

                  <div>
                    <select
                      value={times[driver.id]?.status || 'finished'}
                      onChange={(e) => handleStatusChange(driver.id, e.target.value)}
                      onKeyPress={(e) => handleKeyPress(e, driver.id)}
                      onFocus={() => handleFocusDriver(driver.id)}
                      style={{ 
                        width: '100%', 
                        padding: '0.75rem', 
                        border: driver.id === currentFocusDriverId ? '3px solid #ff6b35' : '2px solid #ff6b35', 
                        borderRadius: '8px',
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        color: '#333',
                        backgroundColor: driver.id === currentFocusDriverId ? '#fffbf0' : 'white',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      <option value="finished">✅ Terminé</option>
                      <option value="dns">❌ Non partant</option>
                      <option value="dsq_general">⛔ Disqualifié</option>
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
                  gridTemplateColumns: '60px 1fr 200px 150px 120px', 
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
                      placeholder="63.456"
                      value={times[driver.id]?.inputValue || ''}
                      onChange={(e) => handleTimeChange(driver.id, e.target.value)}
                      onKeyPress={(e) => handleKeyPress(e, driver.id)}
                      onBlur={() => handleBlur(driver.id)}
                      style={{ 
                        width: '100%', 
                        padding: '0.75rem', 
                        border: '2px solid #28a745', 
                        borderRadius: '8px',
                        fontFamily: 'monospace',
                        fontSize: '1.2rem',
                        fontWeight: 'bold',
                        color: '#1e7e34',
                        backgroundColor: 'white',
                        textAlign: 'center'
                      }}
                    />
                    <div style={{ fontSize: '0.7rem', color: '#666', textAlign: 'center', marginTop: '0.25rem' }}>
                      Correction possible
                    </div>
                  </div>

                  <div>
                    <select
                      value={times[driver.id]?.status || 'finished'}
                      onChange={(e) => handleStatusChange(driver.id, e.target.value)}
                      onKeyPress={(e) => handleKeyPress(e, driver.id)}
                      style={{ 
                        width: '100%', 
                        padding: '0.75rem', 
                        border: '2px solid #28a745', 
                        borderRadius: '8px',
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        color: '#1e7e34',
                        backgroundColor: 'white'
                      }}
                    >
                      <option value="finished">✅ Terminé</option>
                      <option value="dns">❌ Non partant</option>
                      <option value="dsq_general">⛔ Disqualifié</option>
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