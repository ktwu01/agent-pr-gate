# agent-pr-gate

**想用 PR 轰炸我们？你的 agent 先用问题轰炸你。**

一个账号，**10 天提交 58 个 PR，最终合并 5 个。**
这就是 [benchmark-radar 遇到的情况](https://github.com/ktwu01/benchmark-radar/blob/main/CONTRIBUTING.md#a-real-example-of-a-flood)。

于是，我们在 `CONTRIBUTING.md` 里加了四个问题。
AI agent 写 PR 之前，得先停下来，问清楚用户到底想做成什么。
**agent 不能代答。人不回答，它就得等。**

谁让 agent 生成工作，谁先回答问题。使用下面的命令，将规则接入你的仓库。

[English](README.md)

## 接入你的仓库

克隆这个仓库，然后使用 Node.js 20 或更新版本运行安装器：

```sh
git clone https://github.com/ktwu01/agent-pr-gate.git
node agent-pr-gate/scripts/install.mjs --target /path/to/your/repo --agents claude,codex,pi
```

可以选择一个 agent，也可以用逗号分隔多个。安装器保留已有贡献规则和 agent 配置。重复运行不会重复追加规则。

安装的规则允许只读探索，不立即提出四问。准备修改文件或起草 PR 时，agent 才询问尚未回答的问题并等待人回答。同一次贡献复用已有答案。

安装后，在目标仓库中重启 agent。Claude Code 从 `CLAUDE.md` 加载完整规则，Codex 和 Pi 从 `AGENTS.md` 加载。三者都使用原生项目指令发现机制。安装器不安装 hook 或扩展，也不修改 agent 设置。

Agent 配置可能禁用或覆盖项目指令。Codex 的加载受项目指令大小限制和覆盖规则影响。Pi 的 `--no-context-files` 会禁用指令加载。安装器不拦截工具，也不强制审批 PR。

接入方式依据 [Claude Code 项目指令文档](https://code.claude.com/docs/en/memory)、[Codex 项目指令指南](https://developers.openai.com/codex/guides/agents-md)和 [Pi 配置文档](https://github.com/earendil-works/pi/blob/v1.2.0/packages/coding-agent/docs/configuration.md)。

已安装的规则被修改或标记格式有误时，安装器会在写入前停止。选择 Codex 时，根目录存在 `AGENTS.override.md`，或 `AGENTS.md` 超过默认的 32 KiB 限制，也会停止。请检查冲突，不要直接覆盖。将安装生成的文件提交到目标仓库，让其他人克隆时也能收到规则。

手动接入时，将[通用四问模板](templates/gate.md)追加到 `CONTRIBUTING.md` 和 agent 的项目指令文件中。保留已有规则。[这个仓库也在用。](CONTRIBUTING.md)

运行 `node --test tests/install.test.mjs` 检查安装器。

## 为什么做这个？

一个账号，**10 天向 benchmark-radar 提交 58 个 PR，最终合并 5 个。**
[维护者的记录](https://github.com/ktwu01/benchmark-radar/blob/main/CONTRIBUTING.md#a-real-example-of-a-flood)
列出了这次集中提交的情况，其中一次在 27 秒内提交了 8 个 PR。

现在，benchmark-radar 要求贡献者回答这四个问题，并要求 agent 等用户本人回答。
仓库还另设了未关闭 issue 和 PR 的数量上限。这里尚未统计采用四问规则后的效果。

想法很简单：先让贡献者想清楚谁会受益，再给维护者增加工作。
受益者可以是软件用户，也可以是维护者。

这套规则依赖 agent 读取并遵守指令，无法强制阻止 PR 提交。

## 谁在用？

保留注释 `<!-- github.com/ktwu01/agent-pr-gate -->`，别人就能通过它找到你的仓库。
[在 GitHub 上搜索](https://github.com/search?q=%22github.com%2Fktwu01%2Fagent-pr-gate%22+path%3ACONTRIBUTING.md&type=code)。
公布采用数量前，请确认各仓库确实使用了规则，并按仓库去重。搜索结果可能包含副本和示例，也会漏掉未被索引的仓库。

## 分享给其他维护者

把[这个仓库](https://github.com/ktwu01/agent-pr-gate)发给正在被 PR 淹没的维护者。

灵感来自 [@ycaophysics](https://x.com/ycaophysics)。
采用 [CC0 1.0](LICENSE)，可以自由复制和修改，无需署名。
