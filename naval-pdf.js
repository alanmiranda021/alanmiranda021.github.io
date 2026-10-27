/* Vector PDF reports: original numerical samples and provenance are embedded as JSON. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.NavalPDF=api;})(typeof window==='undefined'?null:window,function(){
  'use strict';
  const clean=value=>String(value??'—').replace(/η/g,'eta').replace(/τ/g,'tau').replace(/σ/g,'sigma').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7e]/g,' ');
  const literal=value=>'('+clean(value).replace(/([\\()])/g,'\\$1')+')';
  const number=value=>Number.isFinite(value)?Number(value).toPrecision(15):'indisponivel';
  const text=(value,x,y,size=10)=>`BT /F1 ${size} Tf ${x} ${y} Td ${literal(value)} Tj ET\n`;
  function graph(samples,field,label,point,y){
    const x0=65,y0=y,w=460,h=125;
    const valid=samples.filter(row=>Number.isFinite(row[field]));
    const xmax=Math.max(1,...samples.map(row=>row.J),point.J||0);
    let low=Math.min(0,...valid.map(row=>row[field])),high=Math.max(0,...valid.map(row=>row[field]));
    if(high===low)high=low+1;
    const pad=(high-low)*.08;low-=pad;high+=pad;
    const X=j=>x0+j/xmax*w,Y=v=>y0+(v-low)/(high-low)*h;
    let out=text(label+' em funcao de J',x0,y0+h+18,12);
    out+='0.85 G 0.5 w\n';
    for(let i=0;i<=5;i++){
      const xx=x0+i*w/5,yy=y0+i*h/5;
      out+=`${xx} ${y0} m ${xx} ${y0+h} l S ${x0} ${yy} m ${x0+w} ${yy} l S\n`;
      out+='0 g\n'+text((xmax*i/5).toFixed(2),xx-8,y0-15,8)+text((low+(high-low)*i/5).toPrecision(3),15,yy-2,8)+'0.85 G\n';
    }
    out+='0 G 0 g '+text('J',x0+w+8,y0-15,10);
    out+='q '+`${x0} ${y0} ${w} ${h} re W n\n0.08 0.35 0.65 RG 1.3 w\n`;
    let segment=false;
    for(const row of samples){const v=row[field];if(!Number.isFinite(v)){if(segment)out+='S\n';segment=false;continue;}out+=`${X(row.J)} ${Y(v)} ${segment?'l':'m'}\n`;segment=true;}
    if(segment)out+='S\n';
    if(Number.isFinite(point[field])&&Number.isFinite(point.J))out+=`0.8 0.15 0.1 rg ${X(point.J)-3} ${Y(point[field])-3} 6 6 re f\n`;
    out+='Q\n0 g 0 G\n';
    return out;
  }
  function pagesFor(report){
    const pages=[];
    let page=text(report.title||'Relatorio cientifico de propulsao',45,800,18);
    let y=770;
    const lines=[`Data UTC: ${report.timestamp||new Date().toISOString()}`, ...(report.notes||[])];
    for(const line of lines){for(let i=0;i<clean(line).length;i+=90){page+=text(clean(line).slice(i,i+90),45,y);y-=15;if(y<60){pages.push(page);page='';y=800;}}}
    pages.push(page);
    for(const entry of report.entries||[]){
      const row=entry.row;
      if(!row){
        let empty=text(entry.title,45,800,17),yy=765;
        const diagnostic=entry.category?{status:entry.category.status,contagens:entry.category.contagens_rodada,ae_ao_min:entry.category.area_min,ae_ao_max:entry.category.area_max,representante_rejeitado:entry.category.representante_rejeitado}:{};
        for(const line of [entry.status||'Sem candidato hidrodinamico; nenhuma curva inventada.',...JSON.stringify(diagnostic,null,2).split('\n')]){
          for(let start=0;start<Math.max(1,line.length);start+=90){empty+=text(line.slice(start,start+90),45,yy,9);yy-=12;if(yy<55){pages.push(empty);empty='';yy=800;}}
        }
        pages.push(empty);continue;
      }
      const samples=entry.curve.map(c=>({...c,tenKQ:Number.isFinite(c.KQ)?10*c.KQ:null}));
      const point=entry.point||{J:row.J,KT:row.KTs,KQ:row.KQs,eta0:row.eta0};
      point.tenKQ=Number.isFinite(point.KQ)?10*point.KQ:null;
      let contents=text(entry.title||`Helice Z=${row.Z}`,45,800,17);
      const metadata=[`Z=${row.Z} D=${number(row.D)} m; P/D=${number(row['P/D'])}; AE/AO=${number(row['Ae/Ao'])}`,
        `RPM=${number(row.rpm)}; J operacional=${number(point.J)}; eta0=${number(point.eta0)}`,
        `BHP=${number(row.BHP_kW)} kW/motor; MCR=${number(row.MCR_kW)} kW/motor; FOC=${number(row.FOC_t_h)} t/h`,
        `Motor: ${row.motor_proximo||row.Motores||'nao avaliado'}; compatibilidade: ${row.cabe_motor===true?'aprovado no modelo':row.cabe_motor===false?'incompativel':'nao avaliada'}`];
      metadata.forEach((line,i)=>{contents+=text(line,45,775-i*14,9);});
      contents+=graph(samples,'KT','K_T',point,530)+graph(samples,'tenKQ','10 K_Q',point,345)+graph(samples,'eta0','eta_0 (fracao)',point,160);
      contents+=text('Quadrado vermelho: ponto operacional. Linhas vetoriais; amostras completas no JSON anexo.',45,115,9);
      contents+=text(entry.method||'Modelo Serie B existente; nenhuma captura de tela.',45,98,9);
      contents+=text('eta0 omitida onde KT/KQ nao positivos, nao finita ou fora de [0,1].',45,81,9);
      pages.push(contents);
      const details={...row,diagnostico:entry.diagnostic||null,observacoes:entry.status||null};
      let extra=text('Detalhes numericos: '+(entry.title||'helice'),45,800,16),yy=770;
      for(const line of JSON.stringify(details,null,2).split('\n')){
        for(let start=0;start<Math.max(1,line.length);start+=90){extra+=text(line.slice(start,start+90),45,yy,9);yy-=12;if(yy<55){pages.push(extra);extra='';yy=800;}}
      }
      pages.push(extra);
    }
    let config=text('Configuracao e rastreabilidade',45,800,16),yy=770;
    let printedConfig=report.config||{};
    if(printedConfig.config)printedConfig={config:printedConfig.config,data_utc:printedConfig.data_utc,perfil:printedConfig.perfil,catalogo_origem:printedConfig.catalogo_origem,catalogo_sha256:printedConfig.catalogo_sha256,fontes_sha256:printedConfig.fontes_sha256};
    else if(printedConfig.context)printedConfig={...printedConfig,context:{...printedConfig.context,resistanceCurve:'Curva completa preservada no anexo JSON.'}};
    for(const line of JSON.stringify(printedConfig,null,2).split('\n')){
      for(let start=0;start<Math.max(1,line.length);start+=90){config+=text(line.slice(start,start+90),45,yy,9);yy-=12;if(yy<55){pages.push(config);config='';yy=800;}}
    }
    pages.push(config);
    return pages;
  }
  function build(report){
    const objects=[],add=s=>{objects.push(s);return objects.length;};
    const catalog=add(''),pageTree=add(''),font=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    const pageIds=[];
    for(const content of pagesFor(report)){
      const stream=add(`<< /Length ${content.length} >>\nstream\n${content}endstream`);
      pageIds.push(add(`<< /Type /Page /Parent ${pageTree} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${stream} 0 R >>`));
    }
    const bytes=new TextEncoder().encode(JSON.stringify(report,null,2));
    let embedded='';for(const byte of bytes)embedded+=String.fromCharCode(byte);
    const attachment=add(`<< /Type /EmbeddedFile /Subtype /application#2Fjson /Length ${embedded.length} >>\nstream\n${embedded}\nendstream`);
    const spec=add(`<< /Type /Filespec /F (dados_propulsao.json) /EF << /F ${attachment} 0 R >> >>`);
    objects[catalog-1]=`<< /Type /Catalog /Pages ${pageTree} 0 R /Names << /EmbeddedFiles << /Names [(dados_propulsao.json) ${spec} 0 R] >> >> >>`;
    objects[pageTree-1]=`<< /Type /Pages /Count ${pageIds.length} /Kids [${pageIds.map(id=>id+' 0 R').join(' ')}] >>`;
    let output='%PDF-1.7\n',offsets=[0];
    objects.forEach((object,i)=>{offsets.push(output.length);output+=`${i+1} 0 obj\n${object}\nendobj\n`;});
    const xref=output.length;
    output+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
    for(const offset of offsets.slice(1))output+=String(offset).padStart(10,'0')+' 00000 n \n';
    output+=`trailer\n<< /Size ${objects.length+1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Uint8Array.from(output,c=>c.charCodeAt(0));
  }
  function download(report,name){
    const url=URL.createObjectURL(new Blob([build(report)],{type:'application/pdf'}));
    const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return {build,download,pagesFor};
});
