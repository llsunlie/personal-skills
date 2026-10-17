# Personal Skills

llsunlie 的个人 AI Agent skill 库。每个 skill 单独放在 `skills/<name>/`，通过 Git 维护指令、脚本和参考资料。

## 已收录

| Skill | 功能 | 来源与定制 |
|---|---|---|
| [answer-me-with-html](skills/answer-me-with-html/SKILL.md) | Markdown 生成 HTML；五级阅读、Shift＋滚轮平滑缩放、本地预览与归档 | 基于 [QingYunA/answer-me-with-html](https://github.com/QingYunA/answer-me-with-html)，结合 [chenxiachan/textfold](https://github.com/chenxiachan/textfold) 的折叠交互思路；[详细来源](skills/answer-me-with-html/SOURCE.md) |
| [asd-ste100](skills/asd-ste100/SKILL.md) | 简化技术英语，减少指令、提示词和工具说明的歧义 | 导入 [danyuchn/asd-ste100-skill](https://github.com/danyuchn/asd-ste100-skill) 本机 `0.4.0` 快照；[详细来源](skills/asd-ste100/SOURCE.md) |

`answer-me-with-html` 默认显示全文。HTML 渲染器来自 Answer me with HTML，阅读交互参考 TextFold；折叠模块由个人版本独立实现。两个 skill 各自保留上游 MIT 许可证。

每个 skill 的 `SOURCE.md` 记录上游地址、导入版本或来源不确定性、许可证、参考项目及本地修改。引用交互思路与直接复制代码分别说明。

## 安装

需要 Git、Python 3，以及运行 HTML skill 所需的 Node.js 20 或更新版本。`asd-ste100` 的结构检查脚本只需要 Python 3。

```bash
git clone https://github.com/llsunlie/personal-skills.git
cd personal-skills
python3 scripts/install.py
```

安装器将 skill 链接到 `~/.agents/skills/`。如果已有同名安装，会先移到 `~/.agents/skill-backups/`，再建立链接。重复安装同一来源不会重复备份。私有仓库需要先配置 GitHub 登录。

也可以指定安装目录或只安装一个 skill：

```bash
python3 scripts/install.py --skill answer-me-with-html --target ~/.codex/skills
```

安装后，本机使用的 skill 直接指向仓库中的文件。修改 skill 即修改仓库内容，生成页面和配置仍保存在仓库外。

## 维护

修改后查看并提交需要维护的文件：

```bash
git status
git diff
git add skills/ README.md
git commit -m "Improve HTML reading controls"
git push
```

在其他设备更新时，确认没有未提交修改，再执行 `git pull --ff-only`。软链接无需重新安装。

新增 skill 时，在 `skills/` 下建立同名目录，放入 `SKILL.md`、`SOURCE.md`、上游许可证和所需资源，再运行安装器。系统自带 skill 和第三方插件不自动收录。

更新 HTML skill 的上游版本时应手动合并，保留 `fold.mjs`、`preview.mjs`、`catalog.html` 及 `am.mjs` 中的接入代码。

## 数据边界

仓库保存 skill 源码和说明。生成页面、会话记录、本机配置、密钥、缓存和备份保留在本机。
