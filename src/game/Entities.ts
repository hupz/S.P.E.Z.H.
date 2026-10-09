import * as THREE from 'three';
import { MazeGenerator } from './Maze';
import { PlayerController } from './Player';

// ============ ENEMIES ============

export interface Enemy {
  group: THREE.Group;
  type: 'wolf' | 'rat';
  health: number;
  maxHealth: number;
  speed: number;
  damage: number;
  attackRange: number;
  detectRange: number;
  attackCooldown: number;
  state: 'idle' | 'patrol' | 'chase' | 'attack' | 'dead';
  patrolTarget: THREE.Vector3;
  cellPos: { x: number; z: number };
  deathTimer: number;
}

export class EnemyManager {
  scene: THREE.Scene;
  maze: MazeGenerator;
  enemies: Enemy[] = [];

  constructor(scene: THREE.Scene, maze: MazeGenerator) {
    this.scene = scene;
    this.maze = maze;
  }

  spawnEnemies(count: number): void {
    const cells = this.maze.getOpenCells();
    // Spawn away from start
    const farCells = cells.filter(c => c.x + c.z > 4);
    
    for (let i = 0; i < count && i < farCells.length; i++) {
      const cell = farCells[Math.floor(Math.random() * farCells.length)];
      const worldPos = this.maze.cellToWorld(cell.x, cell.z);
      const type = Math.random() > 0.5 ? 'wolf' : 'rat';
      const enemy = this.createEnemy(type, worldPos, cell);
      this.enemies.push(enemy);
      this.scene.add(enemy.group);
    }
  }

