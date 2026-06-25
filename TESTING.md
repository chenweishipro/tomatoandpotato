# Testing & Lint

## Lint
```bash
npm run lint          # next lint (eslint-config-next)
```

## Tests
```bash
npm run test          # 跑全部 (vitest run)
npm run test:watch    # TDD 模式
npm run test:cov      # 生成 coverage 报告 (html → coverage/index.html)
```

## 当前测试覆盖
| 文件 | 测试 | 覆盖 |
|---|---|---|
| `lib/utils.test.ts` | 8 个 | formatTime / startOfDay / endOfDay / startOfWeek / cn |
| `lib/api-client.test.ts` | 4 个 | apiFetch basePath 前缀逻辑 |

## 加新测试
- 工具函数: `lib/<name>.test.ts` 用 vitest 直接测试
- 组件: `components/<Name>.test.tsx` 用 @testing-library/react
- API routes: `app/api/<route>/route.test.ts` 集成测试 (mock prisma)

## 规则
- TDD: 新功能先写测试 (或 bug fix 同步写 regression test)
- critical 函数必须有 100% 覆盖 (utils, auth, api-client)
- 组件测试聚焦 behavior 而非渲染细节
