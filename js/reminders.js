/* reminders.js — 定时追问 + 弹窗交互 */

var SW = window.SW || {};

SW.Reminders = (function () {
  var KEY_TASKS = 'tasks';
  var intervalId = null;
  var remindedTasks = {};

  function start() {
    intervalId = setInterval(check, 30000);
    check();
  }

  function check() {
    if (document.getElementById('overlayReminder').style.display === 'flex') return;
    if (document.getElementById('overlayAbandon').style.display === 'flex') return;

    var task = SW.Tasks.getCurrentTask();
    if (!task || (task.status !== 'pending' && task.status !== 'postponed')) return;
    if (!task.scheduledTime) return;

    var now = new Date();
    var scheduled = new Date(task.scheduledTime);
    var diffMin = (now - scheduled) / 60000;
    if (diffMin < 0 || diffMin > 5) return;
    if (remindedTasks[task.id]) return;

    remindedTasks[task.id] = true;
    showDialog(task);
  }

  function showDialog(task) {
    document.getElementById('reminderMsg').innerHTML =
      '现在 ' + formatTime(new Date()) + ' 了，你计划开始「<strong>' + esc(task.content) + '</strong>」。<br>你现在在干什么？';
    document.getElementById('overlayReminder').style.display = 'flex';
    window._reminderTaskId = task.id;
  }

  function bindActions() {
    var btns = document.querySelectorAll('#overlayReminder .dialog__btns .btn');
    for (var i = 0; i < btns.length; i++) {
      btns[i].onclick = function () {
        var action = this.dataset.action;
        var taskId = window._reminderTaskId;
        if (!taskId) return;

        if (action === 'abandon') {
          document.getElementById('overlayReminder').style.display = 'none';
          window._abandonTaskId = taskId;
          document.getElementById('overlayAbandon').style.display = 'flex';
          return;
        }

        document.getElementById('overlayReminder').style.display = 'none';
        handleAction(taskId, action);
        if (SW.App && SW.App.refreshHome) SW.App.refreshHome();
      };
    }

    /* 放弃原因 */
    var reasons = document.querySelectorAll('#abandonReasons .btn--reason');
    for (var i = 0; i < reasons.length; i++) {
      reasons[i].onclick = function () {
        var reason = this.dataset.reason;
        var taskId = window._abandonTaskId;
        document.getElementById('overlayAbandon').style.display = 'none';
        if (taskId) {
          SW.Tasks.markStatus(taskId, 'abandon', reason);
          if (SW.App && SW.App.refreshHome) SW.App.refreshHome();
        }
      };
    }
    document.getElementById('overlayAbandon').onclick = function (e) {
      if (e.target === this) this.style.display = 'none';
    };

    /* 降级弹窗 */
    document.getElementById('btnCloseDowngrade').onclick = function () {
      document.getElementById('overlayDowngrade').style.display = 'none';
    };
    document.getElementById('overlayDowngrade').onclick = function (e) {
      if (e.target === this) this.style.display = 'none';
    };
  }

  function handleAction(taskId, action) {
    if (action === 'postpone') {
      var task = SW.Store.getById(KEY_TASKS, taskId);
      var newCount = (task.postponeCount || 0) + 1;
      SW.Tasks.markStatus(taskId, 'postpone');
      if (task.scheduledTime) {
        var newTime = new Date(task.scheduledTime);
        newTime.setMinutes(newTime.getMinutes() + 10);
        SW.Tasks.update(taskId, { scheduledTime: newTime.toISOString() });
      }
      delete remindedTasks[taskId];
      if (newCount >= 2) {
        document.getElementById('downgradeMsg').textContent =
          '你已经推迟 ' + newCount + ' 次了，建议把这个任务降级成 15 分钟低配版。';
        document.getElementById('overlayDowngrade').style.display = 'flex';
      }
    } else if (action === 'slacking') {
      SW.Tasks.markStatus(taskId, 'slacking');
      document.getElementById('downgradeMsg').textContent =
        '别硬撑。现在把原任务降级成 15 分钟版本，先做一点点。';
      document.getElementById('overlayDowngrade').style.display = 'flex';
    } else {
      SW.Tasks.markStatus(taskId, action);
    }
  }

  function formatTime(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  return { start: start, bindActions: bindActions };
})();
