import * as THREE from 'three';

export interface MazeCell {
  x: number;
  z: number;
  walls: { north: boolean; south: boolean; east: boolean; west: boolean };
  visited: boolean;
}

export interface MazeConfig {
  width: number;
  height: number;
  corridorWidth: number;
  wallHeight: number;
  transformInterval: number;
}

export const DEFAULT_MAZE_CONFIG: MazeConfig = {
  width: 12,
  height: 12,
  corridorWidth: 4,
  wallHeight: 8,
  transformInterval: 60,
};

export class MazeGenerator {
  config: MazeConfig;
  grid: MazeCell[][];
  cellSize: number;

  constructor(config: MazeConfig = DEFAULT_MAZE_CONFIG) {
    this.config = config;
    this.cellSize = config.corridorWidth * 2;
    this.grid = [];
    this.generate();
  }

  generate(): void {
    this.grid = [];
    for (let x = 0; x < this.config.width; x++) {
      this.grid[x] = [];
      for (let z = 0; z < this.config.height; z++) {
        this.grid[x][z] = {
          x, z,
          walls: { north: true, south: true, east: true, west: true },
          visited: false,
        };
      }
    }
    this.carveMaze(0, 0);
    this.removeExtraWalls(Math.floor(this.config.width * this.config.height * 0.15));
  }

  carveMaze(startX: number, startZ: number): void {
    const stack: [number, number][] = [[startX, startZ]];
    this.grid[startX][startZ].visited = true;

    while (stack.length > 0) {
      const [cx, cz] = stack[stack.length - 1];
      const neighbors = this.getUnvisitedNeighbors(cx, cz);

      if (neighbors.length === 0) {
        stack.pop();
      } else {
        const [nx, nz, dir] = neighbors[Math.floor(Math.random() * neighbors.length)];
        this.removeWall(cx, cz, dir);
        this.grid[nx][nz].visited = true;
        stack.push([nx, nz]);
      }
    }
  }

  removeExtraWalls(count: number): void {
    for (let i = 0; i < count; i++) {
      const x = Math.floor(Math.random() * this.config.width);
      const z = Math.floor(Math.random() * this.config.height);
      const dirs: ('north' | 'south' | 'east' | 'west')[] = [];
      if (z > 0) dirs.push('north');
      if (z < this.config.height - 1) dirs.push('south');
      if (x < this.config.width - 1) dirs.push('east');
      if (x > 0) dirs.push('west');
      if (dirs.length > 0) {
        const dir = dirs[Math.floor(Math.random() * dirs.length)];
        this.removeWall(x, z, dir);
      }
    }
  }

  getUnvisitedNeighbors(x: number, z: number): [number, number, 'north' | 'south' | 'east' | 'west'][] {
    const result: [number, number, 'north' | 'south' | 'east' | 'west'][] = [];
    if (z > 0 && !this.grid[x][z - 1].visited) result.push([x, z - 1, 'north']);
    if (z < this.config.height - 1 && !this.grid[x][z + 1].visited) result.push([x, z + 1, 'south']);
    if (x < this.config.width - 1 && !this.grid[x + 1][z].visited) result.push([x + 1, z, 'east']);
    if (x > 0 && !this.grid[x - 1][z].visited) result.push([x - 1, z, 'west']);
    return result;
  }

  removeWall(x: number, z: number, dir: 'north' | 'south' | 'east' | 'west'): void {
    this.grid[x][z].walls[dir] = false;
    switch (dir) {
      case 'north': if (z > 0) this.grid[x][z - 1].walls.south = false; break;
      case 'south': if (z < this.config.height - 1) this.grid[x][z + 1].walls.north = false; break;
      case 'east': if (x < this.config.width - 1) this.grid[x + 1][z].walls.west = false; break;
      case 'west': if (x > 0) this.grid[x - 1][z].walls.east = false; break;
    }
  }

  cellToWorld(cx: number, cz: number): THREE.Vector3 {
    return new THREE.Vector3(
      cx * this.cellSize,
      0,
      cz * this.cellSize
    );
  }

  worldToCell(wx: number, wz: number): { x: number; z: number } {
    return {
      x: Math.max(0, Math.min(this.config.width - 1, Math.floor(wx / this.cellSize))),
      z: Math.max(0, Math.min(this.config.height - 1, Math.floor(wz / this.cellSize))),
    };
  }

