import { useEffect, useRef, useState, useCallback } from 'react';
import { Game, GameState } from './game/Game';

const initialState: GameState = {
  health: 100,
  maxHealth: 100,
  moonleavesCollected: 0,
  moonleavesRequired: 3,
  transformTimer: 60,
  transformInterval: 60,
  isTransforming: false,
  transformWarning: false,
  fairyDialogue: '',
  interactionPrompt: '',
  gameWon: false,
  gameLost: false,
  isLocked: false,
};

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [gameState, setGameState] = useState<GameState>(initialState);
  const [started, setStarted] = useState(false);
  const [damageFlash, setDamageFlash] = useState(false);
  const prevHealthRef = useRef(100);

  const startGame = useCallback(() => {
    if (!canvasRef.current) return;
    
    const game = new Game(canvasRef.current);
    game.onStateChange = (state) => setGameState(state);
    game.start();
    gameRef.current = game;
    setStarted(true);

    // Handle E key for interaction
    const handleKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyE' && gameRef.current) {
        gameRef.current.handleInteraction();
      }
    };
    document.addEventListener('keydown', handleKey);

    return () => {
      document.removeEventListener('keydown', handleKey);
      game.dispose();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (gameRef.current) {
        gameRef.current.dispose();
      }
    };
  }, []);

  const handleCanvasClick = () => {
    if (gameRef.current && !gameState.isLocked) {
      gameRef.current.player.requestLock();
    }
  };

  // Damage flash effect
  useEffect(() => {
    if (gameState.health < prevHealthRef.current && gameState.health > 0) {
      setDamageFlash(true);
      setTimeout(() => setDamageFlash(false), 200);
    }
    prevHealthRef.current = gameState.health;
  }, [gameState.health]);

  const healthPercent = (gameState.health / gameState.maxHealth) * 100;
  const timerPercent = (gameState.transformTimer / gameState.transformInterval) * 100;

  return (
    <div className="w-screen h-screen overflow-hidden bg-black relative">
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        onClick={handleCanvasClick}
      />

      {/* Start Screen */}
      {!started && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-[#0a1f0a] via-[#1a3a2a] to-[#0a1f0a] z-50 overflow-hidden">
          {/* Animated background particles */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 rounded-full bg-[#40e0d0]/30 animate-pulse"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 3}s`,
                  animationDuration: `${2 + Math.random() * 3}s`,
                }}
              />
            ))}
          </div>
          
          <div className="text-center relative z-10">
            <div className="mb-4">
              <span className="text-[#40e0d0]/50 text-sm tracking-[0.3em] uppercase">A Dark Fantasy Adventure</span>
            </div>
            <h1 className="text-7xl font-bold text-[#40e0d0] mb-2 tracking-wider" style={{ textShadow: '0 0 30px rgba(64,224,208,0.6), 0 0 60px rgba(64,224,208,0.3)' }}>
              SPEZH
            </h1>
            <p className="text-xl text-[#8ab8a0] mb-1 italic font-light">Sir, While He's Still Alive</p>
            <p className="text-sm text-[#5a8a6a] mb-10">Сэр, пока он ещё жив</p>
            
            <div className="max-w-md mx-auto mb-6 text-left text-[#7aaa8a] text-sm space-y-2 bg-black/40 p-5 rounded-xl border border-[#2a5a3a]/50 backdrop-blur-sm">
              <p className="text-[#40e0d0] font-bold mb-3 flex items-center gap-2">
                <span>⚔️</span> Управление
              </p>
              <div className="grid grid-cols-2 gap-1">
                <p>🖱️ Мышь — обзор</p>
                <p>⌨️ WASD — движение</p>
                <p>␣ Пробел — прыжок</p>
                <p>⇧ Shift — бег</p>
                <p>🖱️ ЛКМ — атака</p>
                <p>⌨️ E — собрать/взаимодействие</p>
              </div>
            </div>
            
            <div className="max-w-md mx-auto mb-8 text-[#7aaa8a] text-sm bg-black/40 p-5 rounded-xl border border-[#2a5a3a]/50 backdrop-blur-sm">
              <p className="text-[#40e0d0] font-bold mb-2 flex items-center gap-2">
                <span>🌿</span> Задание
              </p>
              <p>Собери 3 Лунных Листа и доберись до портала выхода.</p>
              <p className="mt-2 text-[#5a8a6a] italic">⚠️ Лабиринт перестраивается каждые 60 секунд!</p>
            </div>

            <button
              onClick={startGame}
              className="px-10 py-4 bg-gradient-to-r from-[#1a4a3a] to-[#2a5a4a] hover:from-[#2a6a4a] hover:to-[#3a7a5a] text-[#40e0d0] font-bold text-xl rounded-xl border border-[#40e0d0]/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(64,224,208,0.4)] hover:scale-105 cursor-pointer active:scale-95"
            >
              🌲 ВОЙТИ В ЛАБИРИНТ
            </button>
            
            <p className="text-[#3a5a4a] text-xs mt-4">Нажмите для захвата мыши • Click to capture mouse</p>
          </div>
        </div>
      )}

      {/* Damage Flash */}
      {damageFlash && (
        <div className="absolute inset-0 pointer-events-none z-40 bg-red-900/30 animate-pulse"></div>
      )}

      {/* Transform screen shake effect */}
      {gameState.isTransforming && (
        <div className="absolute inset-0 pointer-events-none z-20 border-4 border-[#40e0d0]/20 animate-pulse"></div>
      )}

      {/* Pointer Lock Prompt */}
      {started && !gameState.isLocked && !gameState.gameWon && !gameState.gameLost && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-40 cursor-pointer" onClick={handleCanvasClick}>
          <div className="text-center">
            <p className="text-[#40e0d0] text-xl font-bold">Нажмите чтобы продолжить</p>
            <p className="text-[#5a8a6a] text-sm mt-2">Click to capture mouse</p>
          </div>
        </div>
      )}

      {/* HUD */}
      {started && !gameState.gameWon && !gameState.gameLost && (
        <>
          {/* Crosshair */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30">
            <div className="w-1 h-1 bg-white/60 rounded-full"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-[2px] bg-white/30"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[2px] h-5 bg-white/30"></div>
          </div>

          {/* Health Bar */}
          <div className="absolute bottom-6 left-6 z-30">
            <div className="flex items-center gap-2">
              <span className="text-red-400 text-sm font-bold">❤️</span>
              <div className="w-48 h-4 bg-black/60 rounded-full border border-red-900/50 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${healthPercent}%`,
                    background: healthPercent > 50 ? 'linear-gradient(90deg, #22c55e, #4ade80)' : healthPercent > 25 ? 'linear-gradient(90deg, #eab308, #facc15)' : 'linear-gradient(90deg, #dc2626, #ef4444)',
                  }}
                ></div>
              </div>
              <span className="text-white/80 text-xs font-mono">{gameState.health}/{gameState.maxHealth}</span>
            </div>
          </div>

          {/* Moonleaf Counter */}
          <div className="absolute bottom-6 left-6 mt-12 z-30" style={{ bottom: '70px' }}>
            <div className="flex items-center gap-2">
              <span className="text-[#40e0d0] text-lg">🌿</span>
              <span className="text-[#40e0d0] font-bold text-sm">
                {gameState.moonleavesCollected} / {gameState.moonleavesRequired}
              </span>
              <span className="text-[#5a8a6a] text-xs ml-1">Лунных Листьев</span>
            </div>
          </div>

          {/* Transform Timer */}
          <div className="absolute top-6 right-6 z-30">
            <div className={`text-center ${gameState.transformWarning ? 'animate-pulse' : ''}`}>
              <div className="w-16 h-16 rounded-full border-2 flex items-center justify-center relative"
                style={{
                  borderColor: gameState.transformWarning ? '#ef4444' : '#40e0d0',
                  background: 'rgba(0,0,0,0.6)',
                }}>
                <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <circle
                    cx="18" cy="18" r="16"
                    fill="none"
                    stroke={gameState.transformWarning ? '#ef4444' : '#40e0d0'}
                    strokeWidth="2"
                    strokeDasharray={`${timerPercent} 100`}
                    strokeLinecap="round"
                    opacity="0.6"
                  />
                </svg>
                <span className={`text-lg font-bold font-mono ${gameState.transformWarning ? 'text-red-400' : 'text-[#40e0d0]'}`}>
                  {gameState.transformTimer}
                </span>
              </div>
              <p className="text-[10px] text-[#5a8a6a] mt-1">ТРАНСФОРМАЦИЯ</p>
            </div>
          </div>

          {/* Transform Warning */}
          {gameState.isTransforming && (
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 z-30 animate-pulse">
              <p className="text-red-400 text-2xl font-bold text-center" style={{ textShadow: '0 0 10px rgba(239,68,68,0.5)' }}>
                ⚠️ ЛАБИРИНТ МЕНЯЕТСЯ ⚠️
              </p>
            </div>
          )}

          {/* Interaction Prompt */}
          {gameState.interactionPrompt && (
            <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-30">
              <div className="bg-black/70 px-4 py-2 rounded-lg border border-[#40e0d0]/30">
                <p className="text-[#40e0d0] text-sm font-medium">{gameState.interactionPrompt}</p>
              </div>
            </div>
          )}

          {/* Fairy Dialogue */}
          {gameState.fairyDialogue && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 max-w-lg">
              <div className="bg-black/80 px-5 py-3 rounded-lg border border-[#ffd700]/30">
                <p className="text-[#ffd700] text-xs font-bold mb-1">✨ Фея:</p>
                <p className="text-white/90 text-sm italic">"{gameState.fairyDialogue}"</p>
              </div>
            </div>
          )}

          {/* Objective */}
          <div className="absolute top-6 left-6 z-30">
            <div className="bg-black/50 px-3 py-2 rounded border border-[#2a5a3a]">
              <p className="text-[#40e0d0] text-xs font-bold">ЗАДАНИЕ</p>
              <p className="text-white/70 text-xs mt-1">
                {gameState.moonleavesCollected >= gameState.moonleavesRequired
                  ? '→ Доберитесь до портала выхода'
                  : `→ Соберите Лунные Листья (${gameState.moonleavesCollected}/${gameState.moonleavesRequired})`}
              </p>
            </div>
          </div>
        </>
      )}

      {/* Win Screen */}
      {gameState.gameWon && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-50">
          <div className="text-center">
            <h2 className="text-4xl font-bold text-[#40e0d0] mb-4" style={{ textShadow: '0 0 20px rgba(64,224,208,0.5)' }}>
              ПОБЕДА!
            </h2>
            <p className="text-[#8ab8a0] text-lg mb-2">Вы выбрались из лабиринта!</p>
            <p className="text-[#ffd700] text-sm italic mb-6">✨ Фея: "Ну надо же... Ты выжил. Я в шоке."</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-[#1a4a3a] hover:bg-[#2a6a4a] text-[#40e0d0] font-bold rounded-lg border border-[#40e0d0] transition-all cursor-pointer"
            >
              ИГРАТЬ СНОВА
            </button>
          </div>
        </div>
      )}

      {/* Death Screen */}
      {gameState.gameLost && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
          <div className="text-center">
            <h2 className="text-4xl font-bold text-red-500 mb-4">ВЫ ПОГИБЛИ</h2>
            <p className="text-[#8ab8a0] text-lg mb-2">Лабиринт поглотил ещё одного искателя...</p>
            <p className="text-[#ffd700] text-sm italic mb-6">✨ Фея: "Ну, я предупреждала. Вещички мои."</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-[#4a1a1a] hover:bg-[#6a2a2a] text-red-300 font-bold rounded-lg border border-red-500 transition-all cursor-pointer"
            >
              ПОПРОБОВАТЬ СНОВА
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
