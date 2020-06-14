import {Observable} from "rxjs";

export interface IMoveable {
	readonly speed$: Observable<number>;
	getMaxSpeed(): number;
	setDirectionMask(mask: number): void;
}
