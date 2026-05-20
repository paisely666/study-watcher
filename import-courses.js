/* 课表导入脚本 — 在浏览器控制台中粘贴运行（备用） */
/* 打开 index.html → F12 → Console → 粘贴 → Enter */

(function () {
  SW.Store.save('courses', []);
  localStorage.setItem('_importVersion', '2');

  var courses = [
    { name:"高等数学A(2)", dayOfWeek:1, startTime:"10:00", endTime:"11:40", startWeek:1, endWeek:16, location:"宝山主区 EJ403 温智婕", credits:5 },
    { name:"大学化学实验", dayOfWeek:1, startTime:"13:00", endTime:"14:40", startWeek:1, endWeek:16, location:"宝山主区 HA四楼 付继芳", credits:1 },
    { name:"线性代数", dayOfWeek:2, startTime:"08:00", endTime:"09:40", startWeek:1, endWeek:16, location:"宝山主区 FJ204 黄红娣", credits:3 },
    { name:"大学物理A(2)", dayOfWeek:2, startTime:"10:00", endTime:"11:40", startWeek:1, endWeek:16, location:"宝山主区 EJ304 贾蓉蓉", credits:4 },
    { name:"形势与政策", dayOfWeek:2, startTime:"13:00", endTime:"14:40", startWeek:12, endWeek:12, location:"宝山主区 EJ106 奚建群", credits:1 },
    { name:"形势与政策", dayOfWeek:2, startTime:"13:00", endTime:"14:40", startWeek:16, endWeek:16, location:"宝山主区 EJ106 奚建群", credits:1 },
    { name:"人工智能基础A", dayOfWeek:2, startTime:"15:00", endTime:"16:40", startWeek:1, endWeek:16, location:"宝山主区 FJ204 孙广玲", credits:2 },
    { name:"大学英语A(2)", dayOfWeek:3, startTime:"08:00", endTime:"09:40", startWeek:1, endWeek:16, location:"宝山主区 C109 邵庆华", credits:2 },
    { name:"高等数学A(2)", dayOfWeek:3, startTime:"10:00", endTime:"11:40", startWeek:1, endWeek:16, location:"宝山主区 EJ403 温智婕", credits:5 },
    { name:"大学物理实验A(2)", dayOfWeek:3, startTime:"13:00", endTime:"14:40", startWeek:1, endWeek:16, location:"宝山主区 F楼实验中心 盛雷梅", credits:1 },
    { name:"游泳(基础)", dayOfWeek:3, startTime:"15:00", endTime:"16:40", startWeek:9, endWeek:16, location:"宝山主区 游泳馆大池 刘超云", credits:1 },
    { name:"中国近现代史纲要", dayOfWeek:3, startTime:"18:00", endTime:"20:45", startWeek:1, endWeek:16, location:"宝山主区 FJ403 王国斌", credits:2 },
    { name:"511值班", dayOfWeek:4, startTime:"08:00", endTime:"09:40", startWeek:9, endWeek:16, location:"", credits:0 },
    { name:"大学物理A(2)", dayOfWeek:4, startTime:"10:00", endTime:"11:40", startWeek:1, endWeek:16, location:"宝山主区 EJ304 贾蓉蓉", credits:4 },
    { name:"大学生心理健康", dayOfWeek:4, startTime:"15:00", endTime:"16:40", startWeek:13, endWeek:15, location:"宝山主区 EJ103 海棠", credits:2 },
    { name:"大学化学", dayOfWeek:5, startTime:"08:00", endTime:"09:40", startWeek:1, endWeek:16, location:"宝山主区 C109 袁帅", credits:2 },
    { name:"高等数学A(2)", dayOfWeek:5, startTime:"10:00", endTime:"11:40", startWeek:1, endWeek:16, location:"宝山主区 EJ403 温智婕", credits:5 },
    { name:"红歌视唱", dayOfWeek:5, startTime:"15:00", endTime:"16:40", startWeek:9, endWeek:16, location:"宝山主区 C117 陈迪芸", credits:1 }
  ];

  for (var i = 0; i < courses.length; i++) {
    SW.Store.create('courses', courses[i]);
  }

  alert('成功导入 ' + courses.length + ' 门课程！（版本2）');
  SW.Courses.renderCourseList();
  if (SW.App && SW.App.refreshHome) SW.App.refreshHome();
})();