  createEnemy(type: 'wolf' | 'rat', pos: THREE.Vector3, cell: { x: number; z: number }): Enemy {
    const group = new THREE.Group();
    
    if (type === 'wolf') {
      this.buildWolf(group);
    } else {
      this.buildRat(group);
    }

    group.position.copy(pos);
    group.position.y = 0;

    const stats = type === 'wolf' 
      ? { health: 60, speed: 5, damage: 15, attackRange: 2.0, detectRange: 15 }
      : { health: 30, speed: 7, damage: 8, attackRange: 1.5, detectRange: 12 };

    return {
      group,
      type,
      ...stats,
      maxHealth: stats.health,
      attackCooldown: 0,
      state: 'patrol',
      patrolTarget: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 8, 0, (Math.random() - 0.5) * 8)),
      cellPos: cell,
      deathTimer: 0,
    };
  }

  buildWolf(group: THREE.Group): void {
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.8, flatShading: true });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.8, flatShading: true });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, emissive: 0xffcc00, emissiveIntensity: 0.5 });

    // Body
    const bodyGeo = new THREE.BoxGeometry(0.6, 0.5, 1.2);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.6;
    group.add(body);

    // Head
    const headGeo = new THREE.BoxGeometry(0.4, 0.35, 0.5);
    const head = new THREE.Mesh(headGeo, bodyMat);
    head.position.set(0, 0.75, -0.7);
    group.add(head);

    // Snout
    const snoutGeo = new THREE.BoxGeometry(0.2, 0.15, 0.3);
    const snout = new THREE.Mesh(snoutGeo, darkMat);
    snout.position.set(0, 0.65, -1.0);
    group.add(snout);

    // Ears
    for (let side of [-1, 1]) {
      const earGeo = new THREE.ConeGeometry(0.08, 0.2, 3);
      const ear = new THREE.Mesh(earGeo, darkMat);
      ear.position.set(side * 0.15, 0.95, -0.6);
      group.add(ear);
    }

    // Eyes
    for (let side of [-1, 1]) {
      const eyeGeo = new THREE.SphereGeometry(0.04, 4, 4);
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(side * 0.12, 0.8, -0.9);
      group.add(eye);
    }

    // Legs
    for (let x of [-0.2, 0.2]) {
      for (let z of [-0.4, 0.4]) {
        const legGeo = new THREE.BoxGeometry(0.12, 0.4, 0.12);
        const leg = new THREE.Mesh(legGeo, darkMat);
        leg.position.set(x, 0.2, z);
        group.add(leg);
      }
    }

    // Tail
    const tailGeo = new THREE.CylinderGeometry(0.04, 0.06, 0.6, 4);
    tailGeo.rotateX(Math.PI / 4);
    const tail = new THREE.Mesh(tailGeo, darkMat);
    tail.position.set(0, 0.7, 0.8);
    group.add(tail);

    group.scale.setScalar(1.2);
  }

  buildRat(group: THREE.Group): void {
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.8, flatShading: true });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.8, flatShading: true });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff3333, emissive: 0xff0000, emissiveIntensity: 0.3 });

    // Body - hunched
    const bodyGeo = new THREE.SphereGeometry(0.35, 5, 4);
    bodyGeo.scale(1, 0.7, 1.3);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.3;
    group.add(body);

    // Head
    const headGeo = new THREE.SphereGeometry(0.2, 4, 3);
    headGeo.scale(1, 0.8, 1.2);
    const head = new THREE.Mesh(headGeo, bodyMat);
    head.position.set(0, 0.35, -0.4);
    group.add(head);

    // Ears
    for (let side of [-1, 1]) {
      const earGeo = new THREE.SphereGeometry(0.1, 4, 3);
      earGeo.scale(0.5, 1, 0.5);
      const ear = new THREE.Mesh(earGeo, new THREE.MeshStandardMaterial({ color: 0x8a6a5a, flatShading: true }));
      ear.position.set(side * 0.15, 0.5, -0.35);
      group.add(ear);
    }

    // Eyes
    for (let side of [-1, 1]) {
      const eyeGeo = new THREE.SphereGeometry(0.03, 4, 4);
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(side * 0.1, 0.38, -0.55);
      group.add(eye);
    }

    // Teeth
    const teethGeo = new THREE.BoxGeometry(0.04, 0.06, 0.02);
    const teethMat = new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true });
    const teeth = new THREE.Mesh(teethGeo, teethMat);
    teeth.position.set(0, 0.25, -0.55);
    group.add(teeth);

    // Legs
    for (let x of [-0.15, 0.15]) {
      for (let z of [-0.2, 0.2]) {
        const legGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.2, 4);
        const leg = new THREE.Mesh(legGeo, darkMat);
        leg.position.set(x, 0.1, z);
        group.add(leg);
      }
    }

    // Tail
    const tailGeo = new THREE.CylinderGeometry(0.02, 0.03, 0.8, 4);
    tailGeo.rotateX(-Math.PI / 6);
    const tail = new THREE.Mesh(tailGeo, new THREE.MeshStandardMaterial({ color: 0x8a6a5a, flatShading: true }));
    tail.position.set(0, 0.35, 0.6);
    group.add(tail);
  }

  update(delta: number, player: PlayerController): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      
      if (enemy.state === 'dead') {
        enemy.deathTimer += delta;
        enemy.group.scale.setScalar(Math.max(0, 1 - enemy.deathTimer));
        enemy.group.position.y -= delta * 0.5;
        if (enemy.deathTimer > 1.5) {
          this.scene.remove(enemy.group);
          this.enemies.splice(i, 1);
        }
        continue;
      }

      const distToPlayer = enemy.group.position.distanceTo(player.position);
      
      // State machine
      if (distToPlayer < enemy.attackRange) {
        enemy.state = 'attack';
      } else if (distToPlayer < enemy.detectRange) {
        enemy.state = 'chase';
      } else {
        enemy.state = 'patrol';
      }

      // Behavior
      switch (enemy.state) {
        case 'patrol':
          this.patrolBehavior(enemy, delta);
          break;
        case 'chase':
          this.chaseBehavior(enemy, delta, player);
          break;
        case 'attack':
          this.attackBehavior(enemy, delta, player);
          break;
      }

      // Animation - simple bobbing
      if (enemy.state === 'patrol' || enemy.state === 'chase' || enemy.state === 'attack') {
        enemy.group.position.y = Math.sin(Date.now() * 0.005 + i) * 0.05;
        // Face movement direction
        if (enemy.state === 'chase') {
          const lookDir = new THREE.Vector3().subVectors(player.position, enemy.group.position);
          lookDir.y = 0;
          if (lookDir.length() > 0.1) {
            const angle = Math.atan2(lookDir.x, lookDir.z);
            enemy.group.rotation.y = angle;
          }
        }
      }
    }
  }

  patrolBehavior(enemy: Enemy, delta: number): void {
    const dir = new THREE.Vector3().subVectors(enemy.patrolTarget, enemy.group.position);
    dir.y = 0;
    
    if (dir.length() < 1) {
      // New patrol target
      const cell = this.maze.worldToCell(enemy.group.position.x, enemy.group.position.z);
      const neighbors = this.getWalkableNeighbors(cell);
      if (neighbors.length > 0) {
        const target = neighbors[Math.floor(Math.random() * neighbors.length)];
        enemy.patrolTarget = this.maze.cellToWorld(target.x, target.z);
      }
    } else {
      dir.normalize();
      enemy.group.position.add(dir.multiplyScalar(enemy.speed * 0.3 * delta));
    }
  }

  chaseBehavior(enemy: Enemy, delta: number, player: PlayerController): void {
    const dir = new THREE.Vector3().subVectors(player.position, enemy.group.position);
    dir.y = 0;
    dir.normalize();
    enemy.group.position.add(dir.multiplyScalar(enemy.speed * delta));
  }

  attackBehavior(enemy: Enemy, delta: number, player: PlayerController): void {
    enemy.attackCooldown -= delta;
    if (enemy.attackCooldown <= 0) {
      player.takeDamage(enemy.damage);
      enemy.attackCooldown = 1.5;
      // Attack animation - lunge forward
      const lunge = new THREE.Vector3().subVectors(player.position, enemy.group.position).normalize().multiplyScalar(0.3);
      enemy.group.position.add(lunge);
    }
  }

  getWalkableNeighbors(cell: { x: number; z: number }): { x: number; z: number }[] {
    const result: { x: number; z: number }[] = [];
    const grid = this.maze.grid;
    if (!grid[cell.x] || !grid[cell.x][cell.z]) return result;
    
    const c = grid[cell.x][cell.z];
    if (!c.walls.north && cell.z > 0) result.push({ x: cell.x, z: cell.z - 1 });
    if (!c.walls.south && cell.z < this.maze.config.height - 1) result.push({ x: cell.x, z: cell.z + 1 });
    if (!c.walls.east && cell.x < this.maze.config.width - 1) result.push({ x: cell.x + 1, z: cell.z });
    if (!c.walls.west && cell.x > 0) result.push({ x: cell.x - 1, z: cell.z });
    return result;
  }

  damageEnemy(enemy: Enemy, amount: number): void {
    enemy.health -= amount;
    if (enemy.health <= 0) {
      enemy.state = 'dead';
      enemy.deathTimer = 0;
    }
  }

  getClosestEnemy(hitbox: THREE.Sphere): Enemy | null {
    let closest: Enemy | null = null;
    let closestDist = Infinity;
    
    for (const enemy of this.enemies) {
      if (enemy.state === 'dead') continue;
      const dist = hitbox.center.distanceTo(enemy.group.position);
      if (dist < hitbox.radius && dist < closestDist) {
        closest = enemy;
        closestDist = dist;
      }
    }
    return closest;
  }

  clear(): void {
    for (const enemy of this.enemies) {
      this.scene.remove(enemy.group);
    }
    this.enemies = [];
  }
}

