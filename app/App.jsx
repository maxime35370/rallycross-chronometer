import React from 'react';

function App() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'Arial, sans-serif' }}>
      <h1>🏁 Rallycross Timer</h1>
      <nav style={{ marginBottom: '2rem' }}>
        <button style={{ margin: '0.5rem', padding: '0.5rem 1rem' }}>
          👥 Pilotes
        </button>
        <button style={{ margin: '0.5rem', padding: '0.5rem 1rem' }}>
          🏁 Courses
        </button>
        <button style={{ margin: '0.5rem', padding: '0.5rem 1rem' }}>
          ⏱️ Chronométrage
        </button>
      </nav>
      
      <div>
        <h2>Test Firebase</h2>
        <p>Si vous voyez ceci, React fonctionne !</p>
      </div>
    </div>
  );
}

export default App;