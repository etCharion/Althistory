import React, { useState, useMemo } from 'react';
import { HashRouter, Routes, Route, useNavigate, useParams, useLocation } from 'react-router-dom';
import { ThemeProvider, useTheme } from './theme';
import MainMenu from './components/MainMenu';
import ClassicMainMenu from './components/ClassicMainMenu';
import Lobby from './components/Lobby';
import ClassicLobby from './components/ClassicLobby';
import GameView from './components/GameView';
import ClassicGameView from './components/ClassicGameView';

// Stable per-browser identity used to claim a seat in online games.
function getClientId(): string {
  let id = localStorage.getItem('clientId');
  if (!id) {
    id = (crypto as any).randomUUID ? crypto.randomUUID() : `c-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem('clientId', id);
  }
  return id;
}

function Home() {
  const { theme } = useTheme();
  return theme === 'classic' ? <ClassicMainMenu /> : <MainMenu />;
}

function GameWrapper() {
  const { theme } = useTheme();
  const LobbyView = theme === 'classic' ? ClassicLobby : Lobby;
  const Game = theme === 'classic' ? ClassicGameView : GameView;

  const { gameId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const scenario = location.state?.scenario;
  const clientId = useMemo(getClientId, []);

  // Remember which seat this browser claimed for this game.
  const seatKey = `seat-${gameId}`;
  const [seat, setSeat] = useState(() => {
    const raw = localStorage.getItem(seatKey);
    return raw ? JSON.parse(raw) : null;
  });

  if (!seat) {
    return (
      <LobbyView
        gameId={gameId}
        scenario={scenario}
        clientId={clientId}
        onSeated={(s) => { localStorage.setItem(seatKey, JSON.stringify(s)); setSeat(s); }}
        onExit={() => navigate('/')}
      />
    );
  }

  return (
    <Game
      scenario={scenario}
      gameId={gameId}
      clientId={clientId}
      seat={seat}
      onExit={() => navigate('/')}
      onChangeSeat={() => { localStorage.removeItem(seatKey); setSeat(null); }}
    />
  );
}

function App() {
  return (
    <ThemeProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/game/:gameId" element={<GameWrapper />} />
        </Routes>
      </HashRouter>
    </ThemeProvider>
  );
}

export default App;
