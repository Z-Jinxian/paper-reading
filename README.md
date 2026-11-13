# 论文阅读

一个用来管理机器学习论文和精读笔记的单人工作台。按专题和方法标签找论文，在同一页查看原文章节、公式、符号解释和数值算例。

## 功能

- 创建专题，为论文选择专题并添加方法标签。
- 新增、编辑和搜索论文。移入回收站后可以恢复。
- 配置多个 OpenAI 兼容模型。在生成草稿时选择本次使用的模型。
- 输入公开 PDF 或支持的论文页面链接后，PDF.js 在浏览器解析原文。模型标出重点章节和公式的位置，浏览器从对应 PDF 页面裁出截图。
- 保存前核对草稿、截图、页码和算例。阅读页支持放大原图和跳到 PDF 对应页。

## 本地运行

需要 Node.js 22.13 或更高版本（推荐 Node.js 24 LTS）和 npm。

```sh
git clone https://github.com/Z-Jinxian/paper-reading.git
cd paper-reading
npm ci
npm run db:local
npm run dev
```

打开 [http://127.0.0.1:5173](http://127.0.0.1:5173)，从「演示笔记」预览版式，或通过「新建专题」「新增论文」开始。Wrangler 在 `.wrangler/state/` 保存本地 D1 数据和 R2 截图。启动时会将 PDF.js 运行文件复制到 `public/pdf-engine/`。

### 配置模型 API

在项目根目录创建 `.dev.vars`。用下面的命令生成 64 个十六进制字符。

```sh
node -p "require('node:crypto').randomBytes(32).toString('hex')"
```

把生成结果填入 `.dev.vars`。

```dotenv
NOTEBOOK_CREDENTIAL_KEY=填入刚生成的64位十六进制字符
```

重启开发服务。进入「管理论文 → 模型 API」添加配置，填写 Base URL、模型名和服务商的 API Key。Base URL 填到版本前缀，例如 `https://api.openai.com/v1`。后端向该地址的 `/chat/completions` 发送带页码和行号的 PDF 文本。选择允许接收论文内容的服务商。API Key 使用 `NOTEBOOK_CREDENTIAL_KEY` 加密后存入 D1，请保留该加密密钥，换密钥后需重新保存各模型的 API Key。

在「新增论文」粘贴可访问的 HTTPS 论文链接，选中模型并生成精读草稿。扫描 PDF 缺少可提取的文字时，建议使用带文本层的版本。可以随时手动编辑并保存笔记。

## 独立部署

如需在浏览器中远程访问，可部署到 Cloudflare Workers。项目按单人使用设计，使用 HTTPS 和 HTTP Basic Auth 保护远程访问。用户名是 `notebook`，密码从 `NOTEBOOK_PASSWORD` 读取。

1. 在 Cloudflare 创建 D1 数据库和 R2 桶。将真实数据库 ID、数据库名称和桶名称填入 `wrangler.jsonc`，保留 `DB`、`BUCKET`、`ASSETS` 绑定名。按需配置自定义域名，或将 `workers_dev` 改为 `true`。
2. 运行 `npx wrangler d1 migrations apply DB --remote --config wrangler.jsonc`，然后运行 `npm run build` 和 `npx wrangler deploy`。
3. 用 `npx wrangler secret put NOTEBOOK_PASSWORD` 设置独立的强密码，再用 `npx wrangler secret put NOTEBOOK_CREDENTIAL_KEY` 设置模型密钥的加密密钥。通过 HTTPS 打开部署地址。远程请求只有在设置密码后才可访问。

备份数据时，请保存 D1、R2 以及用于读取模型 API Key 的加密密钥。

## 项目结构

| 路径 | 内容 |
| --- | --- |
| `worker/` | Worker 入口、页面渲染、论文与专题接口、模型配置、PDF 获取和精读草稿 |
| `public/` | 页面样式、交互、PDF.js 文本抽取和截图裁切 |
| `content/` | 首页模板和自编演示笔记 |
| `drizzle/` | D1 数据库迁移 |

运行 `npm run check` 检查类型，`npm run build` 验证生产构建。更新数据库结构时编辑 `db/schema.ts`，运行 `npm run db:generate` 生成迁移。

## 许可证

项目源码和自编演示内容采用 [MIT 许可证](LICENSE)。依赖及论文原文遵循各自的许可。
