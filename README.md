# agent-pr-gate

**DDoS us with PRs? Your own agent has questions to DDoS you first.**

One account. **58 PRs in 10 days. Five merged.** That's what landed in
[benchmark-radar's review queue](https://github.com/ktwu01/benchmark-radar/blob/main/CONTRIBUTING.md#a-real-example-of-a-flood).

So we put four questions in `CONTRIBUTING.md`. Before an AI agent writes a PR,
it has to stop and ask its human what they're actually trying to achieve.
**The agent can't answer for them. It has to wait.**

The person generating the work gets the questions first. Install the rules in your repository with the command below.

[简体中文](README.zh-CN.md)

## Install in your repository

Clone this repository, then run the installer with Node.js 20 or later:

```sh
git clone https://github.com/ktwu01/agent-pr-gate.git
node agent-pr-gate/scripts/install.mjs --target /path/to/your/repo --agents claude,codex,pi
```

Choose one agent or a comma-separated list. The installer preserves existing contribution rules and agent configuration. Running it again does not add duplicate sections.

The installed instructions allow read-only exploration without asking the four questions. Before changing files or drafting a PR, the agent asks for missing human answers and waits. Reuse answers for the same contribution.

Restart your agent in the target repository after installation. Claude Code loads the full rules from `CLAUDE.md`. Codex and Pi load them from `AGENTS.md`. All three use native project instruction discovery. No hook or extension is installed, and agent settings are left untouched.

Agent configuration can disable or override project instructions. Codex instructions are subject to its project instruction size limit and overrides. Pi's `--no-context-files` disables instruction loading. This installer does not block tools or enforce PR approval.

The integrations follow the [Claude Code project instruction guide](https://code.claude.com/docs/en/memory), [Codex project instruction guide](https://developers.openai.com/codex/guides/agents-md), and [Pi configuration reference](https://github.com/earendil-works/pi/blob/v1.2.0/packages/coding-agent/docs/configuration.md).

The installer stops before writing if a previously installed gate has been edited or its markers are malformed. For Codex, it also refuses a root `AGENTS.override.md` or an `AGENTS.md` that exceeds the default 32 KiB limit. Review these conflicts instead of overwriting them. Commit the installed files so others receive them with the repository.

For a manual install, append the [gate template](templates/gate.md) to `CONTRIBUTING.md` and your agent's project instructions. Keep your existing rules. [We use the gate here too.](CONTRIBUTING.md)

Run the installer checks with `node --test tests/install.test.mjs`.

## Why this exists

One account opened **58 PRs in 10 days** on benchmark-radar. **Five were merged.**
The [maintainer's account](https://github.com/ktwu01/benchmark-radar/blob/main/CONTRIBUTING.md#a-real-example-of-a-flood)
documents the flood, including eight PRs in 27 seconds.

benchmark-radar now asks these four questions and tells agents to wait for the human.
It also added a separate open-item limit. Results after adopting the gate have not been measured here yet.

The idea is simple: ask contributors to think about who benefits before generating work for maintainers.
“Customer” can mean a user or a maintainer.

This works only when an agent reads and follows the instructions. It is not an enforced PR blocker.

## Who uses it?

Keep `<!-- https://github.com/ktwu01/agent-pr-gate -->` in your snippet so others can find it.
[Search GitHub for adopters](https://github.com/search?q=%22github.com%2Fktwu01%2Fagent-pr-gate%22+path%3ACONTRIBUTING.md&type=code).
Verify actual use and count unique repos before reporting adoption numbers. Search results can include copies and examples, and miss unindexed repos.

## Pass it on

Share [this repo](https://github.com/ktwu01/agent-pr-gate) with a maintainer whose review queue needs a break.

Inspired by [@ycaophysics](https://x.com/ycaophysics).
[CC0 1.0](LICENSE). Copy and adapt freely. No attribution required.
