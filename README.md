# 语音提醒插件

DSH 浏览器端提醒插件：当任意会话**完成任务**（回合结束）或**请示用户**（ask_user_question / 审批 / 方案评审）时：

- 播放语音提示（`任务已完成.wav` / `请求决策.wav`）
- 页面顶部弹出提示条（6 秒自动消失，可点击关闭）
- 页面失焦/最小化时额外发送**系统通知**（点击可跳回 DSH）

> **语音素材说明**：内置语音为「千织」（原神角色）语音。可自行替换 `assets/` 下的 wav 文件（保持文件名 `任务已完成.wav` / `请求决策.wav` 不变即可），换成任意你喜欢的提示音。

## 结构

- `lib/index.js` — Host 半区：`webServer` 注册 `/voice-sound/{done|ask}.wav` 静态路由，直接吐原始 wav 字节
- `lib/client.js` — Client 半区：`shell.overlay` 插槽 + `useSessions` 订阅会话状态，Audio 播放 + 弹窗 + 系统通知
- `assets/` — 语音素材（可替换）
- `cordis.patch.yml` — 组合补丁（插入 `voice-alert` 插件行）

## 本地安装（file: 依赖）

1. `git clone https://github.com/Roger-Yang-CN/dsh-voice-alert` 到本机任意目录；
2. 在 DSH profile 的 `package.json`（如 `~/.dsh/profiles/web/package.json`）：

```json
"dependencies": { "dsh-voice-alert": "file:<克隆到的绝对路径>" },
"dsh": { "profile": { "bundles": [ "...", "dsh-voice-alert" ] } }
```

3. 在 profile 目录执行 `pnpm install`；
4. **手动同步插件副本**：将插件目录的 `lib/`、`assets/` 复制到 `node_modules/dsh-voice-alert/`（pnpm 对 `file:` 依赖不会自动刷新）；
5. 重启 DSH，页面出现提示条即生效（首次触发时浏览器会请求通知权限，允许后失焦提醒可用）。
