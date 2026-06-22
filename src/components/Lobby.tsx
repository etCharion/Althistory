import React, { useEffect, useState } from 'react';
import { Crown, Shield, Eye, Check, Loader, Users, ArrowLeft, Copy } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { subscribeToGame, createGameIfMissing, claimSeat } from '../logic/firebaseService';
import type { PlayerId, Role } from '../types/game';

const ROLES: { id: Role; label: string; icon: any }[] = [
  { id: 'general', label: 'Generál', icon: Crown },
  { id: 'left', label: 'Levá sekce', icon: Shield },
  { id: 'center', label: 'Střed', icon: Shield },
  { id: 'right', label: 'Pravá sekce', icon: Shield },
];

const TEAM_STYLE: Record<PlayerId, { border: string; bg: string; fg: string }> = {
  player1: { border: '#9fc0e6', bg: 'rgba(47,109,176,.08)', fg: '#1c4e8a' },
  player2: { border: '#e2b2ab', bg: 'rgba(192,57,43,.07)', fg: '#a3382b' },
};

const Lobby = ({ gameId, scenario, clientId, onSeated, onExit }) => {
  const [game, setGame] = useState<any>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pick, setPick] = useState<{ team: PlayerId; role: Role } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (scenario) createGameIfMissing(gameId, scenario);
    const unsub = subscribeToGame(gameId, (data) => setGame(data));
    return () => unsub();
  }, [gameId, scenario]);

  const seats = game?.seats || { player1: {}, player2: {} };
  const teamName = (t: PlayerId) => game?.scenario?.[t]?.name || (t === 'player1' ? 'Spojenci' : 'Osa');

  const handleStart = async () => {
    if (!pick) return;
    setBusy(`${pick.team}-${pick.role}`);
    setError(null);
    const ok = await claimSeat(gameId, pick.team, pick.role, clientId);
    setBusy(null);
    if (ok) onSeated({ team: pick.team, role: pick.role });
    else setError('Toto místo už někdo obsadil.');
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  if (!game) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-ally">
        <Loader className="animate-spin" size={36} />
        <p className="uppercase font-condensed font-extrabold tracking-[0.2em]">Připojuji k bitvě…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-ink">
      <div className="max-w-[980px] mx-auto px-7 pt-12 pb-[72px]">
        <div className="text-center mb-2 font-condensed font-extrabold text-[12px] tracking-[0.3em] uppercase text-tan">
          {game?.scenario?.name || scenario?.name || 'Operace'}
        </div>
        <h1 className="text-center m-0 mb-2 font-condensed font-extrabold text-[38px] text-ink flex items-center justify-center gap-3">
          <Users size={30} className="text-ally" /> Výběr velení
        </h1>
        <p className="text-center mx-auto mb-[30px] max-w-[560px] text-[13.5px] leading-[1.55] text-[#7a6f55]">
          Vyberte stranu a roli. Generál velí i sekcím bez vlastního velitele — jeden hráč tak může hrát celou stranu sám.
        </p>

        {error && <div className="mb-4 text-center text-danger font-bold text-sm uppercase">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-[18px] mb-[22px]">
          {(['player1', 'player2'] as PlayerId[]).map((team) => {
            const ts = TEAM_STYLE[team];
            return (
              <div key={team} className="rounded-[16px] p-[18px]" style={{ border: `2px solid ${ts.border}`, background: ts.bg }}>
                <h2 className="text-center m-0 mb-3.5 font-condensed font-extrabold text-[22px] tracking-[0.06em] uppercase" style={{ color: ts.fg }}>
                  {teamName(team)}
                </h2>
                <div className="flex flex-col gap-[9px]">
                  {ROLES.map(({ id, label, icon: Icon }) => {
                    const occupant = seats[team]?.[id];
                    const mine = occupant === clientId;
                    const taken = occupant && !mine;
                    const selected = pick?.team === team && pick?.role === id;
                    return (
                      <button
                        key={id}
                        disabled={!!taken || busy !== null}
                        onClick={() => setPick({ team, role: id })}
                        className="flex items-center justify-between px-3.5 py-3 rounded-[10px] border-2 font-condensed font-extrabold text-[15px] tracking-[0.04em] uppercase transition-all"
                        style={
                          taken
                            ? { border: '2px solid #d5d0c4', background: '#f1eee6', color: '#a39f93', cursor: 'not-allowed' }
                            : (mine || selected)
                              ? { border: '2px solid #2c7d42', background: '#2c7d42', color: '#fff' }
                              : { border: '2px solid #d5d0c4', background: '#fff', color: '#3a4252' }
                        }
                      >
                        <span className="flex items-center gap-2.5"><Icon size={16} /> {label}</span>
                        {mine ? <Check size={16} /> : taken ? <span className="text-[10px] tracking-wide">Obsazeno</span> : selected ? <Check size={16} /> : busy === `${team}-${id}` ? <Loader size={14} className="animate-spin" /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Online share card */}
        <div className="rounded-[14px] p-[15px_18px] flex items-center gap-4 mb-[22px]" style={{ background: 'rgba(47,109,176,.06)', border: '1.5px solid rgba(47,109,176,.28)' }}>
          <div className="w-[74px] h-[74px] shrink-0 bg-white rounded-[10px] p-[7px]" style={{ boxShadow: 'inset 0 0 0 2px #2f6db0' }}>
            <QRCodeSVG value={window.location.href} size={60} level="M" className="w-full h-full" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-condensed font-extrabold text-[14px] tracking-[0.08em] uppercase text-ally-soft mb-1.5">Pozvat spoluhráče · online</div>
            <div className="flex gap-2 items-center">
              <code className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap bg-white border border-[#c9d8e8] rounded-lg px-3 py-2.5 font-mono text-[12.5px] text-[#46546a]">{window.location.href}</code>
              <button onClick={copyLink} className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg bg-ally-soft text-white font-condensed font-extrabold text-[13px] tracking-[0.04em] uppercase hover:opacity-90 transition-opacity">
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Zkopírováno' : 'Kopírovat'}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3.5 flex-wrap">
          <button onClick={onExit} className="flex items-center gap-1.5 bg-transparent border-none text-tan font-condensed font-extrabold text-[13px] tracking-[0.14em] uppercase cursor-pointer hover:text-axis-soft transition-colors">
            <ArrowLeft size={15} /> Zpět do menu
          </button>
          <div className="flex gap-2.5">
            <button
              onClick={() => onSeated({ spectator: true })}
              className="flex items-center gap-1.5 px-[18px] py-3 rounded-[11px] bg-[#3a4252] text-white font-condensed font-extrabold text-[14px] tracking-[0.04em] uppercase hover:opacity-90 transition-opacity"
            >
              <Eye size={16} /> Sledovat jako divák
            </button>
            <button
              onClick={handleStart}
              disabled={!pick || busy !== null}
              className="flex items-center gap-2 px-[22px] py-3 rounded-[11px] font-condensed font-extrabold text-[15px] tracking-[0.05em] uppercase text-white transition-all"
              style={pick ? { background: '#2c7d42', cursor: 'pointer' } : { background: '#c9bfa3', cursor: 'not-allowed' }}
            >
              {busy ? <Loader size={16} className="animate-spin" /> : null}
              {pick ? 'Zahájit bitvu →' : 'Vyber roli'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Lobby;