// ============ COLLECTIBLES (MOONLEAF) ============

export interface Moonleaf {
  group: THREE.Group;
  collected: boolean;
  cellPos: { x: number; z: number };
  bobOffset: number;
}

export class CollectibleManager {
  scene: THREE.Scene;
  maze: MazeGenerator;
  moonleaves: Moonleaf[] = [];
  totalRequired: number = 3;
  collected: number = 0;

  constructor(scene: THREE.Scene, maze: MazeGenerator) {
    this.scene = scene;
    this.maze = maze;
  }

  spawnMoonleaves(count: number): void {
    const cells = this.maze.getOpenCells();
    // Spread them out
    const usedCells: string[] = [];
    
    for (let i = 0; i < count; i++) {
      let cell: { x: number; z: number };
      let attempts = 0;
      do {
        cell = cells[Math.floor(Math.random() * cells.length)];
        attempts++;
      } while (usedCells.includes(`${cell.x},${cell.z}`) && attempts < 50);
      
      usedCells.push(`${cell.x},${cell.z}`);
      const worldPos = this.maze.cellToWorld(cell.x, cell.z);
      const moonleaf = this.createMoonleaf(worldPos, cell);
      this.moonleaves.push(moonleaf);
      this.scene.add(moonleaf.group);
    }
  }

