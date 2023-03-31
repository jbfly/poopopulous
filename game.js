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

        // Initialize an array to store poo objects
        this.poos = [];

        // Add spacebar key event listener
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    }

    // Update the game state, called every frame
    update() {
        // Check if the spacebar is pressed
        if (this.spaceKey.isDown) {
            // Call the createPoo method to create a poo object
            this.createPoo();
        }

        // Iterate through the poos array and update each poo object
        this.poos.forEach(poo => {
            // Update poo position based on its speed
            poo.x += poo.speed;
            poo.y += poo.speed;
            poo.height += poo.speed;

            // Check if the poo has reached the edge of the map
            if (poo.x >= 10 * 38) {
                // Reset the poo position and height
                poo.x = 0;
                poo.y = 0;
                poo.height = 0;
            }

            // Update the poo's tile position and depth based on its new position
            poo.tile.setPosition(poo.x, poo.y);
            poo.tile.depth = poo.y + poo.height;
        });
    }

    // Create a grid system
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
                    object: null
                };
            }
        }
        return grid;
    }

    // Create a poo object and add it to the poos array
    createPoo() {
        const randomX = Math.floor(Math.random() * mapSize);
        const randomY = Math.floor(Math.random() * mapSize);

        const pooTile = this.add.text(randomX * tileSize, randomY * tileSize, '💩', { fontSize: '32px' });
        pooTile.setOrigin(0, 0);
        this.isoGroup.add(pooTile);

        const poo = {
            x: randomX * tileSize,
            y: randomY * tileSize,
            height: 0,
            speed: 2,
            tile: pooTile
        };

        this.poos.push(poo);
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