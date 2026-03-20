# openclaw-wechat.ts

一键完成 QClaw 微信通路的 openclaw 配置注入与网关重启。

前置条件

 - macOS
 - 已安装 QClaw 并完成微信关联

 - ~/.qclaw/openclaw.json 中存在 channels.wechat-access.token 和 channels.wechat-access.wsUrl

 - 本机已安装 ts-node（或可通过 npx 调用）
 - openclaw CLI 已在 PATH 中

# 用法
## 默认（openclaw config 路径为 ~/.openclaw/openclaw.json）
`npx ts-node openclaw-wechat.ts`

## 自定义 openclaw config 路径
`OPENCLAW_CONFIG=~/.openclaw/openclaw_test.json npx ts-node openclaw-wechat.ts`


# 脚本执行流程

| 步骤 | 操作 |
|------|------|
| 1/6 | 读取 ~/.qclaw/openclaw.json，提取 token & wsUrl |
| 2/6 | 读取 openclaw 配置文件 |
| 3/6 | 注入 channels.wechat-access（启用通路，写入 token 和固定 wsUrl）|
| 4/6 | 启用插件 wechat-access & openclaw-qqbot（allow / load.paths / entries）|
| 5/6 | 追加 binding：route → main via wechat-access，写回配置文件 |
| 6/6 | 退出 QClaw（osascript），等待 2s，执行 openclaw gateway restart |
# 配置文件路径
| 文件 | 说明 |
|------|------|
| ~/.qclaw/openclaw.json | QClaw 生成，只读取，不修改 |
| ~/.openclaw/openclaw.json | openclaw 主配置，脚本写入目标（可通过环境变量覆盖）|

#注入的配置片段
```
{
  "channels": {
    "wechat-access": {
      "enabled": true,
      "token": "<从 QClaw 读取>",
      "wsUrl": "wss://mmgrcalltoken.3g.qq.com/agentwss"
    }
  },
  "plugins": {
    "allow": ["wechat-access", "openclaw-qqbot"],
    "load": {
      "paths": ["/Applications/QClaw.app/Contents/Resources/openclaw/config/extensions"]
    },
    "entries": {
      "wechat-access": { "enabled": true },
      "openclaw-qqbot": { "enabled": true }
    }
  },
  "bindings": [
    {
      "type": "route",
      "agentId": "main",
      "match": { "channel": "wechat-access" }
    }
  ]
}
```
> 脚本具有幂等性：重复执行不会产生重复的 plugins/bindings 条目。
