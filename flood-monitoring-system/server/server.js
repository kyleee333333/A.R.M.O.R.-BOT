const express=require('express');
const cors=require('cors');
const http=require('http');
const WebSocket=require('ws');

const PORT=process.env.PORT||8080;
const app=express();
app.use(cors());
app.use(express.json({limit:'32kb'}));

let latest=null;
const clients=new Set();

function clean(data){
  if(!data||typeof data!=='object')return null;
  const d={...data};
  if(typeof d.distance!=='number'||!Number.isFinite(d.distance)||d.distance<0)d.distance=null;
  if(typeof d.waterLevel!=='number'||!Number.isFinite(d.waterLevel))d.waterLevel=null;
  d.lowSensor=typeof d.lowSensor==='boolean'?d.lowSensor:false;
  d.mediumSensor=typeof d.mediumSensor==='boolean'?d.mediumSensor:false;
  d.highSensor=typeof d.highSensor==='boolean'?d.highSensor:false;
  d.status=['SAFE','WARNING','CRITICAL'].includes(d.status)?d.status:
    d.highSensor?'CRITICAL':d.mediumSensor?'WARNING':'SAFE';
  d.timestamp=d.timestamp||new Date().toISOString();
  return d;
}

function broadcast(data){
  const message=JSON.stringify(data);
  for(const ws of clients){
    if(ws.readyState===WebSocket.OPEN)ws.send(message);
  }
}

app.get('/api/health',(req,res)=>res.json({ok:true,service:'flood-monitoring-server',clients:clients.size,hasData:!!latest}));
app.get('/api/latest',(req,res)=>res.json(latest||{status:'NO_DATA'}));
app.post('/api/telemetry',(req,res)=>{
  const data=clean(req.body);
  if(!data)return res.status(400).json({ok:false,error:'Invalid telemetry'});
  latest=data;
  broadcast(data);
  res.json({ok:true,receivedAt:new Date().toISOString()});
});

const server=http.createServer(app);
const wss=new WebSocket.Server({server});

wss.on('connection',ws=>{
  clients.add(ws);
  ws.send(JSON.stringify(latest||{status:'NO_DATA'}));
  ws.on('close',()=>clients.delete(ws));
  ws.on('error',()=>clients.delete(ws));
  ws.on('message',raw=>{
    try{
      const parsed=JSON.parse(raw.toString());
      const data=clean(parsed);
      if(data){latest=data;broadcast(data);}
    }catch{}
  });
});

server.listen(PORT,()=>console.log(`Flood monitoring server running on port ${PORT}`));
