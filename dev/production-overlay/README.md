# EulerStream Production Overlay

Production TikTok LIVE overlay built with React, TypeScript, and the EulerStream Overlay SDK.

## Build

From the repository root:

```powershell
corepack.cmd pnpm --filter production-overlay exec tsc --noEmit
corepack.cmd pnpm --filter production-overlay run build
```

## Development

```powershell
corepack.cmd pnpm --filter production-overlay run dev
```

## Overlay Configuration

### Timing

| Option | Default | Range |
|---|---:|---:|
| Fade In (ms) | 500 | 100–2000 |
| Fade Out (ms) | 500 | 100–2000 |
| Display Time (ms) | 3000 | 1000–10000 |

### Appearance

| Option | Default | Range |
|---|---:|---:|
| Font Size | 48 | 24–96 |
| Profile Image Size | 200 | 100–400 |

## Source Structure

```text
src/
├── index.ts
├── Overlay.tsx
└── components/
    ├── CommentNotification.tsx
    ├── FiveColumnLayout.tsx
    ├── FollowNotification.tsx
    ├── GiftNotification.tsx
    ├── JoinNotification.tsx
    └── LikeNotification.tsx
```

The overlay manifest is defined in `manifest.ts`.

Static CSS is located in `public/index.css`.

## Package

Package name: `production-overlay`

The package is private and is intended to be built as part of the EulerStream workspace.
