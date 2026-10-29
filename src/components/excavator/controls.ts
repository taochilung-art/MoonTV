// 挖土機遊戲共用的操作定義：鍵盤與手機觸控按鈕都寫入同一份輸入狀態

export type ExcavatorAction =
  | 'forward'
  | 'backward'
  | 'turnLeft'
  | 'turnRight'
  | 'swingLeft'
  | 'swingRight'
  | 'boomUp'
  | 'boomDown'
  | 'stickIn'
  | 'stickOut'
  | 'bucketCurl'
  | 'bucketDump';

export type ExcavatorInput = Record<ExcavatorAction, boolean>;

export const KEY_BINDINGS: Record<string, ExcavatorAction> = {
  KeyW: 'forward',
  KeyS: 'backward',
  KeyA: 'turnLeft',
  KeyD: 'turnRight',
  KeyQ: 'swingLeft',
  KeyE: 'swingRight',
  ArrowUp: 'boomUp',
  ArrowDown: 'boomDown',
  ArrowLeft: 'stickIn',
  ArrowRight: 'stickOut',
  KeyZ: 'bucketCurl',
  KeyX: 'bucketDump',
};

export const CONTROL_HELP: { keys: string; label: string }[] = [
  { keys: 'W / S', label: '前進 / 後退' },
  { keys: 'A / D', label: '車身轉向' },
  { keys: 'Q / E', label: '上部迴轉' },
  { keys: '↑ / ↓', label: '大臂 抬起 / 放下' },
  { keys: '← / →', label: '小臂 收回 / 伸出' },
  { keys: 'Z / X', label: '鏟斗 挖取 / 傾倒' },
];

export function createInput(): ExcavatorInput {
  return {
    forward: false,
    backward: false,
    turnLeft: false,
    turnRight: false,
    swingLeft: false,
    swingRight: false,
    boomUp: false,
    boomDown: false,
    stickIn: false,
    stickOut: false,
    bucketCurl: false,
    bucketDump: false,
  };
}

/** 綁定鍵盤事件到輸入狀態，回傳解除綁定的函式 */
export function bindKeyboard(input: ExcavatorInput): () => void {
  const onKey = (pressed: boolean) => (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
    const action = KEY_BINDINGS[e.code];
    if (!action) return;
    e.preventDefault();
    input[action] = pressed;
  };
  const down = onKey(true);
  const up = onKey(false);
  const reset = () => {
    (Object.keys(input) as ExcavatorAction[]).forEach(
      (k) => (input[k] = false)
    );
  };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', reset);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    window.removeEventListener('blur', reset);
  };
}
