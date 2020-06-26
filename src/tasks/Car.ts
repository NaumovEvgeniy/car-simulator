import {
	AbstractMesh,
	ArcRotateCamera,
	Axis, BoundingBox, Color3, Matrix,
	Mesh,
	MeshBuilder,
	Quaternion,
	Scene,
	Space, StandardMaterial,
	TransformNode,
	Vector3
} from "@babylonjs/core";
import {BehaviorSubject, Observable} from "rxjs";
import {IMoveable} from "./IMoveable";
import {IHavingWheels} from "./IHavingWheels";
import {MoveActionObserver} from "./MoveActionObserver";
import {GLS} from "./GLS";

interface Size {
	width: number
	height: number
	length: number
}

enum WheelMap {
	FrontLeft,
	FrontRight,
	BackLeft,
	BackRight,
}

export class Car implements IMoveable, IHavingWheels {

	/**
	 * Текущий угол поворота передних колес
	 */
	private currentRotationWheelAngle = new BehaviorSubject<number>(0);

	private mapIdNodes = new Map<string, TransformNode>();

	private wheelMap = new Map<WheelMap, string>([
		[WheelMap.FrontLeft, 'wheel.020'],
		[WheelMap.FrontRight, 'wheel.028'],
		[WheelMap.BackLeft, 'wheel.004'],
		[WheelMap.BackRight, 'wheel.012'],
	]);

	private readonly wheelDiameter: number;

	private wheels = new Map<WheelMap, TransformNode>();

	private directionMask = MoveActionObserver.Direction.None;

	public readonly speed$ = new BehaviorSubject<number>(0);

	private currentWheelAngle = 0;

	private pivotPosition$: Observable<Vector3>;

	private pivotSphere: AbstractMesh;

	/**
	 * Размеры машины
	 */
	private size: Size;

	constructor(private rootNode: TransformNode, private scene: Scene) {
		this.check();
		this.applyMaterials();
		this.setWheelsDirectly();
		this.wheelDiameter = this.calcWheelDiameter();
		this.calcSpeed();
		this.pivotPosition$ = this.getPivotPosition$();
		this.size = this.getCarSize();


		GLS.AddAxises(this.rootNode, this.scene, 500);
		/// для тестов

		this.pivotSphere = MeshBuilder.CreateSphere('pivot-point', {
			diameter: 30,
		}, this.scene)
		let pivotMaterial = new StandardMaterial('pivot-material', this.scene);
		pivotMaterial.diffuseColor = Color3.Red();
		this.pivotSphere.material = pivotMaterial;
		this.pivotSphere.parent = this.rootNode;

		console.log(this.rootNode.position)
		this.pivotPosition$.subscribe(pos => {
			this.pivotSphere.position = pos
			// this.rootNode.setPivotMatrix(Matrix.Translation(-(pos.x), -(pos.y), -(pos.z)))
		})
		//
		// cylinder.position.z = -(this.size.length / 2);
		// cylinder.position.x = -(this.size.width / 2);
		// [1,2,3,4,20].forEach((s, i) => setTimeout(() => this.speed$.next(s), i + 1000))

		this.go();
	}

	/**
	 * Скорость в метрах в секунду
	 */
	public get meterPerSecondSpeed(): number {
		return this.speed$.value * 1000 / 3600;
	}

	/**
	 * Диаметер колеса в метрах
	 */
	public get wheelDiameterInMeters(): number {
		return this.getWheelDiameter() / 100;
	}

	/**
	 * Угловая частота вращения
	 */
	public get angleFrequencyWheel(): number {
		if(this.meterPerSecondSpeed === 0){
			return 0;
		}
		return 2 * this.meterPerSecondSpeed / this.wheelDiameterInMeters;
	}

	public applyMaterials(){
		this.rootNode.getChildMeshes().forEach((mesh) => {
			const matchResult = mesh.id.match(/(Material\.\d+)/);
			if(matchResult == null){
				console.warn(`В id меша "${mesh.id}" нет информации о материале`)
				return;
			}
			const materialName = matchResult[1];
			const material = this.scene.getMaterialByID(materialName);
			if(material == null){
				console.warn(`Материала для меша "${mesh.id}" не существует`)
				return;
			}
			mesh.material = null;
		});
	}

	private fillIdNodes(){
		const transformNodes = this.rootNode.getChildTransformNodes().concat(
			this.rootNode.getChildMeshes()
		);
		transformNodes.forEach(node => {
			this.mapIdNodes.set(node.id, node);
		});
	}

	/**
	 * Проверка на существавание нужных узлов + заполнение полей
	 */
	private check(){
		this.fillIdNodes();
		this.wheelMap.forEach((wheelNodeId, wheelType) => {
			const node = this.mapIdNodes.get(wheelNodeId)
			if(!node){
				throw 'Колеса ' + wheelType + ' не существует';
			}
			this.wheels.set(wheelType, node);
		});
	}

	private getCarSize(): Size {
		const carBox = this.rootNode.getChildMeshes(false, node => node.id === 'object.001_Material.001_0')[0];
		if(!carBox){
			throw 'Не возможно определить размеры машины (нет каркаса)';
		}
		return this.getSize(carBox.getBoundingInfo().boundingBox);
	}

	private getSize(boundingBox: BoundingBox): Size {
		const getSizeByAxle = (key: keyof Vector3) => Math.abs(boundingBox.maximumWorld[key] as number) + Math.abs(boundingBox.minimumWorld[key] as number);
		return {
			length: getSizeByAxle('z'),
			width: getSizeByAxle('x'),
			height: getSizeByAxle('y')
		};
	}

