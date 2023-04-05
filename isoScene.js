import Phaser from 'phaser';
import Matter from 'matter-js';
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

        // Initialize Matter.js engine and world
        this.matterEngine = Matter.Engine.create();
        this.matterWorld = this.matterEngine.world;
        this.matterWorld.gravity.scale = 0.01;


        // Add custom collision event
        Matter.Events.on(this.matterEngine, 'collisionStart', (event) => {
            event.pairs.forEach(pair => {
                const bodyA = pair.bodyA;
                const bodyB = pair.bodyB;

                // Check if bodyA is a poo and bodyB is a grid cell
                const pooA = this.poos.find(poo => poo.body === bodyA);
                const gridCellB = this.grid.flat().find(cell => cell.body === bodyB);

                if (pooA && gridCellB) {
                    const heightDifference = Math.abs(pooA.z - gridCellB.height);
                    if (heightDifference > 1) {
                        // If the height difference is too large, separate the poos
                        Matter.SAT.collides(bodyA, bodyB);
                    }
                } else {
                    // Check if bodyB is a poo and bodyA is a grid cell
                    const pooB = this.poos.find(poo => poo.body === bodyB);
                    const gridCellA = this.grid.flat().find(cell => cell.body === bodyA);

                    if (pooB && gridCellA) {
                        const heightDifference = Math.abs(pooB.z - gridCellA.height);
                        if (heightDifference > 1) {
                            // If the height difference is too large, separate the poos
                            Matter.SAT.collides(bodyA, bodyB);
                        }
                    }
                }
            });
        });
        

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
        this.grid = createGrid(this, rows, columns, tileSize, mapSize, this.matterWorld);
    
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
            this.dropPoo(); // Call the new dropPoo() function instead of expandPoo()
            this.lastSpawnTime = time;
        }
        
        // Update the position and height of the poo sprites
        this.poos.forEach(poo => {
            if (poo) {
                const isoCoords = getGridCoordinates(poo.body.position.x, poo.body.position.y, tileSize, mapSize);
    
                // Check if the isoCoords are within the grid bounds
                if (isoCoords.x >= 0 && isoCoords.x < mapSize && isoCoords.y >= 0 && isoCoords.y < mapSize) {
                    const gridCell = this.grid[isoCoords.y][isoCoords.x];
                    const pooZ = gridCell.height || 0;
    
                    poo.z = pooZ; // Update the z property based on grid cell height
    
                    const gridCoords = getGridCoordinates(poo.body.position.x, poo.body.position.y, tileSize, mapSize);
                    const isoX = (gridCoords.x - gridCoords.y) * tileSize / 2 + (mapSize / 2) * tileSize;
                    const isoY = (gridCoords.x + gridCoords.y) * tileSize / 4 - pooZ * tileSize / 4;
                    poo.tile.x = isoX;
                    poo.tile.y = isoY;
                }
            }
        });
    
        // Update Matter.js engine
        Matter.Engine.update(this.matterEngine, 1000 / 60);
    
        // Add this part to update the poo positions based on their Matter.js bodies' positions
        for (let i = 0; i < this.poos.length; i++) {
            const poo = this.poos[i];
            const bodyPosition = poo.body.position;
            poo.tile.x = bodyPosition.x;
            poo.tile.y = bodyPosition.y;
        }
    
        // Update the height text
        this.poos.forEach(poo => {
            if (poo) {
                poo.heightText.x = poo.tile.x;
                poo.heightText.y = poo.tile.y - poo.z * tileSize / 4 - tileSize / 4;
                poo.heightText.text = `${poo.height}`;
            }
        });
    }
    
    createPoo(x, y, offsetY = 0) {
        const offsetX = (mapSize / 2) * tileSize;
        const isoX = (x - y) * tileSize / 2 + offsetX;
        const isoY = (x + y) * tileSize / 4 - offsetY; // Subtract offsetY from isoY
        const centerX = (this.startPoint.x - this.startPoint.y) * tileSize / 2 + offsetX;
        const centerY = (this.startPoint.x + this.startPoint.y) * tileSize / 4;
        const pooTile = this.add.text(centerX, centerY - tileSize, '💩', { fontSize: '32px' });
        pooTile.setOrigin(0.5, 1);
        pooTile.setScale(0.75);
        this.isoGroup.add(pooTile);
    
        const pooBody = Matter.Bodies.circle(centerX, centerY - tileSize, tileSize / 4, {
            isStatic: false,
            friction: 0.5,
            restitution: 0.3,
            collisionFilter: {
                group: 0, // Set the collision group for the poo bodies
            },
        });
        Matter.World.add(this.matterWorld, pooBody);
         Matter.Body.setVelocity(pooBody, { x: 0, y: 5 }); // Set the initial velocity of the spawned poo
    
        const gridCell = this.grid[y][x];
        const pooZ = gridCell.height || 0;

        const pooHeightText = this.add.text(centerX, centerY - tileSize, `1`, {
            fontSize: '18px',
            fontWeight: 'bold',
            color: '#000000',
            stroke: '#ffffff',
            strokeThickness: 4,
        });
        pooHeightText.setOrigin(0.5, 1);
        this.isoGroup.add(pooHeightText);
        
        const poo = {
            x: isoX,
            y: isoY,
            z: pooZ, // Add z property for height
            height: 1,
            speed: 0.5,
            tile: pooTile,
            heightText: pooHeightText,
            sound: this.sound.get('pooSound'),
            body: pooBody, // Add the Matter.js body
        };
    
        this.poos.push(poo);
    }
    
    // New dropPoo function
    dropPoo() {
        const availableCells = [];

        // Find all empty cells in the top row of the grid
        for (let x = 0; x < mapSize; x++) {
            if (!this.grid[0][x].object) {
                availableCells.push({ x: x, y: 0 });
            }
        }

        // Randomly select an available cell for the new poo
        if (availableCells.length > 0) {
            const randomIndex = Math.floor(Math.random() * availableCells.length);
            const newPooCoords = availableCells[randomIndex];

            // Create a poo at the selected cell with an additional vertical offset (tileSize * 4)
            this.createPoo(newPooCoords.x, newPooCoords.y, tileSize * 4);
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
