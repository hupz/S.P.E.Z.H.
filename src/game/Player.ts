import * as THREE from 'three';

export class PlayerController {
  camera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  
  // Movement
  velocity: THREE.Vector3 = new THREE.Vector3();
  direction: THREE.Vector3 = new THREE.Vector3();
  position: THREE.Vector3;
  
  // Camera rotation
  euler: THREE.Euler = new THREE.Euler(0, 0, 0, 'YXZ');
  
  // State
  isLocked: boolean = false;
  moveForward: boolean = false;
  moveBackward: boolean = false;
  moveLeft: boolean = false;
  moveRight: boolean = false;
  isSprinting: boolean = false;
  isCrouching: boolean = false;
  isJumping: boolean = false;
  verticalVelocity: number = 0;
  
  // Settings
  walkSpeed: number = 8;
  sprintSpeed: number = 14;
  crouchSpeed: number = 4;
  jumpForce: number = 8;
  gravity: number = 20;
  mouseSensitivity: number = 0.002;
  playerHeight: number = 1.7;
  crouchHeight: number = 1.0;
  playerRadius: number = 0.4;
  headBob: number = 0;
  headBobSpeed: number = 0;
  
  // Collision
  wallColliders: THREE.Box3[] = [];
  
  // Weapon
  weaponGroup: THREE.Group;
  weaponSwing: number = 0;
  isAttacking: boolean = false;
  attackCooldown: number = 0;
  
  // Health
  health: number = 100;
  maxHealth: number = 100;

  constructor(camera: THREE.PerspectiveCamera, scene: THREE.Scene) {
    this.camera = camera;
    this.scene = scene;
    this.position = new THREE.Vector3(2, this.playerHeight, 2);
    this.camera.position.copy(this.position);
    
    this.weaponGroup = new THREE.Group();
    this.camera.add(this.weaponGroup);
    this.scene.add(this.camera);
    
    this.buildWeapon();
    this.setupControls();
  }

