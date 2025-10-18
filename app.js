// Simple Slack-like SPA using localStorage. No frameworks to ensure deployability.

const STORAGE_KEY = "agentic-slack-store-v1";

function seed() {
  const now = Date.now();
  return {
    users: {
      u1: { id: "u1", name: "Alice", avatarColor: "#EF4444" },
      u2: { id: "u2", name: "Bob", avatarColor: "#22C55E" },
      u3: { id: "u3", name: "Carol", avatarColor: "#3B82F6" },
    },
    channels: {
      general: { id: "general", name: "general", createdAt: now },
      random: { id: "random", name: "random", createdAt: now },
    },
    dms: {
      "u1-u2": { id: "u1-u2", userIds: ["u1", "u2"] },
      "u2-u3": { id: "u2-u3", userIds: ["u2", "u3"] },
    },
    messagesByRoom: {
      "channel:general": [
        { id: "m1", userId: "u1", text: "Welcome to #general!", createdAt: now - 100000 },
        { id: "m2", userId: "u2", text: "Hello everyone 👋", createdAt: now - 80000 },
      ],
      "channel:random": [
        { id: "m3", userId: "u3", text: "Random thoughts here.", createdAt: now - 50000 },
      ],
    },
  };
}

function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const s = seed();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    return s;
  }
  try { return JSON.parse(raw); } catch { const s = seed(); localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); return s; }
}

function save(state) { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

const state = load();
let currentUserId = "u1";

function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") el.className = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "href") el.setAttribute("href", v);
    else if (k === "value") el.value = v;
    else if (k === "placeholder") el.setAttribute("placeholder", v);
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null) continue;
    el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return el;
}

function avatar(name, color, size = 24) {
  const initials = name.split(" ").map(p => p[0]).join("").slice(0,2).toUpperCase();
  return h("div", { class: "inline-flex items-center justify-center rounded", style: `width:${size}px;height:${size}px;background:${color}` },
    h("span", { class: "text-[10px] font-bold" }, initials)
  );
}

function sendMessage(roomId, text, threadRootId) {
  const trimmed = (text || "").trim();
  if (!trimmed) return;
  const msg = { id: `m${Date.now()}`, userId: currentUserId, text: trimmed, createdAt: Date.now(), threadRootId };
  state.messagesByRoom[roomId] = state.messagesByRoom[roomId] || [];
  state.messagesByRoom[roomId].push(msg);
  save(state);
  render();
}

function getRoomTitle(roomId) {
  if (roomId.startsWith("channel:")) {
    const id = roomId.split(":")[1];
    return `#${state.channels[id]?.name || id}`;
  }
  if (roomId.startsWith("dm:")) {
    const id = roomId.split(":")[1];
    const dm = state.dms[id];
    if (!dm) return id;
    return dm.userIds.map(u => state.users[u]?.name || u).join(", ");
  }
  return roomId;
}

function navigate(path) { history.pushState({}, "", path); render(); }

function layout(content, title) {
  return h("div", { class: "flex min-h-screen" },
    sidebar(),
    h("div", { class: "flex-1 flex flex-col h-screen" },
      h("div", { class: "h-12 border-b border-white/10 flex items-center px-4 font-semibold" }, title),
      h("div", { class: "flex-1 min-h-0 flex" }, content)
    )
  );
}

