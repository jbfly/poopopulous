// Import Phaser library ***
import Phaser from 'phaser';

// Define constants for tile size and map size
const tileSize = 38;
const mapSize = 10;

// Create a new IsoScene class that extends Phaser.Scene
class IsoScene extends Phaser.Scene {
    // Define the constructor for the IsoScene class
    constructor() {
        // Call the constructor of the superclass Phaser.Scene and set the scene key
        super({ key: 'IsoScene' });
    }

    // Preload assets (images) needed for the scene
    preload() {
        // Load pipe image
        this.load.image('pipe', 'assets/pipe.png');
    }

    // Create game objects and set up the game state
    create() {
        // Create a new group for isometric game objects
        this.isoGroup = this.add.group();
        // Initialize an array to store poo objects
        this.poos = [];
        
        // Call the createPoo method to create a poo object
        this.createPoo();

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
            poo.height -= poo.speed;

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

    // Create a poo object and add it to the poos array
    createPoo() {
        // Create a new poo Text object using the Unicode poo emoji and set its origin
        const pooTile = this.add.text(0, 0, '💩', { fontSize: '32px' });
        pooTile.setOrigin(0.5, 0.5);
        // Add the poo Text object to the isoGroup
        this.isoGroup.add(pooTile);

        // Define a poo object with position, height, speed, and tile properties
        const poo = {
            x: 0,
            y: 0,
            height: 0,
            speed: 2,
            tile: pooTile
        };

        // Add the poo object to the poos array
        this.poos.push(poo);
    }
}

// Define the configuration object for the Phaser game
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    scene: IsoScene,
};

// Create a new Phaser game instance with the configuration object
const game = new Phaser.Game(config);
