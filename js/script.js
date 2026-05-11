// ==================== 配置常量 ====================
const BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const MODEL_ID = "qwen3.6-plus";

// ==================== 状态变量 ====================
let apiKey = "";
let messages = [
  { role: "system", content: "你是一个有用的AI助手，请用简洁清晰的中文回答用户的问题。" }
];

// ==================== 页面加载时初始化 ====================
document.addEventListener("DOMContentLoaded", () => {
  // 尝试从 localStorage 恢复 API Key
  const savedKey = localStorage.getItem("dashscope_api_key");
  if (savedKey) {
    apiKey = savedKey;
    document.getElementById("api-key-input").value = savedKey;
    updateKeyStatus(true);
    document.getElementById("send-btn").disabled = false;
  } else {
    updateKeyStatus(false);
  }
});

// ==================== API Key 管理 ====================
function saveApiKey() {
  const inputEl = document.getElementById("api-key-input");
  const key = inputEl.value.trim();
  
  if (!key) {
    alert("请输入有效的 API Key！");
    return;
  }

  if (!key.startsWith("sk-")) {
    alert("API Key 格式可能不正确，通常以 sk- 开头，请检查后重试。");
    return;
  }

  apiKey = key;
  localStorage.setItem("dashscope_api_key", key);
  updateKeyStatus(true);
  document.getElementById("send-btn").disabled = false;
}

function updateKeyStatus(isSaved) {
  const statusEl = document.getElementById("key-status");
  if (isSaved) {
    statusEl.textContent = "✅ Key 已保存";
    statusEl.className = "key-status saved";
  } else {
    statusEl.textContent = "⚠️ 尚未设置 Key";
    statusEl.className = "key-status missing";
  }
}

// ==================== 核心：调用大模型 ====================
async function callLLM(userInput) {
  // 将用户消息追加到对话历史
  messages.push({ role: "user", content: userInput });

  const response = await fetch(BASE_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: MODEL_ID,
      messages: messages
    })
  });

  // 处理 API 返回的错误
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const errMsg = errData.message || `HTTP ${response.status}: 请求失败`;
    throw new Error(errMsg);
  }

  const data = await response.json();

  // 提取模型回复
  const reply = data.choices[0].message.content;

  // 将模型回复也加入对话历史（这是多轮对话的关键！）
  messages.push({ role: "assistant", content: reply });

  return reply;
}

// ==================== 页面交互 ====================
async function handleSend() {
  const inputEl = document.getElementById("user-input");
  const chatBox = document.getElementById("chat-box");
  const sendBtn = document.getElementById("send-btn");
  const userInput = inputEl.value.trim();

  if (!userInput) return;

  // 移除空状态提示
  const emptyHint = chatBox.querySelector(".empty-hint");
  if (emptyHint) emptyHint.remove();

  // ① 显示用户消息
  appendMessage("user", userInput);
  inputEl.value = "";
  inputEl.focus();

  // ② 显示加载中提示（要素⑥）
  const loadingId = "loading-" + Date.now();
  appendMessage("assistant", "🤔 思考中，请稍候...", loadingId, "loading");

  // 禁用发送按钮，防止重复请求
  sendBtn.disabled = true;
  sendBtn.textContent = "⏳ 等待回复...";

  try {
    const reply = await callLLM(userInput);
    // ③ 替换加载中为实际回复
    updateMessage(loadingId, reply, "");
  } catch (error) {
    // ④ 显示错误提示（要素⑦）
    updateMessage(loadingId, `❌ 出错了：${error.message}`, "error");
    // 出错时从 messages 数组中移除刚才添加的用户消息，避免对话历史错乱
    // （因为请求失败，模型没有收到也没有回复）
    messages = messages.filter(m => !(m.role === "user" && m.content === userInput));
  } finally {
    // 恢复发送按钮
    sendBtn.disabled = false;
    sendBtn.textContent = "📨 发送";
  }
}

// ==================== 工具函数：操作聊天区 ====================
function appendMessage(role, content, id = "", className = "") {
  const chatBox = document.getElementById("chat-box");

  const msgDiv = document.createElement("div");
  msgDiv.className = `message ${role}`;
  if (id) msgDiv.id = id;

  const label = document.createElement("div");
  label.className = "label";
  label.textContent = role === "user" ? "👤 你" : "🤖 助手";

  const bubble = document.createElement("div");
  bubble.className = `bubble ${className}`;
  bubble.textContent = content;

  msgDiv.appendChild(label);
  msgDiv.appendChild(bubble);
  chatBox.appendChild(msgDiv);

  // 滚动到底部
  chatBox.scrollTop = chatBox.scrollHeight;

  return bubble;
}

function updateMessage(id, newContent, className) {
  const msgDiv = document.getElementById(id);
  if (!msgDiv) return;

  const bubble = msgDiv.querySelector(".bubble");
  if (bubble) {
    bubble.textContent = newContent;
    bubble.className = `bubble ${className}`;
  }
}

// ==================== 清空对话（要素⑧）====================
function clearAll() {
  if (!confirm("确定要清空所有对话记录并清除已保存的 API Key 吗？")) return;

  // 重置对话历史
  messages = [
    { role: "system", content: "你是一个有用的AI助手，请用简洁清晰的中文回答用户的问题。" }
  ];

  // 清空聊天显示区
  const chatBox = document.getElementById("chat-box");
  chatBox.innerHTML = '<div class="empty-hint">尚未开始对话，输入内容后点击发送吧～</div>';

  // 清除 API Key
  apiKey = "";
  localStorage.removeItem("dashscope_api_key");
  document.getElementById("api-key-input").value = "";
  updateKeyStatus(false);
  document.getElementById("send-btn").disabled = true;
}

// ==================== 快捷键：Enter 发送（Shift+Enter 换行）====================
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    const inputEl = document.getElementById("user-input");
    if (document.activeElement === inputEl) {
      e.preventDefault();
      handleSend();
    }
  }
});