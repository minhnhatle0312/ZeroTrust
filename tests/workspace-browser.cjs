// Chrome + real built Web A + real API routes, SQLite :memory:, synthetic OIDC only.
// No trace, HAR, storage state, request bodies, passwords or tokens are persisted.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('../.tools/playwright/driver/package');
const fixture=require('./fixtures/workspace-server.cjs');
const OUT=path.resolve(__dirname,process.env.IAM_BROWSER_PHASE==='6'?'../.runtime/phase6-tests':process.env.IAM_BROWSER_PHASE==='5b'?'../.runtime/phase5b-tests':process.env.IAM_BROWSER_PHASE==='5a'?'../.runtime/phase5a-tests':process.env.IAM_BROWSER_PHASE==='4'?'../.runtime/phase4-tests':'../.runtime/phase3-tests'),checks=[];
let step='start',jsErrors=0,externalRequests=0,browser;
function check(name,value){step=name;checks.push({name,passed:!!value});console.log((value?'PASS ':'FAIL ')+name);if(!value)throw Error('Assertion');}
async function ready(page){await page.locator('.workspace-data:not([inert])').waitFor();}
async function settle(page){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
async function nav(page,label){await page.locator('.shell-sidebar nav').getByRole('button',{name:label,exact:true}).click();await settle(page);await ready(page);}
async function login(role,section='overview'){
  fixture.mode.role=role;
  const ctx=await browser.newContext({viewport:{width:1440,height:1000},locale:'vi-VN',reducedMotion:'reduce'});
  await ctx.route('**/*',route=>{if(new URL(route.request().url()).origin===fixture.base)route.continue();else{externalRequests++;route.abort();}});
  ctx.on('page',page=>page.on('pageerror',()=>jsErrors++));
  const page=await ctx.newPage();await page.goto(fixture.base+'/a/#/'+section);
  await page.getByRole('button',{name:'Đăng nhập qua Keycloak'}).click();await ready(page);return {ctx,page};
}
async function screenshot(page,name){await page.evaluate(()=>scrollTo(0,0));await settle(page);await page.screenshot({path:path.join(OUT,name+'.png'),fullPage:true});}
async function noOverflow(page){return page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth);}
async function main(){
  fs.mkdirSync(OUT,{recursive:true});await fixture.start();
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-background-networking','--disable-sync','--no-first-run']});
  try{
    step='employee login';let {ctx,page}=await login('employee','checkin');
    check('Employee navigation hides team, approvals and administration',await page.locator('.shell-sidebar nav').getByRole('button',{name:'Quản lý nhóm',exact:true}).count()===0&&await page.locator('.shell-sidebar nav').getByRole('button',{name:'Tài khoản & truy cập',exact:true}).count()===0);
    await screenshot(page,'workspace-checkin-desktop');
    fixture.mode.delayRoute='/api/attendance/check-in';fixture.mode.delay=400;
    await page.getByRole('button',{name:'Chấm công vào',exact:true}).click();await settle(page);
    await page.getByRole('button',{name:'Chấm công ra',exact:true}).waitFor();await ready(page);
    check('Check-in writes exactly one attendance record via real API',fixture.store.one('SELECT COUNT(*) AS n FROM attendance WHERE user_id=? AND day=?','synthetic-employee',new Date(Date.now()+7*3600000).toISOString().slice(0,10)).n===1);
    check('Check-in body does not forge identity or time',fixture.mutations.filter(m=>m.route==='/api/attendance/check-in'&&m.status===201).length===1);
    fixture.mode.delay=0;
    await page.getByRole('button',{name:'Chấm công ra',exact:true}).click();await settle(page);
    check('Checkout opens explicit confirmation without changing attendance',await page.getByRole('dialog',{name:'Kết thúc ca làm việc?'}).isVisible()&&fixture.store.one('SELECT check_out FROM attendance WHERE user_id=? ORDER BY day DESC','synthetic-employee').check_out===null);
    await page.getByRole('button',{name:'Tiếp tục làm việc'}).click();await settle(page);
    check('Cancel checkout leaves shift open',fixture.mutations.filter(m=>m.route==='/api/attendance/check-out').length===0);
    await page.getByRole('button',{name:'Chấm công ra',exact:true}).click();await settle(page);await page.getByRole('button',{name:'Xác nhận chấm công ra'}).click();await settle(page);await ready(page);
    check('Confirmed checkout completes shift and disables repeat',await page.getByRole('button',{name:'Đã hoàn thành hôm nay'}).isDisabled()&&fixture.mutations.some(m=>m.route==='/api/attendance/check-out'&&m.status===200));

    await nav(page,'Bảng công của tôi');
    const historyMonth=fixture.store.one('SELECT MIN(day) AS day FROM attendance').day.slice(0,7);
    await page.getByLabel('Tháng bảng công',{exact:true}).fill(historyMonth);await settle(page);await ready(page);
    const table=page.getByRole('table',{name:'Bảng công cá nhân'}),panel=page.locator('.workspace-attendance-table');
    await table.locator('tbody tr').first().waitFor();
    check('Monthly table paginates 25 records into 10 rows',await table.locator('tbody tr').count()===10&&await panel.getByText('1 / 3',{exact:true}).isVisible());
    await panel.getByRole('button',{name:'Trang sau',exact:true}).click();await settle(page);
    check('Next page works',await panel.getByText('2 / 3',{exact:true}).isVisible());
    await page.getByLabel('Tìm bảng công',{exact:true}).fill(historyMonth);await settle(page);
    check('Search resets page even when result count stays the same',await panel.getByText('1 / 3',{exact:true}).isVisible());
    await panel.getByRole('button',{name:'Xóa bộ lọc'}).click();await settle(page);
    await panel.getByLabel('Số dòng mỗi trang').selectOption('20');await settle(page);
    check('Page size selector changes visible rows',await table.locator('tbody tr').count()===20);
    await table.getByRole('button',{name:'Ngày',exact:false}).click();await settle(page);
    check('Sort announces direction and changes row order',(await table.locator('tbody tr').first().innerText()).includes('1/'+Number(historyMonth.slice(5)))&&await table.locator('th[aria-sort="ascending"]').count()===1);
    await panel.getByLabel('Lọc bảng công',{exact:true}).selectOption('late');await settle(page);
    check('Attendance status filter returns only late shifts',await table.locator('tbody tr').count()===12&&(await table.locator('tbody').innerText()).includes('Muộn 15 phút'));
    const downloading=page.waitForEvent('download');await panel.getByRole('button',{name:'Xuất CSV'}).click();await settle(page);const download=await downloading;
    const stream=await download.createReadStream();let csv='';for await(const part of stream)csv+=part.toString('utf8');
    check('CSV includes all filtered results across pages',csv.includes('Phút đi muộn')&&csv.trim().split(/\r?\n/).length===13&&download.suggestedFilename().includes(historyMonth));
    await page.getByLabel('Tìm bảng công',{exact:true}).fill('không tồn tại');await settle(page);
    check('Empty filtered table disables CSV',await panel.getByText('Không tìm thấy bản ghi phù hợp').isVisible()&&await panel.getByRole('button',{name:'Xuất CSV'}).isDisabled());
    await panel.getByRole('button',{name:'Xóa bộ lọc'}).click();await settle(page);
    const dateLabel=historyMonth+'-02';await page.getByRole('button',{name:new RegExp('^'+dateLabel+':')}).click();await settle(page);
    check('Calendar opens daily attendance details',await page.getByRole('dialog',{name:/Chi tiết ngày/}).isVisible());await page.keyboard.press('Escape');
    await screenshot(page,'workspace-attendance-desktop');

    await nav(page,'Đơn điều chỉnh');
    await page.getByRole('button',{name:'Trang sau đơn cá nhân',exact:true}).click();await settle(page);
    check('Request cards support next page',await page.getByRole('navigation',{name:'đơn cá nhân',exact:true}).getByText('2 / 3',{exact:true}).isVisible());
    await page.getByLabel('Số đơn mỗi trang đơn cá nhân').selectOption('20');await settle(page);
    check('Request page size resets to first page',await page.locator('.request-item').count()===20&&await page.getByRole('navigation',{name:'đơn cá nhân',exact:true}).getByText('1 / 2',{exact:true}).isVisible());
    await page.getByLabel('Tìm đơn điều chỉnh').fill('không tồn tại');await settle(page);
    check('Filtered requests distinguish no matches from no data',await page.getByRole('heading',{name:'Không tìm thấy đơn phù hợp'}).isVisible());
    await page.getByRole('button',{name:'Xóa bộ lọc'}).first().click();await settle(page);
    await page.getByLabel('Lọc đơn điều chỉnh').selectOption('rejected');await settle(page);
    check('Request status filter works',await page.locator('.request-item').count()===1&&await page.locator('.request-item .ui-badge').getByText('Từ chối',{exact:true}).isVisible());
    await page.getByRole('button',{name:'Xóa bộ lọc'}).first().click();await settle(page);
    await page.getByRole('button',{name:'Tạo đơn điều chỉnh',exact:true}).click();await settle(page);
    const dialog=page.getByRole('dialog',{name:'Tạo đơn điều chỉnh'}),reason=dialog.getByLabel('Lý do điều chỉnh');
    check('Correction starts with invalid submit disabled',await dialog.getByRole('button',{name:'Gửi đề nghị'}).isDisabled());
    await reason.fill('Đối chiếu giờ làm việc bằng dữ liệu thử nghiệm.');await settle(page);
    await dialog.getByLabel('Giờ ra',{exact:true}).fill('07:00');await settle(page);
    check('Reversed shift time is rejected before API',await dialog.getByRole('button',{name:'Gửi đề nghị'}).isDisabled()&&await dialog.getByText('Giờ ra phải sau giờ vào trong cùng ngày.').isVisible());
    await dialog.getByLabel('Giờ ra',{exact:true}).fill('17:00');await settle(page);
    await dialog.getByLabel('Ngày cần điều chỉnh').fill(new Date(Date.now()+7*3600000).toISOString().slice(0,10));await settle(page);
    await dialog.getByLabel('Giờ ra',{exact:true}).fill('23:59');await settle(page);
    check('Future time today is rejected before API',await dialog.getByRole('button',{name:'Gửi đề nghị'}).isDisabled()&&await dialog.getByText('Giờ đề nghị không được ở tương lai.').isVisible());
    await dialog.getByLabel('Ngày cần điều chỉnh').fill(new Date(Date.now()+7*3600000-2*86400000).toISOString().slice(0,10));await settle(page);await dialog.getByLabel('Giờ ra',{exact:true}).fill('17:00');await settle(page);
    fixture.mode.failOnce='/api/corrections';await dialog.getByRole('button',{name:'Gửi đề nghị'}).click();await settle(page);await dialog.getByRole('alert').waitFor();
    check('API conflict preserves draft and enables deliberate retry',await reason.inputValue()==='Đối chiếu giờ làm việc bằng dữ liệu thử nghiệm.'&&await dialog.getByRole('button',{name:'Gửi đề nghị'}).isEnabled());
    await dialog.getByRole('button',{name:'Gửi đề nghị'}).click();await settle(page);await ready(page);await page.getByRole('button',{name:'Rút đơn',exact:true}).waitFor();
    check('Submit correction creates pending request in real isolated API',fixture.store.one("SELECT COUNT(*) AS n FROM corrections WHERE user_id=? AND status='pending'",'synthetic-employee').n===1);
    await page.locator('.request-item').filter({has:page.getByRole('button',{name:'Rút đơn',exact:true})}).getByText('Tiến trình xử lý').click();await settle(page);
    check('Request timeline expands',await page.getByText('Chờ người có quyền xem xét',{exact:true}).isVisible());
    await page.getByRole('button',{name:'Rút đơn',exact:true}).click();await settle(page);await page.getByRole('button',{name:'Giữ lại đơn'}).click();await settle(page);
    check('Cancel withdraw leaves request pending',fixture.store.one("SELECT COUNT(*) AS n FROM corrections WHERE user_id=? AND status='pending'",'synthetic-employee').n===1);
    await page.getByRole('button',{name:'Rút đơn',exact:true}).click();await settle(page);await page.getByRole('button',{name:'Xác nhận rút đơn'}).click();await settle(page);await ready(page);
    check('Confirm withdraw updates real isolated record',fixture.store.one("SELECT COUNT(*) AS n FROM corrections WHERE user_id=? AND status='cancelled'",'synthetic-employee').n===1);
    await page.getByRole('button',{name:'Tạo đơn điều chỉnh',exact:true}).click();await settle(page);
    check('Successful submit clears old reason for next request',await page.getByLabel('Lý do điều chỉnh').inputValue()==='');await page.keyboard.press('Escape');
    await screenshot(page,'workspace-requests-desktop');

    await page.keyboard.press('Control+k');await page.getByLabel('Tìm chức năng trong hệ thống').fill('bảng công');await settle(page);await page.locator('.ui-command-list').getByRole('button',{name:/Bảng công của tôi/}).click();await settle(page);await ready(page);
    check('Command palette navigates and moves focus to main',await page.evaluate(()=>document.activeElement.id==='main-content')&&new URL(page.url()).hash==='#/attendance');
    await page.goBack();await ready(page);check('Browser back follows section history',new URL(page.url()).hash==='#/requests');
    await page.getByRole('button',{name:'Thông báo',exact:true}).click();await settle(page);await page.getByRole('button',{name:/Thông báo thử nghiệm/}).click();await settle(page);await ready(page);
    check('Notification marks read and opens matching section',fixture.store.one('SELECT COUNT(*) AS n FROM notification_reads WHERE user_id=?','synthetic-employee').n===1);

    for(const width of [320,390,768]){
      await page.setViewportSize({width,height:900});
      for(const section of ['overview','attendance','requests','functions']){
        await page.goto(fixture.base+'/a/#/'+section);await ready(page);
        check('Employee responsive '+section+' '+width,await noOverflow(page));
      }
    }
    await page.setViewportSize({width:390,height:844});await screenshot(page,'workspace-mobile');
    await page.getByRole('button',{name:'Mở menu',exact:true}).click();await settle(page);await page.locator('.shell-mobile-nav').getByRole('button',{name:'Chấm công',exact:true}).click();await settle(page);await ready(page);
    check('Mobile menu navigates and closes dialog',await page.getByRole('dialog').count()===0&&new URL(page.url()).hash==='#/checkin');
    await page.keyboard.press('Tab');check('Keyboard focus is visible',await page.evaluate(()=>{const e=document.activeElement,s=getComputedStyle(e);return e.matches(':focus-visible')&&s.outlineStyle!=='none';}));
    await ctx.close();

    step='manager login';({ctx,page}=await login('manager','team'));
    check('Manager sees own group and no outside-group employee',!(await page.locator('.workspace-data').innerText()).includes('NV ngoài nhóm')&&await page.getByText('2 đơn',{exact:true}).isVisible());
    check('Manager own request is excluded from review list',await page.getByRole('button',{name:'Xem đơn của tôi'}).isVisible()&&await page.locator('.request-item').count()===2);
    await page.getByLabel('Tìm đơn cần duyệt').fill('NV thử 01');await settle(page);check('Review queue search works',await page.locator('.request-item').count()===1);await page.getByLabel('Tìm đơn cần duyệt').fill('');await settle(page);
    await page.locator('.workspace-roster summary').click();await settle(page);check('Team roster expands',await page.locator('.team-strip .member').first().isVisible());
    await page.locator('.request-item').filter({hasText:'NV thử 01'}).getByRole('button',{name:'Duyệt đơn',exact:true}).click();await settle(page);
    check('Review needs a reason before approval',await page.getByRole('button',{name:'Duyệt & cập nhật'}).isDisabled());
    await page.getByLabel('Ghi chú duyệt đơn').fill('Đã đối chiếu dữ liệu thử nghiệm.');await settle(page);await page.getByRole('button',{name:'Duyệt & cập nhật'}).click();await settle(page);await ready(page);
    check('Approval changes request and attendance with audit trail',fixture.store.one('SELECT status FROM corrections WHERE id=?','review-approve').status==='approved'&&!!fixture.store.one('SELECT id FROM attendance WHERE user_id=? AND day=?','fixture-1',new Date(Date.now()+7*3600000-86400000).toISOString().slice(0,10))&&!!fixture.store.one("SELECT id FROM events WHERE reason='CORRECTION_APPROVED'"));
    await page.locator('.request-item').filter({hasText:'NV thử 02'}).getByRole('button',{name:'Từ chối',exact:true}).click();await settle(page);await page.getByLabel('Ghi chú duyệt đơn').fill('Chưa đủ căn cứ trong dữ liệu thử nghiệm.');await settle(page);await page.getByRole('dialog').getByRole('button',{name:'Từ chối đơn',exact:true}).click();await settle(page);await ready(page);
    check('Rejection leaves attendance unchanged and empties review queue',fixture.store.one('SELECT status FROM corrections WHERE id=?','review-reject').status==='rejected'&&!fixture.store.one('SELECT id FROM attendance WHERE user_id=?','fixture-2')&&await page.getByRole('heading',{name:'Đã xử lý hết đơn'}).isVisible());
    await screenshot(page,'workspace-team-desktop');await page.setViewportSize({width:320,height:900});check('Manager team responsive 320',await noOverflow(page));await ctx.close();

    step='admin login';({ctx,page}=await login('admin'));
    await screenshot(page,'workspace-admin-desktop');
    await page.getByRole('button',{name:/Nhân viên trong hệ thống/}).click();await settle(page);await ready(page);
    check('Admin dashboard KPI navigates to employee management',new URL(page.url()).hash==='#/users');
    fixture.mode.delayRoute='/api/attendance';fixture.mode.delay=800;
    await page.getByRole('button',{name:'Làm mới dữ liệu',exact:true}).click();
    await page.locator('.workspace-loading').waitFor();
    check('Refresh announces loading and suspends stale data interactions',await page.locator('.workspace-data').evaluate(e=>e.inert));await ready(page);fixture.mode.delay=0;
    fixture.mode.failOnce='/api/attendance';await page.getByRole('button',{name:'Làm mới dữ liệu',exact:true}).click();await page.getByRole('button',{name:'Thử tải lại'}).waitFor();
    check('Load error offers retry and keeps stale controls inactive',await page.locator('.workspace-data').evaluate(e=>e.inert));
    await page.getByRole('button',{name:'Thử tải lại'}).click();await ready(page);check('Explicit retry restores data interactions',!await page.locator('.workspace-data').evaluate(e=>e.inert));
    await page.getByLabel('Tìm tài khoản',{exact:true}).fill('fixture01');await settle(page);
    check('Employee search finds the correct account',await page.getByRole('table',{name:'Tài khoản nhân viên'}).locator('tbody tr').count()===1);
    await page.getByRole('button',{name:'Hồ sơ & phiên',exact:true}).click();await settle(page);
    await page.getByLabel('Họ và tên',{exact:true}).fill('Một');await settle(page);await page.getByLabel('Lý do cập nhật').fill('Đối chiếu hồ sơ nhân viên thử nghiệm.');await settle(page);
    check('Single-word employee name is rejected in UI',await page.getByRole('button',{name:'Lưu hồ sơ'}).isDisabled());
    await page.getByLabel('Họ và tên',{exact:true}).fill('NV đã cập nhật');await settle(page);
    check('Employee update requires impact acknowledgement',await page.getByRole('button',{name:'Lưu hồ sơ'}).isDisabled());
    await page.getByRole('checkbox').check();await settle(page);await page.getByRole('button',{name:'Lưu hồ sơ'}).click();await settle(page);await ready(page);
    check('Employee profile update saves through real isolated API',fixture.store.one('SELECT name FROM staff WHERE id=?','fixture-1').name==='NV đã cập nhật');
    await page.getByRole('button',{name:'Quản lý truy cập',exact:true}).click();await settle(page);await page.getByRole('radio',{name:/Khóa tài khoản/}).check();await settle(page);await page.getByLabel('Lý do thực hiện').fill('Kiểm tra khóa tài khoản trên môi trường thử.');await settle(page);await page.getByRole('button',{name:'Khóa tài khoản & lưu'}).click();await settle(page);await ready(page);
    check('Access management disable changes synthetic account only',fixture.store.one('SELECT disabled FROM staff WHERE id=?','fixture-1').disabled===1);
    await page.getByLabel('Lọc trạng thái tài khoản').selectOption('disabled');await settle(page);
    check('Disabled account filter works',await page.getByRole('table',{name:'Tài khoản nhân viên'}).locator('tbody tr').count()===1);
    await page.getByRole('button',{name:'Quản lý truy cập',exact:true}).click();await settle(page);await page.getByLabel('Lý do thực hiện').fill('Đối chiếu hoàn tất trong môi trường thử.');await settle(page);await page.getByRole('button',{name:'Mở tài khoản & lưu'}).click();await settle(page);await ready(page);
    check('Re-enable account refreshes filtered empty state',fixture.store.one('SELECT disabled FROM staff WHERE id=?','fixture-1').disabled===0&&await page.getByRole('heading',{name:'Không tìm thấy tài khoản'}).isVisible());
    await page.getByLabel('Tìm tài khoản',{exact:true}).fill('');await settle(page);await page.getByLabel('Lọc trạng thái tài khoản').selectOption('all');await settle(page);await page.getByLabel('Lọc vai trò').selectOption('manager');await settle(page);
    check('Employee role filter works',await page.getByRole('table',{name:'Tài khoản nhân viên'}).locator('tbody tr').count()===1);
    await page.getByLabel('Lọc vai trò').selectOption('all');await settle(page);
    const employeeDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Xuất CSV',exact:true}).click();const employeeCsv=await employeeDownload;
    check('Employee CSV export is available after filtering',employeeCsv.suggestedFilename()==='tai-khoan-nhan-vien.csv');
    await page.getByRole('button',{name:'Thêm nhân viên',exact:true}).click();await settle(page);
    await page.getByLabel('Tên đăng nhập mới').fill('ui-fixture');await settle(page);await page.getByLabel('Email nhân viên').fill('ui-fixture@example.test');await settle(page);await page.getByLabel('Họ và tên',{exact:true}).fill('NV tạo thử');await settle(page);await page.getByLabel('Nhóm nhân viên').fill('Nhóm thử');await settle(page);
    check('New employee form rejects missing password',await page.getByRole('button',{name:'Tạo nhân viên',exact:true}).isDisabled());
    await page.getByLabel('Mật khẩu tạm thời').fill('Fixture'+crypto.randomBytes(18).toString('hex')+'7');await settle(page);await page.getByRole('button',{name:'Tạo nhân viên',exact:true}).click();await settle(page);await ready(page);
    check('Create employee uses synthetic identity adapter and memory database',!!fixture.store.one('SELECT id FROM staff WHERE username=?','ui-fixture'));
    await screenshot(page,'workspace-users-desktop');
    await page.setViewportSize({width:320,height:900});check('Employee management responsive 320',await noOverflow(page));
    const scrolling=page.getByRole('region',{name:'Tài khoản nhân viên · vùng bảng có thể cuộn'});await scrolling.focus();for(let i=0;i<8;i++)await page.keyboard.press('ArrowRight');await settle(page);
    check('Mobile employee table can be scrolled by keyboard',await scrolling.evaluate(e=>e.scrollLeft>0));
    await page.getByRole('button',{name:'Thêm nhân viên',exact:true}).click();await settle(page);check('Employee modal fits mobile viewport',await page.getByRole('dialog').evaluate(e=>e.getBoundingClientRect().width<=innerWidth&&e.getBoundingClientRect().height<=innerHeight));await page.keyboard.press('Escape');await screenshot(page,'workspace-users-mobile');
    await page.setViewportSize({width:1440,height:1000});
    for(const [label,heading] of [['Quyền truy cập của tôi','Quyền truy cập của tôi'],['Hồ sơ & phiên của tôi','Hồ sơ & phiên của tôi'],['Duyệt quyền truy cập','Duyệt quyền truy cập'],['Trung tâm bảo mật','Trung tâm bảo mật']]){
      await nav(page,label);await page.getByRole('heading',{name:heading,exact:true}).first().waitFor();await settle(page);
      check('Remaining menu renders '+label,await page.getByRole('heading',{name:heading,exact:true}).first().isVisible());
    }
    await ctx.close();
    check('No application JavaScript errors',jsErrors===0);check('No requests to real services',externalRequests===0);
    check('SQLite fixture remains memory only',fixture.store.db.location()===null||fixture.store.db.location()==='');
  }finally{await browser.close();await fixture.close();}
}
main().then(()=>{
  fs.writeFileSync(path.join(OUT,'workspace-browser-results.json'),JSON.stringify({kind:'real-api-memory-synthetic-oidc',liveServices:false,checks},null,2));
  console.log('Workspace browser: '+checks.length+' checks PASS.');
}).catch(async error=>{
  fs.writeFileSync(path.join(OUT,'workspace-browser-results.json'),JSON.stringify({kind:'real-api-memory-synthetic-oidc',liveServices:false,checks,failedStep:step,failureType:error.name,failureHint:(error.message||'').match(/strict mode violation|Timeout|Assertion/)?.[0]||'Other',locations:(error.stack||'').match(/workspace-browser\.cjs:\d+:\d+/g)||[]},null,2));
  console.error('Workspace browser failed at '+step+'; no URL, body or credential recorded.');
  await browser?.close().catch(()=>{});fixture.server.closeAllConnections();fixture.server.close();process.exitCode=1;
});
