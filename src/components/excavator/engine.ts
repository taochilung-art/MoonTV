import * as THREE from 'three';

import { ExcavatorInput } from './controls';

export type GameStatus = 'ready' | 'playing' | 'won' | 'lost';

export interface GameStats {
  status: GameStatus;
  score: number;
  goal: number;
  carried: number;
  capacity: number;
  timeLeft: number;
}

interface Dirt {
  mesh: THREE.Mesh;
  state: 'rest' | 'carried' | 'falling';
  vel: THREE.Vector3;
  scored: boolean;
}

interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

const GOAL = 20;
const CAPACITY = 6;
const DIRT_COUNT = 70;
const TIME_LIMIT = 180;
const DIRT_SIZE = 0.3;
const WORLD_HALF = 25;
const EXCAVATOR_RADIUS = 1.8;

const DRIVE_SPEED = 4;
const TURN_SPEED = 1.2;
const SWING_SPEED = 1.1;
const JOINT_SPEED = 0.9;

const BOOM_RANGE: [number, number] = [-0.9, 0.6];
const STICK_RANGE: [number, number] = [0.3, 2.3];
const BUCKET_RANGE: [number, number] = [-1.2, 2.4];

// 卡車：車斗（得分區）與駕駛室
const TRUCK: Rect = { minX: -7.2, maxX: -4.8, minZ: 2, maxZ: 8.5 };
const TRUCK_BED: Rect = { minX: -7.1, maxX: -4.9, minZ: 2.2, maxZ: 6.6 };
const TRUCK_CAB: Rect = { minX: -7.2, maxX: -4.8, minZ: 6.8, maxZ: 8.5 };
const BED_FLOOR = 1.3;
const CAB_TOP = 2.6;

const PILE_CENTER = new THREE.Vector3(5, 0, 6);
const PILE_RADIUS = 2.4;

const inRect = (r: Rect, x: number, z: number) =>
  x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;

const clamp = (v: number, [min, max]: [number, number]) =>
  Math.min(max, Math.max(min, v));

