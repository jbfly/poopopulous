import Matter from 'matter-js';

function createGrid(scene, rows, cols, tileSize, mapSize, world) {
    const grid = [];
    const offsetX = (mapSize / 2) * tileSize;
    for (let y = 0; y < rows; y++) {
        grid[y] = [];
        for (let x = 0; x < cols; x++) {
            const isoX = (x - y) * tileSize / 2 + offsetX;
            const isoY = (x + y) * tileSize / 4;
            const tile = scene.add.graphics();
            tile.lineStyle(1, 0x000000, 1);
            tile.fillStyle(0xffffff, 1);
            tile.beginPath();
            tile.moveTo(isoX, isoY + tileSize / 4);
            tile.lineTo(isoX + tileSize / 2, isoY);
            tile.lineTo(isoX + tileSize, isoY + tileSize / 4);
            tile.lineTo(isoX + tileSize / 2, isoY + tileSize / 2);
            tile.closePath();
            tile.strokePath();
            tile.fillPath();

            // Create a static Matter.js body for the grid cell
            const gridBody = Matter.Bodies.rectangle(isoX, isoY, tileSize, tileSize, {
                isStatic: true,
                friction: 0,
                frictionStatic: 0,
                frictionAir: 0,
                collisionFilter: {
                    group: -1, // Exclude grid bodies from colliding with each other
                },
            });

            // Add the grid body to the world
            Matter.World.add(world, gridBody);

            grid[y][x] = {
                tile: tile,
                object: null,
                highlight: null,
                body: gridBody, // Add the Matter.js body to the grid cell
            };
        }
    }
    return grid;
}    

function getGridCoordinates(x, y, tileSize, mapSize) {
    const offsetX = (mapSize / 2) * tileSize;
    const isoX = Math.round((x - offsetX) / tileSize + y / (tileSize / 2));
    const isoY = Math.round(y / (tileSize / 2) - (x - offsetX) / tileSize);
    return { x: isoX, y: isoY };
}  

export { createGrid, getGridCoordinates };