  buildWeapon(): void {
    // Worn dagger/short sword
    const weaponGroup = new THREE.Group();
    
    // Blade
    const bladeGeo = new THREE.BoxGeometry(0.04, 0.5, 0.01);
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0x8a8a8a,
      metalness: 0.8,
      roughness: 0.3,
      flatShading: true,
    });
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.y = 0.25;
    weaponGroup.add(blade);
    
    // Blade tip
    const tipGeo = new THREE.ConeGeometry(0.025, 0.1, 3);
    const tip = new THREE.Mesh(tipGeo, bladeMat);
    tip.position.y = 0.55;
    weaponGroup.add(tip);
    
    // Handle
    const handleGeo = new THREE.CylinderGeometry(0.025, 0.03, 0.15, 5);
    const handleMat = new THREE.MeshStandardMaterial({
      color: 0x4a2a10,
      roughness: 0.9,
      flatShading: true,
    });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.y = -0.05;
    weaponGroup.add(handle);
    
    // Guard
    const guardGeo = new THREE.BoxGeometry(0.12, 0.03, 0.04);
    const guardMat = new THREE.MeshStandardMaterial({
      color: 0x6a5a2a,
      metalness: 0.5,
      roughness: 0.5,
      flatShading: true,
    });
    const guard = new THREE.Mesh(guardGeo, guardMat);
    guard.position.y = 0.02;
    weaponGroup.add(guard);
    
    weaponGroup.position.set(0.3, -0.3, -0.5);
    weaponGroup.rotation.set(0, 0, -0.3);
    this.weaponGroup.add(weaponGroup);
  }

  setupControls(): void {
    document.addEventListener('mousemove', this.onMouseMove.bind(this));
    document.addEventListener('keydown', this.onKeyDown.bind(this));
    document.addEventListener('keyup', this.onKeyUp.bind(this));
    document.addEventListener('mousedown', this.onMouseDown.bind(this));
    document.addEventListener('mouseup', this.onMouseUp.bind(this));
    document.addEventListener('pointerlockchange', this.onPointerLockChange.bind(this));
  }

  requestLock(): void {
    document.body.requestPointerLock();
  }

  onMouseMove(event: MouseEvent): void {
    if (!this.isLocked) return;
    
    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;
    
    this.euler.setFromQuaternion(this.camera.quaternion);
    this.euler.y -= movementX * this.mouseSensitivity;
    this.euler.x -= movementY * this.mouseSensitivity;
    this.euler.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.euler.x));
    this.camera.quaternion.setFromEuler(this.euler);
  }

  onKeyDown(event: KeyboardEvent): void {
    switch (event.code) {
      case 'KeyW': this.moveForward = true; break;
      case 'KeyS': this.moveBackward = true; break;
      case 'KeyA': this.moveLeft = true; break;
      case 'KeyD': this.moveRight = true; break;
      case 'ShiftLeft': case 'ShiftRight': this.isSprinting = true; break;
      case 'ControlLeft': case 'ControlRight': this.isCrouching = true; break;
      case 'Space':
        if (!this.isJumping) {
          this.isJumping = true;
          this.verticalVelocity = this.jumpForce;
        }
        break;
    }
  }

  onKeyUp(event: KeyboardEvent): void {
    switch (event.code) {
      case 'KeyW': this.moveForward = false; break;
      case 'KeyS': this.moveBackward = false; break;
      case 'KeyA': this.moveLeft = false; break;
      case 'KeyD': this.moveRight = false; break;
      case 'ShiftLeft': case 'ShiftRight': this.isSprinting = false; break;
      case 'ControlLeft': case 'ControlRight': this.isCrouching = false; break;
    }
  }

  onMouseDown(event: MouseEvent): void {
    if (!this.isLocked) return;
    if (event.button === 0 && this.attackCooldown <= 0) {
      this.isAttacking = true;
      this.attackCooldown = 0.5;
      this.weaponSwing = 1.0;
    }
  }

  onMouseUp(_event: MouseEvent): void {
    // Could handle block with right click
  }

  onPointerLockChange(): void {
    this.isLocked = document.pointerLockElement === document.body;
  }

  setWallColliders(colliders: THREE.Box3[]): void {
    this.wallColliders = colliders;
  }

  update(delta: number): void {
    if (!this.isLocked) return;

    // Calculate movement direction
    const speed = this.isCrouching ? this.crouchSpeed : (this.isSprinting ? this.sprintSpeed : this.walkSpeed);
    
    this.direction.set(0, 0, 0);
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    forward.y = 0;
    forward.normalize();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    right.y = 0;
    right.normalize();

    if (this.moveForward) this.direction.add(forward);
    if (this.moveBackward) this.direction.sub(forward);
    if (this.moveRight) this.direction.add(right);
    if (this.moveLeft) this.direction.sub(right);
    
    if (this.direction.length() > 0) {
      this.direction.normalize();
    }

    // Apply movement with collision
    const moveVector = this.direction.multiplyScalar(speed * delta);
    
    // Try X movement
    const newPosX = this.position.clone();
    newPosX.x += moveVector.x;
    if (!this.checkCollision(newPosX)) {
      this.position.x = newPosX.x;
    }
    
    // Try Z movement
    const newPosZ = this.position.clone();
    newPosZ.z += moveVector.z;
    if (!this.checkCollision(newPosZ)) {
      this.position.z = newPosZ.z;
    }

    // Gravity and jumping
    this.verticalVelocity -= this.gravity * delta;
    this.position.y += this.verticalVelocity * delta;
    
    const targetHeight = this.isCrouching ? this.crouchHeight : this.playerHeight;
    if (this.position.y < targetHeight) {
      this.position.y = targetHeight;
      this.verticalVelocity = 0;
      this.isJumping = false;
    }

    // Head bob
    if (this.direction.length() > 0 && !this.isJumping) {
      this.headBobSpeed += delta * (this.isSprinting ? 12 : 8);
      this.headBob = Math.sin(this.headBobSpeed) * (this.isSprinting ? 0.06 : 0.03);
    } else {
      this.headBob *= 0.9;
    }

    // Update camera
    this.camera.position.set(
      this.position.x,
      this.position.y + this.headBob,
      this.position.z
    );

    // Weapon animation
    if (this.weaponSwing > 0) {
      this.weaponSwing -= delta * 4;
      if (this.weaponSwing < 0) this.weaponSwing = 0;
    }
    const weaponChild = this.weaponGroup.children[0];
    if (weaponChild) {
      const swingAngle = Math.sin(this.weaponSwing * Math.PI) * 1.2;
      weaponChild.rotation.x = -swingAngle;
      weaponChild.position.z = -0.5 + Math.sin(this.weaponSwing * Math.PI) * 0.2;
      // Idle sway
      weaponChild.position.y = -0.3 + Math.sin(Date.now() * 0.002) * 0.01;
      weaponChild.position.x = 0.3 + Math.cos(Date.now() * 0.0015) * 0.005;
    }

    // Attack cooldown
    if (this.attackCooldown > 0) {
      this.attackCooldown -= delta;
    } else {
      this.isAttacking = false;
    }
  }

  checkCollision(pos: THREE.Vector3): boolean {
    const playerBox = new THREE.Box3(
      new THREE.Vector3(pos.x - this.playerRadius, pos.y - this.playerHeight, pos.z - this.playerRadius),
      new THREE.Vector3(pos.x + this.playerRadius, pos.y + 0.2, pos.z + this.playerRadius)
    );

    for (const collider of this.wallColliders) {
      if (playerBox.intersectsBox(collider)) {
        return true;
      }
    }
    return false;
  }

  getAttackHitbox(): THREE.Sphere | null {
    if (!this.isAttacking || this.weaponSwing < 0.3) return null;
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const hitPos = this.position.clone().add(forward.multiplyScalar(2));
    return new THREE.Sphere(hitPos, 1.5);
  }

  takeDamage(amount: number): void {
    this.health = Math.max(0, this.health - amount);
  }

  heal(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  isDead(): boolean {
    return this.health <= 0;
  }
}
