import type { ROV, ROVCommands } from './ROV';
const KEYS = new Set(['KeyW','KeyS','KeyA','KeyD','KeyR','KeyF','KeyQ','KeyE','Space']);
export class ROVControls {
  private readonly pressed = new Set<string>();
  private commands: ROVCommands = { forward:0,lateral:0,vertical:0,yaw:0 };
  private readonly down = (e: KeyboardEvent) => { if(KEYS.has(e.code)){e.preventDefault();this.pressed.add(e.code);} };
  private readonly up = (e: KeyboardEvent) => this.pressed.delete(e.code);
  private readonly blur = () => this.clear();
  constructor(private readonly rov: ROV) { window.addEventListener('keydown',this.down);window.addEventListener('keyup',this.up);window.addEventListener('blur',this.blur); }
  update() { const has=(k:string)=>this.pressed.has(k);this.commands={forward:Number(has('KeyW'))-Number(has('KeyS')),lateral:Number(has('KeyD'))-Number(has('KeyA')),vertical:Number(has('KeyR'))-Number(has('KeyF')),yaw:Number(has('KeyE'))-Number(has('KeyQ'))};this.rov.applyCommands(this.commands); }
  getCommands():ROVCommands{return {...this.commands};} clear(){this.pressed.clear();this.commands={forward:0,lateral:0,vertical:0,yaw:0};this.rov.applyCommands(this.commands);}
  get toolActive(){return this.pressed.has('Space');}
  dispose(){window.removeEventListener('keydown',this.down);window.removeEventListener('keyup',this.up);window.removeEventListener('blur',this.blur);}
}
