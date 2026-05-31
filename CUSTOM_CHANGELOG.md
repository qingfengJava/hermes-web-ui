# hermes-web-ui 定制改造与上游同步日志

> 仓库：`hermes-web-ui`（上游：EKKOLearnAI/hermes-web-ui）
> 维护规范：参见根目录 `DEVELOPMENT.md` 第六章
> 记录类型：`[Custom]` 定制改造 / `[Sync]` 上游同步 / `[Reset]` 分支重置

---

## 模板（复制使用）

### 定制改造模板

```markdown
## [Custom] YYYY-MM-DD ─ 简短标题

- 类型：feat / fix / refactor / chore
- 范围：彻底改造 | 增量优化 | 新增独立模块
- 影响文件：
  - `src/custom/xxx.tsx`（新增）
  - `src/components/xxx.tsx`（修改 12-45 行，做了 xxx）
- 与上游关系：
  - [独立] 新增文件，无合并风险
  - [叠加] 修改了上游文件，未来同步需关注此处
  - [改造] 彻底重写，上游对应改动不再合并
- 测试：UI 自测通过 / e2e 通过 / 接口联调通过
- 提交：`feat(custom): xxx`（commit hash）
```

### 上游同步模板

```markdown
## [Sync] YYYY-MM-DD ─ 同步上游 EKKOLearnAI/main

- 上游版本：commit `<short-sha>`（或 release tag）
- 新增文件 / 修改文件 / 删除文件
- 冲突处理：策略与原因
- 不可合并模块：原因 + 后续策略
- 合并建议：短期 / 长期
- 提交：`chore(sync): merge upstream main into custom @ YYYY-MM-DD`
```

---

## 历史记录（最新在上）

<!-- 在此处自上向下追加记录 -->

## [Reset] 2026-05-31 ─ 废弃旧 custom，基于最新 upstream/main 重建

- **背景**：旧 custom 分支对 `controllers/hermes/providers.ts`、`models.ts`、`AppSidebar.vue`、`router/index.ts` 进行侵入式改造，将存储后端从"YAML + 环境变量"替换为"共享数据库"，导致 2026-05-31 同步时 4 个文件出现 1300+ 行业务代码冲突，与上游"多 profile + 用户视角 + RouteLinkItem 重构"演进方向严重错位
- **决策**：本次同步上游 `EKKOLearnAI/main @ 98d877a` 时 `git merge --abort` 撤销合并，废弃旧 custom，从 `main`（已重置到 `upstream/main` 最新）重新拉出干净的 `custom`
- **旧分支归档**：旧 custom 已推送为 `custom-legacy`（顶点 `360d75a`），保留所有历史定制提交（含数据库配置改造 `055870f`、ConfigDbView 页面、CUSTOM_CHANGELOG 制度建立）作历史档案，未来若需查阅旧实现可 `git checkout custom-legacy`
- **后续计划**：按"扩展式 + StorageAdapter"架构重新实现企业级数据库与多模型配置能力
  - 上游 controller 文件几乎不改 → 上游同步零冲突
  - 在 `packages/server/src/services/storage/` 新建 `StorageAdapter` 抽象层 + `Yaml/MySql/PgSql` 三种实现
  - `ConfigDbView` 页面作为独立扩展面板保留，与上游 Models/Providers 页面并存
  - 多 profile（上游方向）+ DB 多配置（企业方向）正交叠加
  - 通过环境变量 `STORAGE_BACKEND=yaml|mysql|postgres` 切换运行模式
- **本仓库新 custom 起点**：等同于 `upstream/main @ 98d877a`，无任何定制改动
