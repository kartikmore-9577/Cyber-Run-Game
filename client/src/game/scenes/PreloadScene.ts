import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
  public constructor() {
    super('PreloadScene');
  }

  public create(): void {
    this.scene.start('MenuScene');
  }
}

