import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { ComicMessageSystem } from '../systems/ComicMessageSystem';
import { HUD } from '../ui/HUD';
import { MobileControls } from '../ui/MobileControls';

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private hazards!: Phaser.Physics.Arcade.Group;
  private ddosWave!: Phaser.GameObjects.Rectangle;
  private checkpoint!: Phaser.GameObjects.Rectangle;
  private checkpoints!: Phaser.Physics.Arcade.StaticGroup;
  private gunPickup!: Phaser.GameObjects.Rectangle;
  private boss!: Phaser.GameObjects.Rectangle;
  private bossVisual!: Phaser.GameObjects.Container;
  private bossHeartsText!: Phaser.GameObjects.Text;
  private bossProjectiles!: Phaser.Physics.Arcade.Group;
  private bullets!: Phaser.Physics.Arcade.Group;
  private readonly maxBossHealth = 5;
  private readonly bossProjectileSpeed = 260;
  private gunCollected = false;
  private currentBossHealth = this.maxBossHealth;
  private lastBossAttack = 0;
  private bossDefeated = false;
  private gunWarningShown = false;
  private bossLowHealthShown = false;
  private finalAttackShown = false;
  private paused = false;
  private pauseOverlay!: Phaser.GameObjects.Container;
  private comic!: ComicMessageSystem;
  private hud!: HUD;
  private mobile!: MobileControls;
  private health = 3;
  private score = 0;
  private checkpointSpawnX = 140;
  // The player's 64px body rests on the red path line at y=600.
  private checkpointSpawnY = 536;
  private invulnerableUntil = 0;
  private checkpointIndex = 0;
  private threatWarningShown = false;
  private readonly ddosPackets: Phaser.GameObjects.Rectangle[] = [];
  private readonly checkpointPositions = [4700, 7200, 9800];
  private readonly sectionWarnings = new Set<number>();
  private nextBulletId = 1;

  public constructor() {
    super('GameScene');
  }

  private checkBulletBossBounds(): void {
    const bossBody = this.boss.body as Phaser.Physics.Arcade.Body;
    if (!this.boss.active || !bossBody.enable) return;
    this.bullets.children.each((child) => {
      const bullet = child as Phaser.Physics.Arcade.Image;
      const bulletBody = bullet.body as Phaser.Physics.Arcade.Body | null;
      if (bullet.active && bulletBody?.enable
        && Phaser.Geom.Intersects.RectangleToRectangle(
          new Phaser.Geom.Rectangle(bulletBody.x, bulletBody.y, bulletBody.width, bulletBody.height),
          new Phaser.Geom.Rectangle(bossBody.x, bossBody.y, bossBody.width, bossBody.height),
        )) {
        this.hitBoss(bullet, this.boss);
      }
      return true;
    });
  }

  public create(): void {
    const worldWidth = 13200;
    this.createProjectileTextures();
    this.physics.world.setBounds(0, 0, worldWidth, 720);
    this.createBackground(worldWidth);
    const platforms = this.createPlatforms(worldWidth);
    this.createHazards();

    this.player = new Player(this, this.checkpointSpawnX, this.checkpointSpawnY);
    this.physics.add.collider(this.player, platforms);
    this.physics.add.overlap(this.player, this.hazards, (_player, hazard) => this.damage(hazard as Phaser.GameObjects.GameObject));
    this.physics.add.overlap(this.player, this.checkpoints, (_player, checkpoint) => {
      this.reachCheckpoint(checkpoint as Phaser.GameObjects.Rectangle);
    });
    this.physics.add.overlap(this.player, this.ddosWave, () => this.damage(this.ddosWave));
    this.physics.add.overlap(this.player, this.gunPickup, () => this.collectGun());
    this.physics.add.overlap(this.player, this.bossProjectiles, (_player, projectile) => {
      const shard = projectile as Phaser.Physics.Arcade.Image;
      if (!shard.active || !shard.body) return;
      shard.setActive(false).setVisible(false);
      (shard.body as Phaser.Physics.Arcade.Body).enable = false;
      this.damage(shard);
    });
    this.physics.add.overlap(this.bullets, this.boss, (_bullet, boss) => {
      this.hitBoss(_bullet as Phaser.Physics.Arcade.Image, this.boss);
    });

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = {
      left: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      up: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      space: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      down: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      shoot: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F),
    };
    this.input.on('pointerdown', () => {
      if (!this.paused) this.shoot();
    });

    this.comic = new ComicMessageSystem(this);
    this.hud = new HUD(this);
    this.mobile = new MobileControls(this);
    this.createPauseOverlay();
    this.input.keyboard!.on('keydown-ESC', this.togglePause, this);
    this.hud.update(this.health, this.score);
    this.comic.show('SURVIVE THE THREATS. KEEP MOVING.', 1900);

    this.cameras.main.setBounds(0, 0, worldWidth, 720);
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08, -260, 0);
    this.cameras.main.setDeadzone(360, 220);
  }

  public update(time: number): void {
    if (this.paused) return;
    const left = this.keys.left.isDown || this.cursors.left.isDown || this.mobile.state.left;
    const right = this.keys.right.isDown || this.cursors.right.isDown || this.mobile.state.right;
    const jumpPressed = Phaser.Input.Keyboard.JustDown(this.keys.up)
      || Phaser.Input.Keyboard.JustDown(this.keys.space)
      || Phaser.Input.Keyboard.JustDown(this.cursors.up)
      || this.mobile.state.jump;
    this.player.update(left, right, jumpPressed, this.keys.down.isDown || this.cursors.down.isDown || this.mobile.state.crouch);
    if (this.player.y > 760) this.respawn();
    this.updateCheckpointProgress();

    if (this.ddosWave.active) {
      this.ddosWave.x -= 2.4;
      if (this.ddosWave.x < this.player.x - 500) this.ddosWave.x = this.player.x + 900;
      this.ddosPackets.forEach((packet, index) => {
        packet.x = this.ddosWave.x - 48 + index * 24;
        packet.y = this.ddosWave.y - 45 + (index % 2) * 82;
      });
    }
    this.cleanupProjectiles();
    if (this.player.x > 600 && !this.threatWarningShown) {
      this.threatWarningShown = true;
      this.comic.show('THREAT ZONE AHEAD — STAY ALERT.', 1300);
    }
    this.showSectionWarning(1, 5200, 'SECURITY GATE AHEAD — FIND A SAFE ROUTE.');
    this.showSectionWarning(2, 7600, 'DATA BREACH ZONE — WATCH THE FALLING FRAGMENTS.');
    this.showSectionWarning(3, 9000, 'RANSOMWARE LOCKDOWN — KEEP MOVING.');
    if (this.player.x > 10400 && !this.gunCollected && !this.gunWarningShown) {
      this.gunWarningShown = true;
      this.comic.show('CYBER GUN AHEAD — YOU WILL NEED IT.', 1400);
    }
    if (this.gunCollected && !this.bossDefeated) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.shoot) || this.mobile.state.shoot) this.shoot();
      this.updateBoss(time);
    }
    this.player.syncGun();
    this.checkBulletBossBounds();
    if (time < this.invulnerableUntil) this.player.setAlpha(0.55 + Math.sin(time / 60) * 0.35);
    else this.player.setAlpha(1);
  }

  private createBackground(worldWidth: number): void {
    this.add.rectangle(worldWidth / 2, 360, worldWidth, 720, 0x242424);
    for (let x = 0; x < worldWidth; x += 360) {
      const height = 120 + ((x / 360) % 4) * 45;
      this.add.rectangle(x + 150, 600 - height / 2, 250, height, 0x303030);
      this.add.rectangle(x + 120, 560 - height / 2, 10, 10, 0x8c8c8c);
      this.add.rectangle(x + 175, 560 - height / 2, 10, 10, 0x8c8c8c);
      this.add.text(x + 20, 155, 'SERVER // NODE', { color: '#555555', fontSize: '14px', fontFamily: 'Arial' });
    }
    this.add.text(460, 200, 'CYBER DISTRICT', { color: '#777777', fontSize: '30px', fontStyle: 'bold' });
    this.add.text(5200, 200, 'SECURITY SECTOR', { color: '#777777', fontSize: '30px', fontStyle: 'bold' });
    this.add.text(7600, 200, 'BREACH ZONE', { color: '#777777', fontSize: '30px', fontStyle: 'bold' });
    this.add.text(9000, 200, 'LOCKDOWN CORE', { color: '#777777', fontSize: '30px', fontStyle: 'bold' });
    this.add.text(11100, 200, 'FINAL THREAT ARENA', { color: '#777777', fontSize: '30px', fontStyle: 'bold' });
  }

  private createPlatforms(worldWidth: number): Phaser.Physics.Arcade.StaticGroup {
    const platforms = this.physics.add.staticGroup();
    const ground = this.add.rectangle(worldWidth / 2, 660, worldWidth, 120, 0x3a3a3a);
    this.physics.add.existing(ground, true);
    platforms.add(ground);
    this.add.rectangle(worldWidth / 2, 598, worldWidth, 8, 0xd83939);
    [[760, 500, 260], [1420, 440, 300], [2200, 510, 260], [2780, 410, 300], [3600, 480, 360], [4400, 390, 300],
      [5400, 470, 280], [6100, 390, 260], [6900, 500, 320], [7550, 420, 260], [8250, 470, 340], [9000, 390, 280], [9700, 470, 330],
      [10400, 470, 300], [11300, 500, 300], [12200, 430, 360]]
      .forEach(([x, y, width]) => {
        const platform = this.add.rectangle(x, y, width, 24, 0x555555).setStrokeStyle(3, 0xbdbdbd);
        this.physics.add.existing(platform, true);
        platforms.add(platform);
      });
    return platforms;
  }

  private createHazards(): void {
    this.hazards = this.physics.add.group({ allowGravity: false, immovable: true });
    this.checkpoints = this.physics.add.staticGroup();
    this.addHazard(1020, 568, '⚠ PHISHING\nCLICK TO VERIFY!', 'phishing');
    this.addHazard(1880, 570, 'MALWARE\n.exe', 'malware');
    this.addHazard(3350, 570, '⚠ PHISHING\nTRAP', 'phishing');
    this.addHazard(5450, 568, 'ACCESS\nDENIED', 'gate');
    this.addHazard(6450, 568, 'WEAK\nPASSWORD', 'password');
    this.addHazard(8750, 568, 'RANSOMWARE\nLOCKED', 'ransomware');
    const malware = this.add.rectangle(2450, 560, 58, 58, 0xd83939).setStrokeStyle(4, 0xf4f4f4);
    this.physics.add.existing(malware);
    malware.setData('hazardType', 'malware');
    this.hazards.add(malware);
    this.tweens.add({ targets: malware, x: 2600, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.add.text(2400, 500, 'MALWARE // PATROL', { color: '#f4f4f4', fontSize: '16px', fontStyle: 'bold' });
    this.add.text(2440, 545, '✕', { color: '#111111', fontSize: '28px', fontStyle: 'bold' });
    this.addThreatFace(2450, 560, 1);

    this.ddosWave = this.add.rectangle(3000, 555, 90, 70, 0xd83939).setStrokeStyle(4, 0xf4f4f4);
    this.physics.add.existing(this.ddosWave);
    this.ddosWave.setData('hazardType', 'ddos');
    const ddosBody = this.ddosWave.body as Phaser.Physics.Arcade.Body;
    ddosBody.setAllowGravity(false).setImmovable(true);
    for (let index = 0; index < 5; index += 1) {
      this.ddosPackets.push(this.add.rectangle(2950 + index * 24, 510 + (index % 2) * 82, 14, 14, 0xd83939)
        .setStrokeStyle(2, 0x777777));
    }
    this.add.text(2920, 455, 'DDoS WAVE', { color: '#f4f4f4', fontSize: '18px', fontStyle: 'bold' });
    this.checkpoint = this.add.rectangle(this.checkpointPositions[0], 530, 34, 130, 0xf4f4f4).setStrokeStyle(5, 0xd83939);
    this.physics.add.existing(this.checkpoint);
    this.checkpoints.add(this.checkpoint);
    const checkpointBody = this.checkpoint.body as Phaser.Physics.Arcade.Body;
    checkpointBody.setAllowGravity(false).setImmovable(true);
    this.add.text(this.checkpointPositions[0] - 80, 440, '[ CHECKPOINT 1 ]', { color: '#f4f4f4', fontSize: '18px', fontStyle: 'bold' });
    this.addCheckpoint(this.checkpointPositions[1], 2);
    this.addCheckpoint(this.checkpointPositions[2], 3);

    for (const x of [7950, 8050, 8150, 9250, 9350, 9450]) {
      const fragment = this.add.rectangle(x, 320, 18, 18, 0xd83939).setStrokeStyle(2, 0xf4f4f4);
      this.physics.add.existing(fragment);
      const body = fragment.body as Phaser.Physics.Arcade.Body;
      body.setAllowGravity(false).setImmovable(true);
      this.hazards.add(fragment);
      this.tweens.add({ targets: fragment, y: 560, duration: 1100 + (x % 3) * 200, yoyo: true, repeat: -1 });
    }
    this.bullets = this.physics.add.group({ allowGravity: false });
    this.bossProjectiles = this.physics.add.group({ allowGravity: false, immovable: true });
    this.gunPickup = this.add.rectangle(10600, 545, 92, 32, 0xf4f4f4).setStrokeStyle(4, 0xd83939);
    this.physics.add.existing(this.gunPickup);
    (this.gunPickup.body as Phaser.Physics.Arcade.Body).setAllowGravity(false).setImmovable(true);
    this.add.text(10510, 475, 'CYBER GUN', { color: '#f4f4f4', fontSize: '20px', fontStyle: 'bold' });
    this.add.text(10525, 515, 'PRESS F / CLICK', { color: '#d83939', fontSize: '14px', fontStyle: 'bold' });
    this.boss = this.add.rectangle(11950, 505, 150, 190, 0x090909).setStrokeStyle(5, 0xd83939);
    this.physics.add.existing(this.boss);
    (this.boss.body as Phaser.Physics.Arcade.Body)
      .setAllowGravity(false)
      .setImmovable(true)
      .setSize(150, 190)
      .setOffset(0, 0);
    this.bossVisual = this.createBossVisual();
    this.bossVisual.setPosition(this.boss.x, this.boss.y).setDepth(6);
    this.add.text(11850, 375, 'THE CYBER THREAT', { color: '#f4f4f4', fontSize: '22px', fontStyle: 'bold' });
    this.bossHeartsText = this.add.text(11950, 410, '', {
      color: '#f4f4f4',
      fontFamily: 'Arial',
      fontSize: '24px',
      fontStyle: 'bold',
    }).setOrigin(0.5).setVisible(false);
    this.updateBossHearts();
  }

  private addHazard(x: number, y: number, label: string, hazardType: string): void {
    const hazard = this.add.text(x, y, label, {
      color: '#f4f4f4', backgroundColor: '#8f2424', fontFamily: 'Arial', fontSize: '15px',
      fontStyle: 'bold', align: 'center', padding: { left: 10, right: 10, top: 8, bottom: 8 },
    }).setOrigin(0.5);
    this.physics.add.existing(hazard);
    const body = hazard.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false).setImmovable(true);
    hazard.setData('hazardType', hazardType);
    this.hazards.add(hazard);
    this.addThreatFace(x, y - 2, 0.8);
  }

  private addThreatFace(x: number, y: number, scale: number): void {
    const face = this.add.graphics().setDepth(5);
    face.fillStyle(0x090909, 1);
    face.fillTriangle(x - 17 * scale, y - 6 * scale, x - 4 * scale, y - 1 * scale, x - 18 * scale, y + 5 * scale);
    face.fillTriangle(x + 17 * scale, y - 6 * scale, x + 4 * scale, y - 1 * scale, x + 18 * scale, y + 5 * scale);
    face.lineStyle(3 * scale, 0x090909, 1);
    face.beginPath();
    face.moveTo(x - 15 * scale, y + 13 * scale);
    face.lineTo(x - 8 * scale, y + 18 * scale);
    face.lineTo(x, y + 12 * scale);
    face.lineTo(x + 8 * scale, y + 18 * scale);
    face.lineTo(x + 15 * scale, y + 13 * scale);
    face.strokePath();
  }

  private damage(source: Phaser.GameObjects.GameObject): void {
    if (this.time.now < this.invulnerableUntil) return;
    this.health -= 1;
    this.score = Math.max(0, this.score - 25);
    this.invulnerableUntil = this.time.now + 1200;
    this.hud.update(this.health, this.score);
    this.cameras.main.flash(150, 210, 45, 45);
    const hazardType = source.getData('hazardType') as string;
    const message = hazardType === 'ddos'
      ? 'TOO MUCH TRAFFIC! — DDoS ATTACK'
      : hazardType === 'malware'
        ? "THAT FILE ISN'T WHAT IT SEEMS! — MALWARE DETECTED"
        : hazardType === 'gate'
          ? 'ACCESS DENIED — FIND A VALID ROUTE'
          : hazardType === 'password'
            ? '123456? SERIOUSLY? — WEAK PASSWORD'
            : hazardType === 'ransomware'
              ? 'THE FILES ARE LOCKED! — RANSOMWARE'
                  : hazardType === 'boss'
                    ? 'INCOMING DATA SHARD!'
                  : hazardType === 'breach'
                ? 'THE DATA IS LEAKING! — DATA BREACH'
                : "WAIT... THAT LINK LOOKS SUSPICIOUS! — PHISHING";
    this.comic.show(message, 1600);
    if (this.health <= 0) this.respawn();
  }

  private respawn(): void {
    this.comic.show('YOU GOT CAUGHT! — RESPAWNING...', 1200);
    this.health = 3;
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    playerBody.reset(this.checkpointSpawnX, this.checkpointSpawnY);
    this.player.setPosition(this.checkpointSpawnX, this.checkpointSpawnY);
    this.player.setVelocity(0, 0);
    this.invulnerableUntil = this.time.now + 1500;
    this.bossProjectiles?.clear(true, true);
    this.hud.update(this.health, this.score);
  }

  private reachCheckpoint(checkpoint: Phaser.GameObjects.Rectangle): void {
    const nextCheckpoint = this.checkpointPositions[this.checkpointIndex];
    if (this.checkpointIndex >= this.checkpointPositions.length || checkpoint.x !== nextCheckpoint) return;
    this.saveCheckpoint(nextCheckpoint);
  }

  private updateCheckpointProgress(): void {
    const nextCheckpoint = this.checkpointPositions[this.checkpointIndex];
    if (this.checkpointIndex >= this.checkpointPositions.length || this.player.x < nextCheckpoint) return;
    this.saveCheckpoint(nextCheckpoint);
  }

  private saveCheckpoint(x: number): void {
    this.checkpointIndex += 1;
    this.checkpointSpawnX = x;
    this.checkpointSpawnY = 536;
    this.addScore(250);
    this.comic.show(`CHECKPOINT ${this.checkpointIndex} REACHED — PROGRESS SAVED`, 1800);
  }

  private collectGun(): void {
    if (this.gunCollected) return;
    this.gunCollected = true;
    this.gunPickup.setVisible(false).setActive(false);
    (this.gunPickup.body as Phaser.Physics.Arcade.Body).enable = false;
    this.player.equipGun();
    this.bossHeartsText.setVisible(true);
    this.comic.show('ENOUGH RUNNING. TIME TO FIGHT BACK.', 1800);
  }

  private shoot(): void {
    if (!this.gunCollected || this.bossDefeated) return;
    const direction = Math.sign(this.boss.x - this.player.x) || 1;
    this.player.setFlipX(direction < 0);
    this.player.syncGun();
    const bullet = this.bullets.get(
      this.player.x + direction * 44,
      this.player.y - 38,
      'player-bullet',
    ) as Phaser.Physics.Arcade.Image;
    if (!bullet) return;
    bullet.setData('bulletId', this.nextBulletId);
    this.nextBulletId += 1;
    bullet.setActive(true).setVisible(true);
    const body = bullet.body as Phaser.Physics.Arcade.Body;
    body.reset(this.player.x + direction * 44, this.player.y - 38);
    body.setAllowGravity(false).setEnable(true);
    body.setVelocity(direction * 760, 0);
    body.setSize(18, 18);
    body.setOffset(0, 0);
    console.log('[SHOT]', 'bulletId=', bullet.getData('bulletId'), 'active=', bullet.active, 'x=', bullet.x, 'y=', bullet.y);
  }

  private updateBoss(time: number): void {
    if (this.currentBossHealth <= 0) return;
    this.boss.x = 11950 + Math.sin(time / 900) * 90;
    this.boss.y = 505 + Math.sin(time / 420) * 24;
    (this.boss.body as Phaser.Physics.Arcade.Body).reset(this.boss.x, this.boss.y);
    (this.boss.body as Phaser.Physics.Arcade.Body).setSize(150, 190).setOffset(0, 0);
    this.bossVisual.setPosition(this.boss.x, this.boss.y);
    this.bossHeartsText.setPosition(this.boss.x, this.boss.y - 95);
    if (time > this.lastBossAttack + 1050) {
      this.lastBossAttack = time;
      const angle = Phaser.Math.Angle.Between(this.boss.x, this.boss.y - 20, this.player.x, this.player.y - 30);
      const projectile = this.bossProjectiles.create(
        this.boss.x + Math.cos(angle) * 78,
        this.boss.y - 20 + Math.sin(angle) * 78,
        'boss-shard',
      ) as Phaser.Physics.Arcade.Image;
      projectile.setActive(true).setVisible(true).setAngle(Phaser.Math.RadToDeg(angle));
      const body = projectile.body as Phaser.Physics.Arcade.Body;
      body.setAllowGravity(false).setEnable(true);
      body.setVelocity(
        Math.cos(angle) * this.bossProjectileSpeed,
        Math.sin(angle) * this.bossProjectileSpeed,
      );
      projectile.setData('hazardType', 'boss');
      if (this.currentBossHealth <= 2 && !this.finalAttackShown) {
        this.finalAttackShown = true;
        this.comic.show('FINAL ATTACK INCOMING!', 1500);
      } else if (this.currentBossHealth > 2) {
        this.comic.show('INCOMING DATA SHARD!', 700);
      }
    }
  }

  private hitBoss(bullet: Phaser.GameObjects.GameObject, boss: Phaser.GameObjects.GameObject): void {
    const playerBullet = bullet as Phaser.Physics.Arcade.Image;
    const bossBody = boss.body as Phaser.Physics.Arcade.Body;
    if (this.bossDefeated || !boss.active || !playerBullet.active || !playerBullet.body || !bossBody.enable) return;
    console.log('[BOSS COLLISION]', 'bulletId=', playerBullet.getData('bulletId'));
    console.log('[DAMAGE BEFORE]', this.currentBossHealth);
    playerBullet.setActive(false).setVisible(false);
    (playerBullet.body as Phaser.Physics.Arcade.Body).enable = false;
    this.takeDamageFromPlayerBullet();
    console.log('[DAMAGE AFTER]', this.currentBossHealth);
    console.log('[BULLET REMOVED]', 'bulletId=', playerBullet.getData('bulletId'));
    this.cameras.main.flash(80, 255, 255, 255);
    if (this.currentBossHealth <= 0) {
      this.bossDefeated = true;
      const bossRectangle = boss as Phaser.GameObjects.Rectangle;
      bossRectangle.setActive(false).setVisible(false);
      this.bossVisual.setVisible(false);
      bossBody.enable = false;
      this.bossHeartsText.setVisible(false);
      this.score += 1000;
      this.hud.update(this.health, this.score);
      this.comic.show('CYBER THREAT DEFEATED — DIGITAL FRAGMENTS SECURED!', 3000);
        for (let index = 0; index < 14; index += 1) {
          const fragment = this.add.rectangle(this.boss.x, this.boss.y, 12, 12, index % 2 ? 0xd83939 : 0xf4f4f4);
          this.tweens.add({ targets: fragment, x: fragment.x + Phaser.Math.Between(-220, 220), y: fragment.y + Phaser.Math.Between(-180, 180), alpha: 0, duration: 900, onComplete: () => fragment.destroy() });
        }

    }
  }

  private takeDamageFromPlayerBullet(): void {
    if (this.currentBossHealth <= 0) return;
    this.currentBossHealth -= 1;
    this.updateBossHearts();
    console.log('PLAYER BULLET HIT BOSS HEARTS LEFT:', this.currentBossHealth);
  }

  private updateBossHearts(): void {
    if (!this.bossHeartsText) return;
    const fullHearts = '♥ '.repeat(this.currentBossHealth).trim();
    const emptyHearts = '♡ '.repeat(this.maxBossHealth - this.currentBossHealth).trim();
    this.bossHeartsText.setText([fullHearts, emptyHearts].filter(Boolean).join(' '));
  }

  private createBossVisual(): Phaser.GameObjects.Container {
    const visual = this.add.container(0, 0);
              const hood = this.add.graphics();
              hood.fillStyle(0x111111, 1);
              hood.lineStyle(5, 0xf4f4f4, 1);
              hood.fillPoints([
                new Phaser.Geom.Point(0, -92),
                new Phaser.Geom.Point(-58, -42),
                new Phaser.Geom.Point(-48, 72),
                new Phaser.Geom.Point(0, 100),
                new Phaser.Geom.Point(48, 72),
                new Phaser.Geom.Point(58, -42),
              ], true);
              hood.strokePoints([
                new Phaser.Geom.Point(0, -92),
                new Phaser.Geom.Point(-58, -42),
                new Phaser.Geom.Point(-48, 72),
                new Phaser.Geom.Point(0, 100),
                new Phaser.Geom.Point(48, 72),
                new Phaser.Geom.Point(58, -42),
                new Phaser.Geom.Point(0, -92),
              ], true);

              const face = this.add.graphics();
              face.fillStyle(0x020202, 1);
              face.fillTriangle(-42, -28, 42, -28, 0, 52);
              face.fillStyle(0xd83939, 1);
              face.fillTriangle(-28, -12, -5, -6, -30, 2);
              face.fillTriangle(28, -12, 5, -6, 30, 2);
              face.lineStyle(4, 0xd83939, 0.8);
              face.strokeCircle(0, 38, 24);

              const core = this.add.graphics();
              core.fillStyle(0x8f2424, 0.8);
              core.lineStyle(3, 0xf4f4f4, 0.8);
              core.fillCircle(0, 115, 34);
              core.strokeCircle(0, 115, 34);
              core.lineBetween(-25, 115, 25, 115);
              core.lineBetween(0, 90, 0, 140);

              visual.add([hood, face, core]);
              this.tweens.add({
                targets: core,
                alpha: 0.35,
                duration: 420,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.inOut',
              });
    return visual;
  }

  private createProjectileTextures(): void {
    if (!this.textures.exists('player-bullet')) {
      const bullet = this.add.graphics();
      bullet.fillStyle(0xd83939, 1);
      bullet.lineStyle(2, 0xf4f4f4, 1);
      bullet.fillCircle(9, 9, 7);
      bullet.strokeCircle(9, 9, 7);
      bullet.generateTexture('player-bullet', 18, 18);
      bullet.destroy();
    }
    if (!this.textures.exists('boss-shard')) {
      const shard = this.add.graphics();
      shard.fillStyle(0x8f2424, 1);
      shard.lineStyle(2, 0xd83939, 1);
      shard.fillTriangle(0, 10, 30, 0, 30, 20);
      shard.strokeTriangle(0, 10, 30, 0, 30, 20);
      shard.generateTexture('boss-shard', 30, 20);
      shard.destroy();
    }
  }

  private cleanupProjectiles(): void {
    this.bullets?.children.each((child) => {
          const projectile = child as Phaser.GameObjects.GameObject & { x: number; y: number };
          if (projectile.x < 0 || projectile.x > this.physics.world.bounds.width
            || projectile.y < 0 || projectile.y > this.physics.world.bounds.height) {
            projectile.destroy();
          }
          return true;
    });
    this.bossProjectiles?.children.each((child) => {
          const projectile = child as Phaser.GameObjects.GameObject & { x: number; y: number };
          if (projectile.x < 0 || projectile.x > this.physics.world.bounds.width
            || projectile.y < 0 || projectile.y > this.physics.world.bounds.height) projectile.destroy();
          return true;
    });
  }

  private createPauseOverlay(): void {
    const { width, height } = this.scale;
    const panel = this.add.rectangle(width / 2, height / 2, 420, 180, 0x111111, 0.94)
      .setStrokeStyle(3, 0xd83939);
    const title = this.add.text(width / 2, height / 2 - 24, 'GAME PAUSED', {
      color: '#f4f4f4',
      fontFamily: 'Arial',
      fontSize: '32px',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    const hint = this.add.text(width / 2, height / 2 + 28, 'PRESS ESC TO RESUME', {
      color: '#d83939',
      fontFamily: 'Arial',
      fontSize: '17px',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.pauseOverlay = this.add.container(0, 0, [panel, title, hint])
      .setScrollFactor(0)
      .setDepth(30)
      .setVisible(false);
  }

  private togglePause(): void {
    this.paused = !this.paused;
    this.pauseOverlay.setVisible(this.paused);
    if (this.paused) {
      this.physics.pause();
      this.tweens.pauseAll();
    } else {
      this.physics.resume();
      this.tweens.resumeAll();
      this.player.syncGun();
    }
  }

  private addCheckpoint(x: number, number: number): void {
    const marker = this.add.rectangle(x, 530, 34, 130, 0xf4f4f4).setStrokeStyle(5, 0xd83939);
    this.physics.add.existing(marker);
    this.checkpoints.add(marker);
    const body = marker.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false).setImmovable(true);
    this.add.text(x - 80, 440, `[ CHECKPOINT ${number} ]`, { color: '#f4f4f4', fontSize: '18px', fontStyle: 'bold' });
  }

  private showSectionWarning(section: number, x: number, message: string): void {
    if (this.player.x > x && !this.sectionWarnings.has(section)) {
      this.sectionWarnings.add(section);
      this.comic.show(message, 1500);
    }
  }

  private addScore(points: number): void {
    this.score += points;
    this.hud.update(this.health, this.score);
  }
}
