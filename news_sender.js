// 飞书新闻早报发送器 - Node.js 版
const https = require("https");

const APP_ID = process.env.FEISHU_APP_ID;
const APP_SECRET = process.env.FEISHU_APP_SECRET;
const CHAT_ID = process.env.FEISHU_CHAT_ID;

if (!APP_ID || !APP_SECRET || !CHAT_ID) {
  console.error("❌ 缺少环境变量: FEISHU_APP_ID, FEISHU_APP_SECRET, FEISHU_CHAT_ID");
  process.exit(1);
}

function feishuPost(path, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const url = new URL(`https://open.feishu.cn${path}`);
    const req = https.request(url, {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data)
      },
      timeout: 15000
    }, (res) => {
      let resp = "";
      res.on("data", d => resp += d);
      res.on("end", () => {
        try { resolve(JSON.parse(resp)); }
        catch(e) { resolve({ raw: resp, status: res.statusCode }); }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function getToken() {
  const result = await feishuPost("/open-apis/auth/v3/tenant_access_token/internal", {
    app_id: APP_ID,
    app_secret: APP_SECRET
  }, "");
  if (result.code !== 0) throw new Error("Token error: " + JSON.stringify(result));
  return result.tenant_access_token;
}

async function sendCardToChat(token, chatId, cardJson) {
  const result = await feishuPost(
    "/open-apis/im/v1/messages?receive_id_type=chat_id",
    { receive_id: chatId, msg_type: "interactive", content: JSON.stringify(cardJson) },
    token
  );
  return result;
}

function buildNewsCard(dateStr, newsItems) {
  const elements = [];
  newsItems.forEach((item, i) => {
    const sourceLabel = item.country === "国内" ? "🇨🇳" : "🌍";
    elements.push({
      tag: "markdown",
      content: "**" + (i+1) + ". " + item.title + "**\n" + sourceLabel + " 来源: " + item.source + " | " + item.time + "\n>" + item.summary
    });
    if (i < newsItems.length - 1) {
      elements.push({ tag: "hr" });
    }
  });
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: "plain_text", content: "📰 每日新闻早报 | " + dateStr },
      template: "blue"
    },
    elements
  };
}

if (typeof module !== "undefined") {
  module.exports = { getToken, sendCardToChat, buildNewsCard, CHAT_ID, APP_ID, APP_SECRET };
}
