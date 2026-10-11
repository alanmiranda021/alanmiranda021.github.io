import type {ROVControls} from '../rov/ROVControls';

/** Circular dead zone, clamped diagonal travel, and reduced power for close maneuvering. */
export function stickVector(dx:number,dy:number,radius:number){
  if(radius<=0)return {x:0,y:0};
  const distance=Math.hypot(dx,dy),fraction=Math.min(1,distance/radius);
  if(fraction<.08)return {x:0,y:0};
  const power=(fraction-.08)/.92*.7;
  return {x:dx/distance*power,y:dy/distance*power};
}

export function createTouchControls(controls:ROVControls){
  const values={forward:0,lateral:0,vertical:0,yaw:0};
  const cleanup:Array<()=>void>=[],resetters:Array<()=>void>=[];
  function stick(id:string,apply:(x:number,y:number)=>void){
    const element=document.getElementById(id),knob=element?.querySelector<HTMLElement>('.stick-knob');
    if(!element || !knob)return;
    let pointer:number|null=null;
    const reset=()=>{
      pointer=null;knob.style.transform='translate(-50%,-50%)';apply(0,0);
      element.classList.remove('active');
    };
    const move=(event:PointerEvent)=>{
      if(event.pointerId!==pointer)return;
      const rect=element.getBoundingClientRect(),radius=rect.width/2-18;
      const dx=event.clientX-rect.left-rect.width/2,dy=event.clientY-rect.top-rect.height/2;
      const factor=Math.min(1,radius/Math.max(1,Math.hypot(dx,dy)));
      knob.style.transform=`translate(calc(-50% + ${dx*factor}px),calc(-50% + ${dy*factor}px))`;
      const value=stickVector(dx,dy,radius);apply(value.x,value.y);
    };
    const down=(event:PointerEvent)=>{
      if(pointer!==null)return;
      event.preventDefault();pointer=event.pointerId;element.setPointerCapture(pointer);
      element.classList.add('active');move(event);
    };
    const up=(event:PointerEvent)=>{if(event.pointerId===pointer)reset();};
    element.addEventListener('pointerdown',down);element.addEventListener('pointermove',move);
    for(const name of ['pointerup','pointercancel','lostpointercapture'])element.addEventListener(name,up as EventListener);
    resetters.push(reset);cleanup.push(()=>{
      element.removeEventListener('pointerdown',down);element.removeEventListener('pointermove',move);
      for(const name of ['pointerup','pointercancel','lostpointercapture'])element.removeEventListener(name,up as EventListener);
    });
  }
  stick('move-stick',(x,y)=>{values.lateral=x;values.forward=-y;controls.setTouchCommands(values);});
  stick('depth-stick',(x,y)=>{values.yaw=x;values.vertical=-y;controls.setTouchCommands(values);});
  const cutter=document.getElementById('touch-cutter');
  let cutterPointer:number|null=null;
  const resetTool=()=>{cutterPointer=null;controls.setTouchTool(false);cutter?.setAttribute('aria-pressed','false');};
  if(cutter){
    const down=(event:PointerEvent)=>{
      if(cutterPointer!==null)return;
      event.preventDefault();cutterPointer=event.pointerId;cutter.setPointerCapture(event.pointerId);
      controls.setTouchTool(true);cutter.setAttribute('aria-pressed','true');
    };
    const up=(event:PointerEvent)=>{if(event.pointerId===cutterPointer)resetTool();};
    cutter.addEventListener('pointerdown',down);
    for(const name of ['pointerup','pointercancel','lostpointercapture'])cutter.addEventListener(name,up as EventListener);
    cleanup.push(()=>{cutter.removeEventListener('pointerdown',down);for(const name of ['pointerup','pointercancel','lostpointercapture'])cutter.removeEventListener(name,up as EventListener);});
  }
  const reset=()=>{resetters.forEach(fn=>fn());resetTool();};
  const visibility=()=>{if(document.hidden)reset();};
  window.addEventListener('blur',reset);document.addEventListener('visibilitychange',visibility);
  return {reset,dispose(){reset();cleanup.forEach(fn=>fn());window.removeEventListener('blur',reset);document.removeEventListener('visibilitychange',visibility);}};
}
