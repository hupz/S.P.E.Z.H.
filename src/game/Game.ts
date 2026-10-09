import * as THREE from 'three';
import { MazeGenerator, DEFAULT_MAZE_CONFIG, MazeConfig } from './Maze';
import { WorldBuilder } from './World';
import { PlayerController } from './Player';
import { EnemyManager, CollectibleManager, FairyCompanion } from './Entities';
import { AudioManager } from './Audio';

export interface GameState {
  health: number;
  maxHealth: number;
  moonleavesCollected: number;
  moonleavesRequired: number;
  transformTimer: number;
  transformInterval: number;
  isTransforming: boolean;
  transformWarning: boolean;
  fairyDialogue: string;
  interactionPrompt: string;
  gameWon: boolean;
  gameLost: boolean;
  isLocked: boolean;
}

export class Game {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  clock: THREE.Clock;
  
  maze: MazeGenerator;
  world: WorldBuilder;
  player: PlayerController;
  enemyManager: EnemyManager;
  collectibles: CollectibleManager;
  fairy: FairyCompanion;
  
  exitPortal: THREE.Group | null = null;
  exitCell: { x: number; z: number } = { x: 0, z: 0 };
  
  transformTimer: number;
  isTransforming: boolean = false;
  transformProgress: number = 0;
  transformWarning: boolean = false;
  
  wallColliders: THREE.Box3[] = [];
  audio: AudioManager;
  
  onStateChange: ((state: GameState) => void) | null = null;
  
  animationId: number = 0;
  isRunning: boolean = false;

  constructor(canvas: HTMLCanvasElement, config?: Partial<MazeConfig>) {
    const mazeConfig = { ...DEFAULT_MAZE_CONFIG, ...config };
    
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.setClearColor(0x1a3a2a);
    
    // Scene
    this.scene = new THREE.Scene();
    
    // Camera
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 600);
    
    // Clock
    this.clock = new THREE.Clock();
    
    // Maze
    this.maze = new MazeGenerator(mazeConfig);
    
    // World
    this.world = new WorldBuilder(this.scene, this.maze);
    
    // Player
    this.player = new PlayerController(this.camera, this.scene);
    
    // Managers
    this.enemyManager = new EnemyManager(this.scene, this.maze);
    this.collectibles = new CollectibleManager(this.scene, this.maze);
    this.fairy = new FairyCompanion(this.scene);
    
    // Timer
    this.transformTimer = mazeConfig.transformInterval;
    
    // Audio
    this.audio = new AudioManager();
    
    // Build world
    this.buildWorld();
    
