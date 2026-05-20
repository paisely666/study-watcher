/* sleep.js — 睡觉按钮 + 24:00 自动总结 */

var SW = window.SW || {};

SW.Sleep = (function () {
  var KEY_REWARDS = 'rewardRules';
  var KEY_RESCUES = 'rescueRules';
  var KEY_SUMMARIES = 'sleepSummaries';
  var KEY_TASKS = 'tasks';

  var alreadySlept = false;
  var midnightTimeout = null;

  function init() {
    document.getElementById('btnSleep').onclick = function () {
      if (!alreadySlept) alreadySlept = true;
      showSummary();
    };
    document.getElementById('btnCloseSleep').onclick = function () {
      document.getElementById('overlaySleep').style.display = 'none';
    };
    document.getElementById('overlaySleep').onclick = function (e) {
      if (e.target === this) this.style.display = 'none';
    };
    scheduleMidnight();
  }

  function scheduleMidnight() {
    var now = new Date();
    var midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    midnightTimeout = setTimeout(function () {
      if (!alreadySlept) {
        alreadySlept = true;
        showSummary();
      }
    }, midnight - now);
  }

  function showSummary() {
    var todayStr = getTodayStr();
    var tasks = SW.Tasks.getTodayTasks();
    var logs = SW.Review.getDayLogs(todayStr);

    var completed = 0, abandoned = 0;
    for (var i = 0; i < tasks.length; i++) {
      var s = tasks[i].status;
      if (s === 'completed') completed++;
      else if (s === 'abandoned') abandoned++;
    }

    var logPostponed = 0, logSlacking = 0;
    for (var i = 0; i < logs.length; i++) {
      if (logs[i].action === 'postpone') logPostponed++;
      if (logs[i].action === 'slacking') logSlacking++;
    }

    /* 检查奖励 */
    var rewards = SW.Store.getAll(KEY_REWARDS);
    var triggeredRewards = [];
    for (var i = 0; i < rewards.length; i++) {
      if (checkReward(rewards[i], tasks, completed)) {
        triggeredRewards.push(rewards[i]);
      }
    }

    /* 检查补救 */
    var rescues = SW.Store.getAll(KEY_RESCUES);
    var triggeredRescues = [];
    for (var i = 0; i < rescues.length; i++) {
      if (checkRescue(rescues[i], tasks, completed, logPostponed, logSlacking, abandoned)) {
        triggeredRescues.push(rescues[i]);
      }
    }

    /* 保存总结 */
    saveSummary(todayStr, tasks.length, completed, logPostponed, logSlacking, abandoned, logs, triggeredRewards, triggeredRescues);

    /* 渲染弹窗 */
    var html = '';
    html += '<div class="summary-block summary-block--complete"><strong>完成情况</strong><br>'
      + '完成任务：' + completed + ' / ' + tasks.length + '<br>'
      + '推迟：' + logPostponed + ' 次 | 摸鱼：' + logSlacking + ' 次 | 放弃：' + abandoned + ' 次</div>';

    if (triggeredRewards.length) {
      html += '<div class="summary-block summary-block--reward"><strong>今日可获得的奖励</strong><br>';
      for (var i = 0; i < triggeredRewards.length; i++) {
        html += '✓ ' + esc(triggeredRewards[i].name) + '：' + esc(triggeredRewards[i].reward) + '<br>';
      }
      html += '</div>';
    } else {
      html += '<div class="summary-block summary-block--reward">今日没有触发奖励规则</div>';
    }

    if (triggeredRescues.length) {
      html += '<div class="summary-block summary-block--rescue"><strong>触发的补救提醒</strong><br>';
      for (var i = 0; i < triggeredRescues.length; i++) {
        html += '⚠ ' + esc(triggeredRescues[i].name) + '：' + esc(triggeredRescues[i].measure) + '<br>';
      }
      html += '</div>';
    }

    document.getElementById('sleepSummaryContent').innerHTML = html;
    document.getElementById('overlaySleep').style.display = 'flex';
  }

  function saveSummary(date, total, completed, postponed, slacking, abandoned, logs, rewards, rescues) {
    var failReason = '';
    var counts = {};
    for (var i = 0; i < logs.length; i++) {
      if (logs[i].reason) counts[logs[i].reason] = (counts[logs[i].reason] || 0) + 1;
    }
    var topN = 0;
    for (var k in counts) { if (counts[k] > topN) { failReason = k; topN = counts[k]; } }

    var data = {
      date: date,
      completedTasks: completed,
      totalTasks: total,
      postponeCount: postponed,
      slackingCount: slacking,
      abandonCount: abandoned,
      mainFailReason: failReason,
      rewardsTriggered: rewards.map(function (r) { return r.name; }),
      rescuesTriggered: rescues.map(function (r) { return r.name; })
    };

    var summaries = SW.Store.getAll(KEY_SUMMARIES);
    var found = false;
    for (var i = 0; i < summaries.length; i++) {
      if (summaries[i].date === date) { summaries[i] = data; found = true; break; }
    }
    if (found) {
      SW.Store.save(KEY_SUMMARIES, summaries);
    } else {
      SW.Store.create(KEY_SUMMARIES, data);
    }
  }

  function checkReward(rule, tasks, completed) {
    if (rule.condition === 'all_complete') return tasks.length > 0 && completed === tasks.length;
    if (rule.condition === 'core_complete') {
      var total = 0;
      for (var i = 0; i < tasks.length; i++) {
        if (tasks[i].status === 'completed') total += tasks[i].estimatedMinutes || 0;
      }
      return total >= 60;
    }
    if (rule.condition === 'streak3') return checkStreak3();
    return false;
  }

  function checkRescue(rule, tasks, completed, postponed, slacking, abandoned) {
    if (rule.condition === 'incomplete_core') {
      var total = 0;
      for (var i = 0; i < tasks.length; i++) {
        if (tasks[i].status === 'completed') total += tasks[i].estimatedMinutes || 0;
      }
      return tasks.length > 0 && total < 60;
    }
    if (rule.condition === 'postpone2') return postponed >= 2;
    if (rule.condition === 'slacking2') return slacking >= 2;
    if (rule.condition === 'complete_low') return tasks.length > 0 && (completed / tasks.length) < 0.5;
    return false;
  }

  function checkStreak3() {
    var summaries = SW.Store.getAll(KEY_SUMMARIES);
    if (summaries.length < 3) return false;
    summaries.sort(function (a, b) { return b.date.localeCompare(a.date); });
    for (var i = 0; i < 3; i++) {
      var rate = summaries[i].totalTasks > 0 ? summaries[i].completedTasks / summaries[i].totalTasks : 1;
      if (rate < 0.7) return false;
    }
    return true;
  }

  function getTodayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  return { init: init, showSummary: showSummary };
})();
