export const FIXED_STEP = 1/60;
export class FixedStepper {
  private accumulator = 0;
  advance(elapsed: number, step: (dt: number)=>void) {
    this.accumulator += Math.max(0,Math.min(elapsed,0.1));
    while (this.accumulator+1e-10 >= FIXED_STEP) {
      step(FIXED_STEP); this.accumulator=Math.max(0,this.accumulator-FIXED_STEP);
    }
  }
  reset() { this.accumulator=0; }
}
export function createLoop(step:(dt:number)=>void,render:(dt:number)=>void) {
  const fixed=new FixedStepper(); let previous=performance.now(), frameId=0;
  const visibility=()=>{previous=performance.now();fixed.reset();};
  const frame=(now:number)=>{
    const elapsed=(now-previous)/1000; previous=now;
    if (!document.hidden) { fixed.advance(elapsed,step); render(Math.min(elapsed,.1)); }
    frameId=requestAnimationFrame(frame);
  };
  document.addEventListener('visibilitychange',visibility);
  frameId=requestAnimationFrame(frame);
  return {reset:visibility,stop(){cancelAnimationFrame(frameId);document.removeEventListener('visibilitychange',visibility);}};
}