  createMoonleaf(pos: THREE.Vector3, cell: { x: number; z: number }): Moonleaf {
    const group = new THREE.Group();

    // Stem
    const stemGeo = new THREE.CylinderGeometry(0.03, 0.04, 0.4, 4);
    const stemMat = new THREE.MeshStandardMaterial({
      color: 0x2a5a4a,
      roughness: 0.7,
      flatShading: true,
    });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.y = 0.2;
    group.add(stem);

    // Leaves - turquoise/blue-green angular
    const numLeaves = 5;
    for (let i = 0; i < numLeaves; i++) {
      const leafGeo = new THREE.ConeGeometry(0.12, 0.3, 4);
      const leafMat = new THREE.MeshStandardMaterial({
        color: 0x40e0d0,
        emissive: 0x20a090,
        emissiveIntensity: 0.4,
        roughness: 0.5,
        flatShading: true,
        transparent: true,
        opacity: 0.9,
      });
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      const angle = (i / numLeaves) * Math.PI * 2;
      leaf.position.set(
        Math.cos(angle) * 0.15,
        0.4 + Math.sin(i * 1.5) * 0.05,
        Math.sin(angle) * 0.15
      );
      leaf.rotation.z = Math.cos(angle) * 0.4;
      leaf.rotation.x = Math.sin(angle) * 0.4;
      group.add(leaf);
    }

    // Glow particle (simple sphere)
    const glowGeo = new THREE.SphereGeometry(0.3, 6, 4);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x40e0d0,
      transparent: true,
      opacity: 0.2,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.y = 0.4;
    group.add(glow);

    // Point light
    const light = new THREE.PointLight(0x40e0d0, 0.5, 5);
    light.position.y = 0.5;
    group.add(light);

    group.position.copy(pos);
    group.position.y = 0;

    return {
      group,
      collected: false,
      cellPos: cell,
      bobOffset: Math.random() * Math.PI * 2,
    };
  }

  update(time: number): void {
    for (const ml of this.moonleaves) {
      if (ml.collected) continue;
      // Bobbing animation
      ml.group.position.y = 0.1 + Math.sin(time * 2 + ml.bobOffset) * 0.1;
      // Rotation
      ml.group.rotation.y += 0.01;
      // Pulse glow
      const glow = ml.group.children[ml.group.children.length - 2] as THREE.Mesh;
      if (glow && glow.material) {
        (glow.material as THREE.MeshBasicMaterial).opacity = 0.15 + Math.sin(time * 3 + ml.bobOffset) * 0.1;
      }
    }
  }

  checkCollection(playerPos: THREE.Vector3): Moonleaf | null {
    for (const ml of this.moonleaves) {
      if (ml.collected) continue;
      const dist = playerPos.distanceTo(ml.group.position);
      if (dist < 2.0) {
        return ml;
      }
    }
    return null;
  }

  collect(ml: Moonleaf): void {
    ml.collected = true;
    this.collected++;
    this.scene.remove(ml.group);
  }

  isComplete(): boolean {
    return this.collected >= this.totalRequired;
  }

  clear(): void {
    for (const ml of this.moonleaves) {
      this.scene.remove(ml.group);
    }
    this.moonleaves = [];
    this.collected = 0;
  }
}

// ============ FAIRY COMPANION ============

