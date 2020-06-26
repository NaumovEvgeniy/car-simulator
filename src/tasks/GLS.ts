// Поддержка всяких 3Д штук

// GL Support статика
import {Color3, Mesh, MeshBuilder, Scene, TransformNode, Vector3} from "@babylonjs/core";

class GLS {
    // Добавить оси к объекту
    public static AddAxises(obj: TransformNode, scene: Scene, aSize?: number): void {
        let size = aSize ? aSize : 1;
        let pilot_local_axisX = Mesh.CreateLines("pilot_local_axisX",
            [
                Vector3.Zero(),
                new Vector3(size, 0, 0),
                new Vector3(size * 0.95, 0.05 * size, 0),
                new Vector3(size, 0, 0),
                new Vector3(size * 0.95, -0.05 * size, 0)
            ],
            scene);
        pilot_local_axisX.color = new Color3(1, 0, 0);

        let pilot_local_axisY = Mesh.CreateLines("pilot_local_axisY",
            [
                Vector3.Zero(),
                new Vector3(0, size, 0),
                new Vector3(-0.05 * size, size * 0.95, 0),
                new Vector3(0, size, 0),
                new Vector3(0.05 * size, size * 0.95, 0)
            ],
            scene);
        pilot_local_axisY.color = new Color3(0, 1, 0);

        let pilot_local_axisZ = Mesh.CreateLines("pilot_local_axisZ",
            [
                Vector3.Zero(),
                new Vector3(0, 0, size),
                new Vector3(0, -0.05 * size, size * 0.95),
                new Vector3(0, 0, size),
                new Vector3(0, 0.05 * size, size * 0.95)
            ]
            , scene);
        pilot_local_axisZ.color = new Color3(0, 0, 1);

        var local_origin = MeshBuilder.CreateBox("axis_origin", {size: 1}, scene);
        local_origin.isVisible = false;

        pilot_local_axisX.parent = local_origin;
        pilot_local_axisY.parent = local_origin;
        pilot_local_axisZ.parent = local_origin;

        local_origin.parent = obj;
    }
}
export {GLS}
