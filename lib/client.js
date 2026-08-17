// 语音提醒 —— Client 半区
// 必须符合 client-modules 协议：window.__ModuleLoader__.load({ id, factory })
// factory 为 CJS 形式，外部依赖（react）经 require 从模块表解析。
window.__ModuleLoader__.load({
  id: "dsh-voice-alert",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    var React = require("react");

    /**
     * shell.overlay 顶部提示条：
     *  - running true→false → 「任务已完成」语音 + 弹窗
     *  - pendingInteraction 出现 → 「请求决策」语音 + 弹窗
     *  - 页面失焦/最小化 → 追加系统通知
     *  - 任意手势解锁自动播放；失败入队，手势/回前台时补播
     */
    exports.name = "dsh-voice-alert";
    exports.inject = ["timer"];

    exports.apply = function apply(ctx) {
      var slots = ctx.get("slots");
      if (slots === undefined) return;

      var soundCache = { done: null, ask: null };
      var queue = [];

      function getUrl(kind) {
        return window.location.origin + "/voice-sound/" + kind + ".wav";
      }

      function play(kind) {
        var el = soundCache[kind];
        if (!el) {
          if (queue.indexOf(kind) < 0) queue.push(kind);
          ensureSounds();
          return;
        }
        try {
          el.currentTime = 0;
          var p = el.play();
          if (p && typeof p.catch === "function") {
            p.catch(function () { if (queue.indexOf(kind) < 0) queue.push(kind); });
          } else if (queue.indexOf(kind) >= 0) {
            queue.splice(queue.indexOf(kind), 1);
          }
        } catch (e) {
          if (queue.indexOf(kind) < 0) queue.push(kind);
        }
      }

      function drain() {
        var guard = 0;
        while (queue.length && guard < 8) {
          guard++;
          var kind = queue[0];
          var el = soundCache[kind];
          if (!el) return;
          queue.shift();
          try {
            el.currentTime = 0;
            var p = el.play();
            if (p && typeof p.catch === "function") {
              p.catch(function () { if (queue.indexOf(kind) < 0) queue.push(kind); });
            }
          } catch (e) {
            if (queue.indexOf(kind) < 0) queue.push(kind);
          }
        }
      }

      function ensureSounds() {
        if (soundCache.done && soundCache.ask) return;
        try {
          var done = new Audio(getUrl("done"));
          done.preload = "auto";
          soundCache.done = done;
          var ask = new Audio(getUrl("ask"));
          ask.preload = "auto";
          soundCache.ask = ask;
          drain();
        } catch (e) {
          console.error("[voice-alert] audio create failed", e);
        }
      }

      function maybeRequestPermission() {
        try {
          if (typeof Notification !== "undefined" && Notification.permission === "default") {
            var p = Notification.requestPermission();
            if (p && typeof p.catch === "function") p.catch(function () {});
          }
        } catch (e) { /* ignore */ }
      }

      function notify(kind, info) {
        try {
          if (typeof Notification === "undefined") return;
          if (Notification.permission !== "granted") return;
          if (!document.hidden && document.hasFocus()) return;
          var n = new Notification(kind === "done" ? "任务已完成" : "需要你的决策", {
            body: info.title || "",
            tag: "voice-alert",
            silent: true,
          });
          n.onclick = function () { try { window.focus(); } catch (e) { /* ignore */ } n.close(); };
        } catch (e) { /* ignore */ }
      }

      function unlock() {
        drain();
        maybeRequestPermission();
      }
      var onGesture = function () { unlock(); };
      var gestures = ["pointerdown", "pointerup", "keydown", "click", "touchstart", "wheel"];
      for (var i = 0; i < gestures.length; i++) {
        document.addEventListener(gestures[i], onGesture, { passive: true });
      }
      var onVisible = function () { if (!document.hidden) drain(); };
      document.addEventListener("visibilitychange", onVisible);
      window.addEventListener("focus", onVisible);
      ctx.effect(function () {
        return function () {
          for (var j = 0; j < gestures.length; j++) {
            document.removeEventListener(gestures[j], onGesture);
          }
          document.removeEventListener("visibilitychange", onVisible);
          window.removeEventListener("focus", onVisible);
        };
      });

      slots.inject("shell.overlay", function () {
        return slots.register(
          { name: "shell.overlay", id: "voice-alert" },
          function (props) {
            var sessions = props.useSessions(function (s) { return s.byId; });
            var alertState = React.useState(null);
            var alert = alertState[0];
            var setAlert = alertState[1];
            var prevRef = React.useRef(null);
            var hideRef = React.useRef(null);

            function fire(kind, info) {
              play(kind);
              notify(kind, info);
              setAlert({
                key: Date.now(),
                kind: kind,
                text: kind === "done" ? "任务已完成" : "需要你的决策",
                session: info.title,
              });
              if (hideRef.current) hideRef.current();
              hideRef.current = ctx.timeout(function () { setAlert(null); }, 6000);
            }

            React.useEffect(function () { ensureSounds(); }, []);

            React.useEffect(function () {
              var cur = {};
              for (var id in sessions) {
                var s = sessions[id];
                cur[id] = {
                  running: !!s.running,
                  pending: (s.pendingInteraction ? 1 : 0),
                  title: s.displayTitle || s.title || id,
                };
              }
              if (prevRef.current === null) { prevRef.current = cur; return; }
              var prev = prevRef.current;
              for (var sid in cur) {
                var c = cur[sid];
                var p = prev[sid];
                if (!p) continue;
                if (p.running && !c.running) fire("done", c);
                if (!p.pending && c.pending) fire("ask", c);
              }
              prevRef.current = cur;
            }, [sessions]);

            return React.createElement(
              "div",
              { style: { position: "fixed", top: 0, left: 0, right: 0, zIndex: 2147483000, display: "flex", flexDirection: "column", alignItems: "center", pointerEvents: "none", paddingTop: 14 } },
              alert ? React.createElement("div", {
                key: alert.key,
                onClick: function () { setAlert(null); },
                style: {
                  pointerEvents: "auto", cursor: "pointer",
                  background: "rgba(20,22,28,0.96)", color: "#fff", padding: "12px 20px",
                  borderRadius: 10, fontSize: 15, boxShadow: "0 6px 24px rgba(0,0,0,0.45)",
                  display: "flex", alignItems: "center", gap: 12, maxWidth: 480,
                  border: alert.kind === "done" ? "1px solid rgba(60,200,120,0.5)" : "1px solid rgba(255,180,60,0.55)",
                },
              },
                React.createElement("span", { style: { fontSize: 22 } }, alert.kind === "done" ? "✅" : "❓"),
                React.createElement("div", null,
                  React.createElement("div", { style: { fontWeight: 700 } }, alert.text),
                  React.createElement("div", { style: { opacity: 0.75, fontSize: 13, marginTop: 2 } }, alert.session),
                ),
              ) : null,
            );
          },
        );
      });
    };

    return module.exports;
  },
});