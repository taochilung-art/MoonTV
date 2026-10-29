# 挖土機遊戲

網址：`/game/excavator`（側邊欄「挖土机」）

有兩種模式，可以用頁面右上角的開關切換：

| 模式     | 說明                                                             |
| -------- | ---------------------------------------------------------------- |
| Three.js | 內建的方塊風格挖土機，打開就能玩：3 分鐘內把 20 塊土運進紅色卡車 |
| Spline   | 載入你在 Spline 做的場景，用同一套按鍵操控裡面的挖土機           |

## 操作

| 鍵盤  | 手機按鈕    | 動作            |
| ----- | ----------- | --------------- |
| W / S | 前 / 後     | 前進 / 後退     |
| A / D | 左 / 右     | 車身轉向        |
| Q / E | 轉左 / 轉右 | 上部迴轉        |
| ↑ / ↓ | 臂 ↑ / 臂 ↓ | 大臂抬起 / 放下 |
| ← / → | 收臂 / 伸臂 | 小臂收回 / 伸出 |
| Z / X | 挖 / 倒     | 鏟斗挖取 / 傾倒 |

玩法：鏟斗放到土堆上，按住「挖」（Z）收斗，土塊就會進到鏟斗（一次最多 6 塊）。接著抬起大臂、轉到卡車車斗上方，按「倒」（X）把鏟斗翻過來，土塊落進車斗就得分。

## 製作 Spline 場景

1. 在 [Spline](https://spline.design) 建立挖土機，物件**名稱**要跟下表一致（大小寫也要一樣），層級也要一層包一層：

   ```
   Excavator          ← 整台車，前進／轉向會移動它
   └─ Turret          ← 上部迴轉體，以 Y 軸旋轉
      └─ Boom         ← 大臂，以 X 軸旋轉
         └─ Stick     ← 小臂，以 X 軸旋轉
            └─ Bucket ← 鏟斗，以 X 軸旋轉
   ```

   每個零件的**軸心（pivot）要放在關節上**。在 Spline 可以把零件放進一個空的 Group，再把 Group 移到關節的位置，然後用這個 Group 當作上表中的物件。

2. 車頭朝向 +Z 方向。如果模型做好後方向不對，旋轉外層的 `Excavator` 群組就好，不要轉裡面的零件。
3. （選用）計分：在 Spline 建立數字變數，例如 `score`，再用 Collision 事件在土塊碰到卡車時加分。頁面會自動在左上角顯示場景裡所有的數字和文字變數。
4. 匯出：Export → Code Export → React（或 Vanilla JS），複製 `https://prod.spline.design/.../scene.splinecode` 網址。
5. 回到遊戲頁面切換到 Spline 模式，貼上網址後按「載入場景」。網址會記在瀏覽器裡。

如果場景缺少某些物件，頁面會列出找不到的名稱，對應的操作就不會有作用。

### 預設場景

除了在頁面上貼網址，也可以用其他兩種方式指定場景：

- 網址參數：`/game/excavator?mode=spline&scene=<splinecode 網址>`
- 環境變數 `NEXT_PUBLIC_SPLINE_EXCAVATOR_SCENE`：在**建置時**寫入，修改後要重新建置

## 程式位置

- `src/app/game/excavator/page.tsx`：頁面與模式切換
- `src/components/excavator/engine.ts`：Three.js 遊戲引擎（場景、手臂、土塊物理、計分）
- `src/components/excavator/ExcavatorGame.tsx`：Three.js 模式的畫面與 HUD
- `src/components/excavator/SplineExcavator.tsx`：載入 Spline 場景並操控零件
- `src/components/excavator/controls.ts`、`TouchControls.tsx`：鍵盤與觸控操作
