import {
	ArcRotateCamera,
	Axis,
	BoundingBox,
	Color3,
	Matrix,
	Mesh,
	MeshBuilder,
	Quaternion,
	Scene,
	Space,
	StandardMaterial,
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

	public readonly speed$ = new BehaviorSubject<number>(0);

	private readonly wheelAngle = new BehaviorSubject<number>(0);

	private pivotPosition$: Observable<Vector3>;

	private directionMask = MoveActionObserver.Direction.None;

	/**
	 * Размеры машины
	 */
	private size: Size;

	private rootNode: TransformNode;

	constructor(rootNode: TransformNode, private scene: Scene) {
		this.rootNode = rootNode.getChildTransformNodes(true)[0];

		// проверка всех элементов в моделе
		this.check();

		// применение материалов для машины
		this.applyMaterials();

		// ставим колеса ровно
		this.setWheelsDirectly();

		// расчитываем диаметр колес
		this.wheelDiameter = this.calcWheelDiameter();

		// обсервер для изменения положения точки врещения
		this.pivotPosition$ = this.getPivotPosition$();

		// размер машины
		this.size = this.getCarSize();

		// установка вращения
		this.setPivot();

		this.calcSpeed();

		GLS.AddAxises(this.rootNode, this.scene, 500);

		this.go();
	}

	private setPivot(){
		let pivotSphere = MeshBuilder.CreateSphere('pivot-point', {
			diameter: 30,
		}, this.scene)
		let pivotMaterial = new StandardMaterial('pivot-material', this.scene);
		pivotMaterial.diffuseColor = Color3.Red();
		pivotSphere.material = pivotMaterial;
		pivotSphere.parent = this.rootNode;

		this.pivotPosition$.subscribe(pos => {
			pivotSphere.position = pos
			this.rootNode.setPivotMatrix(Matrix.Translation(-pos.x, -pos.y, -pos.z))
		})

		let flw = this.wheels.get(WheelMap.FrontLeft);
		if(flw){
			GLS.AddAxises(flw, this.scene, 500)
		}
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
		const getSizeByAxle = (key: keyof Vector3) => (boundingBox.maximumWorld[key] as number) - (boundingBox.minimumWorld[key] as number);
		return {
			length: getSizeByAxle('z'),
			width: getSizeByAxle('x'),
			height: getSizeByAxle('y')
		};
	}

	private go(){
		const engine = this.scene.getEngine();
		this.scene.registerBeforeRender(() => {

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
			// умножаем на 100, т.к. одна клетка - сантиметр
			let deltaSpeed = this.meterPerSecondSpeed * 100 / fps;
			// this.rootNode.position.z += deltaSpeed;

			// console.log((Math.PI / 2 - this.currentRotationWheelAngle.value) * deltaSpeed, deltaSpeed);

			let carAngleSpeed = deltaSpeed / this.size.length * this.currentRotationWheelAngle.value;

			if(carAngleSpeed !== 0) {
				this.rootNode.rotate(Axis.Y, carAngleSpeed, Space.WORLD)
			}

			if(this.scene.activeCamera && this.scene.activeCamera instanceof ArcRotateCamera){
				this.scene.activeCamera.target.z = this.rootNode.position.z;
			}
		});
	}

	public getMaxSpeed(): number {
		return 50;
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

	public setDirectionObserver(mask$: Observable<number>): void {
		mask$.subscribe(value => this.directionMask = value);
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
			}else{
				let v = currentSpeedValue;
				// есжи нажать кнопка назад, сбрасываем скорость или едим назад
				if (this.directionMask & MoveActionObserver.Direction.Backward) {
					v -= stopsSpeedDelta;
				} else {
					// если ичего не зажато, то катимся. если катимся назад, то прибавляем скорость и наоборот
					isReverse
						? v += rollDownSpeedDelta
						: v -= rollDownSpeedDelta;
				}

				// если скорость меньше дельты, когда она катится, то ставим 0, чтобы не было скорости типо 0.001
				if (Math.abs(v) <= rollDownSpeedDelta) {
					v = 0;
				}
				if (v !== 0 || this.speed$.value !== 0) {
					this.speed$.next(v);
				}
			}

			if(this.directionMask & MoveActionObserver.Direction.Right){
				this.rotateWheelAngle(-0.03);
			}
			if(this.directionMask & MoveActionObserver.Direction.Left){
				this.rotateWheelAngle(0.03);
			}
		});
	}

	private rotateWheelAngle(angle: number){
		const maxAngle = Math.PI / 6;
		let curAngle = this.currentRotationWheelAngle.value;
		let newAngle = curAngle + angle;
		if(Math.abs(newAngle) > maxAngle){
			newAngle = newAngle < 0 ? -maxAngle : maxAngle;
		}

		if(curAngle !== newAngle) {
			this.currentRotationWheelAngle.next(newAngle);

			[WheelMap.FrontRight, WheelMap.FrontLeft].forEach(wheelType => {
				const wheelNode = this.wheels.get(wheelType);
				if(wheelNode == null){
					return;
				}

				wheelNode.rotate(Axis.Y, angle, Space.WORLD);
			})
		}
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

	private getPivotPosition$(): Observable<Vector3> {
		return new Observable<Vector3>(subscriber => {
			this.currentRotationWheelAngle.subscribe(angle => {
				let x = this.size.length * Math.tan(Math.PI / 2 - angle);
				subscriber.next(new Vector3(x, 0, -(this.size.length / 2)));
			})
		})
	}
}
