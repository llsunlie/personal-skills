# 来源与维护说明

## 原始项目

- 仓库：[danyuchn/asd-ste100-skill](https://github.com/danyuchn/asd-ste100-skill)
- 原作者：Dustin Yuchen Teng，见上游版权声明。
- 用途：将简化技术英语的写作原则用于 Agent 输出、提示词、工具描述和错误消息，减少歧义。
- 导入版本：本机已安装的 `0.4.0` 快照，版本号来自 `SKILL.md`。未把导入时上游最新提交冒充为安装来源；原始安装提交未记录。
- 许可证：MIT；原许可证保存在 [LICENSE](LICENSE)。

## 理念来源

写作原则来源于 [ASD-STE100 Simplified Technical English](https://www.asd-ste100.org/)。这是该 skill 参考的技术写作标准，不是另一个被合并的 GitHub 代码项目。

本 skill 提供规则说明、示例和结构检查脚本；不包含官方标准全文或完整批准词典。具体参考链接保留在 [references/writing-rules.md](references/writing-rules.md)。

## 纳入个人库的内容

保留本机安装的 `SKILL.md`、`README.md`、许可证、示例、参考资料和 `scripts/ste-lint.py`。这次归档新增了来源说明和来源链接，没有更新或改写现有检查脚本。

原始安装是否含有历史本地修改尚未与上游逐文件核对。因此这里只声明保存了本机版本，不声明它与上游某个提交完全相同。

## 后续维护

个人版本由 [llsunlie/personal-skills](https://github.com/llsunlie/personal-skills) 维护。安装和同步遵循个人库根目录的 README；本目录原有 README 中的上游安装命令仅保留为原始文档。

需要更新上游时先比较差异，保留本地修改和许可证。可以运行 `python3 scripts/ste-lint.py --selftest` 检查脚本行为。
