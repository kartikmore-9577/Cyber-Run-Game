import Phaser from 'phaser';

export class HUD {
  private readonly healthText: Phaser.GameObjects.Text;
  private readonly scoreText: Phaser.GameObjects.Text;

  public constructor(scene: Phaser.Scene) {
    this.healthText = scene.add.text(28, 24, '', {
      color: '#f4f4f4',
      fontFamily: 'Arial',
      fontSize: '26px',
      fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(20);
    this.scoreText = scene.add.text(28, 60, '', {
      color: '#f4f4f4',
      fontFamily: 'Arial',
      fontSize: '18px',
      fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(20);
    scene.add.text(scene.scale.width - 28, 28, 'PAUSE  [ESC]', {
      color: '#f4f4f4',
      fontFamily: 'Arial',
      fontSize: '16px',
      backgroundColor: '#2b2b2b',
      padding: { left: 10, right: 10, top: 7, bottom: 7 },
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(20);
  }

  public update(health: number, score: number): void {
    this.healthText.setText(`${'♥ '.repeat(Math.max(0, health)).trim()}${health < 3 ? `  ${'♡ '.repeat(3 - health).trim()}` : ''}`);
    this.scoreText.setText(`SCORE: ${score.toString().padStart(4, '0')}`);
  }
}
