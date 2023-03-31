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
        this.grid = this.createGrid(mapSize, mapSize, tileSize);

        this.poos = [];
        this.spawnRate = 1000;
        this.lastSpawnTime = 0;

        this.startPoint = {
            x: Math.floor(mapSize / 2),
            y: Math.floor(mapSize / 2)
        };

        this.input.on('pointermove', (pointer) => {
            const { x, y } = this.getGridCoordinates(pointer.x, pointer.y);
            if (x >= 0 && x < mapSize && y >= 0 && y < mapSize) {
                this.highlightGrid(x, y);
            }
        });
    }

    update(time) {
        if (time > this.lastSpawnTime + this.spawnRate) {
            this.createPoo();
            this.lastSpawnTime = time;
        }

        this.poos.forEach(poo => {
            if (poo.height < tileSize * 5) {
                poo.height += poo.speed;
            }

            poo.tile.setPosition(poo.x, poo.y - poo.height);
            poo.tile.depth = poo.y + poo.height;
        });
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

    createPoo() {
        const x = this.startPoint.x;
        const y = this.startPoint.y;

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

    highlightGrid(x, y) {
        if (this.grid[y][x].highlight) {
            this.grid[y][x].highlight.destroy();
        }

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
