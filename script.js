const DEFAULTS={maxHeight:40,lowThreshold:0,mediumThreshold:40,highThreshold:70,espIp:'',wsUrl:'ws://localhost:8080',apiUrl:'http://localhost:8080',updateInterval:1000,timeout:5000};
let settings=JSON.parse(localStorage.getItem('floodSettings')||'null')||DEFAULTS;
let history=JSON.parse(localStorage.getItem('floodHistory')||'[]');
let latest=null,lastReceived=0,socket=null,demo=false,demoTimer=null;
const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function saveSettings(){localStorage.setItem('floodSettings',JSON.stringify(settings))}
function calcLevel(distance){if(typeof distance!=='number'||!Number.isFinite(distance)||distance<0)return null;return clamp(((settings.maxHeight-distance)/settings.maxHeight)*100,0,100)}
function deriveStatus(d){
  if(d.highSensor===true || (typeof d.waterLevel==='number'&&d.waterLevel>=settings.highThreshold)) return 'CRITICAL';
  if(d.mediumSensor===true || (typeof d.waterLevel==='number'&&d.waterLevel>=settings.mediumThreshold)) return 'WARNING';
  return 'SAFE';
}
function safeData(raw){
  if(!raw||typeof raw!=='object')return null;
  const d={...raw};
  d.lowSensor=typeof d.lowSensor==='boolean'?d.lowSensor:null;
  d.mediumSensor=typeof d.mediumSensor==='boolean'?d.mediumSensor:null;
  d.highSensor=typeof d.highSensor==='boolean'?d.highSensor:null;
  d.distance=typeof d.distance==='number'&&Number.isFinite(d.distance)&&d.distance>=0?d.distance:null;
  d.waterLevel=typeof d.waterLevel==='number'&&Number.isFinite(d.waterLevel)?clamp(d.waterLevel,0,100):calcLevel(d.distance);
  d.status=['SAFE','WARNING','CRITICAL'].includes(d.status)?d.status:deriveStatus(d);
  d.timestamp=d.timestamp||new Date().toISOString();
  return d;
}
function setConnection(online){
  $('connectionDot').className='dot '+(online?'online':'offline');
  $('connectionText').textContent=online?'ESP32 ONLINE':'ESP32 OFFLINE';
  $('systemConnection').textContent=online?'Online':'Offline';
}
function fmtTime(ts){const d=new Date(ts);return Number.isNaN(d.getTime())?'—':d.toLocaleTimeString()}
function updateSensor(name,val){
  const card=document.querySelector(`[data-sensor="${name}"]`);
  const el=$(name+'Status');
  const active=val===true;
  card.classList.toggle('active',active); card.dataset.state=active?name:'';
  el.textContent=val===null?'N/A':active?'ACTIVE':'INACTIVE';
}
function updateUI(d){
  latest=d; lastReceived=Date.now(); setConnection(true);
  $('lastData').textContent='Last data received: '+fmtTime(d.timestamp);
  const level=d.waterLevel;
  $('waterLevel').textContent=level===null?'N/A':Math.round(level)+'%';
  $('liveLevel').textContent=level===null?'N/A':level.toFixed(1)+'%';
  $('waterDetailPercent').textContent=level===null?'N/A':level.toFixed(1)+'%';
  $('gaugeFill').style.height=(level===null?0:level)+'%';
  $('waterBarFill').style.width=(level===null?0:level)+'%';
  $('distance').textContent=d.distance===null?'N/A':d.distance.toFixed(1)+' cm';
  $('liveDistance').textContent=d.distance===null?'N/A':d.distance.toFixed(1)+' cm';
  $('waterDetailDistance').textContent=d.distance===null?'N/A':d.distance.toFixed(1)+' cm';
  $('maxHeightDisplay').textContent=settings.maxHeight+' cm';
  $('waterDetailMax').textContent=settings.maxHeight+' cm';
  $('statusTitle').textContent=d.status==='CRITICAL'?'CRITICAL FLOOD LEVEL':d.status;
  $('liveStatus').textContent=d.status;
  $('waterDetailStatus').textContent=d.status;
  $('liveStatusSmall').textContent=d.status==='SAFE'?'Normal condition':d.status==='WARNING'?'Water level is rising':'Immediate attention required';
  $('statusDescription').textContent=d.status==='CRITICAL'?'Water level has reached the critical level. Immediate attention is required.':d.status==='WARNING'?'Water level is rising. Monitor the situation closely.':'Water level is currently within the safe range.';
  $('statusCard').className='status-card '+d.status.toLowerCase();
  $('statusIcon').textContent=d.status==='CRITICAL'?'!':d.status==='WARNING'?'⚠':'✓';
  $('alertTitle').textContent=d.status==='CRITICAL'?'CRITICAL FLOOD ALERT':d.status==='WARNING'?'WATER LEVEL WARNING':'SYSTEM NORMAL';
  $('alertText').textContent=d.status==='CRITICAL'?'High-level sensor activated.':d.status==='WARNING'?'Water level is rising.':'No active flood warning.';
  $('alertTime').textContent=fmtTime(d.timestamp);
  updateSensor('low',d.lowSensor);updateSensor('medium',d.mediumSensor);updateSensor('high',d.highSensor);
  $('liveLow').textContent=d.lowSensor===null?'N/A':d.lowSensor?'ACTIVE':'INACTIVE';
  $('liveMedium').textContent=d.mediumSensor===null?'N/A':d.mediumSensor?'ACTIVE':'INACTIVE';
  $('liveHigh').textContent=d.highSensor===null?'N/A':d.highSensor?'ACTIVE':'INACTIVE';
  $('liveTimestamp').textContent=fmtTime(d.timestamp);
  $('systemWifi').textContent=d.wifiConnected===false?'Disconnected':'Connected';
  $('systemStatus').textContent='Operational';
  addPoint(d); maybeAlert(d); renderAlerts();
}
function maybeAlert(d){
  const sensor=d.highSensor?'HIGH':d.mediumSensor?'MEDIUM':d.lowSensor?'LOW':d.status;
  if(!['WARNING','CRITICAL'].includes(d.status))return;
  const key=d.timestamp+'|'+d.status;
  if(history[0]?.key===key)return;
  history.unshift({key,time:d.timestamp,sensor,waterLevel:d.waterLevel,distance:d.distance,status:d.status});
  history=history.slice(0,500);localStorage.setItem('floodHistory',JSON.stringify(history));
}
function addPoint(d){
  const ts=new Date(d.timestamp).getTime();
  if(!Number.isFinite(ts)||d.waterLevel===null)return;
  waterChart.data.labels.push(new Date(ts));waterChart.data.datasets[0].data.push(d.waterLevel);
  while(waterChart.data.labels.length>500){waterChart.data.labels.shift();waterChart.data.datasets[0].data.shift()}
  filterChart();
}
function filterChart(){
  const mins=Number($('rangeSelect').value), cutoff=Date.now()-mins*60000;
  const pairs=waterChart.data.labels.map((x,i)=>({x,y:waterChart.data.datasets[0].data[i]})).filter(p=>new Date(p.x).getTime()>=cutoff);
  waterChart.data.labels=pairs.map(p=>p.x);waterChart.data.datasets[0].data=pairs.map(p=>p.y);waterChart.update('none');
}
const chartOptions={responsive:true,maintainAspectRatio:false,scales:{x:{type:'category',ticks:{maxTicksLimit:10}},y:{min:0,max:100,title:{display:true,text:'Water Level (%)'}}},plugins:{legend:{display:false}}};
let waterChart=new Chart($('waterChart'),{type:'line',data:{labels:[],datasets:[{data:[],tension:.3,borderWidth:2,pointRadius:0,fill:true}]},options:chartOptions});
let historyChart=new Chart($('historyChart'),{type:'line',data:{labels:history.slice().reverse().map(x=>new Date(x.time)),datasets:[{label:'Alert water level',data:history.slice().reverse().map(x=>x.waterLevel),tension:.3,borderWidth:2}]},options:{...chartOptions,plugins:{legend:{display:true}}}});
function renderAlerts(){
  const q=$('alertSearch').value.toLowerCase(), f=$('alertFilter').value;
  const rows=history.filter(x=>(f==='ALL'||x.status===f)&&(`${x.sensor} ${x.status}`.toLowerCase().includes(q)||fmtTime(x.time).toLowerCase().includes(q)));
  $('alertTable').innerHTML=rows.map(x=>`<tr><td>${fmtTime(x.time)}</td><td>${x.sensor}</td><td>${x.waterLevel==null?'N/A':Number(x.waterLevel).toFixed(1)+'%'}</td><td>${x.distance==null?'N/A':Number(x.distance).toFixed(1)+' cm'}</td><td><b>${x.status}</b></td></tr>`).join('')||'<tr><td colspan="5">No alerts found.</td></tr>';
  historyChart.data.labels=history.slice().reverse().map(x=>new Date(x.time));historyChart.data.datasets[0].data=history.slice().reverse().map(x=>x.waterLevel);historyChart.update();
}
function connectWS(){
  if(socket){try{socket.close()}catch{}}
  try{
    socket=new WebSocket(settings.wsUrl);
    socket.onopen=()=>{setConnection(true);$('settingsMessage').textContent='WebSocket connected.'};
    socket.onmessage=e=>{try{const d=safeData(JSON.parse(e.data));if(d)updateUI(d)}catch{}};
    socket.onclose=()=>setConnection(false);
    socket.onerror=()=>setConnection(false);
  }catch{setConnection(false)}
}
async function testApi(){
  try{const r=await fetch(settings.apiUrl+'/api/health');const d=await r.json();$('settingsMessage').textContent=d.ok?'REST API is online.':'REST API returned an unexpected response.'}
  catch{$('settingsMessage').textContent='REST API test failed.'}
}
function startDemo(){
  demo=!demo;$('demoBtn').textContent=demo?'■ Stop Demo':'▶ Demo Mode';
  if(demo){let t=0;demoTimer=setInterval(()=>{t++;const level=clamp(15+45*(1+Math.sin(t/8))/2+Math.random()*4,0,100);const distance=settings.maxHeight-(level/100)*settings.maxHeight;updateUI(safeData({lowSensor:level>=10,mediumSensor:level>=settings.mediumThreshold,highSensor:level>=settings.highThreshold,distance,waterLevel:level,status:level>=settings.highThreshold?'CRITICAL':level>=settings.mediumThreshold?'WARNING':'SAFE',timestamp:new Date().toISOString(),wifiConnected:true}))},1000)}else clearInterval(demoTimer)
}
function populateSettings(){
  $('maxHeight').value=settings.maxHeight;$('lowThreshold').value=settings.lowThreshold;$('mediumThreshold').value=settings.mediumThreshold;$('highThreshold').value=settings.highThreshold;$('espIp').value=settings.espIp;$('wsUrl').value=settings.wsUrl;$('apiUrl').value=settings.apiUrl;$('updateInterval').value=settings.updateInterval;$('timeout').value=settings.timeout;
}
document.querySelectorAll('.nav-btn').forEach(b=>b.onclick=()=>{document.querySelectorAll('.nav-btn').forEach(x=>x.classList.remove('active'));b.classList.add('active');document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));$('page-'+b.dataset.page).classList.add('active');$('sidebar').classList.remove('open')});
$('menuBtn').onclick=()=>$('sidebar').classList.toggle('open');
$('demoBtn').onclick=startDemo;
$('rangeSelect').onchange=filterChart;
$('alertSearch').oninput=renderAlerts;$('alertFilter').onchange=renderAlerts;
$('clearBtn').onclick=()=>{if(confirm('Clear all alert history?')){history=[];localStorage.setItem('floodHistory','[]');renderAlerts()}};
$('exportBtn').onclick=()=>{const lines=[['Time','Sensor','Water Level','Distance','Status'],...history.map(x=>[x.time,x.sensor,x.waterLevel,x.distance,x.status])];const csv=lines.map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='flood-alert-history.csv';a.click();URL.revokeObjectURL(a.href)};
$('saveSettings').onclick=()=>{settings={maxHeight:+$('maxHeight').value,lowThreshold:+$('lowThreshold').value,mediumThreshold:+$('mediumThreshold').value,highThreshold:+$('highThreshold').value,espIp:$('espIp').value.trim(),wsUrl:$('wsUrl').value.trim(),apiUrl:$('apiUrl').value.trim(),updateInterval:+$('updateInterval').value,timeout:+$('timeout').value};if(settings.maxHeight<=0||settings.mediumThreshold<settings.lowThreshold||settings.highThreshold<settings.mediumThreshold){$('settingsMessage').textContent='Check threshold values.';return}saveSettings();$('settingsMessage').textContent='Settings saved.';connectWS();updateUI(latest||safeData({lowSensor:false,mediumSensor:false,highSensor:false,distance:settings.maxHeight,waterLevel:0,status:'SAFE',timestamp:new Date().toISOString()}))};
$('connectBtn').onclick=connectWS;$('testApi').onclick=testApi;
setInterval(()=>{ $('clock').textContent=new Date().toLocaleString();if(lastReceived&&Date.now()-lastReceived>settings.timeout&&!demo)setConnection(false)},500);
populateSettings();renderAlerts();connectWS();
