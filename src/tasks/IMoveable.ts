import {Observable} from "rxjs";

export interface IMoveable {
	readonly speed$: Observable<number>;
	getMaxSpeed(): number;
	setDirectionObserver(mask: Observable<number>): void;
}
