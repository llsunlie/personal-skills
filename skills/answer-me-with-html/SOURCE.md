# 来源与定制说明

本 skill 基于一个上游实现，结合另一个项目的阅读交互思路定制。下面分别记录代码来源、交互参考和本地新增内容。

## 上游实现：Answer me with HTML

- 仓库：[QingYunA/answer-me-with-html](https://github.com/QingYunA/answer-me-with-html)
- 作用：提供 skill 的基本工作流、扩展 Markdown 格式、HTML 渲染器、图表组件、主题、写作检查和视频能力。
- 导入基线：本机已安装版本，CLI 标识为 `0.4.12`；不是对上游当前最新提交的声明。
- 许可证：MIT；原许可证保存在本目录的 [LICENSE](LICENSE)。
- 代码关系：`scripts/am.mjs` 是上游打包后的 CLI，包含本地接入修改；`SKILL.md` 在原指令上增加了个人库维护和折叠阅读说明。

## 交互参考：TextFold

- 仓库：[chenxiachan/textfold](https://github.com/chenxiachan/textfold)
- 参考文档：[中文介绍](https://github.com/chenxiachan/textfold/blob/main/README.zh-CN.md)、[Agent 折叠插件](https://github.com/chenxiachan/textfold/tree/main/plugins/textfold)。
- 借鉴内容：五级阅读、由概览逐层展开、单节展开，以及保留文字移动、其余文字淡出的过渡方式。
- 实现关系：本仓库的 `scripts/fold.mjs` 独立实现这些交互；没有复制或打包 TextFold 的阅读器代码，也不依赖 TextFold 服务。
- 来源项目许可证：Apache-2.0，见该项目 [LICENSE](https://github.com/chenxiachan/textfold/blob/main/LICENSE)。这里记录的是参考项目的许可证；本目录的 MIT 许可证来自 Answer me with HTML 上游。

## 本地定制

- `scripts/fold.mjs`：分句和分词、五级原句提取、逐词移动与淡出、连续滑杆、单节展开、Shift＋滚轮平滑缩放。
- 默认显示全文；支持 `fold: 1` 至 `fold: 5`，以及 `fold: off`。
- 滚轮输入统一像素、行、页单位，兼容横向映射；按动画帧累计，并避免短滚动取整后退回原级。
- `scripts/preview.mjs`、`scripts/catalog.html`：固定本地预览地址，以及会话、轮次和页面归档目录。
- `SKILL.md`、[references/folding.md](references/folding.md)：写作约定、配置方式和操作说明。

本版本的层级是固定的原句提取：每段前两句、每段第一句、每节第一句、章节标题。它采用 TextFold Agent 折叠的思路，不包含 TextFold 文档阅读器的 AI 语义摘要、文件导入、PDF 对照、翻译和问答能力。

## 维护位置

个人版本由 [llsunlie/personal-skills](https://github.com/llsunlie/personal-skills) 维护。更新上游时手动合并，并保留本地模块和接入代码。生成页面、会话数据和个人配置不属于 skill 源码。
