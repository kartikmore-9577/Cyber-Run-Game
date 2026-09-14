import Phaser from 'phaser';

export class Player extends Phaser.Physics.Arcade.Sprite {
  private readonly maxSpeed = 300;
  private readonly acceleration = 1100;
  private readonly friction = 900;
  private readonly jumpVelocity = 560;
  private readonly standingHeight = 64;
  private readonly crouchingHeight = 38;
  // The generated texture is 72px tall and the sprite uses a bottom origin.
  // Keep the physics body inset so its feet and the visible feet share y.
  private readonly standingOffset = 8;
  private readonly crouchingOffset = 34;
  private readonly gun: Phaser.GameObjects.Rectangle;

  public constructor(scene: Phaser.Scene, x: number, y: number) {
    Player.createTexture(scene);
    super(scene, x, y, 'player-stickman');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setCollideWorldBounds(true);
    this.setSize(30, this.standingHeight);
    this.setOffset(17, this.standingOffset);
    this.setOrigin(0.5, 1);
    this.gun = scene.add.rectangle(x + 30, y - 38, 28, 8, 0xd83939)
      .setStrokeStyle(2, 0xf4f4f4)
      .setVisible(false)
      .setDepth(4);
  }

  public update(
    leftDown: boolean,
    rightDown: boolean,
    jumpJustDown: boolean,
    crouchDown: boolean,
  ): boolean {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const isCrouching = crouchDown && body.blocked.down;

    if (isCrouching) {
      this.setSize(30, this.crouchingHeight);
      this.setOffset(17, this.crouchingOffset);
      this.setTint(0xbdbdbd);
    } else {
      this.setSize(30, this.standingHeight);
      this.setOffset(17, this.standingOffset);
      this.clearTint();
    }

    if (leftDown && !isCrouching) {
      this.setAccelerationX(-this.acceleration);
      this.setFlipX(true);
    } else if (rightDown && !isCrouching) {
      this.setAccelerationX(this.acceleration);
      this.setFlipX(false);
    } else {
      this.setAccelerationX(0);
      this.setDragX(this.friction);
    }
    body.setMaxVelocity(this.maxSpeed, 1000);
    this.gun.setPosition(this.x + (this.flipX ? -30 : 30), this.y - 38);
    this.gun.setScale(this.flipX ? -1 : 1, 1);

    if (jumpJustDown && body.blocked.down && !isCrouching) {
      this.setVelocityY(-this.jumpVelocity);
      return true;
    }
    return false;
  }

  public equipGun(): void {
    this.gun.setVisible(true);
  }

  public syncGun(): void {
    if (this.gun.visible) {
      this.gun.setPosition(this.x + (this.flipX ? -30 : 30), this.y - 38);
      this.gun.setScale(this.flipX ? -1 : 1, 1);
    }
  }

  private static createTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists('player-stickman')) {
      return;
    }

    const graphics = scene.add.graphics();
    graphics.lineStyle(5, 0xf4f4f4, 1);
    graphics.fillStyle(0xd83939, 1);
    graphics.fillCircle(32, 14, 11);
    graphics.lineBetween(32, 26, 32, 54);
    graphics.lineBetween(32, 33, 17, 43);
    graphics.lineBetween(32, 33, 47, 43);
    graphics.lineBetween(32, 54, 18, 68);
    graphics.lineBetween(32, 54, 46, 68);
    graphics.generateTexture('player-stickman', 64, 72);
    graphics.destroy();
  }
}
