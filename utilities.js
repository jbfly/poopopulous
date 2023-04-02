//const mapSize = 50;

export function createGrid(scene, rows, cols, tileSize, mapSize) {
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
            grid[y][x] = {
                tile: tile,
                object: null,
                highlight: null
            };
        }
    }
    return grid;
}    

export function getGridCoordinates(x, y, tileSize, mapSize) {
    const isoX = (x - (mapSize / 2) * tileSize) / (tileSize / 2);
    const isoY = y / (tileSize / 4);
    const gridX = Math.floor((isoX + isoY) / 2);
    const gridY = Math.floor((isoY - isoX) / 2);
    return { x: gridX, y: gridY };
}   