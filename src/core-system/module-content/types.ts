import { Define } from "./define.js"
import { Func } from "./func.js"
import { Struct } from "./struct.js"
import { Uniform } from "./uniform";
import { Variable } from "./variable.js"

export type ModuleEntity = Func | Define | Struct | Variable | Uniform;