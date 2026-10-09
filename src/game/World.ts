import * as THREE from 'three';
import { MazeGenerator } from './Maze';

// Color palette
const COLORS = {
  barkDark: 0x3d2817,
  barkMid: 0x5c3a1e,
  barkLight: 0x7a4f2e,
  leafDark: 0x1a4a2a,
  leafMid: 0x2d6b3f,
  leafLight: 0x4a8c5c,
  moss: 0x3a5f2a,
  ground: 0x2a1f14,
  groundLight: 0x3d2e1f,
  rootDark: 0x4a3020,
  vine: 0x2a5a2a,
  mushroom: 0x8b6914,
  mushroomGlow: 0x40e0d0,
  sky: 0x87ceeb,
  sunLight: 0xffe4b5,
  fog: 0x1a3a2a,
  magical: 0x00ffcc,
  magicalBlue: 0x40e0d0,
};

export class WorldBuilder {
  scene: THREE.Scene;
  maze: MazeGenerator;
  wallGroup: THREE.Group;
  decorGroup: THREE.Group;
  groundMesh: THREE.Mesh | null = null;
  skyDome: THREE.Mesh | null = null;

  constructor(scene: THREE.Scene, maze: MazeGenerator) {
    this.scene = scene;
    this.maze = maze;
    this.wallGroup = new THREE.Group();
    this.wallGroup.name = 'walls';
    this.decorGroup = new THREE.Group();
    this.decorGroup.name = 'decorations';
    scene.add(this.wallGroup);
    scene.add(this.decorGroup);
  }

  buildAll(): void {
    this.buildSky();
    this.buildGround();
    this.buildWalls();
    this.buildDecorations();
    this.setupLighting();
    this.setupFog();
  }

