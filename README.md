# EPUB Merger

一个 **纯静态（前端）** 的 EPUB 电子书合并工具。所有的数据解析、压缩、重新生成都在您的浏览器内存中完成，**不依赖任何后端服务器，保证您的数据隐私与安全**。

在线使用：[https://epub-merger.minjer.top](https://epub-merger.minjer.top)

## ✨ 特性 (Features)

- 🔒 **本地处理**：纯浏览器端运行，无需上传，保护隐私。
- 📚 **多本合并**：支持一次性拖拽/选择多本 `.epub` 文件，支持追加。
- 🖱️ **可视化排序**：原生支持拖拽调整书籍合并后的排版顺序。
- ✏️ **元数据编辑**：支持自定义合并后的书名、作者、语言、出版商等。
- 🖼️ **智能封面**：自动提取可用的书籍封面，允许您自由选择任一一本的封面作为合并后总集的封面。
- 🌓 **深浅色模式**：默认清爽的浅色风格，右上角一键无缝切换保护视力的暗色模式。
- 兼容性好：自动生成 EPUB 3 的 `nav.xhtml` 及 EPUB 2 的兼容 `toc.ncx` 目录。内容合并相互隔离（`book_0`, `book_1`），防止内部图片与样式表冲突。

## 🚀 快速开始 (Quick Start)

因为是纯静态网页，您不需要任何构建工具或复杂的服务器环境配置。

1. **下载/克隆仓库**：
   ```bash
   git clone https://github.com/mj3622/epub-merger.git
   ```
2. **打开使用**：
   直接使用浏览器（推荐 Chrome、Edge 或 Safari）打开项目目录下的 `index.html`，即可开始使用。

## 🛠️ 技术栈 (Tech Stack)

- **HTML5 & CSS3** (Vanilla CSS, CSS Variables, Glassmorphism UI)
- **Vanilla JavaScript** (无框架，零包袱)
- [**JSZip**](https://stuk.github.io/jszip/)：在浏览器中读取、创建、编辑 ZIP (EPUB) 档案。
- [**SortableJS**](https://sortablejs.github.io/Sortable/)：提供丝滑的拖拽重排序体验。
