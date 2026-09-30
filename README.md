# SyncDocs

> 在线协作文档系统

一个基于 Next.js 的在线协作文档系统，支持富文本文档与表格的多人实时协作、版本管理、分享与导出。

## 功能特性

- **富文本文档**：基于 Tiptap / ProseMirror，支持标题、列表、任务列表、加粗/斜体/下划线/删除线、文字颜色、高亮、链接、代码块、引用、对齐等。
- **在线表格**：内置公式引擎（支持 SUM、查找类函数等），A1 表示法，键盘快捷键操作。
- **实时协作**：基于 Yjs + WebSocket 的 CRDT 协同编辑，多人同时编辑无冲突。
- **版本管理**：文档快照、历史版本查看与恢复、版本删除。
- **分享与权限**：分享链接、只读/可写权限控制。
- **文档导出**：
  - 富文本文档导出为 Word（`.docx`）
  - 表格导出为 Excel（`.xlsx`），保留公式并附带计算结果
- **用户与后台**：注册/登录、修改密码、管理后台（用户与文档管理）。

## 技术栈

- **框架**：Next.js 16（App Router）+ React 19
- **自定义服务器**：`server.ts`（Next + WebSocket `/ws`），通过 `tsx` 运行
- **协同**：Yjs、y-protocols、ws
- **编辑器**：Tiptap / ProseMirror
- **导出**：docx（Word）、ExcelJS（Excel）
- **数据存储**：better-sqlite3
- **认证**：iron-session、bcryptjs
- **样式**：Tailwind CSS 4

## 快速开始

### 环境要求

- Node.js 18+

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

服务启动后访问 http://localhost:3000

### 生产构建与运行

```bash
npm run build
npm run start
```

## 项目结构

```
src/
├── app/                    # Next.js App Router 页面与 API 路由
│   ├── admin/              # 管理后台页面
│   ├── api/                # 接口（认证、文档、导出、分享、管理等）
│   ├── doc/[id]/           # 富文本文档页
│   ├── sheet/[id]/         # 表格页
│   ├── documents/          # 文档列表
│   └── share/[token]/      # 分享访问页
├── components/             # React 组件
│   ├── editors/            # DocEditor（富文本）、SheetEditor（表格）
│   └── ...                 # 列表、分享、版本历史、认证弹窗等
├── lib/                    # 工具库
│   ├── docxExport.ts       # tiptap JSON → Word 导出
│   ├── formula.ts          # 表格公式引擎
│   ├── api.ts / types.ts   # 前端 API 封装与类型
└── server/                 # 服务端逻辑
    ├── ws/roomHub.ts       # WebSocket 协作中枢
    ├── db.ts               # SQLite 数据层
    └── auth / session ...  # 认证与会话
```

## 导出说明

- **文档导出 Word**：在文档编辑页工具栏点击「导出 Word」，将当前文档转换为 `.docx` 并下载。
- **表格导出 Excel**：在表格编辑页点击「导出 Excel」，导出 `.xlsx`；公式单元格同时保留公式表达式与计算结果。