function sidebar() {
  const channels = Object.values(state.channels);
  const dms = Object.values(state.dms);
  let channelName = "";
  const input = h("input", {
    placeholder: "New channel name",
    class: "w-full rounded bg-[#22262A] px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-[#4A9EFA]",
    oninput: (e) => { channelName = e.target.value; }
  });
  return h("div", { class: "w-64 shrink-0 bg-[#1F2226] h-screen overflow-y-auto border-r border-white/10" },
    h("div", { class: "p-3 border-b border-white/10" }, h("a", { href: "/", onclick: (e)=>{e.preventDefault(); navigate("/");}, class: "text-lg font-semibold" }, "Agentic Workspace")),
    h("div", { class: "p-3 space-y-6" },
      h("div", {},
        h("div", { class: "mb-2 flex items-center justify-between text-xs uppercase tracking-wide text-gray-400" },
          h("span", {}, "Channels"),
          h("button", { class: "p-1 hover:bg-white/10 rounded", onclick: () => { if (!channelName.trim()) return; const id = channelName.toLowerCase().replace(/[^a-z0-9-]+/g, "-"); if (!state.channels[id]) { state.channels[id] = { id, name: channelName, createdAt: Date.now() }; state.messagesByRoom[`channel:${id}`] = []; save(state); } channelName = ""; input.value = ""; navigate(`/channel/${id}`);} }, "+")
        ),
        input,
        h("ul", { class: "mt-3 space-y-1" },
          channels.map(c => h("li", { key: c.id },
            h("a", { href: `/channel/${c.id}`, class: "flex items-center gap-2 px-2 py-1 rounded hover:bg-white/10", onclick: (e)=>{e.preventDefault(); navigate(`/channel/${c.id}`);} },
              h("span", { class: "text-sm" }, `#${c.name}`)
            )
          ))
        )
      ),
      h("div", {},
        h("div", { class: "mb-2 flex items-center justify-between text-xs uppercase tracking-wide text-gray-400" },
          h("span", {}, "Direct messages"),
          h("a", { href: "/search", onclick: (e)=>{e.preventDefault(); navigate("/search");}, class: "text-xs underline" }, "Search")
        ),
        h("ul", { class: "space-y-1" },
          dms.map(dm => h("li", { key: dm.id },
            h("a", { href: `/dm/${dm.id}`, class: "block px-2 py-1 rounded hover:bg-white/10", onclick: (e)=>{e.preventDefault(); navigate(`/dm/${dm.id}`);} },
              dm.userIds.map(u => state.users[u]?.name || u).join(", ")
            )
          ))
        )
      )
    )
  );
}

function messagesPane(roomId) {
  const messages = (state.messagesByRoom[roomId] || []).slice();
  const list = h("div", { class: "flex-1 overflow-y-auto p-4 space-y-4" },
    messages.map(m => messageItem(roomId, m))
  );
  return h("div", { class: "flex-1 min-h-0 flex flex-col" }, list);
}

function messageItem(roomId, m) {
  const user = state.users[m.userId] || { name: m.userId, avatarColor: "#555" };
  const replies = (state.messagesByRoom[roomId] || []).filter(x => x.threadRootId === m.id);
  return h("div", { class: "flex items-start gap-3" },
    avatar(user.name, user.avatarColor, 28),
    h("div", {},
      h("div", { class: "text-sm text-gray-300" },
        h("span", { class: "font-semibold mr-2" }, user.name),
        h("span", { class: "text-xs text-gray-500" }, new Date(m.createdAt).toLocaleString())
      ),
      h("div", { class: "whitespace-pre-wrap leading-relaxed" }, m.text),
      h("button", { class: "mt-1 text-xs text-[#4A9EFA] underline", onclick: () => { const reply = prompt("Reply in thread:") || ""; if (reply.trim()) sendMessage(roomId, reply, m.id); } }, "Reply in thread"),
      h("div", { class: "mt-2 space-y-2 border-l border-white/10 pl-3" },
        replies.map(r => h("div", { class: "flex items-start gap-3" },
          avatar(state.users[r.userId]?.name || r.userId, state.users[r.userId]?.avatarColor || "#555", 22),
          h("div", {},
            h("div", { class: "text-xs text-gray-400" },
              h("span", { class: "font-semibold mr-2" }, state.users[r.userId]?.name || r.userId),
              h("span", { class: "text-[10px] text-gray-500" }, new Date(r.createdAt).toLocaleString())
            ),
            h("div", { class: "text-sm whitespace-pre-wrap" }, r.text)
          )
        ))
      )
    )
  );
}

