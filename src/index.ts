import {Engine} from "@babylonjs/core";
import {createScene} from "./scene";

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const engine = new Engine(canvas, true);
const scene = createScene(canvas, engine);

engine.runRenderLoop(function() {
	scene.render();
});

window.addEventListener('resize', function() {
	engine.resize();
});
