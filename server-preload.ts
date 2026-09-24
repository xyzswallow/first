import { AsyncLocalStorage } from "node:async_hooks";

// Next.js 内部依赖全局 AsyncLocalStorage（其官方 CLI 会注入）。
// 自定义服务器场景需在导入 next 之前手动补全，否则 app-render 报
// "Invariant: AsyncLocalStorage accessed in runtime where it is not available"。
(globalThis as unknown as { AsyncLocalStorage: typeof AsyncLocalStorage }).AsyncLocalStorage =
  AsyncLocalStorage;