function inputBox(roomId, placeholder) {
  const ta = h("textarea", { class: "w-full resize-none rounded bg-[#22262A] p-3 outline-none focus:ring-2 focus:ring-[#4A9EFA] min-h-[60px]", placeholder });
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(roomId, ta.value);
      ta.value = "";
    }
  });
  return h("div", { class: "border-t border-white/10 p-3" }, ta, h("div", { class: "text-xs text-gray-400 mt-1" }, "Press Enter to send, Shift+Enter for newline"));
}

function channelPage(id) {
  const roomId = `channel:${id}`;
  const title = getRoomTitle(roomId);
  return layout(
    h("div", { class: "flex-1 flex flex-col min-h-0" },
      messagesPane(roomId),
      inputBox(roomId, `Message #${id}`)
    ),
    title
  );
}

function dmPage(id) {
  const roomId = `dm:${id}`;
  const title = getRoomTitle(roomId);
  return layout(
    h("div", { class: "flex-1 flex flex-col min-h-0" },
      messagesPane(roomId),
      inputBox(roomId, `Message ${title}`)
    ),
    title
  );
}

function searchPage() {
  let q = "";
  const input = h("input", { class: "w-full rounded bg-[#22262A] px-3 py-2 outline-none focus:ring-2 focus:ring-[#4A9EFA]", placeholder: "Search messages", oninput: (e)=>{ q = e.target.value; update(); } });
  const list = h("div", { class: "flex-1 overflow-y-auto p-3 space-y-3" });
  function update() {
    list.innerHTML = "";
    const results = [];
    for (const [roomId, msgs] of Object.entries(state.messagesByRoom)) {
      for (const m of msgs) {
        if (q && !m.text.toLowerCase().includes(q.toLowerCase())) continue;
        results.push({ roomId, id: m.id, text: m.text, userName: state.users[m.userId]?.name || m.userId, time: m.createdAt });
      }
    }
    results.sort((a,b)=>b.time-a.time).slice(0,200).forEach(r => {
      const a = h("a", { href: `/${r.roomId.replace(":", "/")}`, class: "block p-3 rounded bg-[#22262A] hover:bg-white/10", onclick: (e)=>{e.preventDefault(); navigate(`/${r.roomId.replace(":","/")}`);} },
        h("div", { class: "text-sm text-gray-400" }, `${r.userName} • ${new Date(r.time).toLocaleString()}`),
        h("div", { class: "mt-1" }, r.text),
        h("div", { class: "text-xs text-gray-500 mt-1" }, r.roomId)
      );
      list.appendChild(a);
    });
  }
  const content = h("div", { class: "flex-1 flex flex-col min-h-0" },
    h("div", { class: "p-3 border-b border-white/10" }, input),
    list
  );
  setTimeout(update, 0);
  return layout(content, "Search");
}

function homePage() {
  return h("div", { class: "flex min-h-screen" },
    h("div", { class: "m-auto text-center space-y-6" },
      h("h1", { class: "text-4xl font-bold" }, "Agentic Slack Clone"),
      h("p", { class: "text-gray-300" }, "Start chatting in channels or DMs."),
      h("div", { class: "flex items-center justify-center gap-4" },
        h("a", { href: "/channel/general", class: "rounded bg-[#4A9EFA] px-4 py-2 text-black", onclick: (e)=>{e.preventDefault(); navigate("/channel/general");} }, "Open #general"),
        h("a", { href: "/search", class: "rounded border border-white/20 px-4 py-2", onclick: (e)=>{e.preventDefault(); navigate("/search");} }, "Search")
      )
    )
  );
}

function router() {
  const path = location.pathname;
  if (path.startsWith("/channel/")) return channelPage(decodeURIComponent(path.split("/channel/")[1]));
  if (path.startsWith("/dm/")) return dmPage(decodeURIComponent(path.split("/dm/")[1]));
  if (path.startsWith("/search")) return searchPage();
  return homePage();
}

function render() {
  const root = document.getElementById("app");
  root.innerHTML = "";
  root.appendChild(router());
}

window.addEventListener("popstate", render);

render();
