import IsoScene from './isoScene.js';

const tileSize = 38;
const mapSize = 50;

const gameConfig = {
    type: Phaser.AUTO,
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: IsoScene,

    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 300 },
            debug: false,
        },
    },
};

export default gameConfig;