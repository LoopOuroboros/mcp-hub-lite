[根目录](../../../CLAUDE.md) > [frontend](../) > [src](../) > **i18n**

# I18N 模块

## 模块职责

I18N 模块负责前端国际化支持，使用 Vue I18n 实现多语言界面切换。

## 目录结构

```
i18n/
└── index.ts    # Vue I18n 配置和初始化
```

## 语言文件

### English (`en.ts`)

**职责**: 英文语言包

**包含内容**:

- 所有界面文本的英文翻译
- 错误消息
- 提示信息
- 按钮文本

### Chinese (`zh.ts`)

**职责**: 中文语言包

**包含内容**:

- 所有界面文本的中文翻译
- 错误消息
- 提示信息
- 按钮文本

## 核心文件

### Index (`index.ts`)

**职责**: Vue I18n 配置和初始化

**主要功能**:

- 加载语言包
- 配置默认语言
- 创建和导出 i18n 实例
- 支持语言切换

**依赖**:

- `vue-i18n` - Vue I18n 库
- `en.ts` - 英文语言包
- `zh.ts` - 中文语言包

## 依赖关系

```
i18n/
├── index.ts
│   ├── depends on: ./en.ts
│   └── depends on: ./zh.ts
├── en.ts
└── zh.ts
```

## 集成方式

I18N 模块在 `frontend/src/main.ts` 中被初始化和使用：

```typescript
import i18n from './i18n';
// ...
app.use(i18n);
```

在组件中使用：

```vue
<template>
  <h1>{{ $t('welcome.message') }}</h1>
</template>
```

## 语言切换

用户可以通过界面切换语言，系统会自动保存用户偏好到 localStorage。

**支持的语言**:

- English (en)
- 中文 (zh)

## 测试与质量

I18N 模块目前没有专门的单元测试，主要通过手动测试验证多语言功能。

## 常见问题 (FAQ)

### Q: 如何添加新语言？

A: 1. 创建新的语言文件（如 `fr.ts`）2. 在 `index.ts` 中导入并添加到 messages 配置 3. 更新语言切换组件支持新语言

### Q: 如何处理动态内容的翻译？

A: 使用 Vue I18n 的插值功能：

```javascript
// 语言包
{
  "user.greeting": "Hello {name}!"
}

// 组件中
$t('user.greeting', { name: 'John' })
```

## 相关文件清单

| 文件路径        | 描述          |
| --------------- | ------------- |
| `i18n/index.ts` | Vue I18n 配置 |
| `i18n/en.ts`    | 英文语言包    |
| `i18n/zh.ts`    | 中文语言包    |

## 变更记录 (Changelog)

### 2026-01-29

- 初始化 I18N 模块文档
