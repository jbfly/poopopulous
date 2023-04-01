import Phaser from 'phaser';

const tileSize = 38;
const mapSize = 50;

class IsoScene extends Phaser.Scene {
    constructor() {
        super({ key: 'IsoScene' });
    }

    preload() {
        this.load.image('highlight', 'assets/highlight.png');
        this.load.audio('pooSound', [
            'assets/poo.ogg'
           // 'assets/poo.mp3'
        ]);
    }

    create() {
        this.input.once('pointerdown', () => {
            this.sound.context.resume().then(() => {
                console.log('Audio Context resumed.');
            });
        });
        this.isoGroup = this.add.group();
        this.grid = this.createGrid(mapSize, mapSize, tileSize);
        const music = this.sound.add('pooSound');
        music.play();
        /* Check if the sound file is loaded successfully
        if (this.cache.audio.exists('pooSound')) {
            this.pooSound = this.sound.add('pooSound');
        }
    */
        // Create the start button
        this.startButton = this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2, 'Start Game', { fontSize: '32px', color: '#000' });
        this.startButton.setOrigin(0.5);
        this.startButton.setInteractive({ useHandCursor: true });
        this.startButton.on('pointerdown', () => {
            this.startButton.visible = false; // Hide the start button
            this.startGame(); // Start the game
        });
    }

    startGame() {
        // Initialize the game state
        this.poos = [];
        this.spawnRate = 2400;
        this.lastSpawnTime = 0;

        this.startPoint = {
            x: Math.floor(mapSize / 2),
            y: Math.floor(mapSize / 2)
        };

        this.createPoo(this.startPoint.x, this.startPoint.y, true);
        this.grid[this.startPoint.y][this.startPoint.x].object = 'poo';

        this.input.on('pointermove', (pointer) => {
            const { x, y } = this.getGridCoordinates(pointer.x, pointer.y);
            if (x >= 0 && x < mapSize && y >= 0 && y < mapSize) {
                this.highlightGrid(x, y);
            }
        });
    }

    update(time) {
        // Check if the game has started
        if (!this.startButton.visible) {
            if (time > this.lastSpawnTime + this.spawnRate) {
                this.expandPoo();
                this.lastSpawnTime = time;
            }
        }
    }

    createGrid(rows, cols, size) {
        const grid = [];
        const offsetX = (mapSize / 2) * tileSize;
        for (let y = 0; y < rows; y++) {
            grid[y] = [];
            for (let x = 0; x < cols; x++) {
                const isoX = (x - y) * size / 2 + offsetX;
                const isoY = (x + y) * size / 4;
                const tile = this.add.graphics();
                tile.lineStyle(1, 0x000000, 1);
                tile.fillStyle(0xffffff, 1);
                tile.beginPath();
                tile.moveTo(isoX, isoY + size / 4);
                tile.lineTo(isoX + size / 2, isoY);
                tile.lineTo(isoX + size, isoY + size / 4);
                tile.lineTo(isoX + size / 2, isoY + size / 2);
                tile.closePath();
                tile.strokePath();
                tile.fillPath();
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
        const offsetX = (mapSize / 2) * tileSize;
        const isoX = (x - y) * tileSize / 2 + offsetX;
        const isoY = (x + y) * tileSize / 4;
        const centerX = (this.startPoint.x - this.startPoint.y) * tileSize / 2 + offsetX;
        const centerY = (this.startPoint.x + this.startPoint.y) * tileSize / 4;
        const pooTile = this.add.text(centerX, -tileSize, '💩', { fontSize: '32px' });
        pooTile.setOrigin(0.5, 1);
        pooTile.setScale(0.75);
        this.isoGroup.add(pooTile);
    
        const poo = {
            x: isoX,
            y: isoY,
            height: 0,
            speed: 0.5,
            tile: pooTile
        };
    
        this.poos.push(poo);
        if (this.pooSound) {
            this.pooSound.play();
        }
    
        // Tween for the falling animation
        this.tweens.add({
            targets: pooTile,
            y: centerY,
            ease: 'Cubic.easeIn',
            duration: 2000,
            onComplete: () => {
                // Tween for the sliding animation
                this.tweens.add({
                    targets: pooTile,
                    x: isoX,
                    y: isoY,
                    ease: 'Cubic.easeOut',
                    duration: 1000
                });
            }
        });
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
                    cell.tile.fillStyle(0xffffff, 1); // Reset fillStyle to the original color
                    cell.tile.fillPath();
                    cell.highlight = false;
                }
            });
        });
    
        const offsetX = (mapSize / 2) * tileSize;
        const isoX = (x - y) * tileSize / 2 + offsetX;
        const isoY = (x + y) * tileSize / 4;
    
        // Add a new highlight by changing the fillStyle of the grid cell
    this.grid[y][x].tile.fillStyle(0x00ff00, 1); // Change the fillStyle to a new color (e.g., green)
    this.grid[y][x].tile.fillPath();
    this.grid[y][x].highlight = true;
    }    
    
    getGridCoordinates(x, y) {
        const offsetX = (mapSize / 2) * tileSize;
        const isoX = Math.round((x - offsetX) / tileSize + y / (tileSize / 2));
        const isoY = Math.round(y / (tileSize / 2) - (x - offsetX) / tileSize);
        return { x: isoX, y: isoY };
    }    
}

const config = {
type: Phaser.AUTO,
width: mapSize * tileSize,
height: mapSize * tileSize,
scene: IsoScene,
audio: {
    disableWebAudio: true
}
};

const game = new Phaser.Game(config);