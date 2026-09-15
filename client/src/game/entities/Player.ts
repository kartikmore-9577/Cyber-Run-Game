import Phaser from 'phaser';

export type PlayerAnimationState = 'idle' | 'run' | 'jump' | 'fall' | 'crouch' | 'shoot' | 'hit';

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
  private shootTimer = 0;
  private hitTimer = 0;
  private runAnimationTimer = 0;
  private animationFrame = 0;
  private currentAnimation: PlayerAnimationState = 'idle';

  public constructor(scene: Phaser.Scene, x: number, y: number) {
    Player.createTextures(scene);
    super(scene, x, y, 'player-stickman-idle');
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
    this.setTexture('player-stickman-idle');
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
      this.shootTimer = Math.max(this.shootTimer, 0);
      return true;
    }

    this.shootTimer = Math.max(0, this.shootTimer - 16);
    this.hitTimer = Math.max(0, this.hitTimer - 16);
    this.updateAnimation(body, isCrouching);
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

  public triggerShootAnimation(): void {
    this.shootTimer = 180;
  }

  public triggerHitAnimation(): void {
    this.hitTimer = 260;
  }

  private updateAnimation(body: Phaser.Physics.Arcade.Body, isCrouching: boolean): void {
    const velocityX = Math.abs(body.velocity.x);
    const velocityY = body.velocity.y;
    const isOnGround = body.blocked.down;

    let nextState: PlayerAnimationState = 'idle';

    if (this.hitTimer > 0) {
      nextState = 'hit';
    } else if (this.shootTimer > 0) {
      nextState = 'shoot';
    } else if (isCrouching) {
      nextState = 'crouch';
    } else if (!isOnGround && velocityY < 0) {
      nextState = 'jump';
    } else if (!isOnGround && velocityY > 0) {
      nextState = 'fall';
    } else if (velocityX > 18) {
      nextState = 'run';
    }

    if (nextState !== this.currentAnimation) {
      this.currentAnimation = nextState;
      this.runAnimationTimer = 0;
      this.animationFrame = 0;
    }

    if (nextState === 'run') {
      this.runAnimationTimer += this.scene.game.loop.delta || 16;
      if (this.runAnimationTimer >= 90) {
        this.runAnimationTimer = 0;
        this.animationFrame = (this.animationFrame + 1) % 4;
      }
    }

    const runFrame = nextState === 'run' ? `run-${(this.animationFrame % 4) + 1}` : null;
    const textureName = nextState === 'idle'
      ? 'player-stickman-idle'
      : nextState === 'run'
        ? `player-stickman-${runFrame}`
        : nextState === 'jump'
          ? 'player-stickman-jump'
          : nextState === 'fall'
            ? 'player-stickman-fall'
            : nextState === 'crouch'
              ? 'player-stickman-crouch'
              : nextState === 'shoot'
                ? 'player-stickman-shoot'
                : 'player-stickman-hit';

    if (this.texture.key !== textureName) {
      this.setTexture(textureName);
    }

    this.setScale(this.flipX ? -1 : 1, 1);
    this.setRotation(0);
  }

  private static createTextures(scene: Phaser.Scene): void {
    if (scene.textures.exists('player-stickman-idle')) {
      return;
    }

    const createPose = (key: string, bodyTopY: number, bodyBottomY: number, leftArm: [number, number, number, number], rightArm: [number, number, number, number], leftLeg: [number, number, number, number], rightLeg: [number, number, number, number], headYOffset = 0): void => {
      const graphics = scene.add.graphics();
      graphics.fillStyle(0xf4f4f4, 1);
      graphics.fillCircle(32, 14 + headYOffset, 11);
      graphics.lineStyle(5, 0xf4f4f4, 1);
      graphics.lineBetween(32, bodyTopY, 32, bodyBottomY);
      graphics.lineBetween(leftArm[0], leftArm[1], leftArm[2], leftArm[3]);
      graphics.lineBetween(rightArm[0], rightArm[1], rightArm[2], rightArm[3]);
      graphics.lineBetween(leftLeg[0], leftLeg[1], leftLeg[2], leftLeg[3]);
      graphics.lineBetween(rightLeg[0], rightLeg[1], rightLeg[2], rightLeg[3]);
      graphics.generateTexture(key, 64, 72);
      graphics.destroy();
    };

    createPose('player-stickman-idle', 26, 54, [32, 35, 18, 44], [32, 35, 46, 44], [32, 54, 20, 68], [32, 54, 43, 68]);
    createPose('player-stickman-run-1', 28, 54, [32, 34, 22, 46], [32, 34, 46, 26], [32, 54, 22, 68], [32, 54, 42, 60]);
    createPose('player-stickman-run-2', 30, 54, [32, 34, 20, 54], [32, 34, 45, 44], [32, 54, 24, 62], [32, 54, 40, 68]);
    createPose('player-stickman-run-3', 28, 54, [32, 34, 42, 46], [32, 34, 22, 26], [32, 54, 38, 68], [32, 54, 23, 60]);
    createPose('player-stickman-run-4', 30, 54, [32, 34, 46, 54], [32, 34, 20, 44], [32, 54, 40, 62], [32, 54, 24, 68]);
    createPose('player-stickman-jump', 26, 54, [32, 33, 20, 24], [32, 33, 42, 22], [32, 54, 26, 60], [32, 54, 38, 60]);
    createPose('player-stickman-fall', 26, 54, [32, 35, 22, 20], [32, 35, 42, 20], [32, 54, 26, 66], [32, 54, 38, 66]);
    createPose('player-stickman-crouch', 26, 48, [32, 32, 22, 42], [32, 32, 42, 42], [32, 48, 25, 60], [32, 48, 39, 60], 2);
    createPose('player-stickman-shoot', 26, 54, [32, 33, 18, 43], [32, 33, 46, 42], [32, 54, 22, 68], [32, 54, 42, 68]);
    createPose('player-stickman-hit', 26, 54, [32, 35, 18, 48], [32, 35, 46, 48], [32, 54, 20, 68], [32, 54, 44, 68]);
  }
}