export class FairyCompanion {
  group: THREE.Group;
  scene: THREE.Scene;
  dialogueLines: string[] = [
    "О, привет. Ты ещё живой?",
    "Я уже начала делить твои вещички.",
    "Кто много стоит, легко в земле лежит. Опа, монетки!",
    "Не переживай, если помрёшь, я всё заберу. Мы же друзья.",
    "Этот лабиринт... он как бы... живой. Не говори ему, что я это сказала.",
    "Собирай лунные листья. Три штуки. Иначе мы тут навсегда застрянем.",
    "Смотри под ноги. Серьёзно. Тут корни везде.",
    "Если услышишь грохот — беги. Лабиринт опять перестраивается.",
    "Ты уверен, что знаешь куда идёшь? Потому что я — нет.",
    "Знаешь, в прошлый раз тут был один искатель... ну, не важно.",
  ];
  currentDialogue: string = '';
  dialogueTimer: number = 0;
  dialogueInterval: number = 15;
  lastDialogueIndex: number = -1;
  targetPosition: THREE.Vector3 = new THREE.Vector3();
  hoverOffset: number = 0;
  showFront: boolean = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.buildFairy();
    scene.add(this.group);
  }

  buildFairy(): void {
    // Body
    const bodyGeo = new THREE.DodecahedronGeometry(0.1, 0);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffa500,
      emissiveIntensity: 0.3,
      roughness: 0.4,
      flatShading: true,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    this.group.add(body);

    // Head
    const headGeo = new THREE.DodecahedronGeometry(0.07, 0);
    const headMat = new THREE.MeshStandardMaterial({
      color: 0xffe4c4,
      roughness: 0.6,
      flatShading: true,
    });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0.12;
    this.group.add(head);

    // Wings
    for (let side of [-1, 1]) {
      const wingGeo = new THREE.PlaneGeometry(0.15, 0.2);
      const wingMat = new THREE.MeshBasicMaterial({
        color: 0x88ffff,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
      });
      const wing = new THREE.Mesh(wingGeo, wingMat);
      wing.position.set(side * 0.12, 0.05, 0);
      wing.rotation.y = side * 0.3;
      wing.name = 'wing';
      this.group.add(wing);
    }

    // Glow
    const glowGeo = new THREE.SphereGeometry(0.2, 6, 4);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      transparent: true,
      opacity: 0.15,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    this.group.add(glow);

    // Light
    const light = new THREE.PointLight(0xffd700, 0.4, 5);
    this.group.add(light);
  }

  update(delta: number, playerPos: THREE.Vector3, playerForward: THREE.Vector3): void {
    this.hoverOffset += delta * 3;
    
    // Position fairy near player but not blocking view
    this.showFront = this.currentDialogue !== '' && this.dialogueTimer > 0;
    
    if (this.showFront) {
      // Move in front of player slightly
      this.targetPosition.copy(playerPos).add(playerForward.clone().multiplyScalar(-1.5));
      this.targetPosition.y = playerPos.y + 0.3;
      // Offset to side
      const right = new THREE.Vector3().crossVectors(playerForward, new THREE.Vector3(0, 1, 0)).normalize();
      this.targetPosition.add(right.multiplyScalar(0.8));
    } else {
      // Hover beside player
      const right = new THREE.Vector3().crossVectors(playerForward, new THREE.Vector3(0, 1, 0)).normalize();
      this.targetPosition.copy(playerPos).add(right.multiplyScalar(0.7));
      this.targetPosition.y = playerPos.y + 0.2;
      this.targetPosition.add(playerForward.clone().multiplyScalar(-0.3));
    }

    // Smooth follow
    this.group.position.lerp(this.targetPosition, delta * 3);
    this.group.position.y += Math.sin(this.hoverOffset) * 0.05;

    // Wing animation
    this.group.traverse((child) => {
      if (child.name === 'wing') {
        child.rotation.y = Math.sin(Date.now() * 0.02) * 0.5;
      }
    });

    // Dialogue timing
    if (this.currentDialogue !== '') {
      this.dialogueTimer -= delta;
      if (this.dialogueTimer <= 0) {
        this.currentDialogue = '';
      }
    } else {
      this.dialogueInterval -= delta;
      if (this.dialogueInterval <= 0) {
        this.triggerRandomDialogue();
        this.dialogueInterval = 12 + Math.random() * 10;
      }
    }
  }

  triggerRandomDialogue(): void {
    let idx: number;
    do {
      idx = Math.floor(Math.random() * this.dialogueLines.length);
    } while (idx === this.lastDialogueIndex && this.dialogueLines.length > 1);
    
    this.lastDialogueIndex = idx;
    this.currentDialogue = this.dialogueLines[idx];
    this.dialogueTimer = 5;
  }

  triggerDialogue(line: string, duration: number = 4): void {
    this.currentDialogue = line;
    this.dialogueTimer = duration;
  }

  getDialogue(): string {
    return this.currentDialogue;
  }
}
