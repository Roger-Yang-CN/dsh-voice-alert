import { fileURLToPath } from 'node:url'

/**
 * 语音提醒 —— Host 半区
 * 通过 webServer 注册 /voice-sound/{done|ask}.wav 静态路由，
 * 直接吐 assets/ 下的原始 wav 字节（不经 base64，避免 UTF-8 编码损坏二进制）。
 */

export const name = 'dsh-voice-alert'

export const inject = ['fs', 'webServer']

const SOUND_DIR = fileURLToPath(new URL('../assets/', import.meta.url))

const FILES = {
  done: '任务已完成.wav',
  ask: '请求决策.wav',
}

export function apply(ctx) {
  for (const key of ['done', 'ask']) {
    ctx.webServer.register({
      kind: 'exact',
      path: `/voice-sound/${key}.wav`,
      handler: async (_req, res) => {
        try {
          const target = await ctx.fs.resolve(SOUND_DIR + FILES[key])
          const bytes = await ctx.fs.readBytes(target, undefined, 600000)
          res.writeHead(200, {
            'Content-Type': 'audio/wav',
            'Content-Length': bytes.length,
            'Cache-Control': 'max-age=86400',
          })
          res.end(bytes)
        } catch (err) {
          console.error(`[voice-alert] route ${key} failed:`, err && err.message ? err.message : err)
          res.writeHead(500)
          res.end('sound unavailable')
        }
      },
    })
  }
}