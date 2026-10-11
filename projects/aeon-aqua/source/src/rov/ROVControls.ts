import type { ROV, ROVCommands } from './ROV';
const KEYS = new Set(['KeyW','KeyS','KeyA','KeyD','KeyR','KeyF','KeyQ','KeyE','Space']);
export class ROVControls {
  private readonly pressed = new Set<string>();
  private commands: ROVCommands = { forward:0,lateral:0,vertical:0,yaw:0 };
  private touch: ROVCommands = { forward:0,lateral:0,vertical:0,yaw:0 };
  private touchTool = false;
  private readonly down = (e: KeyboardEvent) => { if(e.target instanceof Element && (e.target.closest('input,textarea,select,[contenteditable]') || e.code==='Space' && e.target.closest('button')))return; if(KEYS.has(e.code)){e.preventDefault();this.pressed.add(e.code);} };
  private readonly up = (e: KeyboardEvent) => this.pressed.delete(e.code);
  private readonly blur = () => this.clear();
  constructor(private readonly rov: ROV) { window.addEventListener('keydown',this.down);window.addEventListener('keyup',this.up);window.addEventListener('blur',this.blur); }
  setTouchCommands(commands:ROVCommands){this.touch={...commands};}
  setTouchTool(active:boolean){this.touchTool=active;}
  update() { const has=(k:string)=>this.pressed.has(k);const clamp=(v:number)=>Math.max(-1,Math.min(1,v));this.commands={forward:clamp(Number(has('KeyW'))-Number(has('KeyS'))+this.touch.forward),lateral:clamp(Number(has('KeyD'))-Number(has('KeyA'))+this.touch.lateral),vertical:clamp(Number(has('KeyR'))-Number(has('KeyF'))+this.touch.vertical),yaw:clamp(Number(has('KeyE'))-Number(has('KeyQ'))+this.touch.yaw)};this.rov.applyCommands(this.commands); }
  getCommands():ROVCommands{return {...this.commands};} clear(){this.pressed.clear();this.touch={forward:0,lateral:0,vertical:0,yaw:0};this.touchTool=false;this.commands={forward:0,lateral:0,vertical:0,yaw:0};this.rov.applyCommands(this.commands);}
  get toolActive(){return this.pressed.has('Space')||this.touchTool;}
  dispose(){window.removeEventListener('keydown',this.down);window.removeEventListener('keyup',this.up);window.removeEventListener('blur',this.blur);}
}
