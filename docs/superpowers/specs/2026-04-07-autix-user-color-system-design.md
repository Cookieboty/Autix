# Autix-User 色系统一与重设计规格

## 1. 概述

### 项目背景
- **项目名称**: Autix (原 RBAC Admin)
- **用户系统包名**: `@autix/user` (clients/admin-web 需重命名)
- **目标**: 统一色系，支持暗黑/明亮双模式，建立科技感品牌视觉

### 设计目标
1. 统一所有硬编码颜色为 CSS 变量
2. 实现暗黑/明亮双主题切换
3. 建立科技深空 (Tech Space) 风格色系
4. 保持模块间差异化标识色

---

## 2. 设计系统

### 风格定义
- **Pattern**: Bento Grid Dashboard
- **Style**: Dark Mode (OLED) + 微霓虹点缀
- **Mood**: 专业技术感、高对比度、沉浸式深色

### 字体
- **标题/代码**: Fira Code
- **正文**: Fira Sans
- **CSS Import**: 已有，无需修改

### 色系层级

#### 主品牌色 (Brand Primary)
| Token | 暗黑模式 | 明亮模式 | 用途 |
|-------|----------|----------|------|
| `--primary` | `#3B82F6` | `#3B82F6` | 主要按钮、激活状态 |
| `--primary-foreground` | `#FFFFFF` | `#FFFFFF` | 按钮文字 |

#### 辅助色 (Semantic)
| Token | 暗黑模式 | 明亮模式 | 用途 |
|-------|----------|----------|------|
| `--accent` | `#06B6D4` | `#0891B2` | 链接、hover、图标 |
| `--success` | `#22C55E` | `#16A34A` | 成功状态 |
| `--warning` | `#F59E0B` | `#D97706` | 警告状态 |
| `--destructive` | `#EF4444` | `#DC2626` | 错误、危险 |

#### 背景色 (Background)
| Token | 暗黑模式 | 明亮模式 | 用途 |
|-------|----------|----------|------|
| `--background` | `#0F172A` | `#F8FAFC` | 主背景 |
| `--card` | `#1E293B` | `#FFFFFF` | 卡片、容器 |
| `--popover` | `#1E293B` | `#FFFFFF` | 弹出层 |
| `--muted` | `#334155` | `#F1F5F9` | 次级背景 |
| `--input` | `#334155` | `#F1F5F9` | 输入框背景 |

#### 边框色 (Border)
| Token | 暗黑模式 | 明亮模式 | 用途 |
|-------|----------|----------|------|
| `--border` | `#475569` | `#E2E8F0` | 边框 |
| `--ring` | `#3B82F6` | `#3B82F6` | 聚焦环 |

#### 文字色 (Foreground)
| Token | 暗黑模式 | 明亮模式 | 用途 |
|-------|----------|----------|------|
| `--foreground` | `#F8FAFC` | `#0F172A` | 主要文字 |
| `--muted-foreground` | `#94A3B8` | `#475569` | 次要文字 |
| `--card-foreground` | `#F8FAFC` | `#0F172A` | 卡片文字 |

---

## 3. 模块特色色

为保持各模块的视觉区分，使用以下特色色：

| 模块 | 暗黑模式 | 明亮模式 | 应用场景 |
|------|----------|----------|----------|
| 用户管理 | `#3B82F6` | `#2563EB` | 用户模块图标、标签 |
| 角色管理 | `#8B5CF6` | `#7C3AED` | 角色模块图标、标签 |
| 权限中心 | `#06B6D4` | `#0891B2` | 权限模块图标、标签 |
| 部门管理 | `#F59E0B` | `#D97706` | 部门模块图标、标签 |
| 系统配置 | `#22C55E` | `#16A34A` | 系统模块图标、标签 |

---

## 4. 项目名称变更

### 需要修改的位置
1. **package.json**: `name` 字段改为 `@autix/user`
2. **layout.tsx metadata**: `title` 改为 `"Autix User"`
3. **login/page.tsx**: Logo 文字改为 `"Autix"`
4. **sidebar.tsx**: Logo 文字改为 `"Autix"`
5. **其他硬编码 "RBAC Admin"**: 全部替换为 `"Autix"`

---

## 5. 实现范围

### 需要修改的文件

#### 全局样式
- `globals.css` - 重写所有 CSS 变量定义

#### 布局组件
- `sidebar.tsx` - Logo + 激活状态颜色
- `header.tsx` - 背景色（已有透明效果，无需大改）
- `user-menu.tsx` - Avatar 颜色

#### 页面组件
- `login/page.tsx` - Logo + 背景渐变 + 按钮颜色
- `profile/page.tsx` - 标题 + 按钮颜色
- `users/page.tsx` - 标题 + 按钮颜色
- `roles/page.tsx` - 标题 + 按钮颜色
- `departments/page.tsx` - 标题 + 按钮颜色
- `permission-center/page.tsx` - 标题 + 按钮颜色

#### 功能组件
- `users/user-drawer.tsx` - 按钮颜色
- `roles/role-drawer.tsx` - 按钮颜色
- `roles/permission-drawer.tsx` - 按钮颜色
- `departments/department-drawer.tsx` - 按钮颜色
- `permission-tree/menu-drawer.tsx` - 按钮颜色
- `permission-tree/system-drawer.tsx` - 按钮颜色
- `permission-tree/permission-drawer.tsx` - 按钮颜色

---

## 6. 主题切换机制

### 方案
使用 Tailwind CSS 的 `class` 策略 + `next-themes` 库：

```tsx
// 在 html 标签上切换 dark 类
<html class="dark"> /* 暗黑模式 */ </html>
<html> /* 明亮模式 */ </html>
```

### 需要添加的依赖
- `next-themes` (已安装或需添加)

### 数据属性方式 (备选)
```tsx
<html data-theme="dark">
<html data-theme="light">
```

---

## 7. 抗atterns 避免

- ❌ 不使用纯 hex 硬编码颜色
- ❌ 不使用 `bg-white` / `bg-black` 等直接颜色
- ❌ 不使用 `text-gray-500` 等 Tailwind 默认色板
- ✅ 所有颜色通过 CSS 变量引用
- ✅ 优先使用 semantic token (primary, accent, destructive)

---

## 8. 验收标准

### 视觉验收
- [ ] 暗黑模式下所有文字对比度 ≥ 4.5:1
- [ ] 明亮模式下所有文字对比度 ≥ 4.5:1
- [ ] 主题切换无闪烁 (flash)
- [ ] 侧边栏激活状态清晰可辨
- [ ] 模块特色色在各页面保持一致

### 功能验收
- [ ] 主题切换按钮正常工作
- [ ] 刷新页面保持主题选择
- [ ] 所有按钮 hover/active 状态正常
- [ ] 表单输入框 focus 状态可见

### 项目名称验收
- [ ] 所有 "RBAC Admin" 替换为 "Autix"
- [ ] package.json name 正确
- [ ] 浏览器 tab title 正确
