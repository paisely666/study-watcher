/* review.js — 每日复盘 + 红黄绿可视化 */

var SW = window.SW || {};

SW.Review = (function () {
  var KEY_LOGS = 'logs';
  var KEY_SUMMARIES = 'sleepSummaries';

  function getDayLogs(date) {
    var logs = SW.Store.getAll(KEY_LOGS);
    return logs.filter(function (l) { return l.date === date; });
  }

  function getDaySummary(date) {
    var summaries = SW.Store.getAll(KEY_SUMMARIES);
    for (var i = 0; i < summaries.length; i++) {
      if (summaries[i].date === date) return summaries[i];
    }
    return null;
  }

  function renderReview(date) {
    var logs = getDayLogs(date);
    var summary = getDaySummary(date);

    renderSummary(date, logs, summary);
    renderVisual(logs);
    renderAdvice(logs, summary);
  }

  function renderSummary(date, logs, summary) {
    var el = document.getElementById('reviewSummary');
    if (!logs.length && !summary) {
      el.innerHTML = '<p class="empty">该日期没有执行记录</p>';
      return;
    }

    var completed = 0, postponed = 0, slacking = 0, abandoned = 0;
    for (var i = 0; i < logs.length; i++) {
      var a = logs[i].action;
      if (a === 'complete' || a === 'start' || a === 'ready') completed++;
      else if (a === 'postpone') postponed++;
      else if (a === 'slacking') slacking++;
      else if (a === 'abandon') abandoned++;
    }

    var failReasons = {};
    for (var i = 0; i < logs.length; i++) {
      if (logs[i].reason) {
        failReasons[logs[i].reason] = (failReasons[logs[i].reason] || 0) + 1;
      }
    }
    var topReason = '';
    var topCount = 0;
    for (var k in failReasons) {
      if (failReasons[k] > topCount) { topReason = k; topCount = failReasons[k]; }
    }

    var html = '<div style="font-size:13px;line-height:1.8;">'
      + '<div>完成/开始：<strong>' + completed + '</strong> 次</div>'
      + '<div>推迟：<strong>' + postponed + '</strong> 次</div>'
      + '<div>摸鱼：<strong>' + slacking + '</strong> 次</div>'
      + '<div>放弃：<strong>' + abandoned + '</strong> 次</div>'
      + (topReason ? '<div>主要失败原因：<strong>' + topReason + '</strong></div>' : '');
    if (summary) {
      html += '<div style="margin-top:8px;">任务完成：<strong>' + summary.completedTasks + '/' + summary.totalTasks + '</strong></div>';
    }
    html += '</div>';
    el.innerHTML = html;
  }

  function renderVisual(logs) {
    var el = document.getElementById('reviewVisual');
    if (!logs.length) {
      el.innerHTML = '<p class="empty">暂无数据</p>';
      return;
    }

    /* 按任务分组，每个任务取最差状态 */
    var taskMap = {};
    for (var i = 0; i < logs.length; i++) {
      var l = logs[i];
      if (!taskMap[l.taskContent]) taskMap[l.taskContent] = [];
      taskMap[l.taskContent].push(l);
    }

    var rows = [];
    for (var content in taskMap) {
      var actions = taskMap[content];
      var color = getWorstColor(actions);
      var statusText = getStatusText(actions);
      /* 最近一条日志的 id，用于撤销 */
      var latestLog = actions.reduce(function (a, b) {
        return a.time.localeCompare(b.time) > 0 ? a : b;
      });
      rows.push({ content: content, color: color, status: statusText, actions: actions, latestLogId: latestLog.id });
    }

    var html = '<table class="visual-table"><thead><tr><th>任务</th><th>状态</th><th>时间</th><th></th></tr></thead><tbody>';
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      var timeStr = r.actions[0].time;
      html += '<tr>'
        + '<td>' + esc(r.content) + '</td>'
        + '<td><span class="dot dot-' + r.color + '"></span>' + r.status + '</td>'
        + '<td>' + timeStr + '</td>'
        + '<td><button class="btn btn--small" data-undo-log="' + r.latestLogId + '" title="撤销最近一次操作">撤销</button></td>'
        + '</tr>';
    }
    html += '</tbody></table>';
    el.innerHTML = html;
  }

  function getWorstColor(actions) {
    var hasRed = false, hasYellow = false;
    for (var i = 0; i < actions.length; i++) {
      var a = actions[i].action;
      if (a === 'slacking' || a === 'abandon') hasRed = true;
      if (a === 'postpone') hasYellow = true;
    }
    if (hasRed) return 'red';
    if (hasYellow) return 'yellow';
    return 'green';
  }

  function getStatusText(actions) {
    for (var i = 0; i < actions.length; i++) {
      var a = actions[i].action;
      if (a === 'complete') return '已完成';
      if (a === 'abandon') return '已放弃';
      if (a === 'slacking') return '摸鱼了';
      if (a === 'postpone') return '有推迟';
    }
    return '进行中';
  }

  function renderAdvice(logs, summary) {
    var el = document.getElementById('reviewAdvice');
    if (!logs.length) {
      el.innerHTML = '<p class="empty">--</p>';
      return;
    }

    var postponed = 0, slacking = 0, abandoned = 0, completed = 0;
    for (var i = 0; i < logs.length; i++) {
      var a = logs[i].action;
      if (a === 'complete') completed++;
      else if (a === 'postpone') postponed++;
      else if (a === 'slacking') slacking++;
      else if (a === 'abandon') abandoned++;
    }

    var advices = [];
    if (abandoned > 0) {
      advices.push('今天有放弃的任务，明天建议降低任务难度或拆分成更小的步骤。');
    }
    if (postponed >= 2) {
      advices.push('推迟次数较多，建议减少任务数量，把最难的任务安排在精力最好的时间段。');
    }
    if (slacking > 0) {
      advices.push('有摸鱼记录，明天试试把娱乐时间安排在完成任务之后作为奖励。');
    }
    if (completed > 0 && abandoned === 0 && postponed === 0) {
      advices.push('今天完成得不错！保持这个节奏。');
    }
    if (!advices.length) {
      advices.push('继续加油，每天进步一点点。');
    }

    el.innerHTML = '<p style="font-size:14px;line-height:1.8;">' + advices.join('<br>') + '</p>';
  }

  function bindEvents() {
    var dateInput = document.getElementById('reviewDate');
    if (dateInput) {
      dateInput.value = getTodayStr();
    }

    document.getElementById('btnReviewLoad').onclick = function () {
      var date = document.getElementById('reviewDate').value;
      if (!date) { alert('请选择日期'); return; }
      renderReview(date);
    };

    /* 撤销按钮：撤销最近一次操作并刷新复盘 */
    document.getElementById('reviewVisual').onclick = function (e) {
      var btn = e.target.closest('[data-undo-log]');
      if (!btn) return;
      if (!confirm('确定撤销这次操作吗？任务状态会恢复到上一步。')) return;
      var logId = btn.dataset.undoLog;
      SW.Tasks.undoAction(logId);
      var date = document.getElementById('reviewDate').value;
      if (date) renderReview(date);
      if (SW.App && SW.App.refreshHome) SW.App.refreshHome();
    };
  }

  function getTodayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function pad(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  return {
    renderReview: renderReview,
    getDayLogs: getDayLogs,
    getDaySummary: getDaySummary,
    bindEvents: bindEvents
  };
})();