export class ExcavatorEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
  private clock = new THREE.Clock();
  private frameId = 0;
  private resizeObserver: ResizeObserver;

  private root = new THREE.Group();
  private turret = new THREE.Group();
  private boom = new THREE.Group();
  private stick = new THREE.Group();
  private bucket = new THREE.Group();
  private bucketTip = new THREE.Object3D();

  private heading = 0;
  private swing = 0;
  private boomAngle = -0.4;
  private stickAngle = 1.3;
  private bucketAngle = 0.4;

  private dirt: Dirt[] = [];
  private carried: Dirt[] = [];
  private dirtGeometry = new THREE.BoxGeometry(DIRT_SIZE, DIRT_SIZE, DIRT_SIZE);
  private dirtMaterials = ['#8b5a2b', '#7a4e24', '#9c6a3a'].map(
    (color) => new THREE.MeshStandardMaterial({ color, roughness: 1 })
  );

  private stats: GameStats = {
    status: 'ready',
    score: 0,
    goal: GOAL,
    carried: 0,
    capacity: CAPACITY,
    timeLeft: TIME_LIMIT,
  };
  private timeLeft = TIME_LIMIT;

  private tmpA = new THREE.Vector3();
  private tmpB = new THREE.Vector3();

  constructor(
    private container: HTMLElement,
    private input: ExcavatorInput,
    private onStats: (stats: GameStats) => void
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.buildWorld();
    this.buildExcavator();
    this.resetDirt();
    this.updateRig();
    this.snapCamera();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    this.emitStats();
    this.loop();
  }

  start() {
    if (this.stats.status !== 'ready') this.restart();
    this.stats.status = 'playing';
    this.emitStats();
  }

  restart() {
    this.heading = 0;
    this.swing = 0;
    this.boomAngle = -0.4;
    this.stickAngle = 1.3;
    this.bucketAngle = 0.4;
    this.root.position.set(0, 0, 0);
    this.timeLeft = TIME_LIMIT;
    this.resetDirt();
    this.updateRig();
    this.snapCamera();
    this.stats.status = 'playing';
    this.emitStats();
  }

  dispose() {
    cancelAnimationFrame(this.frameId);
    this.resizeObserver.disconnect();
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material)
          ? obj.material
          : [obj.material];
        mats.forEach((m) => m.dispose());
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // ---------- 場景建構 ----------

  private buildWorld() {
    this.scene.background = new THREE.Color('#9fd3f0');
    this.scene.fog = new THREE.Fog('#9fd3f0', 35, 90);

    this.scene.add(new THREE.HemisphereLight('#ffffff', '#6b5a3a', 0.8));
    const sun = new THREE.DirectionalLight('#ffffff', 1.6);
    sun.position.set(12, 20, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const s = sun.shadow.camera;
    s.left = -25;
    s.right = 25;
    s.top = 25;
    s.bottom = -25;
    s.far = 60;
    this.scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_HALF * 4, WORLD_HALF * 4),
      new THREE.MeshStandardMaterial({ color: '#c9a66b', roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // 工地邊界的三角錐
    const coneGeo = new THREE.ConeGeometry(0.3, 0.8, 12);
    const coneMat = new THREE.MeshStandardMaterial({ color: '#ff6a00' });
    for (let i = -WORLD_HALF; i <= WORLD_HALF; i += 5) {
      [
        [i, -WORLD_HALF],
        [i, WORLD_HALF],
        [-WORLD_HALF, i],
        [WORLD_HALF, i],
      ].forEach(([x, z]) => {
        const cone = new THREE.Mesh(coneGeo, coneMat);
        cone.position.set(x, 0.4, z);
        cone.castShadow = true;
        this.scene.add(cone);
      });
    }

    // 土堆位置的深色地面
    const pileBase = new THREE.Mesh(
      new THREE.CircleGeometry(PILE_RADIUS + 0.6, 32),
      new THREE.MeshStandardMaterial({ color: '#8f6a3c', roughness: 1 })
    );
    pileBase.rotation.x = -Math.PI / 2;
    pileBase.position.set(PILE_CENTER.x, 0.01, PILE_CENTER.z);
    pileBase.receiveShadow = true;
    this.scene.add(pileBase);

    this.buildTruck();
  }

  private box(
    w: number,
    h: number,
    d: number,
    color: string,
    x: number,
    y: number,
    z: number,
    parent: THREE.Object3D
  ) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.7 })
    );
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  private buildTruck() {
    const truck = new THREE.Group();
    this.scene.add(truck);
    const cx = (TRUCK.minX + TRUCK.maxX) / 2;
    const bedW = TRUCK_BED.maxX - TRUCK_BED.minX;
    const bedD = TRUCK_BED.maxZ - TRUCK_BED.minZ;
    const bedCz = (TRUCK_BED.minZ + TRUCK_BED.maxZ) / 2;

    // 底盤與車輪
    this.box(2.2, 0.5, TRUCK.maxZ - TRUCK.minZ, '#333', cx, 0.8, 5.25, truck);
    const wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.4, 20);
    const wheelMat = new THREE.MeshStandardMaterial({ color: '#111' });
    [2.8, 4.4, 7.6].forEach((z) =>
      [TRUCK.minX - 0.05, TRUCK.maxX + 0.05].forEach((x) => {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(x, 0.55, z);
        wheel.castShadow = true;
        truck.add(wheel);
      })
    );

    // 車斗
    this.box(bedW, 0.2, bedD, '#d33', cx, BED_FLOOR - 0.1, bedCz, truck);
    this.box(
      0.15,
      0.8,
      bedD,
      '#d33',
      TRUCK_BED.minX,
      BED_FLOOR + 0.3,
      bedCz,
      truck
    );
    this.box(
      0.15,
      0.8,
      bedD,
      '#d33',
      TRUCK_BED.maxX,
      BED_FLOOR + 0.3,
      bedCz,
      truck
    );
    this.box(
      bedW,
      0.8,
      0.15,
      '#d33',
      cx,
      BED_FLOOR + 0.3,
      TRUCK_BED.minZ,
      truck
    );
    this.box(
      bedW,
      0.8,
      0.15,
      '#d33',
      cx,
      BED_FLOOR + 0.3,
      TRUCK_BED.maxZ,
      truck
    );

    // 駕駛室
    const cabD = TRUCK_CAB.maxZ - TRUCK_CAB.minZ;
    const cabCz = (TRUCK_CAB.minZ + TRUCK_CAB.maxZ) / 2;
    this.box(
      2.4,
      CAB_TOP - 1.05,
      cabD,
      '#e8e8e8',
      cx,
      (CAB_TOP + 1.05) / 2,
      cabCz,
      truck
    );
    this.box(
      2.2,
      0.6,
      0.05,
      '#4aa3df',
      cx,
      CAB_TOP - 0.5,
      TRUCK_CAB.maxZ + 0.01,
      truck
    );
  }

  private buildExcavator() {
    const yellow = '#f2b705';
    const dark = '#2b2b2b';
    this.scene.add(this.root);

    // 履帶
    this.box(0.7, 0.8, 3.6, dark, 1.1, 0.4, 0, this.root);
    this.box(0.7, 0.8, 3.6, dark, -1.1, 0.4, 0, this.root);
    this.box(1.6, 0.4, 2.4, '#555', 0, 0.6, 0, this.root);

    // 上部迴轉體
    this.turret.position.y = 1.0;
    this.root.add(this.turret);
    this.box(2.6, 0.9, 2.8, yellow, 0, 0.45, -0.3, this.turret);
    this.box(2.4, 0.8, 0.8, dark, 0, 0.5, -1.7, this.turret); // 配重
    this.box(1.0, 1.3, 1.1, yellow, -0.75, 1.5, 0.4, this.turret); // 駕駛室
    this.box(0.95, 0.7, 0.05, '#4aa3df', -0.75, 1.65, 0.97, this.turret);

    // 大臂 → 小臂 → 鏟斗，每一節的軸心都在關節上
    this.boom.position.set(0.35, 0.9, 0.7);
    this.turret.add(this.boom);
    this.box(0.45, 0.5, 3.2, yellow, 0, 0, 1.6, this.boom);

    this.stick.position.set(0, 0, 3.2);
    this.boom.add(this.stick);
    this.box(0.35, 0.4, 2.2, yellow, 0, 0, 1.1, this.stick);

    this.bucket.position.set(0, 0, 2.2);
    this.stick.add(this.bucket);
    this.box(1.0, 0.08, 0.9, dark, 0, 0, 0.45, this.bucket); // 背板
    this.box(1.0, 0.55, 0.08, dark, 0, -0.27, 0.9, this.bucket); // 斗齒板
    this.box(1.0, 0.2, 0.08, dark, 0, -0.1, 0, this.bucket);
    this.box(0.06, 0.55, 0.9, dark, 0.5, -0.27, 0.45, this.bucket);
    this.box(0.06, 0.55, 0.9, dark, -0.5, -0.27, 0.45, this.bucket);
    this.bucketTip.position.set(0, -0.55, 0.9);
    this.bucket.add(this.bucketTip);
  }

  private resetDirt() {
    this.dirt.forEach((d) => d.mesh.removeFromParent());
    this.dirt = [];
    this.carried = [];
    this.stats.score = 0;

    // 由下往上堆出錐形土堆
    for (let i = 0; i < DIRT_COUNT; i++) {
      const r =
        PILE_RADIUS * Math.sqrt(Math.random()) * (1 - i / (DIRT_COUNT * 1.4));
      const a = Math.random() * Math.PI * 2;
      const x = PILE_CENTER.x + Math.cos(a) * r;
      const z = PILE_CENTER.z + Math.sin(a) * r;
      const mesh = new THREE.Mesh(
        this.dirtGeometry,
        this.dirtMaterials[i % this.dirtMaterials.length]
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.rotation.y = Math.random() * Math.PI;
      mesh.position.set(x, this.surfaceAt(x, z) + DIRT_SIZE / 2, z);
      this.scene.add(mesh);
      this.dirt.push({
        mesh,
        state: 'rest',
        vel: new THREE.Vector3(),
        scored: false,
      });
    }
  }

  // ---------- 遊戲迴圈 ----------

  private loop = () => {
    this.frameId = requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (this.stats.status === 'playing') this.update(dt);
    this.updateFalling(dt);
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private update(dt: number) {
    const i = this.input;

    // 車身行駛
    const turn = (i.turnLeft ? 1 : 0) - (i.turnRight ? 1 : 0);
    const drive = (i.forward ? 1 : 0) - (i.backward ? 1 : 0);
    this.heading += turn * TURN_SPEED * dt;
    const pos = this.root.position;
    const prevX = pos.x;
    const prevZ = pos.z;
    pos.x += Math.sin(this.heading) * drive * DRIVE_SPEED * dt;
    pos.z += Math.cos(this.heading) * drive * DRIVE_SPEED * dt;
    pos.x = Math.min(WORLD_HALF - 2, Math.max(-WORLD_HALF + 2, pos.x));
    pos.z = Math.min(WORLD_HALF - 2, Math.max(-WORLD_HALF + 2, pos.z));
    if (this.hitsTruck(pos.x, pos.z)) {
      pos.x = prevX;
      pos.z = prevZ;
    }

    // 手臂：改完角度後若鏟斗插進地面就還原
    const prev = [
      this.swing,
      this.boomAngle,
      this.stickAngle,
      this.bucketAngle,
    ];
    const axis = (pos: boolean, neg: boolean) =>
      ((pos ? 1 : 0) - (neg ? 1 : 0)) * dt;
    this.swing += axis(i.swingLeft, i.swingRight) * SWING_SPEED;
    this.boomAngle = clamp(
      this.boomAngle + axis(i.boomDown, i.boomUp) * JOINT_SPEED,
      BOOM_RANGE
    );
    this.stickAngle = clamp(
      this.stickAngle + axis(i.stickIn, i.stickOut) * JOINT_SPEED,
      STICK_RANGE
    );
    this.bucketAngle = clamp(
      this.bucketAngle + axis(i.bucketCurl, i.bucketDump) * JOINT_SPEED * 1.4,
      BUCKET_RANGE
    );
    this.updateRig();
    const tip = this.bucketTip.getWorldPosition(this.tmpA);
    const pivot = this.bucket.getWorldPosition(this.tmpB);
    if (tip.y < -0.1 || pivot.y < 0.2) {
      [this.swing, this.boomAngle, this.stickAngle, this.bucketAngle] = prev;
      this.updateRig();
    }

    this.handleBucket();

    this.timeLeft -= dt;
    if (this.stats.score >= GOAL) {
      this.stats.status = 'won';
    } else if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.stats.status = 'lost';
    }
    this.emitStats();
  }

  private updateRig() {
    this.root.rotation.y = this.heading;
    this.turret.rotation.y = this.swing;
    this.boom.rotation.x = this.boomAngle;
    this.stick.rotation.x = this.stickAngle;
    this.bucket.rotation.x = this.bucketAngle;
    this.root.updateMatrixWorld(true);
  }

  private hitsTruck(x: number, z: number) {
    const nx = Math.max(TRUCK.minX, Math.min(x, TRUCK.maxX));
    const nz = Math.max(TRUCK.minZ, Math.min(z, TRUCK.maxZ));
    return (x - nx) ** 2 + (z - nz) ** 2 < EXCAVATOR_RADIUS ** 2;
  }

  /** 鏟斗開口方向（鏟斗座標的 -Y）朝上為正、朝下為負 */
  private bucketOpening() {
    const dir = this.tmpB
      .set(0, -1, 0)
      .transformDirection(this.bucket.matrixWorld);
    return dir.y;
  }

  private handleBucket() {
    const tip = this.bucketTip.getWorldPosition(this.tmpA);

    // 挖取：鏟斗貼近地面、正在收斗時，撿起附近的土塊
    if (
      this.input.bucketCurl &&
      tip.y < 0.9 &&
      this.carried.length < CAPACITY
    ) {
      const near = this.dirt
        .filter(
          (d) =>
            d.state === 'rest' &&
            !d.scored &&
            d.mesh.position.distanceTo(tip) < 1.1
        )
        .sort(
          (a, b) =>
            b.mesh.position.y - a.mesh.position.y ||
            a.mesh.position.distanceTo(tip) - b.mesh.position.distanceTo(tip)
        )
        .slice(0, CAPACITY - this.carried.length);
      near.forEach((d) => this.pickUp(d));
    }

    // 傾倒：開口朝下時土塊落下
    if (this.carried.length > 0 && this.bucketOpening() < -0.25) {
      const released = this.carried;
      this.carried = [];
      released.forEach((d) => {
        this.scene.attach(d.mesh);
        d.state = 'falling';
        d.vel.set((Math.random() - 0.5) * 0.6, 0, (Math.random() - 0.5) * 0.6);
      });
      this.stats.carried = 0;
    }
  }

  private pickUp(d: Dirt) {
    const from = d.mesh.position.clone();
    const slot = this.carried.length;
    this.carried.push(d);
    d.state = 'carried';
    this.bucket.add(d.mesh);
    d.mesh.position.set(
      ((slot % 3) - 1) * 0.3,
      -0.22,
      0.25 + Math.floor(slot / 3) * 0.35
    );
    d.mesh.rotation.set(0, 0, 0);
    this.stats.carried = this.carried.length;
    this.settleAbove(from);
  }

  /** 讓原本壓在某位置上方的土塊開始掉落 */
  private settleAbove(pos: THREE.Vector3) {
    this.dirt.forEach((o) => {
      if (
        o.state === 'rest' &&
        o.mesh.position.y > pos.y - 0.05 &&
        Math.abs(o.mesh.position.x - pos.x) < DIRT_SIZE &&
        Math.abs(o.mesh.position.z - pos.z) < DIRT_SIZE
      ) {
        o.state = 'falling';
        o.vel.set(0, 0, 0);
      }
    });
  }

  /** 某個 xz 位置的落點高度：地面、卡車或其他靜止的土塊 */
  private surfaceAt(x: number, z: number, ignore?: Dirt) {
    let h = 0;
    if (inRect(TRUCK_BED, x, z)) h = BED_FLOOR;
    else if (inRect(TRUCK_CAB, x, z)) h = CAB_TOP;
    else if (inRect(TRUCK, x, z)) h = BED_FLOOR + 0.8;
    this.dirt.forEach((o) => {
      if (o === ignore || o.state !== 'rest') return;
      const p = o.mesh.position;
      if (
        Math.abs(p.x - x) < DIRT_SIZE * 0.9 &&
        Math.abs(p.z - z) < DIRT_SIZE * 0.9
      ) {
        h = Math.max(h, p.y + DIRT_SIZE / 2);
      }
    });
    return h;
  }

  private updateFalling(dt: number) {
    let changed = false;
    this.dirt.forEach((d) => {
      if (d.state !== 'falling') return;
      const p = d.mesh.position;
      d.vel.y -= 9.8 * dt;
      p.addScaledVector(d.vel, dt);
      d.mesh.rotation.x += dt * 3;
      const surface = this.surfaceAt(p.x, p.z, d);
      if (p.y - DIRT_SIZE / 2 <= surface) {
        p.y = surface + DIRT_SIZE / 2;
        d.mesh.rotation.x = 0;
        d.state = 'rest';
        d.vel.set(0, 0, 0);
        if (!d.scored && inRect(TRUCK_BED, p.x, p.z) && p.y < BED_FLOOR + 1.5) {
          d.scored = true;
          this.stats.score += 1;
          changed = true;
        }
      }
    });
    if (changed) this.emitStats();
  }

  // ---------- 相機 ----------

  private cameraTarget = new THREE.Vector3();

  private desiredCamera(out: THREE.Vector3, look: THREE.Vector3) {
    const dir = this.heading + this.swing * 0.6;
    const p = this.root.position;
    out.set(p.x - Math.sin(dir) * 10, 7.5, p.z - Math.cos(dir) * 10);
    look.set(p.x + Math.sin(dir) * 4, 1.5, p.z + Math.cos(dir) * 4);
  }

  private snapCamera() {
    this.desiredCamera(this.camera.position, this.cameraTarget);
    this.camera.lookAt(this.cameraTarget);
  }

  private updateCamera(dt: number) {
    const pos = new THREE.Vector3();
    const look = new THREE.Vector3();
    this.desiredCamera(pos, look);
    const k = 1 - Math.exp(-dt * 3);
    this.camera.position.lerp(pos, k);
    this.cameraTarget.lerp(look, k);
    this.camera.lookAt(this.cameraTarget);
  }

  private resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private emitStats() {
    const timeLeft = Math.ceil(this.timeLeft);
    const changed = timeLeft !== this.stats.timeLeft;
    this.stats.timeLeft = timeLeft;
    this.stats.carried = this.carried.length;
    if (changed || this.lastEmitted !== this.statsKey()) {
      this.lastEmitted = this.statsKey();
      this.onStats({ ...this.stats });
    }
  }

  private lastEmitted = '';
  private statsKey() {
    const s = this.stats;
    return `${s.status}|${s.score}|${s.carried}|${s.timeLeft}`;
  }
}
