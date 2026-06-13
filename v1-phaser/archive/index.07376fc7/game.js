import Phaser from 'phaser';

const tileSize = 38;
const mapSize = 50;

class IsoScene extends Phaser.Scene {
    constructor() {
        super({ key: 'IsoScene' });
    }

    preload() {
        this.load.image('highlight', 'assets/highlight.png');
    }

    create() {
        this.isoGroup = this.add.group();
        // Create a grid of size mapSize x mapSize
        this.grid = this.createGrid(mapSize, mapSize, tileSize);

        this.poos = [];
        this.spawnRate = 2400; // Adjust spawn rate to make it take about 2 minutes to fill the screen
        this.lastSpawnTime = 0;

        // Set the starting point for poo spawning as the center of the grid
        this.startPoint = {
            x: Math.floor(mapSize / 2),
            y: Math.floor(mapSize / 2)
        };

        // Add the initial poo at the starting point
        this.createPoo(this.startPoint.x, this.startPoint.y);
        this.grid[this.startPoint.y][this.startPoint.x].object = 'poo';

        // Add pointermove event listener to highlight grid cells
        this.input.on('pointermove', (pointer) => {
            const { x, y } = this.getGridCoordinates(pointer.x, pointer.y);
            if (x >= 0 && x < mapSize && y >= 0 && y < mapSize) {
                this.highlightGrid(x, y);
            }
        });
    }

    update(time) {
        // Check if it's time to spawn a new poo
        if (time > this.lastSpawnTime + this.spawnRate) {
            this.expandPoo();
            this.lastSpawnTime = time;
        }
    }

    createGrid(rows, cols, size) {
        const grid = [];
        for (let y = 0; y < rows; y++) {
            grid[y] = [];
            for (let x = 0; x < cols; x++) {
                const tile = this.add.rectangle(x * size, y * size, size, size, 0xffffff, 0);
                tile.setStrokeStyle(1, 0x000000, 0.5);
                tile.setOrigin(0, 0);
                grid[y][x] = {
                    tile: tile,
                    object: null,
                    highlight: null
                };
            }
        }
        return grid;
    }

    createPoo(x, y) {
        const pooTile = this.add.text(x * tileSize, y * tileSize, '💩', { fontSize: '32px' });
        pooTile.setOrigin(0, 0);
        this.isoGroup.add(pooTile);

        const poo = {
            x: x * tileSize,
            y: y * tileSize,
            height: 0,
            speed: 0.5,
            tile: pooTile
        };

        this.poos.push(poo);
    }

    expandPoo() {
        // Generate all the possible directions for expansion
        const directions = [
            { x: -1, y: 0 },
            { x: 1, y: 0 },
            { x: 0, y: -1 },
            { x: 0, y: 1 },
        ];

        // Find available grid cells to expand to
        const availableCells = [];
        this.poos.forEach(poo => {
            const gridCoords = this.getGridCoordinates(poo.x, poo.y);
            directions.forEach(dir => {
                const newX = gridCoords.x + dir.x;
                const newY = gridCoords.y + dir.y;
               
                if (
                    newX >= 0 &&
                    newX < mapSize &&
                    newY >= 0 &&
                    newY < mapSize &&
                    !this.grid[newY][newX].object
                ) {
                    availableCells.push({ x: newX, y: newY });
                }
            });
        });
    
        // Randomly select an available cell for the new poo
        if (availableCells.length > 0) {
            const randomIndex = Math.floor(Math.random() * availableCells.length);
            const newPooCoords = availableCells[randomIndex];
            this.createPoo(newPooCoords.x, newPooCoords.y);
            this.grid[newPooCoords.y][newPooCoords.x].object = 'poo';
        }
    }
    
    highlightGrid(x, y) {
        // Clear the previous highlight
        this.grid.forEach(row => {
            row.forEach(cell => {
                if (cell.highlight) {
                    cell.highlight.destroy();
                    cell.highlight = null;
                }
            });
        });
    
        // Add a new highlight
        const highlight = this.add.image(x * tileSize, y * tileSize, 'highlight');
        highlight.setOrigin(0, 0);
        this.grid[y][x].highlight = highlight;
    }
    
    getGridCoordinates(x, y) {
        const gridX = Math.floor(x / tileSize);
        const gridY = Math.floor(y / tileSize);
        return { x: gridX, y: gridY };
    }
}

const config = {
type: Phaser.AUTO,
width: mapSize * tileSize,
height: mapSize * tileSize,
scene: IsoScene,
};

const game = new Phaser.Game(config);