import Phaser from 'phaser';
import poo_sound from './assets/poo.mp3';
import pipe_png from './assets/mariopipe.png';
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
        this.load.image('pipe', pipe_png);
    }

    create() {
        this.isoGroup = this.add.group();

        // Handle window resize
        this.scale.on('resize', (gameSize) => {
        const width = gameSize.width;
        const height = gameSize.height;
        this.cameras.main.setViewport(0, 0, width, height);
        this.adjustInitialZoomAndCenter();
        });

        this.adjustInitialZoomAndCenter();

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
            const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
            const { x, y } = getGridCoordinates(worldPoint.x, worldPoint.y, tileSize, mapSize);
            if (x >= 0 && x < mapSize && y >= 0 && y < mapSize) {
                this.highlightGrid(x, y);
                if (pointer.isDown && this.selectedTool === 'pipe') { //Pipe placement
                    this.placePipe(x, y);
            }
        }
    });
        //Listen for click on the zoom buttons found in the index.html
        
        document.getElementById('zoomInButton').addEventListener('click', () => this.zoomIn());
        document.getElementById('zoomOutButton').addEventListener('click', () => this.zoomOut());

        //Listen for click on pipe button
        document.getElementById('pipeButton').addEventListener('click', () => this.selectPipeTool());
    }    
    zoomIn() {
        const zoom = Math.min(2, this.cameras.main.zoom + 0.1);
        this.cameras.main.setZoom(zoom);
    }

    zoomOut() {
        const zoom = Math.max(0.5, this.cameras.main.zoom - 0.1);
        this.cameras.main.setZoom(zoom);
    }

    selectPipeTool() {
        this.selectedTool = 'pipe';
        console.log('Pipe tool selected');
    }

    placePipe(x, y) {
        if (this.grid[y][x].object) return;
    
        const offsetX = (mapSize / 2) * tileSize;
        const isoX = (x - y) * tileSize / 2 + offsetX;
        const isoY = (x + y) * tileSize / 4;
    
        const pipeSprite = this.add.image(isoX + tileSize / 2, isoY + tileSize / 4 + tileSize / 8, 'pipe');
        pipeSprite.setOrigin(0.5, 1);
        pipeSprite.setScale(0.5);
        this.isoGroup.add(pipeSprite);
    
        this.grid[y][x].object = 'pipe';
    }

    adjustInitialZoomAndCenter() {
        const gameWidth = this.scale.width;
        const gameHeight = this.scale.height;

        const zoomX = gameWidth / (mapSize * tileSize);
        const zoomY = gameHeight / (mapSize * tileSize);
        const zoom = Math.min(zoomX, zoomY);

        this.cameras.main.setZoom(zoom);
        this.cameras.main.centerOn((mapSize * tileSize) / 2, (mapSize * tileSize) / 4);
    }

    update(time) {
        // Check if it's time to spawn a new poo
        if (time > this.lastSpawnTime + this.spawnRate) {
            this.expandPoo();
            this.lastSpawnTime = time;
        }
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
                // Tween for the sliding animation
                this.tweens.add({
                    targets: pooTile,
                    x: isoX,
                    y: isoY,
                    ease: 'Cubic.easeOut',
                    duration: 1000,
                    onComplete: () => {
                        
                    }
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
            const gridCoords = getGridCoordinates(poo.x, poo.y, tileSize, mapSize);
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
                    cell.tile.fillPath(); // Call fillPath() after changing the fillStyle
                    cell.highlight = false;
                }
            });
        });
            
        const offsetX = (mapSize / 2) * tileSize;
        const isoX = (x - y) * tileSize / 2 + offsetX - tileSize / 2;
        const isoY = (x + y) * tileSize / 4;
    
        // Add a new highlight by changing the fillStyle of the grid cell
        this.grid[y][x].tile.fillStyle(0x00ff00, 1); // Change the fillStyle to a new color (e.g., green)
        this.grid[y][x].tile.fillPath();
        this.grid[y][x].highlight = true;
    
        // Set the position of the isoGroup according to the camera
        const worldPoint = this.cameras.main.getWorldPoint(isoX, isoY);
        this.isoGroup.x = worldPoint.x - offsetX;
        this.isoGroup.y = worldPoint.y;
    }
    
}
export default IsoScene;
