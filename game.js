const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    plugins: {
        scene: [
            { key: 'IsoPlugin', plugin: Phaser3Isometric.IsoPlugin, mapping: 'iso' }
        ]
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

function preload() {
    this.load.image('fluid', 'assets/fluid.png');
}

function create() {
    this.isoGroup = this.add.group();

    // Create isometric projection
    this.iso = this.scene.plugins.get('IsoPlugin');
    this.iso.projector.origin.setTo(0.5, 0.3);

    // Create slope
    const slopeSize = 10;
    const slopeHeight = 3;
    for (let x = 0; x < slopeSize; x++) {
        for (let y = 0; y < slopeSize; y++) {
            const tile = this.add.isoSprite(x * 38, y * 38, (x - y) * slopeHeight, 'fluid', 0);
            this.isoGroup.add(tile);
        }
    }

    // Fluid properties
    this.fluidSpeed = 1;
    this.fluidX = 0;
    this.fluidY = 0;
    this.fluidHeight = 0;
}

function update() {
    // Update fluid position
    this.fluidX += this.fluidSpeed;
    this.fluidY += this.fluidSpeed;
    this.fluidHeight -= this.fluidSpeed;

    // Reset fluid position and height when it reaches the end of the slope
    if (this.fluidX >= 10 * 38) {
        this.fluidX = 0;
        this.fluidY = 0;
        this.fluidHeight = 0;
    }

    // Create fluid running down the slope
    const fluidTile = this.add.isoSprite(this.fluidX, this.fluidY, this.fluidHeight, 'fluid', 0);
    this.isoGroup.add(fluidTile);
}
