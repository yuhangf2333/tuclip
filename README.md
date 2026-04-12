<div align="center">
  <img src="docs/images/tuclip-logo.png" alt="TuClip" width="720">

  <p>
    <a href="./README.md"><strong>简体中文</strong></a> ·
    <a href="./README_EN.md"><strong>English</strong></a>
  </p>
  <p>
    <img src="https://img.shields.io/badge/version-0.1.0-4c8bf5" alt="Version">
    <img src="https://img.shields.io/badge/Electron-40-47848F?logo=electron&logoColor=white" alt="Electron">
    <img src="https://img.shields.io/badge/React-19-20232A?logo=react&logoColor=61DAFB" alt="React">
    <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
    <img src="https://img.shields.io/badge/macOS-only-111111?logo=apple&logoColor=white" alt="macOS only">
  </p>
</div>

TuClip 是一个截图管理工具。


## 本地运行

环境要求：

- Node.js `20.19+` 或 `22.12+`
- npm
- 当前仅支持 macOS

第一次运行：

```bash
git clone <仓库地址>
cd TuClip
npm install
```

开发模式：

```bash
npm run dev
```

直接启动：

```bash
npm start
```

构建：

```bash
npm run build
```

> 当前版本依赖 macOS 专用的窗口效果与运行逻辑，暂不支持 Windows。

## 界面预览

![TuClip 主界面](docs/images/app-screenshot.png)

## 主要功能

- **剪贴板监听**  
  检测新的截图图片，放进待处理队列。

- **待处理弹窗**  
  支持保存、编辑、备注、标签。

- **工作区与标签**  
  可以给不同项目建工作区，也可以先放在全局 Inbox。

- **标注编辑器**  
  目前支持矩形框、编号、文字标签和裁剪，并保留编辑历史。

- **稳定导出路径**  
  正式图片直接放在工作区根目录，例如 `001.png`、`002.png`。

- **远程能力**
  - WebDAV：同步整个工作区
  - S3 / R2：把正式图片发布成远程链接

## 数据存储

正式图片放在工作区根目录，内部数据放在隐藏目录 `.tuclip/`。