    // Events
    window.addEventListener('resize', this.onResize.bind(this));
  }

  buildWorld(): void {
    this.world.buildAll();
    this.buildWallColliders();
    
    // Spawn entities
    this.enemyManager.spawnEnemies(8);
    this.collectibles.spawnMoonleaves(3);
    
    // Place exit
    const startCell = { x: 0, z: 0 };
    this.exitCell = this.maze.getFarCell(startCell);
    const exitPos = this.maze.cellToWorld(this.exitCell.x, this.exitCell.z);
    this.exitPortal = this.world.buildExitPortal(exitPos);
    
    // Set player start - ensure safe position
    const startPos = this.maze.cellToWorld(0, 0);
    this.player.position.set(startPos.x, this.player.playerHeight, startPos.z);
    this.camera.position.copy(this.player.position);
    
    // Verify player isn't in a wall
    if (this.player.checkCollision(this.player.position)) {
      this.player.position.x += 1;
      this.player.position.z += 1;
    }
  }

  buildWallColliders(): void {
    this.wallColliders = [];
    const segments = this.maze.getWallSegments();
    
    for (const seg of segments) {
      const center = new THREE.Vector3().addVectors(seg.start, seg.end).multiplyScalar(0.5);
      const length = seg.start.distanceTo(seg.end);
      
      let box: THREE.Box3;
      if (seg.direction === 'ns') {
        box = new THREE.Box3(
          new THREE.Vector3(center.x - 0.8, 0, center.z - length / 2),
          new THREE.Vector3(center.x + 0.8, this.maze.config.wallHeight, center.z + length / 2)
        );
      } else {
        box = new THREE.Box3(
          new THREE.Vector3(center.x - length / 2, 0, center.z - 0.8),
          new THREE.Vector3(center.x + length / 2, this.maze.config.wallHeight, center.z + 0.8)
        );
      }
      this.wallColliders.push(box);
    }
    
    this.player.setWallColliders(this.wallColliders);
  }

  start(): void {
    this.isRunning = true;
    this.clock.start();
    this.audio.init();
    this.animate();
  }

  stop(): void {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }

  animate(): void {
    if (!this.isRunning) return;
    this.animationId = requestAnimationFrame(this.animate.bind(this));
    
    const delta = Math.min(this.clock.getDelta(), 0.1);
    const time = this.clock.getElapsedTime();
    
    this.update(delta, time);
    this.render();
    this.emitState();
  }

  update(delta: number, time: number): void {
    if (this.player.isDead()) return;
    
    // Player
    this.player.update(delta);
    
    // Combat
    const hitbox = this.player.getAttackHitbox();
    if (hitbox && this.player.isAttacking) {
      const enemy = this.enemyManager.getClosestEnemy(hitbox);
      if (enemy) {
        this.enemyManager.damageEnemy(enemy, 25);
        this.audio.playHitSound();
        if (enemy.state === 'dead') {
          this.fairy.triggerDialogue("Неплохо! Для наёмника.", 3);
        }
      }
    }
    
    // Enemies
    this.enemyManager.update(delta, this.player);
    
    // Collectibles
    this.collectibles.update(time);
    const nearLeaf = this.collectibles.checkCollection(this.player.position);
    
    // Interaction check
    let prompt = '';
    if (nearLeaf && !nearLeaf.collected) {
      prompt = '[E] Собрать Лунный Лист';
    }
    
    // Check exit proximity
    if (this.exitPortal) {
      const exitWorldPos = this.maze.cellToWorld(this.exitCell.x, this.exitCell.z);
      const distToExit = this.player.position.distanceTo(exitWorldPos);
      if (distToExit < 3 && this.collectibles.isComplete()) {
        prompt = '[E] Войти в портал';
      } else if (distToExit < 3 && !this.collectibles.isComplete()) {
        prompt = `Портал закрыт. Собрано: ${this.collectibles.collected}/${this.collectibles.totalRequired}`;
      }
    }
    
    // Fairy
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    this.fairy.update(delta, this.player.position, forward);
    
    // Transform timer
    this.transformTimer -= delta;
    this.transformWarning = this.transformTimer <= 10 && this.transformTimer > 0;
    
    if (this.transformTimer <= 0 && !this.isTransforming) {
      this.startTransformation();
    }
    
    if (this.isTransforming) {
      this.updateTransformation(delta);
    }
    
    // Clouds
    this.world.updateClouds(time);
    
    // Exit portal animation
    if (this.exitPortal) {
      this.exitPortal.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
          if (child.material.emissiveIntensity > 0) {
            child.material.emissiveIntensity = 0.5 + Math.sin(time * 3) * 0.3;
          }
        }
      });
    }
    
    // Store prompt for HUD
    (this as any)._interactionPrompt = prompt;
    (this as any)._nearLeaf = nearLeaf;
  }

  handleInteraction(): void {
    const nearLeaf = (this as any)._nearLeaf as any;
    if (nearLeaf && !nearLeaf.collected) {
      this.collectibles.collect(nearLeaf);
      this.audio.playCollectSound();
      this.fairy.triggerDialogue(
        this.collectibles.isComplete() 
          ? "Все листья собраны! Беги к порталу!" 
          : `Есть! Осталось: ${this.collectibles.totalRequired - this.collectibles.collected}`,
        4
      );
    }
    
    // Check exit
    if (this.exitPortal && this.collectibles.isComplete()) {
      const exitWorldPos = this.maze.cellToWorld(this.exitCell.x, this.exitCell.z);
      const distToExit = this.player.position.distanceTo(exitWorldPos);
      if (distToExit < 3) {
        this.winGame();
      }
    }
  }

  startTransformation(): void {
    this.isTransforming = true;
    this.transformProgress = 0;
    this.fairy.triggerDialogue("О нет... Лабиринт опять двигается!", 4);
    this.audio.playTransformRumble();
  }

  updateTransformation(delta: number): void {
    this.transformProgress += delta;
    
    // Shake effect during transformation
    if (this.transformProgress < 4) {
      const shake = Math.sin(this.transformProgress * 20) * 0.02 * (1 - this.transformProgress / 4);
      this.camera.position.x += shake;
      this.camera.position.z += shake * 0.7;
    }
    
    if (this.transformProgress >= 4) {
      this.completeTransformation();
    }
  }

  completeTransformation(): void {
    this.isTransforming = false;
    this.transformProgress = 0;
    this.transformTimer = this.maze.config.transformInterval;
    
    // Get current player cell
    const playerCell = this.maze.worldToCell(this.player.position.x, this.player.position.z);
    
    // Generate new maze
    this.maze.generate();
    
    // Ensure connectivity
    this.maze.ensureConnectivity(playerCell, this.exitCell);
    
    // Rebuild world
    this.world.dispose();
    this.world.maze = this.maze;
    this.world.buildAll();
    this.buildWallColliders();
    
    // Reposition exit
    this.exitCell = this.maze.getFarCell(playerCell);
    const exitPos = this.maze.cellToWorld(this.exitCell.x, this.exitCell.z);
    if (this.exitPortal) {
      this.scene.remove(this.exitPortal);
    }
    this.exitPortal = this.world.buildExitPortal(exitPos);
    
    // Reposition enemies safely
    this.enemyManager.clear();
    this.enemyManager.maze = this.maze;
    this.enemyManager.spawnEnemies(8);
    
    // Reposition moonleaves (keep collected ones)
    const remaining = this.collectibles.totalRequired - this.collectibles.collected;
    this.collectibles.clear();
    this.collectibles.maze = this.maze;
    if (remaining > 0) {
      this.collectibles.spawnMoonleaves(remaining);
    }
    
    // Ensure player isn't inside a wall
    const testPos = this.player.position.clone();
    if (this.player.checkCollision(testPos)) {
      const safePos = this.maze.cellToWorld(playerCell.x, playerCell.z);
      this.player.position.set(safePos.x, this.player.playerHeight, safePos.z);
    }
  }

  winGame(): void {
    this.fairy.triggerDialogue("Ну надо же... Ты выжил. Я в шоке.", 8);
    (this as any)._gameWon = true;
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  emitState(): void {
    if (this.onStateChange) {
      this.onStateChange({
        health: this.player.health,
        maxHealth: this.player.maxHealth,
        moonleavesCollected: this.collectibles.collected,
        moonleavesRequired: this.collectibles.totalRequired,
        transformTimer: Math.max(0, Math.ceil(this.transformTimer)),
        transformInterval: this.maze.config.transformInterval,
        isTransforming: this.isTransforming,
        transformWarning: this.transformWarning,
        fairyDialogue: this.fairy.getDialogue(),
        interactionPrompt: (this as any)._interactionPrompt || '',
        gameWon: (this as any)._gameWon || false,
        gameLost: this.player.isDead(),
        isLocked: this.player.isLocked,
      });
    }
  }

  dispose(): void {
    this.stop();
    this.renderer.dispose();
    window.removeEventListener('resize', this.onResize.bind(this));
  }
}
