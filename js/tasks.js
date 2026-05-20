/* tasks.js — 任务管理 */

var SW = window.SW || {};

SW.Tasks = (function () {
  var KEY_TASKS = 'tasks';
  var KEY_LOGS = 'logs';

  /* ---- 任务 CRUD ---- */

  function getAll(filter) {
    var tasks = SW.Store.getAll(KEY_TASKS);
    if (filter === 'today') {
      var todayStr = getTodayStr();
      tasks = tasks.filter(function (t) {
        return t.scheduledTime && t.scheduledTime.startsWith(todayStr);
      });
    } else if (filter === 'pending') {
      tasks = tasks.filter(function (t) {
        return t.status === 'pending' || t.status === 'in_progress' || t.status === 'postponed';
      });
    }
    tasks.sort(function (a, b) {
      return (a.scheduledTime || '').localeCompare(b.scheduledTime || '');
    });
    return tasks;
  }

  function getTodayTasks() { return getAll('today'); }

  /* 当前应执行的任务：今天 + 时间已到（之后2h内）+ pending/postponed */
  function getCurrentTask() {
    var now = new Date();
    var todayTasks = getTodayTasks();
    for (var i = 0; i < todayTasks.length; i++) {
      var t = todayTasks[i];
      if (t.status !== 'pending' && t.status !== 'postponed') continue;
      if (!t.scheduledTime) continue;
      var scheduled = new Date(t.scheduledTime);
      if (now >= scheduled && now - scheduled < 2 * 60 * 60 * 1000) return t;
    }
    var upcoming = todayTasks.filter(function (t) {
      return t.status === 'pending' || t.status === 'postponed';
    });
    return upcoming.length > 0 ? upcoming[0] : null;
  }

  function add(taskData) {
    taskData.status = 'pending';
    taskData.postponeCount = 0;
    return SW.Store.create(KEY_TASKS, taskData);
  }

  function update(id, updates) {
    return SW.Store.update(KEY_TASKS, id, updates);
  }

  function remove(id) {
    return SW.Store.delete(KEY_TASKS, id);
  }

  /* ---- 执行日志 ---- */

  function addLog(task, action, reason) {
    var now = new Date();
    SW.Store.create(KEY_LOGS, {
      date: getTodayStr(),
      time: pad(now.getHours()) + ':' + pad(now.getMinutes()),
      taskId: task.id,
      taskContent: task.content,
      action: action,
      reason: reason || ''
    });
  }

  /* ---- 状态标记 ---- */

  function markStatus(id, action, reason) {
    var task = SW.Store.getById(KEY_TASKS, id);
    if (!task) return;

    var statusMap = {
      start: 'in_progress', ready: 'in_progress', complete: 'completed',
      postpone: 'postponed', slacking: 'slacking', abandon: 'abandoned'
    };

    var updates = { status: statusMap[action] };
    if (action === 'complete' || action === 'abandon') updates.completedAt = new Date().toISOString();
    if (action === 'abandon') updates.abandonReason = reason;
    if (action === 'postpone') updates.postponeCount = (task.postponeCount || 0) + 1;
    update(id, updates);
    addLog(task, action, reason);
  }

  /* 撤销某条执行日志，恢复任务状态 */
  function undoAction(logId) {
    var log = SW.Store.getById(KEY_LOGS, logId);
    if (!log) return false;
    var task = SW.Store.getById(KEY_TASKS, log.taskId);
    if (!task) { SW.Store.delete(KEY_LOGS, logId); return false; }

    /* 找到同任务同天的其他日志，确定回退状态 */
    var allLogs = SW.Store.getAll(KEY_LOGS);
    var sameDayLogs = allLogs.filter(function (l) {
      return l.taskId === task.id && l.date === log.date && l.id !== logId;
    });
    sameDayLogs.sort(function (a, b) { return b.time.localeCompare(a.time); });
    var prevLog = sameDayLogs[0];

    var statusMap = {
      start: 'in_progress', ready: 'in_progress', complete: 'completed',
      postpone: 'postponed', slacking: 'slacking', abandon: 'abandoned'
    };

    var updates = {};
    if (prevLog) {
      updates.status = statusMap[prevLog.action] || 'pending';
    } else {
      updates.status = 'pending';
    }

    /* 撤销推迟：回退时间 & 计数 */
    if (log.action === 'postpone') {
      updates.postponeCount = Math.max(0, (task.postponeCount || 0) - 1);
      if (task.scheduledTime) {
        var t = new Date(task.scheduledTime);
        t.setMinutes(t.getMinutes() - 10);
        updates.scheduledTime = t.toISOString();
      }
    }
    if (log.action === 'abandon') {
      updates.abandonReason = (prevLog && prevLog.action === 'abandon') ? (prevLog.reason || '') : '';
    }
    if (log.action === 'complete') {
      updates.completedAt = (prevLog && prevLog.action === 'complete') ? task.completedAt : '';
    }

    update(task.id, updates);
    SW.Store.delete(KEY_LOGS, logId);
    return true;
  }

  /* ---- 渲染 ---- */

  function renderTaskList(filter) {
    filter = filter || 'all';
    var el = document.getElementById('taskList');
    var tasks = getAll(filter);
    if (!tasks.length) { el.innerHTML = '<p class="empty">暂无任务</p>'; return; }
    var html = '';
    for (var i = 0; i < tasks.length; i++) {
      var t = tasks[i];
      var statusLabel = statusText(t.status);
      var scheduledDisplay = t.scheduledTime ? formatScheduled(t.scheduledTime) : '未安排';
      var datetimeLocal = t.scheduledTime ? toDatetimeLocal(t.scheduledTime) : '';
      var canEdit = t.status === 'pending' || t.status === 'in_progress' || t.status === 'postponed';
      html += '<div class="task-item">'
        + '<div class="task-item__info">'
        + '<div class="task-item__content">' + esc(t.content) + '</div>'
        + '<div class="task-item__meta">'
        + '<span class="task-time-display">' + scheduledDisplay + '</span>'
        + (canEdit ? '<input type="datetime-local" class="task-time-input" data-task-id="' + t.id + '" value="' + datetimeLocal + '" step="60" style="display:none;">' : '')
        + ' | ' + t.estimatedMinutes + '分钟'
        + ' | <span class="task-item__status status-' + t.status + '">' + statusLabel + '</span>'
        + (t.postponeCount ? ' | 推迟' + t.postponeCount + '次' : '')
        + '</div>';
      if (canEdit) {
        html += '<div class="task-item__actions">'
          + '<button class="btn btn--small" data-task-complete="' + t.id + '">标记完成</button>'
          + '<button class="btn btn--small" data-task-postpone="' + t.id + '">推迟</button>'
          + '<button class="btn btn--small" data-task-slacking="' + t.id + '">摸鱼了</button>'
          + '<button class="btn btn--small" data-task-abandon="' + t.id + '">放弃</button>'
          + '<button class="btn btn--small" data-task-edit-time="' + t.id + '">修改时间</button>'
          + '<button class="btn btn--small btn--danger" data-task-delete="' + t.id + '">删除</button>'
          + '</div>';
      }
      html += '</div></div>';
    }
    el.innerHTML = html;
  }

  function renderHomeTasks() {
    var el = document.getElementById('homeTasks');
    var tasks = getTodayTasks();
    if (!tasks.length) { el.innerHTML = '<p class="empty">今日暂无任务</p>'; return; }
    var html = '';
    for (var i = 0; i < tasks.length; i++) {
      var t = tasks[i];
      html += '<div style="padding:5px 0;font-size:13px;display:flex;justify-content:space-between;align-items:center;">'
        + '<span>' + esc(t.content) + ' (' + t.estimatedMinutes + '分钟)</span>'
        + '<span style="color:#666;font-size:12px;">' + formatScheduled(t.scheduledTime) + '</span>'
        + '</div>';
    }
    el.innerHTML = html;
  }

  function renderCurrentTask() {
    var el = document.getElementById('homeCurrentTask');
    var task = getCurrentTask();
    if (!task) {
      var upcoming = getTodayTasks().filter(function (t) {
        return t.status === 'pending' || t.status === 'postponed';
      });
      if (upcoming.length > 0) {
        var next = upcoming[0];
        el.innerHTML = '<p style="font-size:14px;">下一个任务：<strong>' + esc(next.content)
          + '</strong><br><span style="color:#666;font-size:12px;">预计 ' + formatScheduled(next.scheduledTime) + ' 开始</span></p>';
      } else {
        el.innerHTML = '<p class="empty">今日无待执行任务</p>';
      }
      return;
    }
    el.innerHTML = '<p style="font-size:14px;font-weight:600;">当前任务：' + esc(task.content) + '</p>'
      + '<p style="font-size:12px;color:#666;">预计用时 ' + task.estimatedMinutes + ' 分钟 | '
      + formatScheduled(task.scheduledTime) + '</p>';
  }

  function renderEvaluation() {
    var el = document.getElementById('homeEvaluation');
    var tasks = getTodayTasks();
    if (!tasks.length) { el.innerHTML = '<p class="empty">暂无任务，无法评价</p>'; return; }
    var courses = SW.Courses ? SW.Courses.getTodayCourses() : [];
    var result = SW.Evaluation.evaluateToday(tasks, courses);
    var cls = 'evaluation evaluation--' + result.level;
    el.innerHTML = '<div class="' + cls + '">'
      + '<div class="evaluation__verdict">今日安排：' + result.verdict + '</div>'
      + '<div class="evaluation__reason">原因：' + result.reason + '</div>'
      + (result.advice ? '<div class="evaluation__advice">建议：' + result.advice + '</div>' : '')
      + '</div>';
  }

  /* ---- 事件绑定 ---- */

  function bindEvents() {
    var formTask = document.getElementById('formTask');
    formTask.onsubmit = function (e) {
      e.preventDefault();
      var fd = new FormData(formTask);
      var content = fd.get('content').trim();
      var estimatedMinutes = parseInt(document.getElementById('estimatedMinutes').value, 10) || 30;
      var scheduledTime = fd.get('scheduledTime');
      if (!scheduledTime) { alert('请选择预计执行时间'); return; }
      add({
        content: content,
        estimatedMinutes: estimatedMinutes,
        scheduledTime: new Date(scheduledTime).toISOString()
      });
      formTask.reset();
      resetPresets();
      refreshAll();
    };

    /* 预测用时预设按钮 */
    var presets = document.querySelectorAll('#timePresets .btn--preset');
    var customInput = document.getElementById('customMinutes');
    var estimatedInput = document.getElementById('estimatedMinutes');
    for (var i = 0; i < presets.length; i++) {
      presets[i].onclick = function () {
        for (var j = 0; j < presets.length; j++) presets[j].classList.remove('btn--preset-active');
        this.classList.add('btn--preset-active');
        var min = this.dataset.min;
        if (min === 'custom') {
          customInput.style.display = 'block';
          customInput.focus();
          estimatedInput.value = customInput.value || '30';
        } else {
          customInput.style.display = 'none';
          estimatedInput.value = min;
        }
      };
    }
    customInput.oninput = function () { estimatedInput.value = this.value || '30'; };

    /* 筛选按钮 */
    var filterBtns = document.querySelectorAll('#page-tasks .btn--filter');
    for (var i = 0; i < filterBtns.length; i++) {
      filterBtns[i].onclick = function () {
        for (var j = 0; j < filterBtns.length; j++) filterBtns[j].classList.remove('btn--filter-active');
        this.classList.add('btn--filter-active');
        renderTaskList(this.dataset.filter);
        bindTaskActions();
      };
    }
    bindTaskActions();
  }

  function resetPresets() {
    var presets = document.querySelectorAll('#timePresets .btn--preset');
    for (var i = 0; i < presets.length; i++) presets[i].classList.remove('btn--preset-active');
    var btn30 = document.querySelector('#timePresets [data-min="30"]');
    if (btn30) btn30.classList.add('btn--preset-active');
    document.getElementById('estimatedMinutes').value = '30';
    document.getElementById('customMinutes').style.display = 'none';
  }

  /* 任务列表操作按钮（事件委托） */
  function bindTaskActions() {
    var taskList = document.getElementById('taskList');
    if (!taskList) return;

    taskList.onclick = function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;

      /* 修改时间：隐藏文字，显示 datetime 输入框 */
      if (btn.dataset.taskEditTime !== undefined) {
        var id = btn.dataset.taskEditTime;
        var metaDiv = btn.closest('.task-item').querySelector('.task-item__meta');
        var display = metaDiv.querySelector('.task-time-display');
        var input = metaDiv.querySelector('.task-time-input');
        display.style.display = 'none';
        input.style.display = '';
        input.focus();
        return;
      }

      var id = btn.dataset.taskComplete || btn.dataset.taskPostpone || btn.dataset.taskSlacking
        || btn.dataset.taskAbandon || btn.dataset.taskDelete;
      if (!id) return;

      if (btn.dataset.taskComplete !== undefined) {
        markStatus(id, 'complete'); refreshAll();
      } else if (btn.dataset.taskPostpone !== undefined) {
        var task = SW.Store.getById(KEY_TASKS, id);
        var newCount = (task.postponeCount || 0) + 1;
        markStatus(id, 'postpone');
        if (task.scheduledTime) {
          var newTime = new Date(task.scheduledTime);
          newTime.setMinutes(newTime.getMinutes() + 10);
          update(id, { scheduledTime: newTime.toISOString() });
        }
        if (newCount >= 2) {
          document.getElementById('downgradeMsg').textContent =
            '你已经推迟 ' + newCount + ' 次了，建议把这个任务降级成 15 分钟低配版。';
          document.getElementById('overlayDowngrade').style.display = 'flex';
        }
        refreshAll();
      } else if (btn.dataset.taskSlacking !== undefined) {
        markStatus(id, 'slacking');
        document.getElementById('downgradeMsg').textContent = '别硬撑。现在把原任务降级成 15 分钟版本，先做一点点。';
        document.getElementById('overlayDowngrade').style.display = 'flex';
        refreshAll();
      } else if (btn.dataset.taskAbandon !== undefined) {
        window._abandonTaskId = id;
        document.getElementById('overlayAbandon').style.display = 'flex';
      } else if (btn.dataset.taskDelete !== undefined) {
        if (!confirm('确定删除这个任务吗？')) return;
        remove(id); refreshAll();
      }
    };

    /* 时间输入框修改：blur 时保存并刷新，ESC 时取消 */
    taskList.onchange = function (e) {
      var input = e.target.closest('.task-time-input');
      if (!input) return;
      var id = input.dataset.taskId;
      var newVal = input.value;
      if (newVal) {
        update(id, { scheduledTime: new Date(newVal).toISOString() });
        refreshAll();
      }
    };
    taskList.onkeydown = function (e) {
      if (e.key !== 'Escape') return;
      var input = e.target.closest('.task-time-input');
      if (!input) return;
      var metaDiv = input.closest('.task-item__meta');
      var display = metaDiv.querySelector('.task-time-display');
      input.style.display = 'none';
      display.style.display = '';
    };
  }

  function refreshAll() {
    var currentFilter = document.querySelector('#page-tasks .btn--filter-active');
    var filter = currentFilter ? currentFilter.dataset.filter : 'all';
    renderTaskList(filter);
    bindTaskActions();
    renderEvaluation();
    if (SW.App && SW.App.refreshHome) SW.App.refreshHome();
  }

  /* ---- 工具 ---- */

  function getTodayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function statusText(s) {
    var map = {
      pending: '待执行', in_progress: '进行中', completed: '已完成',
      postponed: '已推迟', abandoned: '已放弃', slacking: '摸鱼了'
    };
    return map[s] || s;
  }

  function formatScheduled(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
      + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function toDatetimeLocal(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
      + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  return {
    getAll: getAll, getTodayTasks: getTodayTasks, getCurrentTask: getCurrentTask,
    add: add, update: update, remove: remove,
    addLog: addLog, markStatus: markStatus, undoAction: undoAction,
    renderTaskList: renderTaskList, renderHomeTasks: renderHomeTasks,
    renderCurrentTask: renderCurrentTask, renderEvaluation: renderEvaluation,
    bindEvents: bindEvents, refreshAll: refreshAll
  };
})();
