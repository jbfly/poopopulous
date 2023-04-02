import Phaser from 'phaser';
import poo_sound from './assets/poo.mp3';
import { createGrid, getGridCoordinates } from './utilities';

const tileSize = 38;
const mapSize = 50;
const rows = mapSize;
const columns = mapSize;
const spawnRate = 400; //How often in ms poos will be pooed

class IsoScene extends Phaser.Scene {
    constructor() {
        super({ key: 'IsoScene' });
    }
    preload() {
        this.load.image('highlight', 'assets/highlight.png');
        this.load.audio('pooSound', poo_sound);
    }

    create() {
        this.isoGroup = this.add.group();
        this.sound.add('pooSound', poo_sound);
        // Create a grid of size rows x columns
        this.grid = createGrid(this, rows, columns, tileSize, mapSize);
    
        this.poos = [];
        this.spawnRate = spawnRate;
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
            const { x, y } = getGridCoordinates(pointer.x, pointer.y, tileSize, mapSize);
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
    createPoo(x, y, isInitialPoo = false) {
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
            gridX: x,
            gridY: y,
            height: 0,
            speed: 0.5,
            tile: pooTile,
            sound: this.sound.get('pooSound')
        };
    
        this.poos.push(poo);
    
        // Tween for the falling animation
        this.tweens.add({
            targets: pooTile,
            y: centerY,
            ease: 'Cubic.easeIn',
            duration: 2000,
            onComplete: () => {
                poo.sound.play();
                // Call the pushPoo function only if it's not the initial poo
                if (!isInitialPoo) {
                    this.pushPoo(poo);
                }
            }
        });
    }
    
    
    // New function to push poos
    pushPoo(poo, finalX, finalY) {
        const offsetX = (mapSize / 2) * tileSize;
    
        let currentPoo = poo;
    
        // Loop through poos and push them
        while (currentPoo) {
            // Calculate the direction to push the current poo
            const dirX = Math.sign(finalX - currentPoo.gridX);
            const dirY = Math.sign(finalY - currentPoo.gridY);
    
            const newX = currentPoo.gridX + dirX;
            const newY = currentPoo.gridY + dirY;
    
            let nextPoo = null;
    
            if (
                newX >= 0 &&
                newX < mapSize &&
                newY >= 0 &&
                newY < mapSize
            ) {
                // Find the next poo to push
                nextPoo = this.poos.find(p => p.gridX === newX && p.gridY === newY);
    
                // Update the grid data
                this.grid[currentPoo.gridY][currentPoo.gridX].object = null;
                this.grid[newY][newX].object = 'poo';
    
                // Update the current poo's grid coordinates
                currentPoo.gridX = newX;
                currentPoo.gridY = newY;
    
                // Tween for the pushing animation
                const isoX = (newX - newY) * tileSize / 2 + offsetX;
                const isoY = (newX + newY) * tileSize / 4;
                this.tweens.add({
                    targets: currentPoo.tile,
                    x: isoX,
                    y: isoY,
                    ease: 'Cubic.easeOut',
                    duration: 1000
                });
            } else {
                // Break the loop when the poo reaches the final position
                break;
            }
    
            currentPoo = nextPoo;
        }
    }       
            
    expandPoo() {
        // Find available grid cells to expand to
        const availableCells = [];
        for (let x = 0; x < mapSize; x++) {
            for (let y = 0; y < mapSize; y++) {
                if (!this.grid[y][x].object) {
                    availableCells.push({ x: x, y: y });
                }
            }
        }
    
        // Randomly select an available cell for the new poo
        if (availableCells.length > 0) {
            const randomIndex = Math.floor(Math.random() * availableCells.length);
            const newPooCoords = availableCells[randomIndex];
    
            // Create a new poo at the center
            this.createPoo(this.startPoint.x, this.startPoint.y);
    
            // Find the new poo that was just created
            const newPoo = this.poos.find(p => p.gridX === this.startPoint.x && p.gridY === this.startPoint.y && !p.pushed);
    
            // Mark the new poo as pushed
            newPoo.pushed = true;
    
            // Call the pushPoo function on the new poo with the final position
            this.pushPoo(newPoo, newPooCoords.x, newPooCoords.y);
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
}
export default IsoScene;
