// Utils
const $ = document.querySelector.bind(document);
const $$ = document.querySelectorAll.bind(document);

// DOM Elements
const dropZone = $('#drop-zone');
const fileInput = $('#file-input');
const browseBtn = $('#browse-btn');
const bookListSection = $('#book-list-section');
const bookListEl = $('#book-list');
const bookCountEl = $('#book-count');
const metadataSection = $('#metadata-section');
const actionSection = $('#action-section');
const clearBtn = $('#clear-btn');
const mergeBtn = $('#merge-btn');
const toastEl = $('#toast');
const coverSourceSelect = $('#cover-source');
const coverPreview = $('#cover-preview');
const themeToggleBtn = $('#theme-toggle');
const tocBookTitleModeSelect = $('#toc-book-title-mode');
const tocCustomTitlesWrap = $('#toc-custom-titles-wrap');
const tocCustomTitlesList = $('#toc-custom-titles-list');

const progressSection = $('#progress-section');
const progressFill = $('#progress-fill');
const progressText = $('#progress-text');

let books = []; // Array of Book objects
let sortableInstance = null;

// Book structure:
// { id, file, zip, title, author, coverBlobUrl, opfPath, manifest, spine, isLoaded: false, tocCustomTitle, tocCustomTitleEdited }

// Toast Notification
function showToast(msg, type = "success") {
  toastEl.textContent = msg;
  toastEl.className = type;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 3000);
}

// Theme Toggle
function initTheme() {
  const savedTheme = localStorage.getItem('epub-merger-theme');
  if (savedTheme === 'dark') {
    document.body.setAttribute('data-theme', 'dark');
    themeToggleBtn.textContent = '☀️';
  } else {
    document.body.removeAttribute('data-theme');
    themeToggleBtn.textContent = '🌙';
  }
}
initTheme();

themeToggleBtn.addEventListener('click', () => {
  if (document.body.hasAttribute('data-theme')) {
    document.body.removeAttribute('data-theme');
    localStorage.setItem('epub-merger-theme', 'light');
    themeToggleBtn.textContent = '🌙';
  } else {
    document.body.setAttribute('data-theme', 'dark');
    localStorage.setItem('epub-merger-theme', 'dark');
    themeToggleBtn.textContent = '☀️';
  }
});

// Drag & Drop
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
});
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  let files = e.dataTransfer.files;
  handleFiles(files);
});
browseBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
  handleFiles(e.target.files);
  fileInput.value = '';
});

async function handleFiles(fileList) {
  let epubs = Array.from(fileList).filter(f => f.name.toLowerCase().endsWith('.epub'));
  if (epubs.length === 0) return;

  for (let file of epubs) {
    let internalId = Math.random().toString(36).substring(2, 9);
    let book = {
      id: internalId,
      file: file,
      zip: null,
      title: file.name,
      author: 'Unknown',
      coverBlobUrl: null,
      opfPath: '',
      manifest: [],
      spine: [],
      isLoaded: false,
      tocCustomTitle: file.name,
      tocCustomTitleEdited: false
    };
    books.push(book);
    renderBookItem(book);
    parseEpubInfo(book);
  }
  updateUIState();
}

function updateUIState() {
  if (books.length > 0) {
    bookListSection.style.display = 'block';
    metadataSection.style.display = 'block';
    actionSection.style.display = 'block';
    bookCountEl.textContent = `${books.length} 本`;
    
    // Auto-fill title with "Book1 & Book2..." if empty or default
    let metaTitle = $('#meta-title');
    if (!metaTitle.value || metaTitle.dataset.auto == "true") {
      let titles = books.map(b => b.title).filter(Boolean);
      let newTitle = titles.slice(0, 2).join(' & ') + (titles.length > 2 ? ' 等' : '');
      metaTitle.value = newTitle;
      metaTitle.dataset.auto = "true";
    }

    if (!sortableInstance) {
      sortableInstance = new Sortable(bookListEl, {
        animation: 150,
        handle: '.drag-handle',
        ghostClass: 'sortable-ghost',
        onEnd: () => {
          // Sync books array with DOM order
          let newOrder = Array.from(bookListEl.children).map(el => el.dataset.id);
          books = newOrder.map(id => books.find(b => b.id === id));
          updateBookOrderNumbers();
          renderTocCustomTitleInputs();
          updateCoverSelect();
          updateCoverPreview();
        }
      });
    }
  } else {
    bookListSection.style.display = 'none';
    metadataSection.style.display = 'none';
    actionSection.style.display = 'none';
    if (sortableInstance) {
      sortableInstance.destroy();
      sortableInstance = null;
    }
    $('#meta-title').value = '';
    $('#meta-title').dataset.auto = "true";
  }
  renderTocCustomTitleInputs();
  updateTocCustomTitlesVisibility();
  updateCoverSelect();
  updateCoverPreview();
}

