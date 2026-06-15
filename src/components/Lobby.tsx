import React, { useEffect, useState } from 'react';
import { Crown, Shield, Eye, Check, Loader, Users } from 'lucide-react';
import { subscribeToGame, createGameIfMissing, claimSeat } from '../logic/firebaseService';
import type { PlayerId, Role } from '../types/game';

const ROLES: { id: Role; label: string; icon: any }[] = [
  { id: 'general', label: 'Generál', icon: Crown },
  { id: 'left', label: 'Levá sekce', icon: Shield },
  { id: 'center', label: 'Střed', icon: Shield },
  { id: 'right', label: 'Pravá sekce', icon: Shield },
];

const Lobby = ({ gameId, scenario, clientId, onSeated, onExit }) => {
  const [game, setGame] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (scenario) createGameIfMissing(gameId, scenario);
    const unsub = subscribeToGame(gameId, (data) => setGame(data));
    return () => unsub();
  }, [gameId, scenario]);

  const seats = game?.seats || { player1: {}, player2: {} };
  const teamName = (t: PlayerId) => game?.scenario?.[t]?.name || (t === 'player1' ? 'Tým 1' : 'Tým 2');

  const handleClaim = async (team: PlayerId, role: Role) => {
    setBusy(`${team}-${role}`);
    setError(null);
    const ok = await claimSeat(gameId, team, role, clientId);
    setBusy(null);
    if (ok) onSeated({ team, role });
    else setError('Toto místo už někdo obsadil.');
  };

  if (!game) {
    return (
      <div className="min-h-screen bg-map-paper flex flex-col items-center justify-center font-military gap-4 text-map-ink-blue">
        <Loader className="animate-spin" size={36} />
        <p className="uppercase font-bold tracking-widest">Připojuji k bitvě...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-map-paper flex flex-col items-center justify-center p-4 font-military">
      <div className="max-w-3xl w-full bg-white/90 p-6 md:p-10 rounded-xl shadow-2xl border-2 border-map-ink-blue">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-map-ink-blue font-handwriting uppercase tracking-widest flex items-center justify-center gap-3">
            <Users size={28} /> Výběr velení
          </h1>
          <p className="text-xs text-gray-500 uppercase tracking-tight mt-2 font-bold">
            Vyberte stranu a roli. Generál velí i sekcím bez vlastního velitele —
            jeden hráč tak může hrát celou stranu sám.
          </p>
        </div>

        {error && <div className="mb-4 text-center text-red-600 font-bold text-sm uppercase">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(['player1', 'player2'] as PlayerId[]).map((team) => (
            <div key={team} className={`p-4 rounded-xl border-2 ${team === 'player1' ? 'border-blue-300 bg-blue-50/40' : 'border-red-300 bg-red-50/40'}`}>
              <h2 className={`font-black uppercase text-center mb-4 tracking-widest ${team === 'player1' ? 'text-blue-700' : 'text-red-700'}`}>
                {teamName(team)}
              </h2>
              <div className="flex flex-col gap-2">
                {ROLES.map(({ id, label, icon: Icon }) => {
                  const occupant = seats[team]?.[id];
                  const mine = occupant === clientId;
                  const taken = occupant && !mine;
                  return (
                    <button
                      key={id}
                      disabled={!!taken || busy !== null}
                      onClick={() => handleClaim(team, id)}
                      className={`flex items-center justify-between px-4 py-3 rounded-lg border-2 font-bold uppercase text-sm transition-all
                        ${mine ? 'bg-map-ink-green text-white border-green-800'
                          : taken ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                          : 'bg-white border-slate-300 hover:border-map-ink-blue hover:scale-[1.02]'}`}
                    >
                      <span className="flex items-center gap-2"><Icon size={16} /> {label}</span>
                      {mine ? <Check size={16} /> : taken ? <span className="text-[9px]">Obsazeno</span> : busy === `${team}-${id}` ? <Loader size={14} className="animate-spin" /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between gap-4">
          <button onClick={onExit} className="text-gray-400 hover:text-red-600 transition-colors uppercase text-[10px] font-black tracking-widest">
            Zpět do menu
          </button>
          <button
            onClick={() => onSeated({ spectator: true })}
            className="flex items-center gap-2 bg-slate-800 text-white px-5 py-2.5 rounded-lg font-bold uppercase text-xs hover:bg-slate-700 transition-colors"
          >
            <Eye size={14} /> Sledovat jako divák
          </button>
        </div>
      </div>
    </div>
  );
};

export default Lobby;
