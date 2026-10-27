import {it,expect} from 'vitest';
import {stickVector} from '../src/ui/TouchControls';

it('mantém a zona neutra e limita a diagonal para manobras precisas',()=>{
  expect(stickVector(0,0,40)).toEqual({x:0,y:0});
  expect(stickVector(1,1,40)).toEqual({x:0,y:0});
  const diagonal=stickVector(100,-100,40);
  expect(Math.hypot(diagonal.x,diagonal.y)).toBeCloseTo(.7);
  expect(diagonal.x).toBeGreaterThan(0);expect(diagonal.y).toBeLessThan(0);
});
it('mantém comandos graduais e trata área sem tamanho',()=>{
  expect(stickVector(40,0,40).x).toBeCloseTo(.7);
  const half=stickVector(20,0,40).x;
  expect(half).toBeGreaterThan(0);expect(half).toBeLessThan(.7);
  expect(stickVector(10,10,0)).toEqual({x:0,y:0});
});
