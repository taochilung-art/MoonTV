'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import CapsuleSwitch from '@/components/CapsuleSwitch';
import ExcavatorGame from '@/components/excavator/ExcavatorGame';
import SplineExcavator from '@/components/excavator/SplineExcavator';
import PageLayout from '@/components/PageLayout';

const SCENE_STORAGE_KEY = 'excavatorSplineScene';
const isSceneUrl = (url: string) =>
  /^https:\/\/.+\.splinecode(\?.*)?$/.test(url.trim());

function ExcavatorPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode') === 'spline' ? 'spline' : 'three';

  // 場景網址優先順序：網址參數 ?scene= → 環境變數 → 上次輸入過的
  const [scene, setScene] = useState('');
  const [draft, setDraft] = useState('');
  useEffect(() => {
    let saved = '';
    try {
      saved = localStorage.getItem(SCENE_STORAGE_KEY) || '';
    } catch {
      // 無法使用 localStorage 時略過
    }
    const initial =
      searchParams.get('scene') ||
      process.env.NEXT_PUBLIC_SPLINE_EXCAVATOR_SCENE ||
      saved;
    setScene(isSceneUrl(initial) ? initial : '');
    setDraft(initial);
  }, [searchParams]);

  const loadScene = () => {
    const url = draft.trim();
    if (!isSceneUrl(url)) return;
    setScene(url);
    try {
      localStorage.setItem(SCENE_STORAGE_KEY, url);
    } catch {
      // 無法使用 localStorage 時略過
    }
  };

  const setMode = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('mode', value);
    router.replace(`/game/excavator?${params.toString()}`);
  };

  return (
    <PageLayout activePath='/game/excavator'>
      <div className='flex flex-col gap-3 px-4 py-4 sm:px-10 md:h-screen'>
        <div className='flex flex-wrap items-center justify-between gap-3 md:pr-24'>
          <h1 className='text-2xl font-bold text-gray-800 dark:text-gray-200'>
            🚜 挖土機
          </h1>
          <CapsuleSwitch
            options={[
              { label: 'Three.js', value: 'three' },
              { label: 'Spline', value: 'spline' },
            ]}
            active={mode}
            onChange={setMode}
          />
        </div>

        {mode === 'spline' && (
          <div className='flex flex-col gap-2 sm:flex-row'>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadScene()}
              placeholder='https://prod.spline.design/xxxx/scene.splinecode'
              className='flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'
            />
            <button
              onClick={loadScene}
              disabled={!isSceneUrl(draft)}
              className='rounded-lg bg-yellow-500 px-4 py-2 text-sm font-semibold text-gray-900 disabled:opacity-50'
            >
              載入場景
            </button>
          </div>
        )}

        <div className='h-[calc(100vh-14rem)] min-h-[420px] md:h-auto md:flex-1'>
          {mode === 'three' && <ExcavatorGame />}
          {mode === 'spline' &&
            (scene ? (
              <SplineExcavator scene={scene} />
            ) : (
              <div className='flex h-full flex-col items-center justify-center gap-2 rounded-xl bg-gray-100 p-6 text-center text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300'>
                <p>
                  在 Spline 編輯器按 Export → Code Export → React，複製
                  .splinecode 網址貼到上方。
                </p>
                <p>
                  場景裡把零件命名為 <code>Excavator</code>、<code>Turret</code>
                  、<code>Boom</code>、<code>Stick</code>、<code>Bucket</code>
                  ，就能用鍵盤操控。
                </p>
              </div>
            ))}
        </div>
      </div>
    </PageLayout>
  );
}

export default function ExcavatorPage() {
  return (
    <Suspense>
      <ExcavatorPageClient />
    </Suspense>
  );
}
