import Phaser from 'phaser';
import IsoScene from './isoScene';

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: window.innerWidth,
  height: window.innerHeight,
  scene: [IsoScene],
  physics: {
    default: 'arcade',
    arcade: {
      gravity: {y: 300 },
      debug: false
    }
  }
};

const game = new Phaser.Game(config);

window.addEventListener('resize', () => {
  game.scale.resize(window.innerWidth, window.innerHeight);
});
