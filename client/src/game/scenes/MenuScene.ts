import Phaser from 'phaser';
import { AudioManager } from '../systems/AudioManager';

export class MenuScene extends Phaser.Scene {
  public constructor() {
    super('MenuScene');
  }

  public create(): void {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x111111);
    this.add.text(width / 2, height * 0.32, 'CYBER RUN', {
      color: '#f4f4f4',
      fontFamily: 'Arial',
      fontSize: '72px',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.add.text(width / 2, height * 0.45, 'SURVIVE. LEARN. DEFEAT THE THREAT.', {
      color: '#d83939',
      fontFamily: 'Arial',
      fontSize: '24px',
    }).setOrigin(0.5);

    const startButton = this.add.text(width / 2, height * 0.62, '[ START GAME ]', {
      backgroundColor: '#d83939',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontSize: '28px',
      padding: { left: 24, right: 24, top: 14, bottom: 14 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    startButton.on('pointerdown', () => {
      AudioManager.resume();
      this.scene.start('GameScene');
    });
  }
}