	private go(){
		//
		// let cylinder = MeshBuilder.CreateSphere('pivot-point', {
		// 	diameter: 30,
		// }, this.scene)
		// let pivotMaterial = new StandardMaterial('pivot-material', this.scene);
		// pivotMaterial.diffuseColor = Color3.Red();
		// cylinder.material = pivotMaterial;
		// cylinder.parent = this.rootNode;
		//
		// cylinder.position.z = -(this.size.length / 2);
		// cylinder.position.x = -(this.size.width / 2);
		//
		// this.rootNode.setPivotMatrix(Matrix.Translation(this.size.width / 2, 0, this.size.length / 2), false)
		// this.rootNode.setPivotMatrix(Matrix.Translation(this.size.width / 2, 0, this.size.length / 2))
		// this.rootNode.setPivotMatrix(Matrix.Translation())
		// this.rootNode.setPivotPoint(new Vector3(-600, -600, -300))
		// cylinder.position =
		// end-test

		const engine = this.scene.getEngine();
		this.scene.registerBeforeRender(() => {

			// this.rootNode.rotate(Axis.Y, 0.005)

			// console.log(this.angleFrequencyWheel, engine.getFps(), this.angleFrequencyWheel / engine.getFps())
			let fps = engine.getFps();
			let angleSpeed = this.angleFrequencyWheel / fps;

			// крутим колеса
			this.wheels.forEach((node, type) => {
				let newAngleSpeed = angleSpeed;
				if(type == WheelMap.BackRight || type == WheelMap.FrontRight){
					newAngleSpeed = 0 - angleSpeed;
				}

				node.addRotation(node.rotation.x + newAngleSpeed, node.rotation.y, node.rotation.z);
			});

			// двигаем машину (пока прямо)
			// console.log('go', this.meterPerSecondSpeed / fps);
			this.rootNode.position.y -= this.meterPerSecondSpeed;

			if(this.scene.activeCamera && this.scene.activeCamera instanceof ArcRotateCamera){
				this.scene.activeCamera.target.z = 0 - this.rootNode.position.y;
			}


			// расчитаем угол поворота колеса
			if(MoveActionObserver.Direction.Left & this.directionMask){
				this.currentWheelAngle += 0.001;
			}else if(MoveActionObserver.Direction.Right & this.directionMask){
				this.currentWheelAngle -= 0.001;
			}

			this.rotateFrontWheels(this.currentWheelAngle);
		});
	}

	public getMaxSpeed(): number {
		return 180;
	}

	public getWheelDiameter(): number {
		return this.wheelDiameter;
	}

	private calcWheelDiameter() {
		const backLeftWheelId = this.wheelMap.get(WheelMap.BackLeft);
		if(!backLeftWheelId){
			throw 'Задне левого колеса не существует'
		}

		const node = this.mapIdNodes.get(backLeftWheelId + '_Material.033_0');
		if(!(node instanceof Mesh)) {
			throw 'Колесо не меш';
		}
		const mesh = node as Mesh;
		const boundingBoxInfo = mesh.getBoundingInfo();

		return Math.abs(boundingBoxInfo.maximum.y) + Math.abs(boundingBoxInfo.minimum.y);
	}

	public setDirectionMask(mask: number): void {
		this.directionMask = mask;
	}

	private calcSpeed() {
		// когда машина просто катится
		const rollDownSpeedDelta = 0.1;

		const stopsSpeedDelta = 0.5;

		this.scene.registerBeforeRender(() => {
			let currentSpeedValue = this.speed$.value;
			let isReverse = currentSpeedValue < 0;

			// если нажать клавиша вперед, то увелечиваем скорость
			if(this.directionMask & MoveActionObserver.Direction.Forward){
				this.speed$.next(currentSpeedValue + 0.5);
				return;
			}

			let v = currentSpeedValue;
			// есжи нажать кнопка назад, сбрасываем скорость или едим назад
			if(this.directionMask & MoveActionObserver.Direction.Backward){
				v -= stopsSpeedDelta;
			}else {

				// если ичего не зажато, то катимся. если катимся назад, то прибавляем скорость и наоборот
				isReverse
					? v += rollDownSpeedDelta
					: v -= rollDownSpeedDelta;
			}

			// если скорость меньше дельты, когда она катится, то ставим 0, чтобы не было скорости типо 0.001
			if(Math.abs(v) < rollDownSpeedDelta){
				v = 0;
			}
			this.speed$.next(v);
		});
	}

	private setWheelsDirectly() {
		this.wheels.forEach((node, type) => {
			let angle = 0;
			if(type == WheelMap.FrontRight || type == WheelMap.BackRight){
				angle = Math.PI;
			}
			node.rotationQuaternion = Quaternion.RotationAxis(Axis.Y, angle);
		});
	}

	private rotateFrontWheels(angle: number) {
		const maxRotation = Math.PI / 6;

		let newAngle = this.currentRotationWheelAngle.value;
		newAngle += angle;

		if(Math.abs(newAngle) > maxRotation){
			newAngle = angle < 0 ? -maxRotation : maxRotation;
			this.currentRotationWheelAngle.next(newAngle);
			return;
		}
		this.currentRotationWheelAngle.next(newAngle);

		[WheelMap.FrontRight, WheelMap.FrontLeft].forEach(wheelType => {
			const wheelNode = this.wheels.get(wheelType);
			if(wheelNode == null){
				return;
			}

			wheelNode.rotate(Axis.Y, angle, Space.WORLD);
		})
	}

	private getPivotPosition$(): Observable<Vector3> {
		return new Observable<Vector3>(subscriber => {
			this.currentRotationWheelAngle.subscribe(angle => {
				subscriber.next(new Vector3(this.size.length * Math.tan(angle), 0, -(this.size.length / 2)));
			})
		})
	}
}
