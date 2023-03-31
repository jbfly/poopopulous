// Import Phaser library
import Phaser from 'phaser';

// Define constants for tile size and map size
const tileSize = 38;
const mapSize = 50;

// Create a new IsoScene class that extends Phaser.Scene
class IsoScene extends Phaser.Scene {
    // Define the constructor for the IsoScene class
    constructor() {
        // Call the constructor of the superclass Phaser.Scene and set the scene key
        super({ key: 'IsoScene' });
    }

    // Create game objects and set up the game state
    create() {
        // Create a new group for isometric game objects
        this.isoGroup = this.add.group();

        // Create the grid
        this.grid = this.createGrid(mapSize, mapSize, tileSize);

        // Add mouse events
        this.input.on('pointermove', this.highlightGrid, this);
        this.input.on('pointerdown', this.placeObject, this);
    }

    // Update the game state, called every frame
    update() {
        // Update grid square highlighting
        this.highlightGrid(this.input.activePointer);
    }

    // Create a grid system
    createGrid(rows, cols, size) {
        const grid = [];
        for (let y = 0; y < rows; y++) {
            grid[y] = [];
            for (let x = 0; x < cols; x++) {
                const tile = this.add.rectangle(x * size, y * size, size, size, 0xffffff, 0.1);
                tile.setStrokeStyle(1, 0x000000, 0.5);
                tile.setOrigin(0, 0);
                grid[y][x] = {
                    tile: tile,
                    object: null
                };
            }
        }
        return grid;
    }

    // Highlight the grid square under the mouse cursor
    highlightGrid(pointer) {
        const x = Math.floor(pointer.x / tileSize);
        const y = Math.floor(pointer.y / tileSize);

        if (x >= 0 && x < mapSize && y >= 0 && y < mapSize) {
            this.grid.forEach(row => {
                row.forEach(cell => {
                    cell.tile.setFillStyle(0xffffff, 0.1);
                });
            });
            this.grid[y][x].tile.setFillStyle(0xffff00, 0.5);
        }
    }

    // Place an object on the grid
    placeObject(pointer) {
        const x = Math.floor(pointer.x / tileSize);
        const y = Math.floor(pointer.y / tileSize);

        if (x >= 0 && x < mapSize && y >= 0 && y < mapSize) {
            const cell = this.grid[y][x];
            if (cell.object === null) {
                const object = this.add.rectangle(x * tileSize, y * tileSize, tileSize, tileSize, 0xff0000, 0.5);
                object.setOrigin(0, 0);
                cell.object = object;
            }
        }
    }
}

// Define the configuration object for the Phaser game
const config = {
    type: Phaser.AUTO,
    width: mapSize * tileSize,
    height: mapSize * tileSize,
    scene: IsoScene,
};

// Create a new Phaser game instance with the configuration object
const game = new Phaser.Game(config);