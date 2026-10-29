'use client';

import type { Application, SPEObject } from '@splinetool/runtime';
import { useEffect, useRef, useState } from 'react';

import {
  bindKeyboard,
  CONTROL_HELP,
  createInput,
  ExcavatorInput,
} from './controls';
import TouchControls from './TouchControls';

/**
 * Spline 場景裡需要的物件名稱（大小寫要一致）。
 * 軸心（pivot）要放在關節上：Boom、Stick、Bucket 以本身的 X 軸旋轉，
 * Turret 以 Y 軸旋轉，Excavator 是整台車的最外層群組。
 */
export const SPLINE_PARTS = [
  'Excavator',
  'Turret',
  'Boom',
  'Stick',
  'Bucket',
] as const;
type PartName = (typeof SPLINE_PARTS)[number];

// Spline 的長度單位比 Three.js 大很多（預設方塊是 100）
const DRIVE_SPEED = 250;
const TURN_SPEED = 1.2;
const SWING_SPEED = 1.1;
const JOINT_SPEED = 0.9;
const JOINT_LIMIT = 1.2;

interface Rig {
  parts: Partial<Record<PartName, SPEObject>>;
  base: Partial<Record<PartName, { x: number; y: number; z: number }>>;
  offset: { swing: number; boom: number; stick: number; bucket: number };
}

function SceneMessage({ text }: { text: string }) {
  return (
    <div className='flex h-full w-full items-center justify-center p-6 text-center text-sm text-gray-200'>
      {text}
    </div>
  );
}

function driveRig(rig: Rig, input: ExcavatorInput, dt: number) {
  const { parts, base, offset } = rig;
  const axis = (pos: boolean, neg: boolean) =>
    ((pos ? 1 : 0) - (neg ? 1 : 0)) * dt;
  const limit = (v: number) => Math.max(-JOINT_LIMIT, Math.min(JOINT_LIMIT, v));

  const body = parts.Excavator;
  if (body) {
    body.rotation.y += axis(input.turnLeft, input.turnRight) * TURN_SPEED;
    const drive = axis(input.forward, input.backward) * DRIVE_SPEED;
    body.position.x += Math.sin(body.rotation.y) * drive;
    body.position.z += Math.cos(body.rotation.y) * drive;
  }

  offset.swing += axis(input.swingLeft, input.swingRight) * SWING_SPEED;
  offset.boom = limit(
    offset.boom + axis(input.boomDown, input.boomUp) * JOINT_SPEED
  );
  offset.stick = limit(
    offset.stick + axis(input.stickIn, input.stickOut) * JOINT_SPEED
  );
  offset.bucket = limit(
    offset.bucket + axis(input.bucketCurl, input.bucketDump) * JOINT_SPEED
  );

  if (parts.Turret && base.Turret)
    parts.Turret.rotation.y = base.Turret.y + offset.swing;
  if (parts.Boom && base.Boom)
    parts.Boom.rotation.x = base.Boom.x + offset.boom;
  if (parts.Stick && base.Stick)
    parts.Stick.rotation.x = base.Stick.x + offset.stick;
  if (parts.Bucket && base.Bucket)
    parts.Bucket.rotation.x = base.Bucket.x + offset.bucket;
}

/** 載入 Spline 匯出的場景，並用鍵盤／觸控按鈕操控裡面的挖土機零件 */
export default function SplineExcavator({ scene }: { scene: string }) {
  const [input] = useState(createInput);
  const rigRef = useRef<Rig | null>(null);
  const appRef = useRef<Application | null>(null);
  const [missing, setMissing] = useState<PartName[]>([]);
  const [variables, setVariables] = useState<
    Record<string, number | boolean | string>
  >({});

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    'loading'
  );

  // 載入場景（runtime 只在瀏覽器端動態載入）
  useEffect(() => {
    let disposed = false;
    let app: Application | null = null;
    setLoadState('loading');
    setMissing([]);
    setVariables({});

    import('@splinetool/runtime')
      .then(async ({ Application }) => {
        if (disposed || !canvasRef.current) return;
        app = new Application(canvasRef.current, { renderOnDemand: false });
        await app.load(scene);
        if (disposed) return;
        const parts: Rig['parts'] = {};
        const base: Rig['base'] = {};
        SPLINE_PARTS.forEach((name) => {
          const obj = app?.findObjectByName(name);
          if (obj) {
            parts[name] = obj;
            base[name] = { ...obj.rotation };
          }
        });
        appRef.current = app;
        rigRef.current = {
          parts,
          base,
          offset: { swing: 0, boom: 0, stick: 0, bucket: 0 },
        };
        setMissing(SPLINE_PARTS.filter((name) => !parts[name]));
        setLoadState('ready');
      })
      .catch(() => {
        if (!disposed) setLoadState('error');
      });

    return () => {
      disposed = true;
      rigRef.current = null;
      appRef.current = null;
      app?.dispose();
    };
  }, [scene]);

  useEffect(() => {
    const unbind = bindKeyboard(input);
    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (rigRef.current) driveRig(rigRef.current, input, dt);
    };
    frame = requestAnimationFrame(tick);

    // 場景裡的變數（例如 score、time）由 Spline 的事件邏輯更新，這裡定期讀出來顯示
    const poll = window.setInterval(() => {
      try {
        if (appRef.current) setVariables({ ...appRef.current.getVariables() });
      } catch {
        // 場景沒有變數時忽略
      }
    }, 300);

    return () => {
      unbind();
      cancelAnimationFrame(frame);
      window.clearInterval(poll);
    };
  }, [input]);

  const shownVariables = Object.entries(variables).filter(
    ([, v]) => typeof v !== 'boolean'
  );

  return (
    <div className='relative h-full w-full overflow-hidden rounded-xl bg-gray-900'>
      <canvas ref={canvasRef} className='absolute inset-0 h-full w-full' />
      {loadState !== 'ready' && (
        <div className='absolute inset-0'>
          <SceneMessage
            text={
              loadState === 'loading'
                ? '正在載入 Spline 場景…'
                : '場景載入失敗，請確認網址是 Spline 匯出的 .splinecode 連結。'
            }
          />
        </div>
      )}

      {shownVariables.length > 0 && (
        <div className='pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2 text-sm font-semibold text-white'>
          {shownVariables.map(([k, v]) => (
            <span key={k} className='rounded-lg bg-black/50 px-3 py-1'>
              {k}: {String(v)}
            </span>
          ))}
        </div>
      )}

      {missing.length > 0 && (
        <div className='absolute bottom-3 left-3 right-3 rounded-lg bg-amber-500/90 p-2 text-xs text-gray-900 md:bottom-auto md:left-auto md:right-3 md:top-3 md:max-w-xs'>
          場景裡找不到這些物件，對應的操作不會生效：{missing.join('、')}
        </div>
      )}

      <div className='pointer-events-none absolute right-3 bottom-3 hidden rounded-lg bg-black/50 p-3 text-xs text-white md:block'>
        {CONTROL_HELP.map((c) => (
          <div key={c.keys} className='flex justify-between gap-4'>
            <span className='font-mono text-yellow-300'>{c.keys}</span>
            <span>{c.label}</span>
          </div>
        ))}
      </div>

      <TouchControls input={input} />
    </div>
  );
}
