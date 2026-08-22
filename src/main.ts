import { Raidline } from "./game";
import "./style.css";

const canvas = document.getElementById("view") as HTMLCanvasElement;
const game = new Raidline(canvas);
Object.assign(window, { raidline: game });