function renderBookItem(book) {
  let el = document.createElement('div');
  el.className = 'book-item';
  el.dataset.id = book.id;
  
  el.innerHTML = `
    <div class="drag-handle">☰</div>
    <div class="book-order-num"></div>
    <div class="book-cover-thumb">
      ${book.coverBlobUrl ? `<img src="${book.coverBlobUrl}">` : '📖'}
    </div>
    <div class="book-info">
      <div class="book-title-text" title="${book.title}">${book.title}</div>
      <div class="book-author-text">Parsing...</div>
      <div class="book-meta-tags">
        <span class="tag tag-size">${(book.file.size / 1024 / 1024).toFixed(2)} MB</span>
      </div>
    </div>
    <button class="book-remove" title="Remove">✕</button>
  `;
  
  el.querySelector('.book-remove').addEventListener('click', () => {
    books = books.filter(b => b.id !== book.id);
    el.remove();
    updateUIState();
    updateBookOrderNumbers();
  });
  
  bookListEl.appendChild(el);
  updateBookOrderNumbers();
}

function updateBookOrderNumbers() {
  let items = bookListEl.querySelectorAll('.book-item');
  items.forEach((item, index) => {
    item.querySelector('.book-order-num').textContent = index + 1;
  });
}

function renderTocCustomTitleInputs() {
  if (!tocCustomTitlesList) return;
  tocCustomTitlesList.innerHTML = '';
  books.forEach((book, index) => {
    let row = document.createElement('div');
    row.className = 'toc-custom-title-item';
    let indexEl = document.createElement('div');
    indexEl.className = 'toc-custom-title-index';
    indexEl.textContent = `第 ${index + 1} 本`;
    let input = document.createElement('input');
    input.className = 'field-input';
    input.type = 'text';
    input.dataset.bookId = book.id;
    input.placeholder = book.title || '';
    input.value = book.tocCustomTitle || '';
    input.addEventListener('input', () => {
      book.tocCustomTitle = input.value;
      book.tocCustomTitleEdited = true;
    });
    row.appendChild(indexEl);
    row.appendChild(input);
    tocCustomTitlesList.appendChild(row);
  });
}

function updateTocCustomTitlesVisibility() {
  if (!tocBookTitleModeSelect || !tocCustomTitlesWrap) return;
  tocCustomTitlesWrap.style.display = tocBookTitleModeSelect.value === 'custom' ? 'block' : 'none';
}

