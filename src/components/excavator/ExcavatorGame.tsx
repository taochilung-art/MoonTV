'use client';

import { useEffect, useRef, useState } from 'react';

import { bindKeyboard, CONTROL_HELP, createInput } from './controls';
import { ExcavatorEngine, GameStats } from './engine';
import TouchControls from './TouchControls';

/** Three.js 版挖土機遊戲：把土堆裡的土塊運到卡車車斗 */
export default function ExcavatorGame() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ExcavatorEngine | null>(null);
  const [input] = useState(createInput);
  const [stats, setStats] = useState<GameStats | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const engine = new ExcavatorEngine(containerRef.current, input, setStats);
    engineRef.current = engine;
    const unbind = bindKeyboard(input);
    return () => {
      unbind();
      engine.dispose();
      engineRef.current = null;
    };
  }, [input]);

  const status = stats?.status ?? 'ready';
  const minutes = Math.floor((stats?.timeLeft ?? 0) / 60);
  const seconds = String((stats?.timeLeft ?? 0) % 60).padStart(2, '0');

  return (
    <div className='relative h-full w-full overflow-hidden rounded-xl bg-sky-200'>
      <div ref={containerRef} className='absolute inset-0' />

      {stats && (
        <div className='pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2 text-sm font-semibold text-white'>
          <span className='rounded-lg bg-black/50 px-3 py-1'>
            🚚 {stats.score} / {stats.goal}
          </span>
          <span className='rounded-lg bg-black/50 px-3 py-1'>
            🪣 {stats.carried} / {stats.capacity}
          </span>
          <span
            className={`rounded-lg px-3 py-1 ${
              stats.timeLeft <= 30 ? 'bg-red-600/70' : 'bg-black/50'
            }`}
          >
            ⏱ {minutes}:{seconds}
          </span>
        </div>
      )}

      <div className='pointer-events-none absolute right-3 top-3 hidden rounded-lg bg-black/50 p-3 text-xs text-white md:block'>
        {CONTROL_HELP.map((c) => (
          <div key={c.keys} className='flex justify-between gap-4'>
            <span className='font-mono text-yellow-300'>{c.keys}</span>
            <span>{c.label}</span>
          </div>
        ))}
      </div>

      {status === 'playing' && <TouchControls input={input} />}

      {status !== 'playing' && (
        <div className='absolute inset-0 flex items-center justify-center bg-black/40 p-4'>
          <div className='max-w-sm rounded-2xl bg-white/95 p-6 text-center shadow-xl dark:bg-gray-900/95'>
            <h2 className='mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100'>
              {status === 'ready' && '🚜 挖土機大作戰'}
              {status === 'won' && '🎉 任務完成！'}
              {status === 'lost' && '⏰ 時間到！'}
            </h2>
            <p className='mb-4 text-sm text-gray-600 dark:text-gray-300'>
              {status === 'ready' &&
                `在 ${Math.floor(
                  (stats?.timeLeft ?? 180) / 60
                )} 分鐘內，把土堆裡的土塊挖起來倒進紅色卡車，裝滿 ${
                  stats?.goal ?? 20
                } 塊就過關。鏟斗放低後按「挖」收斗撿土，抬到車斗上方再按「倒」。`}
              {status === 'won' &&
                `剩下 ${minutes}:${seconds}，共裝了 ${stats?.score} 塊土。`}
              {status === 'lost' &&
                `裝了 ${stats?.score} / ${stats?.goal} 塊，再試一次吧！`}
            </p>
            <button
              onClick={() =>
                status === 'ready'
                  ? engineRef.current?.start()
                  : engineRef.current?.restart()
              }
              className='rounded-lg bg-yellow-500 px-6 py-2 font-semibold text-gray-900 hover:bg-yellow-400'
            >
              {status === 'ready' ? '開始遊戲' : '再玩一次'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
