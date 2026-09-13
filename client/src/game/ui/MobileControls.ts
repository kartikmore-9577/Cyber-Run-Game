import Phaser from 'phaser';

export interface MobileControlState {
  left: boolean;
  right: boolean;
  jump: boolean;
  crouch: boolean;
  shoot: boolean;
}

export class MobileControls {
  public readonly state: MobileControlState = {
    left: false, right: false, jump: false, crouch: false, shoot: false,
  };

  public constructor(scene: Phaser.Scene) {
    const { width, height } = scene.scale;
    this.addButton(scene, 74, height - 74, '◀', 'left');
    this.addButton(scene, 164, height - 74, '▶', 'right');
    this.addButton(scene, width - 164, height - 74, '▲', 'jump');
    this.addButton(scene, width - 74, height - 74, '▼', 'crouch');
    this.addButton(scene, width - 74, height - 150, '●', 'shoot');
  }

  private addButton(
    scene: Phaser.Scene,
    x: number,
    y: number,
    label: string,
    key: keyof MobileControlState,
  ): void {
    const button = scene.add.text(x, y, label, {
      color: '#f4f4f4',
      fontFamily: 'Arial',
      fontSize: '28px',
      backgroundColor: '#222222cc',
      padding: { left: 18, right: 18, top: 10, bottom: 10 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(20).setInteractive();
    button.on('pointerdown', () => {
      this.state[key] = true;
      button.setStyle({ backgroundColor: '#8f2424cc' });
    });
    const release = () => {
      this.state[key] = false;
      button.setStyle({ backgroundColor: '#222222cc' });
    };
    button.on('pointerup', release);
    button.on('pointerout', release);
  }
}
