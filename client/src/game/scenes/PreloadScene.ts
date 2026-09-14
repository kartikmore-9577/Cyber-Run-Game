import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
  public constructor() {
    super('PreloadScene');
  }

  public preload(): void {
    this.load.image('cyberBackground', 'assets/cyber-background.png');
  }

  public create(): void {
    this.scene.start('MenuScene');
  }
}
