import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [status, setStatus] = useState('Disconnected')
  const [messages, setMessages] = useState<string[]>([])

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws`;
    
    console.log('Connecting to', wsUrl);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setStatus('Connected');
      ws.send(JSON.stringify({ type: 'Request', payload: { action: 'ListProjects' } }));
    };

    ws.onmessage = (event) => {
      setMessages((prev) => [...prev, event.data]);
    };

    ws.onclose = () => {
      setStatus('Disconnected');
    };

    return () => {
      ws.close();
    };
  }, []);

  return (
    <>
      <h1>iKanban</h1>
      <div className="card">
        <p>Status: {status}</p>
        <div>
          <h2>Messages:</h2>
          <pre>
            {messages.map((m, i) => (
              <div key={i}>{m}</div>
            ))}
          </pre>
        </div>
      </div>
    </>
  )
}

export default App
