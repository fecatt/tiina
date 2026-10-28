import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildBjtGraphScene,parseBjtInputTable,renderBjtGraphScene,type BjtGraphData} from '../src/bjt-graph-scene.ts';

const synthetic:BjtGraphData={
 model:'analytic test transistor',
 output:[0,100e-6].map(ib_A=>({ib_A,points:[[0,ib_A*100],[10,ib_A*100+100e-6]] as Array<[number,number]>})),
 input5V:Array.from({length:101},(_,i)=>[.6+i*.005,i*1e-6] as [number,number]),
 load:{supply_V:10,rCollector_ohm:1000,rEmitter_ohm:100},
 limits:{uceMax_V:12,icMax_A:.02,pCollectorMax_W:.1}
};
const scene=buildBjtGraphScene(synthetic),ibQ=(5-.055)/110100;
assert.ok(Math.abs(scene.q.ib_A-ibQ)<1e-10);assert.equal(scene.q.uce_V,5);assert.ok(Math.abs(scene.q.ic_A-(ibQ*100+.00005))<1e-10);
assert.equal(scene.panels[1].series[0].points.length,801);
assert.deepEqual(scene.panels[2].series[0].points[0],{x:synthetic.input5V[0][1],y:synthetic.input5V[0][0]},'input graph must rotate the data coordinates');
assert.equal(scene.panels[2].x.reverse,true);assert.equal(scene.panels[2].y.reverse,true);
assert.equal(scene.timePanels.length,4);assert.ok(scene.a.ube_V<scene.q.ube_V&&scene.b.ube_V>scene.q.ube_V);
const svg=renderBjtGraphScene(scene);assert.match(svg,/data-panel="input"/);assert.match(svg,/data-projection="a"/);assert.match(svg,/iК\(t\)/);
assert.deepEqual(parseBjtInputTable('* Uбе\tIб\n0,55\t0,000001\n0,60\t0,00001'),[[.55,1e-6],[.6,1e-5]]);
assert.deepEqual(parseBjtInputTable('\uFEFFUbe,Ib\n0.55,0.000001\n0.60,0.00001'),[[.55,1e-6],[.6,1e-5]]);
const stageScene=buildBjtGraphScene({...synthetic,stage:{R1_ohm:100e3,R2_ohm:10e3,Ce_F:100e-6,Cp1_F:10e-6,Ck_F:5e-12}}),row=(label:string)=>stageScene.calculations.find(r=>r.label===label)!;
assert.ok(Math.abs(row('h₁₁ — входное сопротивление').value!-5000)<1e-5);assert.ok(Math.abs(row('h₂₁ — коэффициент передачи тока транзистора').value!-100)<1e-6);assert.ok(Math.abs(row('h₂₂ — выходная проводимость').value!-1e-5)<1e-8);
assert.ok(Math.abs(row('Rвых транзистора = 1/h₂₂').value!-100e3)<1e-2);assert.ok(Math.abs(row('Rб = R₁ ∥ R₂').value!-100e3*10e3/110e3)<1e-6);
assert.ok(row('Pвых = UКЭm²/(2Rк)').value!>0);assert.ok(row('fн = 1/(2πτн)').value!>0);assert.ok(row('fв = 1/(2πτв)').value!>0);
const rin=100e3*10e3/110e3,rinStage=rin*5000/(rin+5000),routStage=1000*100e3/101e3;
assert.ok(Math.abs(row('Rвх каскада = Rб ∥ Rвх транзистора').value!-rinStage)<1e-6);
assert.ok(Math.abs(row('Rвых каскада = Rк ∥ Rвых транзистора').value!-routStage)<1e-5);
assert.ok(Math.abs(row('Kᵤ по формуле методички = −βRк/Rвх').value!-(-100*1000/rinStage))<1e-8);
assert.ok(Math.abs(row('Kₚ уточн. = |β Kᵤ уточн.|').value!-Math.abs(100*row('Kᵤ с учётом Rвых транзистора = −β(Rк∥RвыхТ)/h₁₁').value!))<1e-8);
const q=stageScene.q,re=synthetic.load.rEmitter_ohm,r1=100e3,r2=10e3,vb=q.ube_V+(q.ic_A+q.ib_A)*re,sourceExpected=10*(q.ic_A+(10-vb)/r1);
assert.ok(Math.abs(row('Pист, расчёт из Q и тока через R₁').value!-sourceExpected)<1e-12);
assert.ok(stageScene.calculationWarnings.some(w=>w.includes('отличается от тока базы')),'nonmatching bias divider is a warning, not a failed graph');
assert.equal(row('h₁₂ — обратная передача напряжения').status,'unavailable');

if(process.env.TINA_BJT_NATIVE_FIXTURES==='1')for(const variant of [3,59]){
 const data=JSON.parse(readFileSync(new URL(`../work/method-audit-20261027/datasets/variant${variant}.json`,import.meta.url),'utf8')) as BjtGraphData;
 const nativeScene=buildBjtGraphScene(data),expected=variant===3?{ib_A:8.250474166e-6,ic_A:2.097152055e-3,uce_V:9,ube_V:.6026322136512511}:{ib_A:30.95898301e-6,ic_A:3.478810305e-3,uce_V:18,ube_V:.6730531938};
 for(const key of Object.keys(expected) as Array<keyof typeof expected>)assert.ok(Math.abs(nativeScene.q[key]-expected[key])<Math.max(1e-12,Math.abs(expected[key])*2e-7),`variant ${variant} Q ${key}`);
}
console.log('OK BJT method scene: analytic Q, rotated input, tangent-limited a/b, comma-decimal import, projections and four time traces'+(process.env.TINA_BJT_NATIVE_FIXTURES==='1'?' + native-derived variants 3/59':''));
