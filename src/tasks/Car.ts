import {ArcRotateCamera, Axis, Mesh, Quaternion, Scene, Space, TransformNode} from "@babylonjs/core";
import {BehaviorSubject} from "rxjs";
import {IMoveable} from "./IMoveable";
import {IHavingWheels} from "./IHavingWheels";
import {MoveActionObserver} from "./MoveActionObserver";

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
	private currentRotationWheelAngle: number;

	private readonly maxWheelTurnAngle = Math.PI / 4;

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

	constructor(private rootNode: TransformNode, private scene: Scene) {
		this.check();
		this.applyMaterials();
		this.setWheelsDirectly();
		this.currentRotationWheelAngle = 0;
		this.wheelDiameter = this.calcWheelDiameter();
		this.calcSpeed();

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

	private go(){
		const engine = this.scene.getEngine();
		this.scene.registerBeforeRender(() => {
			// console.log(this.angleFrequencyWheel, engine.getFps(), this.angleFrequencyWheel / engine.getFps())
			let fps = engine.getFps();
			let angle = this.angleFrequencyWheel / fps;

			// крутим колеса
			this.wheels.forEach((node, type) => {
				let newAngle = angle;
				if(type == WheelMap.BackRight || type == WheelMap.FrontRight){
					newAngle = 0 - angle;
				}

				node.addRotation(node.rotation.x + newAngle, node.rotation.y, node.rotation.z);
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
			}else{
				let delta = 0.001;
				if(this.currentWheelAngle > 0){
					delta = 0 - delta;
				}

				this.currentWheelAngle += delta;
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

		this.currentRotationWheelAngle += angle;

		if(Math.abs(this.currentRotationWheelAngle) > maxRotation){
			this.currentRotationWheelAngle = angle < 0 ? -maxRotation : maxRotation;
			return;
		}

		[WheelMap.FrontRight, WheelMap.FrontLeft].forEach(wheelType => {
			const wheelNode = this.wheels.get(wheelType);
			if(wheelNode == null){
				return;
			}

			wheelNode.rotate(Axis.Y, angle, Space.WORLD);
		})
	}
}
