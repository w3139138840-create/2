# 每日新闻早报 - Windows 任务计划程序方案
# 每天 6:30 通过 node_repl 搜索新闻并发送到飞书
# 存入: E:\ai3\news-bot\run_daily.ps1

$nodeReplCode = @"
const https = await import("node:https");
const A="cli_aab7b9ddf1f95bd6", S="LJq2fqixSvbpamG0BC30zfJOxVsJtofJ", C="oc_44070754be2a9618d4d4820e4eb33855";

async function get(url){return new Promise(r=>{const req=https.request(url,{headers:{"User-Agent":"Mozilla/5.0"},timeout:10000},res=>{let b="";res.on("data",d=>b+=d);res.on("end",()=>{try{r(JSON.parse(b))}catch(e){r({raw:b})}})});req.on("error",e=>r({error:e.message}));req.end()})}
function post(p,b,t){return new Promise(r=>{const d=JSON.stringify(b),u=new URL("https://open.feishu.cn"+p);const req=https.request(u,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+t},"Content-Length":Buffer.byteLength(d)},res=>{let x="";res.on("data",c=>x+=c);res.on("end",()=>{try{r(JSON.parse(x))}catch(e){r({raw:x})}})});req.on("error",e=>r({error:e.message}));req.write(d);req.end()})}

var sina=await get("https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2509&k=&num=15&page=1");
var sinaIntl=await get("https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2512&k=&num=10&page=1");
var sinaSoc=await get("https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2516&k=&num=10&page=1");

var items=[];
var seen=new Set();

function add(item){var k=item.title.slice(0,30);if(!seen.has(k)){seen.add(k);items.push(item)}}

// 国内 - 从 lid=2509 筛选科技/政策/民生
for(var x of sina.result.data){
  if(items.filter(i=>i.country==="国内").length>=6) break;
  var t=x.title||"", s=x.media_name||"新浪", d=new Date(parseInt(x.intime)*1000);
  var ts=d.getMonth()+1+"-"+d.getDate()+" "+String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");
  if(/基金|ETF|炒股|涨停|A股|大盘|涨幅|股价/.test(t)) continue;
  add({country:"国内",title:t,source:s,time:ts,summary:(x.intro||t).slice(0,80)});
}

// 国际 - 从 lid=2512+2516
for(var src of [sinaIntl,sinaSoc]){
  if(!src.result||!src.result.data) continue;
  for(var x of src.result.data){
    if(items.filter(i=>i.country==="国际").length>=6) break;
    var t=x.title||"", s=x.media_name||"环球";
    var isIntl=/特朗普|美国|日本|北约|欧洲|英国|韩国|俄|乌|美元|美联储|WTO|UN|EU|OPEC|全球|世界/.test(t);
    if(!isIntl) continue;
    var d=new Date(parseInt(x.intime)*1000);
    var ts=d.getMonth()+1+"-"+d.getDate()+" "+String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");
    add({country:"国际",title:t,source:s,time:ts,summary:(x.intro||t).slice(0,80)});
  }
}

items=items.slice(0,10);
var dc=items.filter(i=>i.country==="国内").length;
var ic=items.filter(i=>i.country==="国际").length;
console.log("国内"+dc+"条 国际"+ic+"条 共"+items.length+"条");

var tr=await post("/open-apis/auth/v3/tenant_access_token/internal",{app_id:A,app_secret:S});
var tk=tr.tenant_access_token;
var card={config:{wide_screen_mode:true},header:{title:{tag:"plain_text",content:"📰 每日新闻早报 | "+new Date().toLocaleDateString("zh-CN")},template:"blue"},elements:[]};
items.forEach((n,i)=>{card.elements.push({tag:"markdown",content:"**"+(i+1)+". "+n.title+"**\n"+(n.country==="国内"?"🇨🇳":"🌍")+" "+n.source+" | "+n.time+"\n>"+n.summary});if(i<items.length-1)card.elements.push({tag:"hr"})});
var sr=await post("/open-apis/im/v1/messages?receive_id_type=chat_id",{receive_id:C,msg_type:"interactive",content:JSON.stringify(card)},tk);
console.log(sr.code===0?"OK":"FAIL: "+sr.msg);
"@

# 写入文件
Set-Content E:\ai3\news-bot\run_daily.js $nodeReplCode -Encoding UTF8
Write-Host "脚本已存为 E:\ai3\news-bot\run_daily.js"
