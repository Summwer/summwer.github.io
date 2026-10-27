'use strict';
// No libraries, analytics, network requests, or server-side uploads.
(() => {
  const root = document.documentElement;
  const themeButton = document.querySelector('.theme-toggle');
  const updateThemeLabel = () => {
    const isDark = root.dataset.theme === 'dark';
    themeButton?.setAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} theme`);
  };
  updateThemeLabel();
  themeButton?.addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('wx-theme', root.dataset.theme); } catch (_) { /* Storage may be unavailable in private/local mode. */ }
    updateThemeLabel();
  });

  const menuButton = document.querySelector('.menu-toggle');
  const navigation = document.getElementById('main-nav');
  const closeMenu = () => {
    navigation?.classList.remove('is-open');
    menuButton?.setAttribute('aria-expanded', 'false');
    menuButton?.setAttribute('aria-label', 'Open navigation');
  };
  menuButton?.addEventListener('click', () => {
    const opened = navigation.classList.toggle('is-open');
    menuButton.setAttribute('aria-expanded', String(opened));
    menuButton.setAttribute('aria-label', `${opened ? 'Close' : 'Open'} navigation`);
  });
  navigation?.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
  document.addEventListener('click', event => {
    if (!event.target.closest('.site-header')) closeMenu();
  });
  const sections = [...document.querySelectorAll('main section[id]')];
  const navLinks = [...document.querySelectorAll('.main-nav a')];
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        navLinks.forEach(link => {
          if (link.hash === `#${entry.target.id}`) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      });
    }, {rootMargin: '-15% 0px -65% 0px', threshold: 0});
    sections.forEach(section => observer.observe(section));
  }

  const papers = [...document.querySelectorAll('.publication')];
  const filterButtons = [...document.querySelectorAll('.filter-button')];
  const searchInput = document.getElementById('publication-search');
  let activeFilter = 'all';
  const normalize = value => value.normalize('NFKD').toLocaleLowerCase();
  const filterPapers = () => {
    const query = normalize(searchInput?.value.trim() || '');
    let count = 0;
    papers.forEach(paper => {
      const show = (activeFilter === 'all' || paper.dataset.kind === activeFilter)
        && normalize(paper.textContent).includes(query);
      paper.hidden = !show;
      if (show) count += 1;
    });
    document.getElementById('empty-publications').hidden = count !== 0;
    document.getElementById('publication-count').textContent = `${count} ${count === 1 ? 'work' : 'works'} shown`;
  };
  filterButtons.forEach(button => button.addEventListener('click', () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach(item => {
      const selected = item === button;
      item.classList.toggle('active', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
    filterPapers();
  }));
  searchInput?.addEventListener('input', filterPapers);

  document.getElementById('copy-email')?.addEventListener('click', async () => {
    const email = 'wenwen.xia@math.u-bordeaux.fr';
    const status = document.getElementById('copy-status');
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(email);
      else {
        const helper = document.createElement('textarea');
        helper.value = email; helper.style.position = 'fixed'; helper.style.opacity = '0';
        document.body.append(helper); helper.select();
        const copied = document.execCommand('copy'); helper.remove();
        if (!copied) throw new Error('Clipboard unavailable');
      }
      status.textContent = 'Email address copied.';
    } catch (_) {
      status.textContent = 'Please select and copy the email address above.';
    }
  });
  const year = document.getElementById('copyright-year');
  if (year) year.textContent = String(new Date().getFullYear());

  // This is only a client-side preview/crop tool, NOT an authenticated administration page.
  // To publish a portrait, replace assets/portrait.jpg and commit the file to your repository.
  const showEditor = location.protocol === 'file:' || ['localhost', '127.0.0.1', '::1', '[::1]'].includes(location.hostname)
    || new URLSearchParams(location.search).get('edit') === '1';
  const editButton = document.getElementById('edit-photo-button');
  const dialog = document.getElementById('portrait-editor');
  const fileInput = document.getElementById('portrait-file');
  const canvas = document.getElementById('portrait-canvas');
  const context = canvas.getContext('2d');
  const zoom = document.getElementById('portrait-zoom');
  const xSlider = document.getElementById('portrait-x');
  const ySlider = document.getElementById('portrait-y');
  const previewButton = document.getElementById('preview-portrait');
  const downloadButton = document.getElementById('download-portrait');
  const status = document.getElementById('portrait-status');
  let photo = null;
  let loadGeneration = 0;
  let previousFocus = null;
  if (showEditor && editButton && typeof dialog.showModal === 'function') {
    editButton.hidden = false;
  }
  editButton?.addEventListener('click', () => {
    if (typeof dialog.showModal !== 'function') return;
    previousFocus = document.activeElement;
    dialog.showModal();
  });
  const closeDialog = () => { dialog.close(); previousFocus?.focus(); };
  document.getElementById('close-photo-editor')?.addEventListener('click', closeDialog);
  dialog?.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) closeDialog();
  });
  const enableControls = enabled => {
    [zoom, xSlider, ySlider, previewButton, downloadButton].forEach(control => { control.disabled = !enabled; });
  };
  const drawPhoto = () => {
    if (!photo) return;
    const {width, height} = canvas;
    const scale = Math.max(width / photo.naturalWidth, height / photo.naturalHeight) * Number(zoom.value);
    const w = photo.naturalWidth * scale, h = photo.naturalHeight * scale;
    const x = (width - w) * Number(xSlider.value) / 100;
    const y = (height - h) * Number(ySlider.value) / 100;
    context.fillStyle = '#ffffff'; context.fillRect(0, 0, width, height);
    context.drawImage(photo, x, y, w, h);
  };
  [zoom, xSlider, ySlider].forEach(slider => slider?.addEventListener('input', drawPhoto));
  fileInput?.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const generation = ++loadGeneration;
    enableControls(false);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      status.textContent = '请选择 JPG、PNG 或 WebP 图片。'; return;
    }
    if (file.size > 20 * 1024 * 1024) { status.textContent = '图片超过 20 MB，请先缩小图片。'; return; }
    status.textContent = '正在读取本地图片…';
    const objectURL = URL.createObjectURL(file);
    const candidate = new Image();
    candidate.onload = () => {
      URL.revokeObjectURL(objectURL);
      if (generation !== loadGeneration) return;
      if (!candidate.naturalWidth || !candidate.naturalHeight || candidate.naturalWidth * candidate.naturalHeight > 40_000_000) {
        status.textContent = '图片尺寸无法处理，请使用不超过 4000 万像素的图片。'; return;
      }
      photo = candidate; zoom.value = '1'; xSlider.value = '50'; ySlider.value = '50';
      drawPhoto(); enableControls(true);
      document.getElementById('canvas-placeholder').hidden = true;
      status.textContent = '调整裁剪后下载 portrait.jpg，再替换 assets/portrait.jpg。';
    };
    candidate.onerror = () => {
      URL.revokeObjectURL(objectURL);
      if (generation !== loadGeneration) return;
      status.textContent = '图片读取失败，请重新选择有效图片。';
    };
    candidate.src = objectURL;
  });
  previewButton?.addEventListener('click', () => {
    if (!photo) return;
    try {
      const image = document.getElementById('profile-photo');
      image.src = canvas.toDataURL('image/jpeg', .92);
      image.alt = 'Portrait of Wenwen Xia';
      status.textContent = '已在当前页面预览。请下载图片并替换文件，才能永久保存。';
      closeDialog();
      editButton.textContent = '照片仅本地预览 · 下载后替换文件';
    } catch (_) { status.textContent = '预览失败，请重新选择图片。'; }
  });
  downloadButton?.addEventListener('click', () => {
    if (!photo) return;
    canvas.toBlob(blob => {
      if (!blob) { status.textContent = '图片导出失败，请重新选择图片。'; return; }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = 'portrait.jpg'; document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      status.textContent = '已导出 800 × 1000 的 portrait.jpg。请将其放入 assets 文件夹并替换同名文件，再提交到 GitHub。';
    }, 'image/jpeg', .92);
  });
})();
