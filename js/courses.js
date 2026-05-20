/* courses.js — 课表管理 */

var SW = window.SW || {};

SW.Courses = (function () {
  var KEY = 'courses';

  /* 2026春季学期：第1周从3月2日（周一）开始 */
  var SEMESTER_START = new Date(2026, 2, 2); // 月份从0开始，2=3月

  function getCurrentWeek() {
    var now = new Date();
    /* 找到本周一 */
    var day = now.getDay(); // 0=周日
    var monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    monday.setHours(0, 0, 0, 0);
    var diffMs = monday - SEMESTER_START;
    var week = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
    return Math.max(1, week);
  }

  function getAll() {
    return SW.Store.getAll(KEY);
  }

  function getTodayCourses() {
    var today = new Date();
    var dayOfWeek = today.getDay();
    dayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek;
    var currentWeek = getCurrentWeek();

    return getAll().filter(function (c) {
      if (Number(c.dayOfWeek) !== dayOfWeek) return false;
      var sw = c.startWeek || 1;
      var ew = c.endWeek || 20;
      return currentWeek >= sw && currentWeek <= ew;
    }).sort(function (a, b) {
      return a.startTime.localeCompare(b.startTime);
    });
  }

  /* 渲染课程列表（课表页） */
  function renderCourseList() {
    var el = document.getElementById('courseList');
    var courses = getAll();
    if (!courses.length) {
      el.innerHTML = '<p class="empty">暂无课程，请先添加</p>';
      return;
    }
    var dayNames = ['', '周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    var currentWeek = getCurrentWeek();
    var html = '';
    for (var i = 0; i < courses.length; i++) {
      var c = courses[i];
      var sw = c.startWeek || 1;
      var ew = c.endWeek || 20;
      var active = currentWeek >= sw && currentWeek <= ew;
      var inactiveLabel = '';
      if (!active) {
        inactiveLabel = currentWeek < sw ? '(未开始)' : '(已过期)';
      }
      html += '<div class="course-item' + (active ? '' : ' course-item--inactive') + '">'
        + '<div class="course-item__info">'
        + '<div class="course-item__name">' + esc(c.name)
        + ' <span style="font-weight:400;font-size:12px;color:#666;">' + c.credits + '学分</span>'
        + (inactiveLabel ? ' <span style="font-size:11px;color:#999;">' + inactiveLabel + '</span>' : '')
        + '</div>'
        + '<div class="course-item__meta">' + dayNames[c.dayOfWeek] + ' '
        + c.startTime + '-' + c.endTime
        + ' | ' + esc(c.location)
        + ' | 第' + sw + '-' + ew + '周'
        + '</div>'
        + '</div>'
        + '<button class="btn btn--danger btn--small" data-delete-course="' + c.id + '">删除</button>'
        + '</div>';
    }
    el.innerHTML = html;
  }

  /* 渲染今日课程（首页） */
  function renderHomeCourses() {
    var el = document.getElementById('homeCourses');
    var courses = getTodayCourses();
    if (!courses.length) {
      el.innerHTML = '<p class="empty">今日无课</p>';
      return;
    }
    var currentWeek = getCurrentWeek();
    var html = '<div style="font-size:12px;color:#999;margin-bottom:4px;">当前第' + currentWeek + '周</div>';
    for (var i = 0; i < courses.length; i++) {
      var c = courses[i];
      html += '<div style="padding:6px 0;font-size:14px;">'
        + '<strong>' + esc(c.name) + '</strong> '
        + c.startTime + '-' + c.endTime
        + ' | ' + esc(c.location)
        + ' | ' + c.credits + '学分'
        + '</div>';
    }
    el.innerHTML = html;
  }

  function bindEvents() {
    /* 新增课程表单 */
    var form = document.getElementById('formCourse');
    form.onsubmit = function (e) {
      e.preventDefault();
      var fd = new FormData(form);
      SW.Store.create(KEY, {
        name: fd.get('name').trim(),
        dayOfWeek: Number(fd.get('dayOfWeek')),
        startTime: fd.get('startTime'),
        endTime: fd.get('endTime'),
        startWeek: Number(fd.get('startWeek')) || 1,
        endWeek: Number(fd.get('endWeek')) || 16,
        location: fd.get('location').trim(),
        credits: Number(fd.get('credits'))
      });
      form.reset();
      /* 恢复默认周数 */
      form.querySelector('[name="startWeek"]').value = '1';
      form.querySelector('[name="endWeek"]').value = '16';
      renderCourseList();
      if (SW.App && SW.App.refreshHome) SW.App.refreshHome();
    };

    /* 删除课程 */
    document.getElementById('courseList').onclick = function (e) {
      var btn = e.target.closest('[data-delete-course]');
      if (!btn) return;
      if (!confirm('确定删除这门课程吗？')) return;
      SW.Store.delete(KEY, btn.dataset.deleteCourse);
      renderCourseList();
      if (SW.App && SW.App.refreshHome) SW.App.refreshHome();
    };
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  return {
    getAll: getAll,
    getTodayCourses: getTodayCourses,
    getCurrentWeek: getCurrentWeek,
    renderCourseList: renderCourseList,
    renderHomeCourses: renderHomeCourses,
    bindEvents: bindEvents
  };
})();
