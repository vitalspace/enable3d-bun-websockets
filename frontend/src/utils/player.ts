import {
  ExtendedObject3D,
  THREE,
  ThirdPersonControls,
  PointerLock,
  PointerDrag,
} from "enable3d";

const isTouchDevice = "ontouchstart" in window;

interface Position {
  x: string;
  y: string;
  z: string;
}

export class AddPlayer {
  canJump: boolean;
  move: boolean;
  moveTop: number;
  moveRight: number;
  man: any;
  controls: any;

  socket?: any;
  self: any;
  id: string;
  position: Position;
  havePhysics?: boolean;

  keys: {
    w: { isDown: boolean };
    a: { isDown: boolean };
    s: { isDown: boolean };
    d: { isDown: boolean };
    space: { isDown: boolean };
  };

  constructor(
    scene: any,
    id: string,
    postion: Position,
    havePhysics?: boolean,
    socket?: WebSocket
  ) {
    this.socket = socket;
    this.id = id;
    this.position = postion;
    this.havePhysics = havePhysics;

    this.self = scene;
    this.canJump = true;
    this.move = false;

    this.moveTop = 0;
    this.moveRight = 0;
    this.keys = {
      w: { isDown: false },
      a: { isDown: false },
      s: { isDown: false },
      d: { isDown: false },
      space: { isDown: false },
    };
  }

  async init() {
    const object = await this.self.load.gltf("man");
    const man = object.scene.children[0];

    this.man = new ExtendedObject3D();
    this.man.uuid = this.id;
    this.man.name = "man";
    this.man.add(man);
    this.man.position.set(this.position.x, this.position.y, this.position.z);

    this.man.traverse(
      (child: {
        isMesh: any;
        castShadow: boolean;
        receiveShadow: boolean;
        material: { roughness: number; metalness: number };
      }) => {
        if (child.isMesh) {
          child.castShadow = child.receiveShadow = false;
          child.material.roughness = 1;
          child.material.metalness = 0;
        }
      }
    );

    this.self.animationMixers.add(this.man.anims.mixer);
    object.animations.forEach((animation: { name: any }) => {
      if (animation.name) {
        this.man.anims.add(animation.name, animation);
      }
    });

    this.man.anims.play("idle");
    this.self.add.existing(this.man);

    if (this.havePhysics) {
      this.self.physics.add.existing(this.man, {
        shape: "sphere",
        radius: 0.25,
        width: 0.5,
        offset: { y: -0.25 },
      });

      this.man.body.setFriction(0.8);
      this.man.body.setAngularFactor(0, 0, 0);

      this.man.body.setCcdMotionThreshold(1e-7);
      this.man.body.setCcdSweptSphereRadius(0.25);

      this.controls = new ThirdPersonControls(this.self.camera, this.man, {
        offset: new THREE.Vector3(0, 1, 0),
        targetRadius: 3,
      });
      this.controls.theta = 90;

      if (!isTouchDevice) {
        let pl = new PointerLock(this.self.canvas);
        let pd = new PointerDrag(this.self.canvas);
        pd.onMove((delta: { x: number; y: number }) => {
          if (pl.isLocked()) {
            this.controls.update(delta.x * 2, delta.y * 2);
          }
        });
      }

      const press = (e: KeyboardEvent, isDown: boolean) => {
        e.preventDefault();
        const { keyCode } = e;
        switch (keyCode) {
          case 87: // w
            this.keys.w.isDown = isDown;
            break;
          case 38: // arrow up
            this.keys.w.isDown = isDown;
            break;
          case 32: // space
            this.keys.space.isDown = isDown;
            break;
        }
      };

      document.addEventListener("keydown", (e) => press(e, true));
      document.addEventListener("keyup", (e) => press(e, false));
    }
  }

  jump() {
    if (!this.man || !this.canJump) return;
    this.canJump = false;
    this.man.anims.play("jump_running", 500, false);
    setTimeout(() => {
      this.canJump = true;
      this.man.anims.play("idle");
    }, 650);
    this.man.body.applyForceY(6);
  }

  async update(time: any, delta: any) {
    if (this.man && this.man.body && this.havePhysics) {
      this.controls.update(this.moveRight * 2, -this.moveTop * 2);

      const speed = 4;
      const v3 = new THREE.Vector3();

      const rotation = this.self.camera.getWorldDirection(v3);
      const theta = Math.atan2(rotation.x, rotation.z);
      const rotationMan = this.man.getWorldDirection(v3);
      const thetaMan = Math.atan2(rotationMan.x, rotationMan.z);
      this.man.body.setAngularVelocityY(0);

      const l = Math.abs(theta - thetaMan);
      let rotationSpeed = isTouchDevice ? 2 : 4;
      let d = Math.PI / 24;

      if (l > d) {
        if (l > Math.PI - d) rotationSpeed *= -1;
        if (theta < thetaMan) rotationSpeed *= -1;
        this.man.body.setAngularVelocityY(rotationSpeed);
      }

      if (this.keys.w.isDown || this.move) {
        if (this.man.anims.current === "idle" && this.canJump)
          this.man.anims.play("run");

        const x = Math.sin(theta) * speed,
          y = this.man.body.velocity.y,
          z = Math.cos(theta) * speed;

        this.man.body.setVelocity(x, y, z);
      } else {
        if (this.man.anims.current === "run" && this.canJump)
          this.man.anims.play("idle");
      }

      if (this.keys.space.isDown && this.canJump) {
        this.jump();
      }

      const currentPosition = {
        x: this.man.position.x,
        y: this.man.position.y,
        z: this.man.position.z,
        r: this.man.rotation,
        animation: this.man.anims.current,
      };

      this.socket.send(
        JSON.stringify({ type: "playerMovement", position: currentPosition })
      );
    }
  }
}
