/* evaluation.js — 任务安排合理性评价 + 相似任务查找 */

var SW = window.SW || {};

SW.Evaluation = (function () {
  var KEY_LOGS = 'logs';

  /* 评价今日任务安排 */
  function evaluateToday(tasks, courses) {
    if (!tasks.length) {
      return { level: 'ok', verdict: '合理', reason: '今天没有安排任务。', advice: '' };
    }

    var totalMin = 0;
    var lateCount = 0;
    var heavyAdjacent = false;
    var reasons = [];
    var adviceItems = [];

    for (var i = 0; i < tasks.length; i++) {
      totalMin += tasks[i].estimatedMinutes || 0;
    }

    for (var i = 0; i < tasks.length; i++) {
      var st = tasks[i].scheduledTime;
      if (st) {
        var hour = parseInt(st.split('T')[1] || '00:00', 10);
        if (hour >= 21) lateCount++;
      }
    }

    for (var i = 0; i < tasks.length - 1; i++) {
      if ((tasks[i].estimatedMinutes || 0) > 45 && (tasks[i + 1].estimatedMinutes || 0) > 45) {
        heavyAdjacent = true;
        break;
      }
    }

    /* 高学分课是否有对应复习任务 */
    var highCreditCourses = courses.filter(function (c) { return c.credits >= 3; });
    var hasReviewTask = false;
    for (var i = 0; i < tasks.length; i++) {
      for (var j = 0; j < highCreditCourses.length; j++) {
        if (tasks[i].content.indexOf(highCreditCourses[j].name) !== -1) {
          hasReviewTask = true;
          break;
        }
      }
      if (hasReviewTask) break;
    }

    /* 历史完成率 */
    var logs = SW.Store.getAll(KEY_LOGS);
    var todayStr = getTodayStr();
    var completedCount = 0, totalLogged = 0;
    for (var i = 0; i < logs.length; i++) {
      if (logs[i].date !== todayStr) continue;
      totalLogged++;
      if (logs[i].action === 'complete') completedCount++;
    }
    var completionRate = totalLogged > 0 ? completedCount / totalLogged : 1;

    /* 评分 */
    var score = 0;
    if (totalMin > 180) { score += 2; reasons.push('今日任务总时长超过 180 分钟'); }
    else if (totalMin > 120) { score += 1; reasons.push('今日任务总时长超过 120 分钟'); }
    if (heavyAdjacent) { score += 1; reasons.push('连续安排了多个高强度任务（>45分钟）'); }
    if (lateCount > 0) { score += 1; reasons.push(lateCount + ' 个任务安排在 21:00 之后'); }
    if (completionRate < 0.5) { score += 1; reasons.push('近期完成率偏低'); }

    if (highCreditCourses.length > 0 && !hasReviewTask && tasks.length > 0) {
      adviceItems.push('今天有' + highCreditCourses.length + '门高学分课，建议安排相关复习任务');
    }
    if (totalMin > 120) adviceItems.push('建议把总学习时间控制在 90 分钟以内');
    if (lateCount > 0) adviceItems.push('尽量把任务安排在 21:00 之前');
    if (heavyAdjacent) adviceItems.push('高强度任务之间建议穿插休息或低强度任务');

    var level, verdict;
    if (score === 0) { level = 'ok'; verdict = '合理'; }
    else if (score === 1) { level = 'slightly-full'; verdict = '略满'; }
    else if (score === 2) { level = 'full'; verdict = '偏满'; }
    else { level = 'unrealistic'; verdict = '不太现实'; }

    return {
      level: level,
      verdict: verdict,
      totalMin: totalMin,
      reason: reasons.length ? reasons.join('；') : '安排看起来不错',
      advice: adviceItems.length ? adviceItems.join('。') : ''
    };
  }

  /* 简单关键词匹配找相似任务 */
  function findSimilarTasks(content, allTasks) {
    var keywords = content.replace(/[0-9０-９第章节测练习题复习作业考试截止周一二三四五六日]/g, '').trim();
    if (!keywords) return [];
    return allTasks.filter(function (t) {
      if (t.content === content) return false;
      for (var i = 0; i < keywords.length; i++) {
        if (t.content.indexOf(keywords[i]) !== -1) return true;
      }
      return false;
    });
  }

  function getTodayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  return {
    evaluateToday: evaluateToday,
    findSimilarTasks: findSimilarTasks
  };
})();
