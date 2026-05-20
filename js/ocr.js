/* ocr.js — 截图 OCR 识别，生成候选任务 */

var SW = window.SW || {};

SW.OCR = (function () {
  var overlay, dropzone, progressEl, resultsEl, saveBtn, fileInput;
  var candidates = [];

  function init() {
    overlay = document.getElementById('overlayOCR');
    dropzone = document.getElementById('ocrDropzone');
    progressEl = document.getElementById('ocrProgress');
    resultsEl = document.getElementById('ocrResults');
    saveBtn = document.getElementById('btnOCRSave');
    fileInput = document.getElementById('ocrFileInput');

    if (!overlay) return;

    /* 首页按钮 → 打开文件选择器 */
    var btnOCR = document.getElementById('btnOCR');
    if (btnOCR) {
      btnOCR.onclick = function () { fileInput.click(); };
    }

    /* 文件选择 → 开始识别 */
    fileInput.onchange = function () {
      if (fileInput.files.length) startOCR(fileInput.files[0]);
    };

    /* 拖拽上传 */
    if (dropzone) {
      dropzone.ondragover = function (e) { e.preventDefault(); dropzone.style.borderColor = 'var(--primary)'; };
      dropzone.ondragleave = function () { dropzone.style.borderColor = ''; };
      dropzone.ondrop = function (e) {
        e.preventDefault();
        dropzone.style.borderColor = '';
        var file = e.dataTransfer.files[0];
        if (file && file.type.match(/image\//)) startOCR(file);
      };
      dropzone.onclick = function () { fileInput.click(); };
    }

    /* 关闭按钮 */
    document.getElementById('btnOCRClose').onclick = function () { close(); };
    overlay.onclick = function (e) { if (e.target === overlay) close(); };

    /* 保存选中候选任务 */
    saveBtn.onclick = function () {
      var checked = resultsEl.querySelectorAll('input[type="checkbox"]:checked');
      var count = 0;
      for (var i = 0; i < checked.length; i++) {
        var c = candidates[parseInt(checked[i].value, 10)];
        if (!c) continue;
        var minInput = resultsEl.querySelector('#ocrMin_' + checked[i].value);
        var timeInput = resultsEl.querySelector('#ocrTime_' + checked[i].value);
        var min = parseInt(minInput ? minInput.value : 30, 10) || 30;
        var timeVal = timeInput ? timeInput.value : '';
        var scheduled = timeVal ? new Date(timeVal).toISOString() : getDefaultTime();
        SW.Tasks.add({
          content: c.text,
          estimatedMinutes: min,
          scheduledTime: scheduled
        });
        count++;
      }
      close();
      if (SW.App && SW.App.refreshHome) SW.App.refreshHome();
      if (SW.Tasks && SW.Tasks.refreshAll) SW.Tasks.refreshAll();
    };
  }

  function startOCR(file) {
    overlay.style.display = 'flex';
    dropzone.style.display = 'none';
    progressEl.style.display = 'block';
    progressEl.textContent = '正在识别中...';
    resultsEl.style.display = 'none';
    saveBtn.style.display = 'none';

    /* 用 FileReader 读取为 data URL，Tesseract.js 可直接处理 */
    var reader = new FileReader();
    reader.onload = function () {
      runTesseract(reader.result);
    };
    reader.readAsDataURL(file);
  }

  function runTesseract(imageData) {
    /* Tesseract.js v5: createWorker + recognize */
    if (typeof Tesseract === 'undefined') {
      progressEl.textContent = '错误：Tesseract.js 未加载，请检查网络连接后刷新页面。';
      return;
    }
    Tesseract.createWorker('chi_sim')
      .then(function (worker) {
        progressEl.textContent = '正在识别中... (可能需要 10-30 秒)';
        return worker.recognize(imageData).then(function (result) {
          worker.terminate();
          return result;
        });
      })
      .then(function (result) {
        onResult(result);
      })
      .catch(function (err) {
        progressEl.textContent = '识别出错：' + err.message;
      });
  }

  function onResult(result) {
    progressEl.style.display = 'none';
    resultsEl.style.display = 'block';
    saveBtn.style.display = '';

    var lines = result.data.lines || [];
    candidates = [];

    /* 过滤噪音行：至少 3 个中文字符，非纯数字/符号 */
    for (var i = 0; i < lines.length; i++) {
      var text = (lines[i].text || '').trim();
      var chineseCount = (text.match(/[一-鿿]/g) || []).length;
      if (chineseCount >= 3 || (text.length >= 4 && chineseCount >= 1)) {
        /* 去重 */
        var dup = false;
        for (var j = 0; j < candidates.length; j++) {
          if (candidates[j].text === text) { dup = true; break; }
        }
        if (!dup) candidates.push({ text: text });
      }
    }

    if (!candidates.length) {
      resultsEl.innerHTML = '<p class="empty">未识别到文本，请尝试更清晰的截图</p>';
      return;
    }

    var defaultTimeStr = getTodayStr() + 'T20:00';
    var html = '';
    for (var i = 0; i < candidates.length; i++) {
      html += '<div class="ocr-candidate">'
        + '<input type="checkbox" value="' + i + '" id="ocrChk_' + i + '" checked>'
        + '<label for="ocrChk_' + i + '" style="flex:1;min-width:0;">' + esc(candidates[i].text) + '</label>'
        + '<div class="ocr-candidate__time">'
        + '<input type="number" value="30" min="5" max="240" id="ocrMin_' + i + '"> 分钟'
        + '<input type="datetime-local" value="' + defaultTimeStr + '" id="ocrTime_' + i + '">'
        + '</div>'
        + '</div>';
    }
    resultsEl.innerHTML = html;
  }

  function close() {
    overlay.style.display = 'none';
    dropzone.style.display = '';
    progressEl.style.display = 'none';
    resultsEl.style.display = 'none';
    saveBtn.style.display = 'none';
    fileInput.value = '';
    candidates = [];
  }

  function getDefaultTime() {
    var d = new Date();
    d.setHours(20, 0, 0, 0);
    return d.toISOString();
  }

  function getTodayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function esc(s) { var d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  return { init: init };
})();
