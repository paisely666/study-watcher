/* app.js — 主控：导航、奖励规则、初始化 */

var SW = window.SW || {};

SW.App = (function () {
  var KEY_REWARDS = 'rewardRules';
  var KEY_RESCUES = 'rescueRules';

  /* ---- 初始化 ---- */

  function init() {
    renderHomeDate();
    renderTodayTimeline();
    SW.Tasks.renderEvaluation();
    SW.Courses.renderCourseList();
    SW.Courses.bindEvents();
    SW.Tasks.bindEvents();
    SW.Review.bindEvents();
    renderRewardList();
    renderRescueList();
    bindRuleForms();
    bindNavigation();
    SW.Reminders.bindActions();
    SW.Reminders.start();
    SW.Sleep.init();
    SW.OCR.init();
  }

  function refreshHome() {
    renderHomeDate();
    renderTodayTimeline();
    SW.Tasks.renderEvaluation();
  }

  /* ---- 今日时间线（v2 核心） ---- */

  function renderTodayTimeline() {
    var el = document.getElementById('homeTimeline');
    var courses = SW.Courses.getTodayCourses();
    var tasks = SW.Tasks.getTodayTasks();
    var now = new Date();
    var nowMin = now.getHours() * 60 + now.getMinutes();
    var currentWeek = SW.Courses.getCurrentWeek();

    /* 1. 课程 → 统一时间块 */
    var blocks = [];
    for (var i = 0; i < courses.length; i++) {
      var c = courses[i];
      blocks.push({
        type: 'course',
        title: c.name,
        startMin: timeToMin(c.startTime),
        endMin: timeToMin(c.endTime),
        startDisplay: c.startTime,
        endDisplay: c.endTime,
        meta: esc(c.location) + ' | ' + c.credits + '学分',
        credits: c.credits
      });
    }

    /* 2. 任务 → 统一时间块 */
    for (var i = 0; i < tasks.length; i++) {
      var t = tasks[i];
      if (!t.scheduledTime) continue;
      var startMin = timeToMin(formatScheduled(t.scheduledTime));
      var endMin = startMin + (t.estimatedMinutes || 30);
      var endD = new Date(new Date(t.scheduledTime).getTime() + (t.estimatedMinutes || 30) * 60000);
      blocks.push({
        type: 'task',
        id: t.id,
        title: t.content,
        startMin: startMin,
        endMin: endMin,
        startDisplay: pad2(Math.floor(startMin / 60)) + ':' + pad2(startMin % 60),
        endDisplay: pad2(endD.getHours()) + ':' + pad2(endD.getMinutes()),
        meta: t.estimatedMinutes + '分钟 | ' + statusText(t.status),
        status: t.status
      });
    }

    if (!blocks.length) {
      el.innerHTML = '<p class="empty">今日无课程也无任务</p>';
      return;
    }

    /* 3. 按开始时间排序 */
    blocks.sort(function (a, b) { return a.startMin - b.startMin; });

    /* 4. 找到"现在"插入位置 */
    var nowIdx = -1;
    for (var i = 0; i < blocks.length; i++) {
      if (nowMin >= blocks[i].startMin && nowMin <= blocks[i].endMin) { nowIdx = i; break; }
    }
    if (nowIdx < 0) {
      for (var i = 0; i < blocks.length - 1; i++) {
        if (nowMin > blocks[i].endMin && nowMin < blocks[i + 1].startMin) { nowIdx = i + 0.5; break; }
      }
    }

    /* 5. 渲染 */
    var html = '<div style="font-size:12px;color:#999;margin-bottom:8px;">当前第' + currentWeek + '周</div>';
    html += '<div class="timeline">';
    var nowInserted = false;
    /* 现在时间在所有块之前 */
    if (nowIdx < 0 && nowMin < blocks[0].startMin) {
      html += '<div class="timeline__now">现在</div>';
      nowInserted = true;
    }
    for (var i = 0; i < blocks.length; i++) {
      if (!nowInserted && (nowIdx === i || nowIdx === i - 0.5)) {
        html += '<div class="timeline__now">现在</div>';
        nowInserted = true;
      }

      var b = blocks[i];
      var cls = 'timeline__item timeline__item--' + b.type;
      if (b.type === 'task' && b.status === 'in_progress') cls += ' timeline__item--active';
      if (b.status === 'completed' || b.status === 'abandoned' || b.status === 'slacking') {
        cls += ' timeline__item--done';
      }

      var blockCls = 'timeline__block timeline__block--' + b.type;
      if (b.type === 'task') blockCls += ' timeline__block--' + (b.status || 'pending');

      var dot = '<div class="timeline__dot"></div>';
      html += '<div class="' + cls + '">'
        + '<div class="timeline__time">' + b.startDisplay + '<br>' + b.endDisplay + '</div>'
        + dot
        + '<div class="' + blockCls + '">'
        + '<div class="timeline__title">' + esc(b.title) + '</div>'
        + '<div class="timeline__meta">' + b.meta + '</div>'
        + '</div></div>';
    }
    /* "现在"在所有块之后 */
    if (!nowInserted && nowMin > blocks[blocks.length - 1].endMin) {
      html += '<div class="timeline__now">现在</div>';
    }
    html += '</div>';
    el.innerHTML = html;
  }

  function timeToMin(t) {
    var parts = t.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function formatScheduled(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function statusText(s) {
    var map = { pending:'待执行', in_progress:'进行中', completed:'已完成', postponed:'已推迟', abandoned:'已放弃', slacking:'摸鱼了' };
    return map[s] || s;
  }

  function renderHomeDate() {
    var el = document.getElementById('homeDate');
    var now = new Date();
    var dayNames = ['日', '一', '二', '三', '四', '五', '六'];
    el.textContent = now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日'
      + ' 星期' + dayNames[now.getDay()];
  }

  /* ---- 导航 ---- */

  function bindNavigation() {
    var btns = document.querySelectorAll('.nav__btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].onclick = function () {
        var tab = this.dataset.tab;
        for (var j = 0; j < btns.length; j++) btns[j].classList.remove('nav__btn--active');
        this.classList.add('nav__btn--active');
        var pages = document.querySelectorAll('.page');
        for (var k = 0; k < pages.length; k++) pages[k].classList.remove('page--active');
        var target = document.getElementById('page-' + tab);
        if (target) target.classList.add('page--active');
        if (tab === 'home') refreshHome();
        if (tab === 'courses') SW.Courses.renderCourseList();
        if (tab === 'tasks') SW.Tasks.refreshAll();
        if (tab === 'rules') { renderRewardList(); renderRescueList(); }
        if (tab === 'review') {
          var d = document.getElementById('reviewDate');
          if (d && d.value) SW.Review.renderReview(d.value);
        }
      };
    }
  }

  /* ---- 奖励 & 补救规则 ---- */

  function bindRuleForms() {
    document.getElementById('formReward').onsubmit = function (e) {
      e.preventDefault();
      var fd = new FormData(this);
      SW.Store.create(KEY_REWARDS, {
        name: fd.get('name').trim(), condition: fd.get('condition'), reward: fd.get('reward').trim()
      });
      this.reset();
      renderRewardList();
    };

    document.getElementById('formRescue').onsubmit = function (e) {
      e.preventDefault();
      var fd = new FormData(this);
      SW.Store.create(KEY_RESCUES, {
        name: fd.get('name').trim(), condition: fd.get('condition'), measure: fd.get('measure').trim()
      });
      this.reset();
      renderRescueList();
    };
  }

  function renderRewardList() {
    var el = document.getElementById('rewardList');
    var rules = SW.Store.getAll(KEY_REWARDS);
    if (!rules.length) { el.innerHTML = '<p class="empty">暂无奖励规则</p>'; return; }
    var conds = { all_complete: '完成今日全部任务', core_complete: '完成核心任务（≥60分钟）', streak3: '连续3天完成率≥70%' };
    var html = '';
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      html += '<div class="rule-item"><div class="rule-item__info">'
        + '<div class="rule-item__name">' + esc(r.name) + '</div>'
        + '<div class="rule-item__meta">条件：' + (conds[r.condition] || r.condition) + ' → 奖励：' + esc(r.reward) + '</div>'
        + '</div><button class="btn btn--danger btn--small" data-delete-reward="' + r.id + '">删除</button></div>';
    }
    el.innerHTML = html;
    el.onclick = function (e) {
      var btn = e.target.closest('[data-delete-reward]');
      if (btn) { SW.Store.delete(KEY_REWARDS, btn.dataset.deleteReward); renderRewardList(); }
    };
  }

  function renderRescueList() {
    var el = document.getElementById('rescueList');
    var rules = SW.Store.getAll(KEY_RESCUES);
    if (!rules.length) { el.innerHTML = '<p class="empty">暂无补救规则</p>'; return; }
    var conds = { incomplete_core: '未完成主要任务', postpone2: '连续推迟≥2次', slacking2: '摸鱼≥2次', complete_low: '完成率低于50%' };
    var html = '';
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      html += '<div class="rule-item"><div class="rule-item__info">'
        + '<div class="rule-item__name">' + esc(r.name) + '</div>'
        + '<div class="rule-item__meta">条件：' + (conds[r.condition] || r.condition) + ' → 补救：' + esc(r.measure) + '</div>'
        + '</div><button class="btn btn--danger btn--small" data-delete-rescue="' + r.id + '">删除</button></div>';
    }
    el.innerHTML = html;
    el.onclick = function (e) {
      var btn = e.target.closest('[data-delete-rescue]');
      if (btn) { SW.Store.delete(KEY_RESCUES, btn.dataset.deleteRescue); renderRescueList(); }
    };
  }

  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  /* ---- 启动 ---- */

  document.addEventListener('DOMContentLoaded', init);

  return { init: init, refreshHome: refreshHome };
})();
