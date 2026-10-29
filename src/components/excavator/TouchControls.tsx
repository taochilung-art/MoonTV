'use client';

import { ExcavatorAction, ExcavatorInput } from './controls';

interface TouchControlsProps {
  input: ExcavatorInput;
}

const PADS: { title: string; buttons: [ExcavatorAction, string][] }[] = [
  {
    title: '行駛',
    buttons: [
      ['forward', '前'],
      ['backward', '後'],
      ['turnLeft', '左'],
      ['turnRight', '右'],
    ],
  },
  {
    title: '迴轉 / 大臂',
    buttons: [
      ['boomUp', '臂↑'],
      ['boomDown', '臂↓'],
      ['swingLeft', '轉左'],
      ['swingRight', '轉右'],
    ],
  },
  {
    title: '小臂 / 鏟斗',
    buttons: [
      ['stickIn', '收臂'],
      ['stickOut', '伸臂'],
      ['bucketCurl', '挖'],
      ['bucketDump', '倒'],
    ],
  },
];

/** 手機用的按住式操作按鈕 */
export default function TouchControls({ input }: TouchControlsProps) {
  const bind = (action: ExcavatorAction) => ({
    onPointerDown: (e: React.PointerEvent) => {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      input[action] = true;
    },
    onPointerUp: () => (input[action] = false),
    onPointerCancel: () => (input[action] = false),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  return (
    <div className='pointer-events-none absolute inset-x-0 bottom-0 flex justify-between gap-2 p-3 md:hidden'>
      {PADS.map((pad) => (
        <div
          key={pad.title}
          className='pointer-events-auto flex flex-col items-center gap-1'
        >
          <span className='text-[10px] text-white/80 drop-shadow'>
            {pad.title}
          </span>
          <div className='grid grid-cols-2 gap-1'>
            {pad.buttons.map(([action, label]) => (
              <button
                key={action}
                {...bind(action)}
                className='h-11 w-11 select-none touch-none rounded-lg bg-black/45 text-xs font-medium text-white active:bg-yellow-500/80'
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
