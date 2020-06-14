import {IMoveable} from "./IMoveable";
import {Scene} from "@babylonjs/core";
import {AdvancedDynamicTexture, Control, Rectangle, TextBlock} from "@babylonjs/gui";

export class Speedometer {

	constructor(private moveableItem: IMoveable) {
	}

	public printCurrentSpeedLabel(scene: Scene){

		var advancedTexture = AdvancedDynamicTexture.CreateFullscreenUI("ui1");

		var label = new Rectangle("current speed");
		label.background = "black"
		label.height = "30px";
		label.alpha = 0.5;
		label.width = "100px";
		label.cornerRadius = 20;
		label.thickness = 1;
		label.linkOffsetY = 30;
		label.top = "10%";
		label.zIndex = 5;
		label.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
		advancedTexture.addControl(label);

		var text1 = new TextBlock();
		text1.color = "white";
		label.addControl(text1);

		this.moveableItem.speed$.subscribe(speed => {
			text1.text = `${Math.ceil(speed)} km/h`;
		})
	}
}
