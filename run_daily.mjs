// 每日新闻早报 - GitHub Actions 版
const https = await import("node:https");
const A = process.env.FEISHU_APP_ID;
const S = process.env.FEISHU_APP_SECRET;
const C = process.env.FEISHU_CHAT_ID;

if (!A || !S || !C) {
  console.error("❌ 缺少环境变量: FEISHU_APP_ID, FEISHU_APP_SECRET, FEISHU_CHAT_ID");
  process.exit(1);
}

async function get(url){return new Promise(r=>{const req=https.request(url,{headers:{"User-Agent":"Mozilla/5.0"},timeout:10000},res=>{let b="";res.on("data",d=>b+=d);res.on("end",()=>{try{r(JSON.parse(b))}catch(e){r({raw:b})}})});req.on("error",e=>r({error:e.message,raw:""}));req.end()})}
async function post(p,b,t){return new Promise(r=>{const d=JSON.stringify(b),u=new URL("https://open.feishu.cn"+p);const req=https.request(u,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+t},"Content-Length":Buffer.byteLength(d)},res=>{let x="";res.on("data",c=>x+=c);res.on("end",()=>{try{r(JSON.parse(x))}catch(e){r({raw:x})}})});req.on("error",e=>r({error:e.message}));req.write(d);req.end()})}

console.log("["+new Date().toLocaleString("zh-CN",{timeZone:"Asia/Shanghai"})+"] 搜索新闻...");

const [sina,sinaIntl,sinaSoc] = await Promise.all([
  get("https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2509&k=&num=15&page=1"),
  get("https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2512&k=&num=10&page=1"),
  get("https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2516&k=&num=10&page=1")
]);

const items=[], seen=new Set();
function add(item){const k=item.title.slice(0,30);if(!seen.has(k)){seen.add(k);items.push(item)}}

if(sina.result&&sina.result.data){
  for(const x of sina.result.data){
    if(items.filter(i=>i.country==="国内").length>=6) break;
    const t=x.title||"", s=x.media_name||"新浪";
    if(/基金|ETF|炒股|涨停|A股.*涨|大盘.*涨|涨幅|股价/.test(t)) continue;
    const d=new Date(parseInt(x.intime)*1000);
    const ts=(d.getMonth()+1)+"-"+d.getDate()+" "+String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");
    add({country:"国内",title:t,source:s,time:ts,summary:(x.intro||t).slice(0,80)});
  }
}

for(const src of [sinaIntl,sinaSoc]){
  if(!src.result||!src.result.data) continue;
  for(const x of src.result.data){
    if(items.filter(i=>i.country==="国际").length>=6) break;
    const t=x.title||"", s=x.media_name||"环球";
    if(!/特朗普|美国|日本|北约|欧洲|英国|韩国|俄|乌|美元|美联储|WTO|UN|EU|OPEC|全球|世界|印度|中东|伊朗|朝鲜|澳大利亚|加拿大|德国|法国|意大利/.test(t)) continue;
    const d=new Date(parseInt(x.intime)*1000);
    const ts=(d.getMonth()+1)+"-"+d.getDate()+" "+String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");
    add({country:"国际",title:t,source:s,time:ts,summary:(x.intro||t).slice(0,80)});
  }
}

items.splice(10);
console.log("国内"+items.filter(i=>i.country==="国内").length+"条 国际"+items.filter(i=>i.country==="国际").length+"条");

const tr=await post("/open-apis/auth/v3/tenant_access_token/internal",{app_id:A,app_secret:S});
const tk=tr.tenant_access_token;
const card={config:{wide_screen_mode:true},header:{title:{tag:"plain_text",content:"📰 每日新闻早报 | "+new Date().toLocaleDateString("zh-CN",{timeZone:"Asia/Shanghai"})},template:"blue"},elements:[]};
items.forEach((n,i)=>{card.elements.push({tag:"markdown",content:"**"+(i+1)+". "+n.title+"**\n"+(n.country==="国内"?"🇨🇳":"🌍")+" "+n.source+" | "+n.time+"\n>"+n.summary});if(i<items.length-1)card.elements.push({tag:"hr"})});
const sr=await post("/open-apis/im/v1/messages?receive_id_type=chat_id",{receive_id:C,msg_type:"interactive",content:JSON.stringify(card)},tk);
console.log(sr.code===0?"✅ 发送成功":"❌ "+sr.msg);
