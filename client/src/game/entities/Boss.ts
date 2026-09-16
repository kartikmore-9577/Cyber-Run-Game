import Phaser from 'phaser';

export type BossState = 'IDLE' | 'ATTACKING' | 'DEFEATED';

export class Boss {
  public readonly maxHealth = 5;
  public currentHealth = 5;
  public readonly hitbox: Phaser.GameObjects.Rectangle;
  public readonly projectiles: Phaser.Physics.Arcade.Group;
  public state: BossState = 'IDLE';

  private readonly scene: Phaser.Scene;
  private readonly visual: Phaser.GameObjects.Container;
  private readonly hearts: Phaser.GameObjects.Text;
  private readonly target: () => Phaser.Physics.Arcade.Sprite;
  private readonly onDefeated: () => void;
  private readonly onProjectileFired?: () => void;
  private attackTimer?: Phaser.Time.TimerEvent;
  private readonly attackInterval = 3000;
  private readonly projectileSpeed = 200;
  private readonly originX: number;
  private readonly originY: number;

  public constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    target: () => Phaser.Physics.Arcade.Sprite,
    onDefeated: () => void,
    onProjectileFired?: () => void,
  ) {
    this.scene = scene;
    this.target = target;
    this.onDefeated = onDefeated;
    this.onProjectileFired = onProjectileFired;
    this.originX = x;
    this.originY = y;
    this.visual = this.createVisual();
    this.visual.setPosition(x, y).setDepth(6);

    this.hitbox = scene.add.rectangle(x, y, 150, 190, 0x000000, 0);
    scene.physics.add.existing(this.hitbox);
    const body = this.hitbox.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false).setImmovable(true).setSize(150, 190);

    scene.add.text(x, y - 130, 'THE CYBER THREAT', {
      color: '#f4f4f4',
      fontFamily: 'Arial',
      fontSize: '22px',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(7);
    this.hearts = scene.add.text(x, y - 95, '', {
      color: '#f4f4f4',
      fontFamily: 'Arial',
      fontSize: '24px',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(7);
    this.updateHearts();

    this.projectiles = scene.physics.add.group({ allowGravity: false });
    Boss.createProjectileTexture(scene);
  }

  public startAttacking(): void {
    if (this.state === 'DEFEATED' || this.attackTimer) return;
    this.state = 'ATTACKING';
    this.attackTimer = this.scene.time.addEvent({
      delay: this.attackInterval,
      loop: true,
      callback: () => this.fireProjectile(),
    });
  }

  public update(time: number): void {
    if (this.state === 'DEFEATED') return;
    const bobY = this.originY + Math.sin(time / 700) * 16;
    const bobX = this.originX + Math.sin(time / 1300) * 60;
    this.hitbox.setPosition(bobX, bobY);
    (this.hitbox.body as Phaser.Physics.Arcade.Body).reset(bobX - 75, bobY - 95);
    this.visual.setPosition(bobX, bobY);
    this.hearts.setPosition(bobX, bobY - 95);
  }

  public takeDamageFromPlayerBullet(): void {
    if (this.state === 'DEFEATED' || this.currentHealth <= 0) return;
    this.currentHealth -= 1;
    this.updateHearts();
    this.scene.cameras.main.flash(80, 255, 255, 255);
    if (this.currentHealth === 0) this.defeat();
  }

  public defeat(): void {
    if (this.state === 'DEFEATED') return;
    this.state = 'DEFEATED';
    this.attackTimer?.remove();
    this.attackTimer = undefined;
    this.projectiles.clear(true, true);
    (this.hitbox.body as Phaser.Physics.Arcade.Body).enable = false;
    this.hitbox.setActive(false).setVisible(false);
    this.visual.setVisible(false);
    this.hearts.setVisible(false);
    this.onDefeated();
  }

  private fireProjectile(): void {
    if (this.state !== 'ATTACKING') return;
    const target = this.target();
    const angle = Phaser.Math.Angle.Between(this.hitbox.x, this.hitbox.y, target.x, target.y - 30);
    const projectile = this.projectiles.create(
      this.hitbox.x + Math.cos(angle) * 78,
      this.hitbox.y + Math.sin(angle) * 78,
      'boss-projectile',
    ) as Phaser.Physics.Arcade.Image;
    projectile.setActive(true).setVisible(true).setAngle(Phaser.Math.RadToDeg(angle));
    const body = projectile.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false).setEnable(true).setVelocity(
      Math.cos(angle) * this.projectileSpeed,
      Math.sin(angle) * this.projectileSpeed,
    );
    this.onProjectileFired?.();
  }

  private updateHearts(): void {
    this.hearts.setText(`${'♥ '.repeat(this.currentHealth)}${'♡ '.repeat(this.maxHealth - this.currentHealth)}`.trim());
  }

  private createVisual(): Phaser.GameObjects.Container {
    const visual = this.scene.add.container(0, 0);
    const hood = this.scene.add.graphics();
    hood.fillStyle(0x111111, 1).lineStyle(5, 0xf4f4f4, 1);
    const points = [
      new Phaser.Geom.Point(0, -92), new Phaser.Geom.Point(-58, -42),
      new Phaser.Geom.Point(-48, 72), new Phaser.Geom.Point(0, 100),
      new Phaser.Geom.Point(48, 72), new Phaser.Geom.Point(58, -42),
    ];
    hood.fillPoints(points, true).strokePoints([...points, points[0]], true);
    const face = this.scene.add.graphics();
    face.fillStyle(0x020202, 1).fillTriangle(-42, -28, 42, -28, 0, 52);
    face.fillStyle(0xd83939, 1)
      .fillTriangle(-28, -12, -5, -6, -30, 2)
      .fillTriangle(28, -12, 5, -6, 30, 2);
    face.lineStyle(4, 0xd83939, 0.8).strokeCircle(0, 38, 24);
    const core = this.scene.add.graphics();
    core.fillStyle(0x8f2424, 0.8).lineStyle(3, 0xf4f4f4, 0.8)
      .fillCircle(0, 115, 34).strokeCircle(0, 115, 34)
      .lineBetween(-25, 115, 25, 115).lineBetween(0, 90, 0, 140);
    visual.add([hood, face, core]);
    this.scene.tweens.add({ targets: core, alpha: 0.35, duration: 420, yoyo: true, repeat: -1 });
    return visual;
  }

  private static createProjectileTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists('boss-projectile')) return;
    const shard = scene.add.graphics();
    shard.fillStyle(0x8f2424, 1).lineStyle(2, 0xd83939, 1);
    shard.fillTriangle(0, 10, 30, 0, 30, 20).strokeTriangle(0, 10, 30, 0, 30, 20);
    shard.generateTexture('boss-projectile', 30, 20);
    shard.destroy();
  }
}