function resolvePath(basePath, relativePath) {
  if (!basePath) return relativePath;
  let parts = basePath.split('/');
  parts.pop(); // remove filename
  let relParts = relativePath.split('/');
  for (let part of relParts) {
    if (part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
}

// Extract base path (dirname)
function getDirName(path) {
  if (!path.includes('/')) return '';
  return path.substring(0, path.lastIndexOf('/'));
}

function escapeXml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function sanitizeManifestProperties(properties = '') {
  if (!properties) return '';
  // Keep source-specific rendering hints, but remove properties that must stay unique in merged book.
  let blocked = new Set(['cover-image', 'nav']);
  let kept = properties
    .split(/\s+/)
    .map(token => token.trim())
    .filter(Boolean)
    .filter(token => !blocked.has(token));
  return kept.join(' ');
}

function getTagChildren(parent, localName) {
  return Array.from(parent.children || []).filter(el => el.localName === localName);
}

function toMergedHrefFromZipPath(prefix, zipPath) {
  let merged = `${prefix}/${zipPath.split('/').map(encodeURIComponent).join('/')}`;
  return decodeURIComponent(merged);
}

function buildMergedHref(prefix, baseZipPath, rawHref) {
  if (!rawHref) return null;
  let hashIndex = rawHref.indexOf('#');
  let pathPart = hashIndex >= 0 ? rawHref.slice(0, hashIndex) : rawHref;
  let fragment = hashIndex >= 0 ? rawHref.slice(hashIndex + 1) : '';
  let resolvedZipPath = pathPart ? resolvePath(baseZipPath, pathPart) : baseZipPath;
  let mergedPath = toMergedHrefFromZipPath(prefix, resolvedZipPath);
  return fragment ? `${mergedPath}#${fragment}` : mergedPath;
}

function parseNavLiNode(liEl, navZipPath, prefix) {
  let childElements = Array.from(liEl.children || []);
  let anchorEl = childElements.find(el => el.localName === 'a');
  let textEl = anchorEl || childElements.find(el => el.localName === 'span' || el.localName === 'div');
  let title = (textEl ? textEl.textContent : liEl.textContent || '').trim();
  let href = anchorEl ? buildMergedHref(prefix, navZipPath, anchorEl.getAttribute('href')) : null;
  let childOl = childElements.find(el => el.localName === 'ol');
  let children = childOl
    ? getTagChildren(childOl, 'li').map(li => parseNavLiNode(li, navZipPath, prefix)).filter(Boolean)
    : [];
  if (!title && !href && children.length === 0) return null;
  return {
    title: title || '未命名章节',
    href,
    children
  };
}

async function parseBookNavToc(book, prefix) {
  // First try to find nav item by properties="nav"
  let navItem = book.manifest.find(item =>
    item.mediaType === "application/xhtml+xml" &&
    item.properties.split(/\s+/).includes("nav")
  );
  
  // Fallback: try to find by id containing "nav" or "toc"
  if (!navItem) {
    navItem = book.manifest.find(item =>
      item.mediaType === "application/xhtml+xml" &&
      ((item.id || '').toLowerCase().includes('nav') || (item.id || '').toLowerCase().includes('toc'))
    );
  }
  
  if (!navItem) return [];
  let opfDir = getDirName(book.opfPath);
  let navZipPath = opfDir ? `${opfDir}/${navItem.href}` : navItem.href;
  let navFile = book.zip.file(navZipPath);
  if (!navFile) return [];
  let navXml = await navFile.async("string");
  let parser = new DOMParser();
  let navDoc = parser.parseFromString(navXml, "application/xhtml+xml");
  let navEls = Array.from(navDoc.getElementsByTagName('*')).filter(el => el.localName === 'nav');
  let tocNav = navEls.find(el => {
    let epubType = (el.getAttribute('epub:type') || el.getAttribute('type') || '').split(/\s+/);
    return epubType.includes('toc');
  }) || navEls[0];
  if (!tocNav) return [];
  let tocOl = getTagChildren(tocNav, 'ol')[0];
  if (!tocOl) return [];
  return getTagChildren(tocOl, 'li').map(li => parseNavLiNode(li, navZipPath, prefix)).filter(Boolean);
}

function parseNcxNavPoint(navPointEl, ncxZipPath, prefix) {
  let labelText = '';
  let navLabel = getTagChildren(navPointEl, 'navLabel')[0];
  if (navLabel) {
    let textEl = getTagChildren(navLabel, 'text')[0];
    if (textEl) labelText = (textEl.textContent || '').trim();
  }
  let contentEl = getTagChildren(navPointEl, 'content')[0];
  let src = contentEl ? contentEl.getAttribute('src') : '';
  let href = src ? buildMergedHref(prefix, ncxZipPath, src) : null;
  let children = getTagChildren(navPointEl, 'navPoint').map(child => parseNcxNavPoint(child, ncxZipPath, prefix)).filter(Boolean);
  if (!labelText && !href && children.length === 0) return null;
  return {
    title: labelText || '未命名章节',
    href,
    children
  };
}

async function parseBookNcxToc(book, prefix) {
  // More comprehensive search for NCX file
  let ncxItem = book.manifest.find(item =>
    item.mediaType === "application/x-dtbncx+xml" || 
    (item.href || '').toLowerCase().endsWith('.ncx') ||
    (item.id || '').toLowerCase().includes('toc')
  );
  if (!ncxItem) return [];
  let opfDir = getDirName(book.opfPath);
  let ncxZipPath = opfDir ? `${opfDir}/${ncxItem.href}` : ncxItem.href;
  let ncxFile = book.zip.file(ncxZipPath);
  if (!ncxFile) return [];
  let ncxXml = await ncxFile.async("string");
  let parser = new DOMParser();
  let ncxDoc = parser.parseFromString(ncxXml, "text/xml");
  let navMap = Array.from(ncxDoc.getElementsByTagName('*')).find(el => el.localName === 'navMap');
  if (!navMap) return [];
  return getTagChildren(navMap, 'navPoint').map(point => parseNcxNavPoint(point, ncxZipPath, prefix)).filter(Boolean);
}

async function extractBookTocNodes(book, prefix) {
  console.log(`extractBookTocNodes: book.title=${book.title}, prefix=${prefix}, hasZip=!!${book.zip}, manifest.length=${book.manifest?.length}`);
  
  // First try: search in manifest for nav.xhtml
  let navNodes = await parseBookNavToc(book, prefix);
  if (navNodes.length > 0) {
    console.log(`  Found nav via parseBookNavToc: ${navNodes.length} nodes`);
    return navNodes;
  }
  
  // Second try: search in manifest for ncx
  navNodes = await parseBookNcxToc(book, prefix);
  if (navNodes.length > 0) {
    console.log(`  Found nav via parseBookNcxToc: ${navNodes.length} nodes`);
    return navNodes;
  }
  
  // Third try: direct search in zip files
  let zipFiles = Object.keys(book.zip.files);
  console.log(`  zipFiles sample: ${zipFiles.slice(0, 10).join(', ')}`);
  
  // Search for nav.xhtml or navi.xhtml
  let navFileName = zipFiles.find(f => 
    f.toLowerCase().includes('nav') && f.toLowerCase().endsWith('.xhtml')
  );
  console.log(`  Found navFileName: ${navFileName}`);
  if (navFileName) {
    let navFile = book.zip.file(navFileName);
    if (navFile) {
      let navZipPath = navFileName;
      let navXml = await navFile.async("string");
      let parser = new DOMParser();
      let navDoc = parser.parseFromString(navXml, "application/xhtml+xml");
      let navEls = Array.from(navDoc.getElementsByTagName('*')).filter(el => el.localName === 'nav');
      let tocNav = navEls.find(el => {
        let epubType = (el.getAttribute('epub:type') || el.getAttribute('type') || '').split(/\s+/);
        return epubType.includes('toc');
      }) || navEls[0];
      if (tocNav) {
        let tocOl = getTagChildren(tocNav, 'ol')[0];
        if (tocOl) {
          return getTagChildren(tocOl, 'li').map(li => parseNavLiNode(li, navZipPath, prefix)).filter(Boolean);
        }
      }
    }
  }
  
  // Search for toc.ncx
  let ncxFileName = zipFiles.find(f => f.toLowerCase().endsWith('.ncx'));
  console.log(`  Found ncxFileName: ${ncxFileName}`);
  if (ncxFileName) {
    let ncxFile = book.zip.file(ncxFileName);
    if (ncxFile) {
      let ncxXml = await ncxFile.async("string");
      let parser = new DOMParser();
      let ncxDoc = parser.parseFromString(ncxXml, "text/xml");
      let navMap = Array.from(ncxDoc.getElementsByTagName('*')).find(el => el.localName === 'navMap');
      if (navMap) {
        return getTagChildren(navMap, 'navPoint').map(point => parseNcxNavPoint(point, ncxFileName, prefix)).filter(Boolean);
      }
    }
  }
  
  return [];
}

function getBookTopLevelTitle(book, index, finalTitle, mode) {
  if (mode === 'custom') {
    return (book.tocCustomTitle || '').trim() || (book.title || '').trim() || `${finalTitle} ${index + 1}`;
  }
  return `${finalTitle} ${index + 1}`;
}

function findFirstHref(node) {
  if (!node) return '';
  if (node.href) return node.href;
  for (let child of node.children || []) {
    let href = findFirstHref(child);
    if (href) return href;
  }
  return '';
}

function renderNavListItems(nodes) {
  return nodes.map(node => {
    let title = escapeXml(node.title || '未命名章节');
    let label = node.href
      ? `<a href="${escapeXml(node.href)}">${title}</a>`
      : `<span>${title}</span>`;
    let childHtml = (node.children && node.children.length > 0)
      ? `\n        <ol>\n          ${renderNavListItems(node.children)}\n        </ol>`
      : '';
    return `<li>${label}${childHtml}</li>`;
  }).join('\n          ');
}

function buildNcxNavPoints(nodes, playOrder = 1, parentHref = '') {
  let xml = '';
  for (let node of nodes) {
    let currentOrder = playOrder++;
    let effectiveHref = node.href || findFirstHref(node) || parentHref;
    let nested = buildNcxNavPoints(node.children || [], playOrder, effectiveHref);
    playOrder = nested.playOrder;
    xml += `
  <navPoint id="navPoint-${currentOrder}" playOrder="${currentOrder}">
    <navLabel><text>${escapeXml(node.title || '未命名章节')}</text></navLabel>
    ${effectiveHref ? `<content src="${escapeXml(effectiveHref)}"/>` : ''}
${nested.xml}  </navPoint>`;
  }
  return { xml, playOrder };
}

async function parseEpubInfo(book) {
  try {
    let zip = await JSZip.loadAsync(book.file);
    book.zip = zip;
    
    // 1. Read container.xml
    let containerFile = zip.file("META-INF/container.xml");
    if (!containerFile) throw new Error("Missing META-INF/container.xml");
    let containerXmlUrl = await containerFile.async("string");
    
    let parser = new DOMParser();
    let containerDoc = parser.parseFromString(containerXmlUrl, "text/xml");
    let rootfile = containerDoc.querySelector("rootfile");
    if (!rootfile) throw new Error("No rootfile in container");
    
    book.opfPath = rootfile.getAttribute("full-path");
    
    // 2. Read OPF
    let opfFile = zip.file(book.opfPath);
    if (!opfFile) throw new Error("OPF file missing: " + book.opfPath);
    let opfXml = await opfFile.async("string");
    let opfDoc = parser.parseFromString(opfXml, "text/xml");
    book.opfDoc = opfDoc; // Save for advanced parsing during merge if needed
    
    // Metadata
    let titleEl = opfDoc.querySelector("title");
    if (titleEl) book.title = titleEl.textContent;
    if (!book.tocCustomTitleEdited) {
      book.tocCustomTitle = book.title;
    }
    let creatorEl = opfDoc.querySelector("creator");
    if (creatorEl) book.author = creatorEl.textContent;
    else book.author = "";
    
    // Manifest & Spines
    let manifestItems = opfDoc.querySelectorAll("manifest > item");
    book.manifest = Array.from(manifestItems).map(el => ({
      id: el.getAttribute("id"),
      href: el.getAttribute("href"),
      mediaType: el.getAttribute("media-type"),
      properties: el.getAttribute("properties") || ""
    }));
    
    let spineItems = opfDoc.querySelectorAll("spine > itemref");
    book.spine = Array.from(spineItems).map(el => el.getAttribute("idref"));
    
    // Find cover image
    let coverMeta = opfDoc.querySelector("meta[name='cover']");
    let coverId = coverMeta ? coverMeta.getAttribute("content") : null;
    let coverItem = null;
    
    if (coverId) {
      coverItem = book.manifest.find(i => i.id === coverId);
    }
    if (!coverItem) {
      coverItem = book.manifest.find(i => i.properties.includes("cover-image") || i.id.toLowerCase().includes("cover"));
    }
    
    if (coverItem) {
      // Load cover visually
      let coverZipPath = resolvePath(book.opfPath, coverItem.href);
      let cFile = zip.file(coverZipPath);
      if (cFile) {
        let blob = await cFile.async("blob");
        book.coverBlobUrl = URL.createObjectURL(blob);
        book.coverZipPath = coverZipPath;
        book.coverMediaType = coverItem.mediaType || "image/jpeg";
      }
    }
    
    book.isLoaded = true;
    
    // Update DOM
    let curEl = bookListEl.querySelector(`[data-id="${book.id}"]`);
    if (curEl) {
      curEl.querySelector('.book-title-text').textContent = book.title;
      curEl.querySelector('.book-author-text').textContent = book.author;
      if (book.coverBlobUrl) {
        curEl.querySelector('.book-cover-thumb').innerHTML = `<img src="${book.coverBlobUrl}">`;
      }
      let tagContainer = curEl.querySelector('.book-meta-tags');
      tagContainer.innerHTML += `<span class="tag tag-chapters">${book.spine.length} 章</span>`;
    }
    
    updateCoverSelect();
    updateCoverPreview();
    renderTocCustomTitleInputs();
    
    if (!($('#meta-title').dataset.auto == "false") && $('#meta-title').value.includes(' 等')) {
       // Optional: Re-eval title if new books parsed
    }
    
  } catch(e) {
    console.error("Failed to parse " + book.title, e);
    showToast(`无法解析 ${book.title}: ${e.message}`, "error");
    
    // Remove from UI
    books = books.filter(b => b.id !== book.id);
    let curEl = bookListEl.querySelector(`[data-id="${book.id}"]`);
    if(curEl) curEl.remove();
    updateUIState();
  }
}

// User types custom title -> no longer auto update
$('#meta-title').addEventListener('input', () => {
  $('#meta-title').dataset.auto = "false";
});

if (tocBookTitleModeSelect) {
  tocBookTitleModeSelect.addEventListener('change', updateTocCustomTitlesVisibility);
}

coverSourceSelect.addEventListener('change', updateCoverPreview);

function updateCoverPreview() {
  if (books.length === 0) {
    coverPreview.innerHTML = "🖼️";
    return;
  }
  let selectedId = coverSourceSelect.value;
  let b = books.find(book => book.id === selectedId);
  if (b && b.coverBlobUrl) {
    coverPreview.innerHTML = `<img src="${b.coverBlobUrl}">`;
  } else {
    coverPreview.innerHTML = "❌";
  }
}

function updateCoverSelect() {
  let prevValue = coverSourceSelect.value;
  coverSourceSelect.innerHTML = '<option value="">— 不设封面 —</option>';
  
  books.forEach((b, index) => {
    if (b.coverBlobUrl) {
      let opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = `图书 ${index + 1}: ${b.title}`;
      coverSourceSelect.appendChild(opt);
    }
  });
  
  if (Array.from(coverSourceSelect.options).some(o => o.value === prevValue)) {
    coverSourceSelect.value = prevValue;
  } else if (coverSourceSelect.options.length > 1) {
    // default to the first available cover if there's any
    coverSourceSelect.value = coverSourceSelect.options[1].value;
  }
}

clearBtn.addEventListener('click', () => {
  books = [];
  bookListEl.innerHTML = '';
  updateUIState();
});

mergeBtn.addEventListener('click', startMerge);

async function startMerge() {
  if (books.length < 2) {
    showToast("请至少添加2本需要合并的书籍", "error");
    return;
  }
  if (books.some(b => !b.isLoaded)) {
    showToast("有书籍正在解析中，请稍后再试", "error");
    return;
  }

  let finalTitle = $('#meta-title').value.trim() || "Merged Books";
  let finalAuthor = $('#meta-author').value.trim() || "";
  let finalLang = $('#meta-language').value || "zh";
  let finalPublisher = $('#meta-publisher').value.trim() || "EPUB Merger Offline";
  let selectedCoverBookId = coverSourceSelect.value;
  let tocBookTitleMode = tocBookTitleModeSelect ? tocBookTitleModeSelect.value : 'merged-title-index';

  mergeBtn.disabled = true;
  progressSection.style.display = 'block';
  
  const setProgress = (percent, text) => {
    progressFill.style.width = percent + '%';
    progressText.textContent = text;
  };

  try {
    setProgress(5, "初始化压缩包...");
    let mergedZip = new JSZip();
    mergedZip.file("mimetype", "application/epub+zip");
    
    // Write container.xml
    mergedZip.folder("META-INF").file("container.xml", 
      `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
    <rootfiles>
        <rootfile full-path="content.opf" media-type="application/oebps-package+xml"/>
    </rootfiles>
</container>`
    );

    let masterManifest = [];
    let masterSpine = [];
    let navPoints = []; // For EPUB 3 nav.xhtml and EPUB 2 NCX
    
    let coverMetaEl = '';
    
    if (selectedCoverBookId) {
       let coverBook = books.find(b => b.id === selectedCoverBookId);
       if (coverBook && coverBook.coverZipPath) {
           let coverExt = "jpg";
           if (coverBook.coverMediaType === "image/png") coverExt = "png";
           else if (coverBook.coverMediaType === "image/gif") coverExt = "gif";
           
           let cFile = coverBook.zip.file(coverBook.coverZipPath);
           if (cFile) {
               let cData = await cFile.async("uint8array");
               mergedZip.file(`cover_image.${coverExt}`, cData);
               let coverId = "merge-cover-image";
               masterManifest.push(`<item id="${coverId}" href="cover_image.${coverExt}" media-type="${coverBook.coverMediaType}" properties="cover-image"/>`);
               coverMetaEl = `<meta name="cover" content="${coverId}" />`;
           }
       }
    }
    
    setProgress(10, "整合内容...");

    for (let i = 0; i < books.length; i++) {
        let b = books[i];
        let pfx = `book_${i}`;
        
        let fileCount = Object.keys(b.zip.files).length;
        let c = 0;
        
        // Copy all files from book zip into book_i/
        for (const [relPath, zipEntry] of Object.entries(b.zip.files)) {
            if (zipEntry.dir) continue;
            // Skip original meta-inf and mimetype
            if (relPath.startsWith("META-INF") || relPath === "mimetype") continue;
            
            let data = await zipEntry.async("uint8array");
            mergedZip.file(`${pfx}/${relPath}`, data);
            
            c++;
            if (c % 20 === 0) setProgress(10 + (i / books.length * 70), `处理 ${b.title}...`);
        }
        
        // Add to Master OPF Manifest
        let firstSpineItemHref = null;
        
        b.manifest.forEach(item => {
            let opfDir = getDirName(b.opfPath);
            let origZipPath = opfDir ? `${opfDir}/${item.href}` : item.href;
            
            // Re-encode spaces in href just in case
            let newHref = `${pfx}/${origZipPath.split('/').map(encodeURIComponent).join('/')}`;
            // Fix double encode if original had %20
            newHref = decodeURIComponent(newHref); 
            
            let newId = `${pfx}_${item.id}`;
            let sanitizedProps = sanitizeManifestProperties(item.properties || "");
            let propsStr = sanitizedProps ? ` properties="${sanitizedProps}"` : '';
            
            masterManifest.push(`<item id="${newId}" href="${newHref}" media-type="${item.mediaType}"${propsStr}/>`);
            
            if (item.id === b.spine[0]) {
              firstSpineItemHref = newHref;
            }
        });
        
        // Add to Master Spines
        b.spine.forEach(sid => {
            masterSpine.push(`<itemref idref="${pfx}_${sid}"/>`);
        });
        
        // Add to Nav: each book is level-1, original TOC is demoted one level.
        let bookTocChildren = await extractBookTocNodes(b, pfx);
        console.log(`Book ${i}: ${b.title}, TOC children count: ${bookTocChildren.length}`);
        let topLevelTitle = getBookTopLevelTitle(b, i, finalTitle, tocBookTitleMode);
        let topLevelHref = firstSpineItemHref || findFirstHref(bookTocChildren[0] || null) || null;
        navPoints.push({
            title: topLevelTitle,
            href: topLevelHref,
            children: bookTocChildren
        });
    }
    
    console.log('All navPoints:', JSON.stringify(navPoints.map(np => ({title: np.title, childrenCount: np.children.length})), null, 2));
    setProgress(85, "生成目录...");
    
    // Generate toc.ncx (EPUB 2 backward compatibility)
    let ncxNavPointsXml = buildNcxNavPoints(navPoints).xml;
    console.log('NCX navPoints XML length:', ncxNavPointsXml.length);
    console.log('NCX navPoints XML preview:', ncxNavPointsXml.substring(0, 500));
    let ncxContent = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
<head><meta name="dtb:uid" content="urn:uuid:${Date.now()}"/></head>
<docTitle><text>${escapeXml(finalTitle)}</text></docTitle>
<navMap>
${ncxNavPointsXml}
</navMap>
</ncx>`;
    mergedZip.file("toc.ncx", ncxContent);
    masterManifest.push(`<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`);

    // Generate nav.xhtml (EPUB 3)
    let navListHtml = renderNavListItems(navPoints);
    console.log('nav.xhtml list HTML FULL:', navListHtml);
    console.log('nav.xhtml list HTML length:', navListHtml.length);
    let navContent = `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Table of Contents</title></head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>目录</h1>
    <ol>
      ${navListHtml}
    </ol>
  </nav>
</body>
</html>`;
    mergedZip.file("nav.xhtml", navContent);
    masterManifest.push(`<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`);

    setProgress(90, "生成 OPF...");
    // Generate Master content.opf
    console.log('masterSpine items:', masterSpine.slice(0, 5), '... total:', masterSpine.length);
    console.log('masterManifest items:', masterManifest.slice(0, 5), '... total:', masterManifest.length);
    
    let opfContent = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="pub-id" version="3.0">
    <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
        <dc:title>${finalTitle}</dc:title>
        <dc:creator>${finalAuthor}</dc:creator>
        <dc:language>${finalLang}</dc:language>
        <dc:publisher>${finalPublisher}</dc:publisher>
        <dc:identifier id="pub-id">urn:uuid:${Date.now()}</dc:identifier>
        <meta property="dcterms:modified">${new Date().toISOString().split('.')[0]}Z</meta>
        ${coverMetaEl}
    </metadata>
    <manifest>
        ${masterManifest.join('\n        ')}
    </manifest>
    <spine toc="ncx">
        ${masterSpine.join('\n        ')}
    </spine>
</package>`;
    console.log('OPF spine section:', opfContent.match(/<spine[\s\S]*?<\/spine>/));
    
    mergedZip.file("content.opf", opfContent);
    console.log('OPF content (spine + manifest):', opfContent.substring(opfContent.indexOf('<spine'), opfContent.indexOf('</package>')));

    setProgress(95, "正在压缩装填...");

    // Generate Blob
    let mergedBlob = await mergedZip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: {
            level: 1
        }
    }, (meta) => {
        setProgress(95 + (meta.percent / 20), `压缩中 ${meta.percent.toFixed(0)}%`);
    });

    setProgress(100, "完成！");
    
    // Download
    let url = URL.createObjectURL(mergedBlob);
    let a = document.createElement("a");
    a.href = url;
    a.download = `${finalTitle}.epub`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);

    showToast("合并完成！开始下载");

  } catch (err) {
    console.error("Merge error:", err);
    showToast(`合并失败: ${err.message}`, "error");
  } finally {
    mergeBtn.disabled = false;
    setTimeout(() => {
        progressSection.style.display = 'none';
        setProgress(0, "");
    }, 3000);
  }
}
