export interface MissionInput {
  distance: number;
  speed: number;
  alignment: number;
  toolActive: boolean;
  collision: boolean;
}

export const MISSION_STEPS = ['Aproximar', 'Inspecionar', 'Cortar a rede', 'Verificar'] as const;

export class PropellerMission {
  stage = 0;
  elapsed = 0;
  inspectTime = 0;
  cutTime = 0;
  verifyTime = 0;
  collisions = 0;
  private collisionCooldown = 0;
  get finished() { return this.stage === 4; }
  get cutProgress() { return Math.min(1, this.cutTime / 4); }
  get score() { return Math.max(0, Math.round(1000 - this.collisions * 100 - Math.max(0, this.elapsed - 120) * 5)); }

  update(input: MissionInput, dt: number) {
    if (this.finished || dt <= 0) return;
    this.elapsed += dt;
    this.collisionCooldown = Math.max(0, this.collisionCooldown - dt);
    if (input.collision && this.collisionCooldown === 0) {
      this.collisions++; this.collisionCooldown = 1;
    }
    const inspecting = input.distance < 4 && input.speed < .5 && input.alignment > .85;
    switch (this.stage) {
      case 0:
        if (input.distance < 4 && input.speed < .35) this.stage = 1;
        break;
      case 1:
        this.inspectTime = inspecting ? this.inspectTime + dt : 0;
        if (this.inspectTime >= 3) this.stage = 2;
        break;
      case 2:
        if (inspecting && input.distance < 3.2 && input.toolActive) this.cutTime += dt;
        if (this.cutTime >= 4) this.stage = 3;
        break;
      case 3:
        const verifying = inspecting && input.distance > 3.2 && !input.toolActive;
        this.verifyTime = verifying ? this.verifyTime + dt : 0;
        if (this.verifyTime >= 2) this.stage = 4;
    }
  }

  get hint() {
    return [
      'Chegue a menos de 4 m e reduza a velocidade abaixo de 0,35 m/s.',
      'Aponte a frente do ROV para a rede por 3 s, a menos de 4 m.',
      'A menos de 3,2 m do centro da hélice, segure Espaço por 4 s, devagar e apontando para a rede.',
      'Solte Espaço e recue para 3,2–4 m. Inspecione a hélice livre por 2 s.',
      'Missão concluída! Reinicie para tentar melhorar sua pontuação.'
    ][this.stage];
  }
}
