import Phaser from 'phaser';

export class ComicMessageSystem {
  private readonly container: Phaser.GameObjects.Container;
  private readonly text: Phaser.GameObjects.Text;
  private readonly panel: Phaser.GameObjects.Rectangle;
  private timer?: Phaser.Time.TimerEvent;

  public constructor(scene: Phaser.Scene) {
    const { width } = scene.scale;
    this.panel = scene.add.rectangle(width / 2, 86, 620, 58, 0xf4f4f4)
      .setStrokeStyle(3, 0xd83939);
    this.text = scene.add.text(width / 2, 86, '', {
      color: '#111111',
      fontFamily: 'Arial',
      fontSize: '20px',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: 570 },
    }).setOrigin(0.5);
    this.container = scene.add.container(0, 0, [this.panel, this.text]);
    this.container.setScrollFactor(0).setDepth(20).setVisible(false);
  }

  public show(message: string, duration = 1700): void {
    this.text.setText(message);
    this.container.setVisible(true).setAlpha(1);
    this.timer?.remove();
    this.timer = this.container.scene.time.delayedCall(duration, () => {
      this.container.scene.tweens.add({
        targets: this.container,
        alpha: 0,
        duration: 180,
        onComplete: () => this.container.setVisible(false),
      });
    });
  }
}
