import {ActionManager, ExecuteCodeAction, Scene} from "@babylonjs/core";
import {BehaviorSubject} from "rxjs";

export class MoveActionObserver {

	public static readonly Direction = {
		None: 0,
		Forward: 1,
		Backward: 2,
		Right: 4,
		Left: 8
	};

	public readonly direction$ = new BehaviorSubject<number>(MoveActionObserver.Direction.None);

	constructor(private scene: Scene) {
		if(!scene.actionManager){
			throw 'Не активный actionManager у сцены';
		}
		this.registerEvents();
	}

	private registerEvents() {
		this.scene.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnKeyUpTrigger, (evt) => {
			const sourceEvent = evt.sourceEvent as KeyboardEvent;
			let mask = this.direction$.value;
			switch (sourceEvent.code) {
				case 'KeyW':
					mask = mask &~ MoveActionObserver.Direction.Forward; break;
				case 'KeyS':
					mask = mask &~ MoveActionObserver.Direction.Backward; break;
				case 'KeyA':
					mask = mask &~ MoveActionObserver.Direction.Left; break;
				case 'KeyD':
					mask = mask &~ MoveActionObserver.Direction.Right; break;
			}

			this.fireEvent(mask);
		}));
		this.scene.actionManager.registerAction(new ExecuteCodeAction(ActionManager.OnKeyDownTrigger, (evt) => {
			const sourceEvent = evt.sourceEvent as KeyboardEvent;
			let mask = this.direction$.value;
			switch (sourceEvent.code) {
				case 'KeyW':
					mask |= MoveActionObserver.Direction.Forward; break;
				case 'KeyS':
					mask |= MoveActionObserver.Direction.Backward; break;
				case 'KeyA':
					mask |= MoveActionObserver.Direction.Left; break;
				case 'KeyD':
					mask |= MoveActionObserver.Direction.Right; break;
			}
			this.fireEvent(mask);
		}));
	}


	private fireEvent(mask: number) {
		// if(this.direction$.value !== mask){
			this.direction$.next(mask);
		// }
	}
}
