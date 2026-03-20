#!/usr/bin/env npx ts-node

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";

// ─── Paths ────────────────────────────────────────────────────────────────────

const QCLAW_JSON = path.join(os.homedir(), ".qclaw", "openclaw.json");

// 如果你的 openclaw config 路径不同，改这里
const OPENCLAW_CONFIG =
  process.env.OPENCLAW_CONFIG ??
  path.join(os.homedir(), ".openclaw", "openclaw.json");

const EXTENSIONS_PATH =
  "/Applications/QClaw.app/Contents/Resources/openclaw/config/extensions";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readJson<T>(filePath: string): T {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

function writeJson(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

function log(step: string, msg: string) {
  console.log(`[${step}] ${msg}`);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface QClawJson {
  channels: {
    "wechat-access": {
      token: string;
      wsUrl: string;
    };
  };
}

interface OpenClawConfig {
  channels?: Record<string, unknown>;
  plugins?: {
    allow?: string[];
    load?: { paths?: string[] };
    entries?: Record<string, unknown>;
  };
  bindings?: Array<{
    type: string;
    agentId: string;
    match: Record<string, string>;
  }>;
  [key: string]: unknown;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  // 1. 读取 QClaw 配置，获取 token & wsUrl
  log("1/6", `读取 QClaw 配置: ${QCLAW_JSON}`);
  const qclaw = readJson<QClawJson>(QCLAW_JSON);
  const token = qclaw?.channels?.["wechat-access"]?.token;
  const wsUrl = qclaw?.channels?.["wechat-access"]?.wsUrl;

  if (!token || !wsUrl) {
    throw new Error(
      "在 ~/.qclaw/openclaw.json 中找不到 channel.wechat-access.token / wsUrl"
    );
  }
  log("1/6", `token: ${token.slice(0, 8)}...  wsUrl: ${wsUrl}`);

  // 2. 读取 openclaw 配置
  log("2/6", `读取 openclaw 配置: ${OPENCLAW_CONFIG}`);
  const cfg = readJson<OpenClawConfig>(OPENCLAW_CONFIG);

  // 3. 写入 channels.wechat-access
  log("3/6", "注入 channels.wechat-access");
  cfg.channels ??= {};
  cfg.channels["wechat-access"] = {
    enabled: true,
    token,
    wsUrl: "wss://mmgrcalltoken.3g.qq.com/agentwss",
  };

  // 4. 启用插件
  log("4/6", "启用插件 wechat-access & openclaw-qqbot");
  cfg.plugins ??= {};

  // allow
  cfg.plugins.allow ??= [];
  for (const p of ["wechat-access", "openclaw-qqbot"] as const) {
    if (!cfg.plugins.allow.includes(p)) cfg.plugins.allow.push(p);
  }

  // load.paths
  cfg.plugins.load ??= {};
  cfg.plugins.load.paths ??= [];
  if (!cfg.plugins.load.paths.includes(EXTENSIONS_PATH)) {
    cfg.plugins.load.paths.push(EXTENSIONS_PATH);
  }

  // entries
  cfg.plugins.entries ??= {};
  cfg.plugins.entries["wechat-access"] = { enabled: true };
  cfg.plugins.entries["openclaw-qqbot"] = { enabled: true };

  // 5. 增加 bindings
  log("5/6", "增加 bindings (route → main via wechat-access)");
  cfg.bindings ??= [];
  const exists = cfg.bindings.some(
    (b) =>
      b.type === "route" &&
      b.agentId === "clawbot" &&
      b.match?.channel === "wechat-access"
  );
  if (!exists) {
    cfg.bindings.push({
      type: "route",
      agentId: "main",
      match: { channel: "wechat-access" },
    });
  }

  // 写回配置
  writeJson(OPENCLAW_CONFIG, cfg);
  log("5/6", `配置已写入: ${OPENCLAW_CONFIG}`);

  // 6. 退出 QClaw → 重启 openclaw gateway
  log("6/6", "退出 QClaw...");
  try {
    execSync(`osascript -e 'quit app "QClaw"'`);
    execSync("sleep 2");
    log("6/6", "QClaw 已退出");
  } catch {
    log("6/6", "QClaw 未运行，跳过");
  }

  log("6/6", "重启 openclaw gateway...");
  execSync("openclaw gateway restart", { stdio: "inherit" });

  console.log("\n✓ 全部完成！");
}

// npx ts-node openclaw-wechat.ts
// OPENCLAW_CONFIG=~/.openclaw/openclaw_test.json npx ts-node openclaw-wechat.ts
main();
