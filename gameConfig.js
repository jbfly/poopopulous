import IsoScene from './isoScene.js';

const tileSize = 38;
const mapSize = 50;

const gameConfig = {
    type: Phaser.AUTO,
    width: mapSize * tileSize,
    height: mapSize * tileSize,
    scene: IsoScene,
};

export default gameConfig;