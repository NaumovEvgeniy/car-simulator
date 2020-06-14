import {
	ActionManager,
	ArcRotateCamera,
	Color3,
	Mesh,
	MeshBuilder,
	PointLight,
	Scene,
	SceneLoader,
	SpotLight,
	StandardMaterial,
	Vector3
} from "@babylonjs/core";
import {Car} from "./Car";
import {Speedometer} from "./Speedometer";
import {MoveActionObserver} from "./MoveActionObserver";
import {IMoveable} from "./IMoveable";

export class City {
	private car?: Car;

	private moveActionObserver: MoveActionObserver;

	constructor(private scene: Scene) {
		this.scene.actionManager = new ActionManager(this.scene);
		this.moveActionObserver = new MoveActionObserver(this.scene);
	}

	public async draw(){
		this.prepareCamera();
		this.prepareLight();
		await this.prepareGround();
		await this.prepareModel();
	}

	private prepareLight(){
		const light = new PointLight('point', new Vector3(0, 300, 0), this.scene);
		if(this.scene.activeCamera !== null) {
			this.scene.registerBeforeRender(() => {
				light.position = this.scene.activeCamera?.position || Vector3.Zero();
			});
		}
	}

	// TODO: нарисовать землю с height map
	private async prepareGround(){
		// await SceneLoader.AppendAsync('/models/terrain/', 'scene.gltf', this.scene);
		const ground = MeshBuilder.CreateGround('ground', {
			width: 1000,
			height: 1000,
		})

		ground.position.y = -68;

		const material = new StandardMaterial('ground-material', this.scene);
		material.diffuseColor = Color3.Green();
		ground.material = material;
	}

	private async prepareModel(){
		await SceneLoader.ImportMeshAsync('', '/models/car/', 'scene.gltf', this.scene)
		const carNode = this.scene.getTransformNodeByID('BMW i8.fbx');
		if(!carNode){
			return;
		}
		const car = new Car(carNode, this.scene);
		this.car = car;
		this.moveActionObserver.direction$.subscribe(mask => car.setDirectionMask(mask));
		this.prepareSpeedometer(car);
	}

	private prepareSpeedometer(moveable: IMoveable) {
		const speedometer = new Speedometer(moveable);
		speedometer.printCurrentSpeedLabel(this.scene);
	}

	private prepareCamera() {
		// this.scene.activeCamera.
		// this.scene.activeCamera.position = new Vector3(-10, 211, -400);
		const arcCamera = new ArcRotateCamera('arc-camera', 0, 0, 500, Vector3.Zero(), this.scene)
		let canvas = this.scene.getEngine().getRenderingCanvas();
		if(canvas) {
			arcCamera.attachControl(canvas, true)
		}
		this.scene.activeCamera = arcCamera;
	}
}