  buildSky(): void {
    // Sky dome
    const skyGeo = new THREE.SphereGeometry(500, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x4a90d9) },
        bottomColor: { value: new THREE.Color(0x87ceeb) },
        horizonColor: { value: new THREE.Color(0xc8e6c9) },
        offset: { value: 10 },
        exponent: { value: 0.6 },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform vec3 horizonColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          float t = max(pow(max(h, 0.0), exponent), 0.0);
          vec3 color = mix(horizonColor, bottomColor, clamp(t * 2.0, 0.0, 1.0));
          color = mix(color, topColor, clamp((t - 0.5) * 2.0, 0.0, 1.0));
          gl_FragColor = vec4(color, 1.0);
        }
      `,
      side: THREE.BackSide,
    });
    this.skyDome = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.skyDome);

    // Clouds - flat polygons
    for (let i = 0; i < 15; i++) {
      const cloudGroup = new THREE.Group();
      const numParts = 3 + Math.floor(Math.random() * 4);
      for (let j = 0; j < numParts; j++) {
        const size = 10 + Math.random() * 20;
        const cloudGeo = new THREE.DodecahedronGeometry(size, 0);
        cloudGeo.scale(2, 0.3, 1);
        const cloudMat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.6 + Math.random() * 0.3,
        });
        const cloud = new THREE.Mesh(cloudGeo, cloudMat);
        cloud.position.set(
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 3,
          (Math.random() - 0.5) * 10
        );
        cloudGroup.add(cloud);
      }
      const angle = Math.random() * Math.PI * 2;
      const radius = 150 + Math.random() * 200;
      cloudGroup.position.set(
        Math.cos(angle) * radius,
        80 + Math.random() * 60,
        Math.sin(angle) * radius
      );
      cloudGroup.userData.speed = 0.02 + Math.random() * 0.03;
      cloudGroup.userData.angle = angle;
      cloudGroup.userData.radius = radius;
      cloudGroup.name = 'cloud';
      this.scene.add(cloudGroup);
    }
  }

  buildGround(): void {
    const totalWidth = this.maze.config.width * this.maze.cellSize + this.maze.cellSize;
    const totalHeight = this.maze.config.height * this.maze.cellSize + this.maze.cellSize;

    // Main ground
    const groundGeo = new THREE.PlaneGeometry(totalWidth * 1.5, totalHeight * 1.5, 20, 20);
    // Add some vertex displacement for uneven terrain
    const pos = groundGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      pos.setZ(i, (Math.sin(x * 0.5) * Math.cos(y * 0.3) * 0.3 + Math.random() * 0.1));
    }
    groundGeo.computeVertexNormals();

    const groundMat = new THREE.MeshStandardMaterial({
      color: COLORS.ground,
      roughness: 0.95,
      metalness: 0.0,
      flatShading: true,
    });
    this.groundMesh = new THREE.Mesh(groundGeo, groundMat);
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.groundMesh.position.set(totalWidth / 2 - this.maze.cellSize / 2, 0, totalHeight / 2 - this.maze.cellSize / 2);
    this.groundMesh.receiveShadow = true;
    this.scene.add(this.groundMesh);

    // Path stones
    for (let i = 0; i < 80; i++) {
      const cellX = Math.floor(Math.random() * this.maze.config.width);
      const cellZ = Math.floor(Math.random() * this.maze.config.height);
      const worldPos = this.maze.cellToWorld(cellX, cellZ);
      const stoneGeo = new THREE.DodecahedronGeometry(0.2 + Math.random() * 0.4, 0);
      stoneGeo.scale(1, 0.4, 1);
      const stoneMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0x4a4a3a).lerp(new THREE.Color(0x6a6a5a), Math.random()),
        roughness: 0.9,
        flatShading: true,
      });
      const stone = new THREE.Mesh(stoneGeo, stoneMat);
      stone.position.set(
        worldPos.x + (Math.random() - 0.5) * this.maze.config.corridorWidth,
        0.05,
        worldPos.z + (Math.random() - 0.5) * this.maze.config.corridorWidth
      );
      stone.rotation.y = Math.random() * Math.PI;
      stone.castShadow = true;
      this.decorGroup.add(stone);
    }

    // Exposed roots crossing pathways
    for (let i = 0; i < 30; i++) {
      const cellX = Math.floor(Math.random() * this.maze.config.width);
      const cellZ = Math.floor(Math.random() * this.maze.config.height);
      const worldPos = this.maze.cellToWorld(cellX, cellZ);
      this.buildGroundRoot(
        new THREE.Vector3(
          worldPos.x + (Math.random() - 0.5) * this.maze.config.corridorWidth * 0.5,
          0,
          worldPos.z + (Math.random() - 0.5) * this.maze.config.corridorWidth * 0.5
        )
      );
    }

    // Moss patches on ground
    for (let i = 0; i < 40; i++) {
      const cellX = Math.floor(Math.random() * this.maze.config.width);
      const cellZ = Math.floor(Math.random() * this.maze.config.height);
      const worldPos = this.maze.cellToWorld(cellX, cellZ);
      const mossGeo = new THREE.CircleGeometry(0.3 + Math.random() * 0.5, 5);
      const mossMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(COLORS.moss).lerp(new THREE.Color(COLORS.leafDark), Math.random()),
        roughness: 1.0,
        flatShading: true,
      });
      const moss = new THREE.Mesh(mossGeo, mossMat);
      moss.rotation.x = -Math.PI / 2;
      moss.position.set(
        worldPos.x + (Math.random() - 0.5) * this.maze.config.corridorWidth,
        0.01,
        worldPos.z + (Math.random() - 0.5) * this.maze.config.corridorWidth
      );
      this.decorGroup.add(moss);
    }
  }

  buildGroundRoot(pos: THREE.Vector3): void {
    const length = 1 + Math.random() * 2;
    const rootGeo = new THREE.CylinderGeometry(0.04, 0.08, length, 4, 2);
    rootGeo.rotateZ(Math.PI / 2);
    
    // Add waviness
    const rootPos = rootGeo.attributes.position;
    for (let i = 0; i < rootPos.count; i++) {
      const x = rootPos.getX(i);
      rootPos.setY(i, rootPos.getY(i) + Math.sin(x * 3) * 0.05 + 0.05);
    }
    rootGeo.computeVertexNormals();
    
    const rootMat = new THREE.MeshStandardMaterial({
      color: COLORS.rootDark,
      roughness: 0.9,
      flatShading: true,
    });
    const root = new THREE.Mesh(rootGeo, rootMat);
    root.position.set(pos.x, 0.05, pos.z);
    root.rotation.y = Math.random() * Math.PI;
    root.castShadow = true;
    this.decorGroup.add(root);
  }

  buildWalls(): void {
    this.wallGroup.clear();
    const segments = this.maze.getWallSegments();

    for (const seg of segments) {
      this.buildTreeWallSegment(seg);
    }
  }

  buildTreeWallSegment(seg: { start: THREE.Vector3; end: THREE.Vector3; direction: 'ns' | 'ew' }): void {
    const length = seg.start.distanceTo(seg.end);
    const numTrees = Math.max(2, Math.floor(length / 1.5));
    const midPoint = new THREE.Vector3().addVectors(seg.start, seg.end).multiplyScalar(0.5);

    for (let i = 0; i < numTrees; i++) {
      const t = (i + 0.5) / numTrees;
      const pos = new THREE.Vector3().lerpVectors(seg.start, seg.end, t);
      pos.x += (Math.random() - 0.5) * 0.5;
      pos.z += (Math.random() - 0.5) * 0.5;

      this.buildTreeTrunk(pos, 0.4 + Math.random() * 0.4, this.maze.config.wallHeight + Math.random() * 4);
    }

    // Roots connecting trees
    for (let i = 0; i < numTrees - 1; i++) {
      const t1 = (i + 0.5) / numTrees;
      const t2 = (i + 1.5) / numTrees;
      const p1 = new THREE.Vector3().lerpVectors(seg.start, seg.end, t1);
      const p2 = new THREE.Vector3().lerpVectors(seg.start, seg.end, t2);
      this.buildRoot(p1, p2);
    }

    // Fill gaps with bushes
    for (let i = 0; i < numTrees + 2; i++) {
      const t = Math.random();
      const pos = new THREE.Vector3().lerpVectors(seg.start, seg.end, t);
      pos.x += (Math.random() - 0.5) * 0.8;
      pos.z += (Math.random() - 0.5) * 0.8;
      this.buildBush(pos);
    }

    // Vines hanging from top
    for (let i = 0; i < Math.floor(numTrees / 2); i++) {
      const t = Math.random();
      const pos = new THREE.Vector3().lerpVectors(seg.start, seg.end, t);
      this.buildVine(pos, 2 + Math.random() * 4);
    }
  }

  buildTreeTrunk(pos: THREE.Vector3, radius: number, height: number): void {
    // Main trunk - tapered cylinder with low poly
    const trunkGeo = new THREE.CylinderGeometry(radius * 0.6, radius, height, 6, 3);
    // Add some irregularity
    const trunkPos = trunkGeo.attributes.position;
    for (let i = 0; i < trunkPos.count; i++) {
      const y = trunkPos.getY(i);
      const noise = Math.sin(y * 2) * 0.1 + Math.cos(y * 3.7) * 0.05;
      trunkPos.setX(i, trunkPos.getX(i) + noise);
      trunkPos.setZ(i, trunkPos.getZ(i) + noise * 0.7);
    }
    trunkGeo.computeVertexNormals();

    const barkColor = new THREE.Color(COLORS.barkDark).lerp(new THREE.Color(COLORS.barkLight), Math.random() * 0.5);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: barkColor,
      roughness: 0.9,
      metalness: 0.0,
      flatShading: true,
    });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(pos.x, height / 2, pos.z);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    this.wallGroup.add(trunk);

    // Branches at top
    const numBranches = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numBranches; i++) {
      const branchHeight = height * (0.5 + Math.random() * 0.5);
      const angle = Math.random() * Math.PI * 2;
      const branchLen = 1.5 + Math.random() * 2;
      this.buildBranch(
        new THREE.Vector3(pos.x, branchHeight, pos.z),
        angle,
        branchLen,
        radius * 0.3
      );
    }

    // Canopy foliage - smaller and more sparse to allow sky visibility
    if (Math.random() > 0.3) { // 70% chance of canopy
      const canopyGeo = new THREE.DodecahedronGeometry(radius * 2 + Math.random() * 1.5, 1);
      canopyGeo.scale(1.2, 0.6, 1.2);
      const leafColor = new THREE.Color(COLORS.leafDark).lerp(new THREE.Color(COLORS.leafLight), Math.random());
      const canopyMat = new THREE.MeshStandardMaterial({
        color: leafColor,
        roughness: 0.8,
        flatShading: true,
        transparent: true,
        opacity: 0.85,
      });
      const canopy = new THREE.Mesh(canopyGeo, canopyMat);
      canopy.position.set(pos.x + (Math.random() - 0.5) * 1, height * 0.9, pos.z + (Math.random() - 0.5) * 1);
      canopy.castShadow = true;
      this.wallGroup.add(canopy);
    }

    // Moss patches on trunk
    if (Math.random() > 0.5) {
      const mossGeo = new THREE.DodecahedronGeometry(radius * 0.8, 0);
      mossGeo.scale(1, 0.5, 0.5);
      const mossMat = new THREE.MeshStandardMaterial({
        color: COLORS.moss,
        roughness: 1.0,
        flatShading: true,
      });
      const moss = new THREE.Mesh(mossGeo, mossMat);
      const mossAngle = Math.random() * Math.PI * 2;
      moss.position.set(
        pos.x + Math.cos(mossAngle) * radius,
        0.5 + Math.random() * 2,
        pos.z + Math.sin(mossAngle) * radius
      );
      this.wallGroup.add(moss);
    }
  }

  buildBranch(start: THREE.Vector3, angle: number, length: number, radius: number): void {
    const branchGeo = new THREE.CylinderGeometry(radius * 0.3, radius, length, 4, 1);
    branchGeo.rotateZ(Math.PI / 4 + Math.random() * 0.3);
    branchGeo.rotateY(angle);
    const branchMat = new THREE.MeshStandardMaterial({
      color: COLORS.barkMid,
      roughness: 0.9,
      flatShading: true,
    });
    const branch = new THREE.Mesh(branchGeo, branchMat);
    branch.position.copy(start);
    branch.castShadow = true;
    this.wallGroup.add(branch);
  }

  buildRoot(start: THREE.Vector3, end: THREE.Vector3): void {
    const dir = new THREE.Vector3().subVectors(end, start);
    const length = dir.length();
    const rootGeo = new THREE.CylinderGeometry(0.08, 0.15, length, 4, 2);

    // Orient root along direction
    const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    rootGeo.rotateZ(Math.PI / 2);
    rootGeo.lookAt(dir.normalize());

    const rootMat = new THREE.MeshStandardMaterial({
      color: COLORS.rootDark,
      roughness: 0.9,
      flatShading: true,
    });
    const root = new THREE.Mesh(rootGeo, rootMat);
    root.position.set(midPoint.x, 0.15, midPoint.z);
    root.castShadow = true;
    this.wallGroup.add(root);
  }

  buildBush(pos: THREE.Vector3): void {
    const size = 0.5 + Math.random() * 0.8;
    const bushGeo = new THREE.DodecahedronGeometry(size, 0);
    bushGeo.scale(1, 0.7, 1);
    const leafColor = new THREE.Color(COLORS.leafDark).lerp(new THREE.Color(COLORS.leafMid), Math.random());
    const bushMat = new THREE.MeshStandardMaterial({
      color: leafColor,
      roughness: 0.85,
      flatShading: true,
    });
    const bush = new THREE.Mesh(bushGeo, bushMat);
    bush.position.set(pos.x, size * 0.4, pos.z);
    bush.castShadow = true;
    this.wallGroup.add(bush);
  }

  buildVine(pos: THREE.Vector3, length: number): void {
    const vineGeo = new THREE.CylinderGeometry(0.03, 0.05, length, 3, 3);
    // Add waviness
    const vinePos = vineGeo.attributes.position;
    for (let i = 0; i < vinePos.count; i++) {
      const y = vinePos.getY(i);
      vinePos.setX(i, vinePos.getX(i) + Math.sin(y * 3) * 0.1);
    }
    vineGeo.computeVertexNormals();

    const vineMat = new THREE.MeshStandardMaterial({
      color: COLORS.vine,
      roughness: 0.8,
      flatShading: true,
    });
    const vine = new THREE.Mesh(vineGeo, vineMat);
    vine.position.set(pos.x, this.maze.config.wallHeight - length / 2, pos.z);
    this.wallGroup.add(vine);
  }

  buildDecorations(): void {
    this.decorGroup.clear();
    const totalCells = this.maze.config.width * this.maze.config.height;

    // Mushrooms
    for (let i = 0; i < totalCells * 0.5; i++) {
      const cellX = Math.floor(Math.random() * this.maze.config.width);
      const cellZ = Math.floor(Math.random() * this.maze.config.height);
      const worldPos = this.maze.cellToWorld(cellX, cellZ);
      this.buildMushroom(
        new THREE.Vector3(
          worldPos.x + (Math.random() - 0.5) * this.maze.config.corridorWidth,
          0,
          worldPos.z + (Math.random() - 0.5) * this.maze.config.corridorWidth
        )
      );
    }

    // Small plants
    for (let i = 0; i < totalCells * 0.8; i++) {
      const cellX = Math.floor(Math.random() * this.maze.config.width);
      const cellZ = Math.floor(Math.random() * this.maze.config.height);
      const worldPos = this.maze.cellToWorld(cellX, cellZ);
      this.buildSmallPlant(
        new THREE.Vector3(
          worldPos.x + (Math.random() - 0.5) * this.maze.config.corridorWidth,
          0,
          worldPos.z + (Math.random() - 0.5) * this.maze.config.corridorWidth
        )
      );
    }

    // Fallen branches on ground
    for (let i = 0; i < totalCells * 0.3; i++) {
      const cellX = Math.floor(Math.random() * this.maze.config.width);
      const cellZ = Math.floor(Math.random() * this.maze.config.height);
      const worldPos = this.maze.cellToWorld(cellX, cellZ);
      this.buildFallenBranch(
        new THREE.Vector3(
          worldPos.x + (Math.random() - 0.5) * this.maze.config.corridorWidth,
          0,
          worldPos.z + (Math.random() - 0.5) * this.maze.config.corridorWidth
        )
      );
    }

    // Grass tufts
    for (let i = 0; i < totalCells * 1.5; i++) {
      const cellX = Math.floor(Math.random() * this.maze.config.width);
      const cellZ = Math.floor(Math.random() * this.maze.config.height);
      const worldPos = this.maze.cellToWorld(cellX, cellZ);
      this.buildGrassTuft(
        new THREE.Vector3(
          worldPos.x + (Math.random() - 0.5) * this.maze.config.corridorWidth * 1.5,
          0,
          worldPos.z + (Math.random() - 0.5) * this.maze.config.corridorWidth * 1.5
        )
      );
    }

    // Magical particles (floating lights)
    for (let i = 0; i < 20; i++) {
      const cellX = Math.floor(Math.random() * this.maze.config.width);
      const cellZ = Math.floor(Math.random() * this.maze.config.height);
      const worldPos = this.maze.cellToWorld(cellX, cellZ);
      this.buildFloatingParticle(
        new THREE.Vector3(
          worldPos.x + (Math.random() - 0.5) * this.maze.config.corridorWidth,
          1 + Math.random() * 3,
          worldPos.z + (Math.random() - 0.5) * this.maze.config.corridorWidth
        )
      );
    }
  }

  buildGrassTuft(pos: THREE.Vector3): void {
    const group = new THREE.Group();
    const numBlades = 3 + Math.floor(Math.random() * 3);
    
    for (let i = 0; i < numBlades; i++) {
      const bladeGeo = new THREE.ConeGeometry(0.02, 0.15 + Math.random() * 0.15, 3);
      const grassColor = new THREE.Color(COLORS.leafDark).lerp(new THREE.Color(COLORS.moss), Math.random());
      const bladeMat = new THREE.MeshStandardMaterial({
        color: grassColor,
        roughness: 0.9,
        flatShading: true,
      });
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.position.set(
        (Math.random() - 0.5) * 0.1,
        0.07,
        (Math.random() - 0.5) * 0.1
      );
      blade.rotation.z = (Math.random() - 0.5) * 0.4;
      blade.rotation.x = (Math.random() - 0.5) * 0.3;
      group.add(blade);
    }
    
    group.position.copy(pos);
    this.decorGroup.add(group);
  }

  buildFloatingParticle(pos: THREE.Vector3): void {
    const particleGeo = new THREE.SphereGeometry(0.04, 4, 3);
    const isCyan = Math.random() > 0.5;
    const particleMat = new THREE.MeshBasicMaterial({
      color: isCyan ? 0x40e0d0 : 0xffd700,
      transparent: true,
      opacity: 0.6,
    });
    const particle = new THREE.Mesh(particleGeo, particleMat);
    particle.position.copy(pos);
    particle.name = 'floatingParticle';
    particle.userData.baseY = pos.y;
    particle.userData.speed = 0.5 + Math.random() * 1.5;
    particle.userData.offset = Math.random() * Math.PI * 2;
    this.decorGroup.add(particle);
  }

  buildMushroom(pos: THREE.Vector3): void {
    const group = new THREE.Group();
    const isGlowing = Math.random() > 0.7;

    // Stem
    const stemGeo = new THREE.CylinderGeometry(0.05, 0.08, 0.3, 4);
    const stemMat = new THREE.MeshStandardMaterial({
      color: 0xd4c5a0,
      roughness: 0.8,
      flatShading: true,
    });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.y = 0.15;
    group.add(stem);

    // Cap
    const capGeo = new THREE.ConeGeometry(0.15 + Math.random() * 0.1, 0.15, 5);
    capGeo.scale(1, -1, 1);
    const capColor = isGlowing ? COLORS.mushroomGlow : COLORS.mushroom;
    const capMat = new THREE.MeshStandardMaterial({
      color: capColor,
      roughness: 0.6,
      emissive: isGlowing ? capColor : 0x000000,
      emissiveIntensity: isGlowing ? 0.3 : 0,
      flatShading: true,
    });
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.y = 0.3;
    group.add(cap);

    group.position.copy(pos);
    group.scale.setScalar(0.8 + Math.random() * 0.6);
    this.decorGroup.add(group);
  }

  buildSmallPlant(pos: THREE.Vector3): void {
    const group = new THREE.Group();
    const numLeaves = 3 + Math.floor(Math.random() * 4);

    for (let i = 0; i < numLeaves; i++) {
      const leafGeo = new THREE.ConeGeometry(0.08, 0.3 + Math.random() * 0.2, 3);
      const leafColor = new THREE.Color(COLORS.leafDark).lerp(new THREE.Color(COLORS.leafLight), Math.random());
      const leafMat = new THREE.MeshStandardMaterial({
        color: leafColor,
        roughness: 0.8,
        flatShading: true,
      });
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      const angle = (i / numLeaves) * Math.PI * 2;
      leaf.position.set(Math.cos(angle) * 0.1, 0.15, Math.sin(angle) * 0.1);
      leaf.rotation.z = (Math.random() - 0.5) * 0.5;
      leaf.rotation.x = (Math.random() - 0.5) * 0.3;
      group.add(leaf);
    }

    group.position.copy(pos);
    this.decorGroup.add(group);
  }

  buildFallenBranch(pos: THREE.Vector3): void {
    const length = 0.5 + Math.random() * 1.5;
    const branchGeo = new THREE.CylinderGeometry(0.03, 0.06, length, 4);
    branchGeo.rotateZ(Math.PI / 2);
    const branchMat = new THREE.MeshStandardMaterial({
      color: COLORS.barkMid,
      roughness: 0.9,
      flatShading: true,
    });
    const branch = new THREE.Mesh(branchGeo, branchMat);
    branch.position.set(pos.x, 0.05, pos.z);
    branch.rotation.y = Math.random() * Math.PI;
    this.decorGroup.add(branch);
  }

  setupLighting(): void {
    // Ambient light
    const ambient = new THREE.AmbientLight(0x3a5a4a, 0.4);
    this.scene.add(ambient);

    // Hemisphere light for sky/ground color
    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x2a1f14, 0.3);
    this.scene.add(hemi);

    // Directional sunlight
    const sun = new THREE.DirectionalLight(COLORS.sunLight, 0.8);
    sun.position.set(50, 80, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 200;
    sun.shadow.camera.left = -60;
    sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 60;
    sun.shadow.camera.bottom = -60;
    this.scene.add(sun);

    // Magical accent lights
    const magicLight1 = new THREE.PointLight(COLORS.magical, 0.5, 20);
    magicLight1.position.set(10, 3, 10);
    this.scene.add(magicLight1);

    const magicLight2 = new THREE.PointLight(COLORS.magicalBlue, 0.3, 15);
    magicLight2.position.set(30, 2, 30);
    this.scene.add(magicLight2);
  }

  setupFog(): void {
    this.scene.fog = new THREE.FogExp2(0x1a3a2a, 0.008);
  }

  // Build exit portal
  buildExitPortal(pos: THREE.Vector3): THREE.Group {
    const portal = new THREE.Group();
    portal.name = 'exitPortal';

    // Root arch
    const archGeo = new THREE.TorusGeometry(2.5, 0.4, 6, 8, Math.PI);
    const archMat = new THREE.MeshStandardMaterial({
      color: COLORS.rootDark,
      roughness: 0.8,
      flatShading: true,
    });
    const arch = new THREE.Mesh(archGeo, archMat);
    arch.rotation.x = Math.PI;
    arch.position.y = 2.5;
    portal.add(arch);

    // Portal surface (glowing)
    const portalGeo = new THREE.CircleGeometry(2.2, 8);
    const portalMat = new THREE.MeshStandardMaterial({
      color: COLORS.magical,
      emissive: COLORS.magical,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      flatShading: true,
    });
    const portalSurface = new THREE.Mesh(portalGeo, portalMat);
    portalSurface.position.y = 2.5;
    portal.add(portalSurface);

    // Vine decorations
    for (let i = 0; i < 6; i++) {
      const vineGeo = new THREE.CylinderGeometry(0.05, 0.08, 2 + Math.random() * 2, 3);
      const vineMat = new THREE.MeshStandardMaterial({
        color: COLORS.vine,
        roughness: 0.8,
        flatShading: true,
      });
      const vine = new THREE.Mesh(vineGeo, vineMat);
      const angle = (i / 6) * Math.PI;
      vine.position.set(
        Math.cos(angle) * 2.5,
        2.5 + Math.sin(angle) * 2.5,
        (Math.random() - 0.5) * 0.5
      );
      vine.rotation.z = angle + Math.PI / 2;
      portal.add(vine);
    }

    // Light
    const portalLight = new THREE.PointLight(COLORS.magical, 1.5, 15);
    portalLight.position.y = 2.5;
    portal.add(portalLight);

    portal.position.copy(pos);
    this.scene.add(portal);
    return portal;
  }

  // Animate clouds and particles
  updateClouds(time: number): void {
    this.scene.traverse((obj) => {
      if (obj.name === 'cloud') {
        obj.userData.angle += obj.userData.speed * 0.01;
        obj.position.x = Math.cos(obj.userData.angle) * obj.userData.radius;
        obj.position.z = Math.sin(obj.userData.angle) * obj.userData.radius;
      }
      if (obj.name === 'floatingParticle') {
        obj.position.y = obj.userData.baseY + Math.sin(time * obj.userData.speed + obj.userData.offset) * 0.5;
        obj.position.x += Math.sin(time * 0.3 + obj.userData.offset) * 0.002;
        if (obj instanceof THREE.Mesh && obj.material instanceof THREE.MeshBasicMaterial) {
          obj.material.opacity = 0.3 + Math.sin(time * 2 + obj.userData.offset) * 0.3;
        }
      }
    });
  }

  dispose(): void {
    this.wallGroup.clear();
    this.decorGroup.clear();
  }
}