  getWallSegments(): { start: THREE.Vector3; end: THREE.Vector3; direction: 'ns' | 'ew' }[] {
    const segments: { start: THREE.Vector3; end: THREE.Vector3; direction: 'ns' | 'ew' }[] = [];
    const hw = this.cellSize / 2;

    for (let x = 0; x < this.config.width; x++) {
      for (let z = 0; z < this.config.height; z++) {
        const cell = this.grid[x][z];
        const cx = x * this.cellSize;
        const cz = z * this.cellSize;

        if (cell.walls.east && x < this.config.width - 1) {
          segments.push({
            start: new THREE.Vector3(cx + hw, 0, cz - hw),
            end: new THREE.Vector3(cx + hw, 0, cz + hw),
            direction: 'ns',
          });
        }
        if (cell.walls.south && z < this.config.height - 1) {
          segments.push({
            start: new THREE.Vector3(cx - hw, 0, cz + hw),
            end: new THREE.Vector3(cx + hw, 0, cz + hw),
            direction: 'ew',
          });
        }
      }
    }

    // Border walls
    for (let x = 0; x < this.config.width; x++) {
      const cx = x * this.cellSize;
      // North border
      segments.push({
        start: new THREE.Vector3(cx - hw, 0, -hw),
        end: new THREE.Vector3(cx + hw, 0, -hw),
        direction: 'ew',
      });
      // South border
      const southZ = (this.config.height - 1) * this.cellSize + hw;
      segments.push({
        start: new THREE.Vector3(cx - hw, 0, southZ),
        end: new THREE.Vector3(cx + hw, 0, southZ),
        direction: 'ew',
      });
    }
    for (let z = 0; z < this.config.height; z++) {
      const cz = z * this.cellSize;
      // West border
      segments.push({
        start: new THREE.Vector3(-hw, 0, cz - hw),
        end: new THREE.Vector3(-hw, 0, cz + hw),
        direction: 'ns',
      });
      // East border
      const eastX = (this.config.width - 1) * this.cellSize + hw;
      segments.push({
        start: new THREE.Vector3(eastX, 0, cz - hw),
        end: new THREE.Vector3(eastX, 0, cz + hw),
        direction: 'ns',
      });
    }

    return segments;
  }

  // BFS pathfinding to verify connectivity
  hasPath(fromCell: { x: number; z: number }, toCell: { x: number; z: number }): boolean {
    const visited = new Set<string>();
    const queue: { x: number; z: number }[] = [fromCell];
    visited.add(`${fromCell.x},${fromCell.z}`);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.x === toCell.x && current.z === toCell.z) return true;

      const cell = this.grid[current.x][current.z];
      const neighbors: { x: number; z: number }[] = [];

      if (!cell.walls.north && current.z > 0) neighbors.push({ x: current.x, z: current.z - 1 });
      if (!cell.walls.south && current.z < this.config.height - 1) neighbors.push({ x: current.x, z: current.z + 1 });
      if (!cell.walls.east && current.x < this.config.width - 1) neighbors.push({ x: current.x + 1, z: current.z });
      if (!cell.walls.west && current.x > 0) neighbors.push({ x: current.x - 1, z: current.z });

      for (const n of neighbors) {
        const key = `${n.x},${n.z}`;
        if (!visited.has(key)) {
          visited.add(key);
          queue.push(n);
        }
      }
    }
    return false;
  }

  // Get shortest path for enemy pathfinding
  findPath(fromCell: { x: number; z: number }, toCell: { x: number; z: number }): { x: number; z: number }[] | null {
    const visited = new Set<string>();
    const parent = new Map<string, { x: number; z: number } | null>();
    const queue: { x: number; z: number }[] = [fromCell];
    visited.add(`${fromCell.x},${fromCell.z}`);
    parent.set(`${fromCell.x},${fromCell.z}`, null);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.x === toCell.x && current.z === toCell.z) {
        const path: { x: number; z: number }[] = [];
        let node: { x: number; z: number } | null = current;
        while (node) {
          path.unshift(node);
          node = parent.get(`${node.x},${node.z}`) || null;
        }
        return path;
      }

      const cell = this.grid[current.x][current.z];
      const neighbors: { x: number; z: number }[] = [];

      if (!cell.walls.north && current.z > 0) neighbors.push({ x: current.x, z: current.z - 1 });
      if (!cell.walls.south && current.z < this.config.height - 1) neighbors.push({ x: current.x, z: current.z + 1 });
      if (!cell.walls.east && current.x < this.config.width - 1) neighbors.push({ x: current.x + 1, z: current.z });
      if (!cell.walls.west && current.x > 0) neighbors.push({ x: current.x - 1, z: current.z });

      for (const n of neighbors) {
        const key = `${n.x},${n.z}`;
        if (!visited.has(key)) {
          visited.add(key);
          parent.set(key, current);
          queue.push(n);
        }
      }
    }
    return null;
  }

  // Ensure exit is reachable from player position
  ensureConnectivity(playerCell: { x: number; z: number }, exitCell: { x: number; z: number }): void {
    if (!this.hasPath(playerCell, exitCell)) {
      // Carve a path between them
      let cx = playerCell.x;
      let cz = playerCell.z;
      while (cx !== exitCell.x || cz !== exitCell.z) {
        if (cx < exitCell.x) {
          this.removeWall(cx, cz, 'east');
          cx++;
        } else if (cx > exitCell.x) {
          this.removeWall(cx, cz, 'west');
          cx--;
        } else if (cz < exitCell.z) {
          this.removeWall(cx, cz, 'south');
          cz++;
        } else if (cz > exitCell.z) {
          this.removeWall(cx, cz, 'north');
          cz--;
        }
      }
    }
  }

  getOpenCells(): { x: number; z: number }[] {
    return this.grid.flatMap((col, x) =>
      col.map((_, z) => ({ x, z }))
    );
  }

  getFarCell(fromCell: { x: number; z: number }): { x: number; z: number } {
    let best: { x: number; z: number } = { x: 0, z: 0 };
    let bestDist = 0;
    for (let x = 0; x < this.config.width; x++) {
      for (let z = 0; z < this.config.height; z++) {
        const dist = Math.abs(x - fromCell.x) + Math.abs(z - fromCell.z);
        if (dist > bestDist) {
          bestDist = dist;
          best = { x, z };
        }
      }
    }
    return best;
  }
}
