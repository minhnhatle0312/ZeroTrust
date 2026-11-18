// Actual Web B build + Express/SQLite :memory:; synthetic OIDC and central Audit DTOs.
// All networking stays on an allocated loopback server; no HAR/storage/token logs.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('../.tools/playwright/driver/package');
const fixture=require('./fixtures/workspace-server.cjs');
const {pgId,legacyId}=require('./fixtures/security-data.cjs');
const OUT=path.resolve(__dirname,process.env.IAM_BROWSER_PHASE==='6'?'../.runtime/phase6-tests':process.env.IAM_BROWSER_PHASE==='5b'?'../.runtime/phase5b-tests':'../.runtime/phase5a-tests'),checks=[];
let browser,step='start',jsErrors=0,externalRequests=0;
function check(name,condition){step=name;checks.push({name,passed:!!condition});console.log((condition?'PASS ':'FAIL ')+name);if(!condition)throw Error('Assertion');}
async function settle(page){await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
async function loaded(page){await settle(page);await page.locator('.incident-list[aria-busy="false"]').waitFor();await settle(page);}
async function detailed(page){await page.locator('.incident-detail[aria-busy="false"] .incident-hero').waitFor();await settle(page);}
async function nav(page,label){step='navigate '+label;await page.locator('.shell-sidebar nav').getByRole('button',{name:label,exact:true}).click();await settle(page);}
async function login(role,section='overview'){
  fixture.mode.role=role;
  const ctx=await browser.newContext({viewport:{width:1440,height:1000},locale:'vi-VN',reducedMotion:'reduce'});
  await ctx.route('**/*',r=>{if(new URL(r.request().url()).origin===fixture.base)r.continue();else{externalRequests++;r.abort();}});
  ctx.on('page',p=>p.on('pageerror',()=>jsErrors++));
  const page=await ctx.newPage();await page.goto(fixture.base+'/b/#/'+section);await page.getByRole('button',{name:'Đăng nhập qua Keycloak'}).click();await page.getByRole('heading',{level:1,name:section==='overview'?'Trung tâm an ninh':'Điều tra cảnh báo'}).waitFor();await page.getByLabel('Tự cập nhật 20 giây').uncheck();return {ctx,page};
}
async function shot(page,name){await page.evaluate(()=>scrollTo(0,0));await settle(page);await page.screenshot({path:path.join(OUT,name+'.png'),fullPage:false});}
async function main(){
  if(!['5a','5b','6'].includes(process.env.IAM_BROWSER_PHASE))throw Error('Use the isolated phase5a runner');
  fs.mkdirSync(OUT,{recursive:true});fixture.mode.securityFixture=true;await fixture.start();
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-background-networking','--disable-sync','--no-first-run']});
  try{
    let {ctx,page}=await login('admin');await loaded(page);
    check('Admin dashboard retains all 18 navigation entries',await page.locator('.shell-sidebar nav button').count()===18);
    check('Dashboard exposes source-separated incident lists',await page.getByRole('group',{name:'Kho sự cố'}).isVisible());
    await shot(page,'security-overview-desktop');
    const primary=fixture.store.one("SELECT id FROM alerts WHERE kind='Fixture incident 00'").id;
    step='dashboard detail';await page.locator('.incident-list').getByRole('button',{name:/^Xem sự cố /}).first().click();await detailed(page);
    check('Dashboard opens actual SQLite Phase 4 detail',await page.locator('.incident-hero').innerText().then(s=>s.includes('sqlite:')));
    await page.evaluate(id=>location.hash='/incident/sqlite/'+id,primary);await detailed(page);
    check('Six detail sections have keyboard-focusable headings',await page.locator('.incident-card h2[tabindex="-1"]').count()===6);
    check('Local hypothesis stays distinct from conclusions',await page.getByText('Giả thuyết · chưa xác minh',{exact:true}).isVisible());
    check('Generated proposals are visibly unexecuted',await page.getByText('Đề xuất hệ thống · chưa thực hiện',{exact:true}).isVisible());
    check('No remediation or closing form in incident view',await page.locator('.incident-detail form').count()===0);
    const proof=page.getByRole('table',{name:'Bằng chứng',exact:true}).getByRole('button').first();await proof.click();
    check('Exact local evidence opens readable source facts',await page.getByRole('dialog',{name:'Bằng chứng sự cố'}).getByText('FIXTURE_DENIAL',{exact:true}).isVisible());
    await page.keyboard.press('Escape');await settle(page);check('Evidence dialog restores focus to invoking control',await proof.evaluate(el=>el===document.activeElement));
    await page.getByRole('navigation',{name:'Các phần hồ sơ'}).getByRole('button',{name:'Diễn biến',exact:true}).click();
    check('Section shortcuts move keyboard focus',await page.locator('#incident-timeline').evaluate(el=>el===document.activeElement));
    check('Initial history page is limited to 25 entries',await page.locator('.incident-history').count()===25);
    await page.getByRole('button',{name:'Tải lịch sử trước đó',exact:true}).click();await page.locator('.incident-history').nth(30).waitFor();
    check('SQLite history pagination merges 31 entries without duplicate timeline',await page.locator('.incident-history').count()===31&&await page.locator('.incident-timeline li').count()===33);
    await page.locator('.incident-history summary').first().click();
    check('History expands the recorded before/after snapshot',await page.locator('.incident-history[open] pre').isVisible());
    await shot(page,'security-incident-desktop');
    await page.reload();await detailed(page);check('Incident deep link survives reload',page.url().endsWith('/incident/sqlite/'+primary));
    await page.getByRole('button',{name:'← Danh sách sự cố',exact:true}).click();await loaded(page);
    let table=page.getByRole('table',{name:'Sự cố bảo mật',exact:true});
    check('Default local list shows ten real API records',await table.locator('tbody tr').count()===10);
    await page.getByRole('button',{name:'Sự cố sau',exact:true}).click();await loaded(page);
    check('Local server pagination advances',await page.getByText('Trang 2 / 4',{exact:true}).isVisible());
    await page.getByLabel('Số sự cố mỗi trang').selectOption('20');await loaded(page);
    check('Page size resets to first page',await table.locator('tbody tr').count()===20&&await page.getByText('Trang 1 / 2',{exact:true}).isVisible());
    await page.getByLabel('Tìm sự cố trên máy chủ').fill('Fixture incident 00');await loaded(page);
    check('Local server search returns exact matching incident',await table.locator('tbody tr').count()===1&&(await table.innerText()).includes(primary));
    const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Xuất CSV',exact:true}).click();const download=await downloading,stream=await download.createReadStream();let csv='';for await(const b of stream)csv+=b.toString('utf8');
    check('Incident CSV contains only displayed filtered source records',csv.includes(primary)&&csv.trim().split(/\r?\n/).length===2&&download.suggestedFilename()==='su-co-sqlite-trang-1.csv');
    await page.getByLabel('Tìm sự cố trên máy chủ').fill('no-such-fixture');await loaded(page);
    check('Empty filtered state disables CSV',await page.getByRole('heading',{name:'Không tìm thấy sự cố phù hợp'}).isVisible()&&await page.getByRole('button',{name:'Xuất CSV',exact:true}).isDisabled());
    await page.getByRole('button',{name:'Xóa bộ lọc sự cố',exact:true}).click();await loaded(page);
    await page.getByLabel('Trạng thái',{exact:true}).selectOption('reviewing');await loaded(page);check('Local state filter reads server state rather than history notes',await table.count()===0);
    await page.getByRole('button',{name:'Xóa bộ lọc sự cố',exact:true}).click();await loaded(page);
    await page.getByLabel('Mức độ',{exact:true}).selectOption('high');await loaded(page);check('Local severity filter reaches actual API',await table.locator('tbody tr').count()===16&&(await table.innerText()).includes('Cao'));
    await page.getByLabel('Nguồn sự kiện',{exact:true}).selectOption('keycloak');await loaded(page);check('Exact source filter does not match unrelated application',await table.count()===0);
    await page.getByRole('button',{name:'Xóa bộ lọc sự cố',exact:true}).click();await loaded(page);
    await page.getByLabel('Mốc thời gian').selectOption('occurred');await page.getByLabel('Từ ngày',{exact:true}).fill('2026-10-01');await page.getByLabel('Đến ngày',{exact:true}).fill('2026-10-01');await loaded(page);check('UTC+7 occurrence date filter includes seeded source events',await table.locator('tbody tr').count()===20);
    await page.getByLabel('Từ ngày',{exact:true}).fill('2026-10-02');await loaded(page);check('Reversed date interval shows validation and hides records',await page.getByText('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.').isVisible()&&await table.count()===0);
    await page.getByRole('button',{name:'Xóa bộ lọc sự cố',exact:true}).click();await loaded(page);
    step='local detail 404';await page.evaluate(()=>location.hash='/incident/sqlite/nonexistent-fixture');await page.getByText('Không tìm thấy sự cố hoặc bằng chứng.',{exact:true}).waitFor();check('Missing incident has explicit 404 state',await page.getByText('Không tìm thấy sự cố hoặc bằng chứng.',{exact:true}).isVisible());
    await page.getByRole('button',{name:'← Danh sách sự cố',exact:true}).click();await loaded(page);
    await page.getByRole('group',{name:'Kho sự cố'}).getByRole('button',{name:'Audit & Detection · PostgreSQL',exact:true}).click();await loaded(page);
    check('Central list uses existing PostgreSQL gateway',await table.locator('tbody tr').count()===10&&(await table.innerText()).includes(pgId));
    await page.getByRole('button',{name:'Sự cố sau',exact:true}).click();await loaded(page);check('Central list uses offset pagination',await page.getByText('Trang 2 / 4',{exact:true}).isVisible());
    await page.getByLabel('Số sự cố mỗi trang').selectOption('20');await loaded(page);check('Central page size resets offset',await table.locator('tbody tr').count()===20&&await page.getByText('Trang 1 / 2',{exact:true}).isVisible());
    await page.getByLabel('Trạng thái',{exact:true}).selectOption('resolved');await loaded(page);check('Central state filter retains legacy warning',await table.locator('tbody tr').count()===1&&await table.getByText('Xem bằng chứng xác minh trong chi tiết').isVisible());
    await page.getByRole('button',{name:'Xóa bộ lọc sự cố',exact:true}).click();await loaded(page);
    await page.getByLabel('Tìm nội dung trong trang').fill('not-present');await settle(page);check('Central page-local search declares its scope',await page.getByText(/0 khớp trong trang này/).isVisible()&&await table.count()===0);
    await page.getByLabel('Tìm nội dung trong trang').fill('');await page.getByLabel('Bộ phát hiện').selectOption('detection');await loaded(page);check('Detection filter is sent through Phase 4 gateway',await table.locator('tbody tr').count()===1&&(await table.innerText()).includes(pgId));
    await page.getByRole('button',{name:'Xem sự cố '+pgId,exact:true}).click();await detailed(page);
    check('Central detail renders origin and actual recorded context',await page.locator('.incident-hero').innerText().then(s=>s.includes('audit:'+pgId))&&await page.getByText('192.0.2.10',{exact:true}).isVisible());
    check('Recorded action and verification method are distinguished',await page.getByText('REMEDIATION_TEST',{exact:true}).isVisible()&&await page.getByText('Synthetic independent access probe',{exact:true}).isVisible()&&await page.getByText('Chưa đủ kết luận',{exact:true}).isVisible());
    fixture.mode.bumpVersion=true;await page.getByRole('button',{name:'Tải lịch sử trước đó',exact:true}).click();await page.getByText('Sự cố đã thay đổi. Đã tải lại để tránh ghép lịch sử khác phiên bản.').waitFor();await detailed(page);
    check('Concurrent incident change reloads instead of mixing history versions',await page.locator('.incident-history').count()===25);fixture.mode.bumpVersion=false;
    await page.getByRole('button',{name:'Tải lại chi tiết',exact:true}).click();await detailed(page);await page.getByRole('button',{name:'Tải lịch sử trước đó',exact:true}).click();await page.locator('.incident-history').nth(30).waitFor();
    check('Central cursor history includes all 31 records',await page.locator('.incident-history').count()===31);
    await page.getByRole('button',{name:'← Danh sách sự cố',exact:true}).click();await loaded(page);check('Detail back button returns to the matching central source list',await page.getByRole('button',{name:'Audit & Detection · PostgreSQL',exact:true}).getAttribute('aria-pressed')==='true');
    await page.evaluate(id=>location.hash='/incident/audit/'+id,legacyId);await detailed(page);
    check('Legacy resolved state does not claim verified remediation',await page.getByText('Chưa xác minh khắc phục',{exact:true}).first().isVisible()&&await page.getByText('Trạng thái từ dữ liệu cũ; không được coi là kết quả khắc phục đã xác minh.').isVisible());
    check('Missing source times and evidence are explicit',await page.getByRole('heading',{name:'Chưa có bằng chứng nguồn chính xác'}).isVisible()&&await page.getByText('Không khả dụng: audit:fixture-missing').isVisible()&&await page.getByText('Chưa có nhận định nguyên nhân',{exact:true}).isVisible());
    await nav(page,'Audit PostgreSQL');await page.getByRole('button',{name:'Điều tra sự kiện',exact:true}).click();await page.getByRole('button',{name:'Chi tiết',exact:true}).first().waitFor();
    check('Audit events paginate 25 of 31',await page.locator('.audit-table tbody tr').count()===25);await page.getByRole('button',{name:'Sau',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.audit-table tbody tr').length===6);await settle(page);check('Audit pagination requests second page',await page.locator('.audit-table tbody tr').count()===6);
    await page.getByLabel('Tìm sự kiện',{exact:true}).fill('fixture-event');await page.getByRole('button',{name:'Áp dụng bộ lọc',exact:true}).click();await page.getByText('31 kết quả · Trang 1',{exact:true}).waitFor();check('Audit search applies and resets page',await page.getByText('31 kết quả · Trang 1',{exact:true}).isVisible());
    await page.getByRole('button',{name:'Chuẩn bị CSV theo bộ lọc',exact:true}).click();await page.getByText('Đã chuẩn bị 31 bản ghi để xuất.').waitFor();check('Existing Audit CSV preparation retained',await page.getByRole('button',{name:'Xuất CSV',exact:true}).isEnabled());
    await page.getByRole('button',{name:'Chi tiết',exact:true}).first().click();await page.getByRole('dialog',{name:'Điều tra sự kiện'}).waitFor();await page.getByRole('button',{name:'Tìm sự cố gắn sự kiện gốc',exact:true}).click();await page.getByRole('button',{name:'PYTHON_BASELINE · Xem sự cố '+pgId,exact:true}).waitFor();
    check('Audit links only explicit matching event_id',await page.getByRole('button',{name:'PYTHON_BASELINE · Xem sự cố '+pgId,exact:true}).isVisible());await page.getByRole('button',{name:'PYTHON_BASELINE · Xem sự cố '+pgId,exact:true}).click();await detailed(page);
    check('Audit event opens incident without leaving an orphan modal',await page.getByRole('dialog').count()===0);
    await nav(page,'Audit PostgreSQL');await page.getByRole('button',{name:'Cảnh báo tập trung',exact:true}).click();await loaded(page);check('Old central closing dialog replaced by read-only list',await page.getByRole('button',{name:'Lưu kết luận',exact:true}).count()===0&&await table.isVisible());
    await nav(page,'Python Detection');await page.getByRole('heading',{name:'Kết quả và đặc trưng',exact:true}).waitFor();await page.getByLabel('Phân loại',{exact:true}).selectOption('Anomaly');await page.getByRole('button',{name:'Log gốc',exact:true}).waitFor();check('Detection prediction filter retains original result tools',await page.getByRole('button',{name:'Log gốc',exact:true}).count()===1&&await page.getByRole('button',{name:'Đặc trưng / gán nhãn',exact:true}).isVisible());
    await page.getByRole('button',{name:'Đặc trưng / gán nhãn',exact:true}).click();await page.getByRole('dialog',{name:'Đặc trưng & nhãn đánh giá'}).waitFor();check('Existing label dialog still opens without submitting changes',await page.getByRole('dialog',{name:'Đặc trưng & nhãn đánh giá'}).locator('pre').innerText().then(s=>s.includes('deny_count')));await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Log gốc',exact:true}).click();await page.getByRole('dialog',{name:'Điều tra sự kiện'}).waitFor();await page.getByRole('dialog',{name:'Điều tra sự kiện'}).getByRole('button',{name:'Tìm sự cố gắn sự kiện gốc',exact:true}).waitFor();check('Detection original-log dialog retains event navigation',await page.getByRole('dialog',{name:'Điều tra sự kiện'}).getByRole('button',{name:'Tìm sự cố gắn sự kiện gốc',exact:true}).isVisible());await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Tìm sự cố gắn sự kiện gốc',exact:true}).click();await page.getByRole('button',{name:'PYTHON_BASELINE · Xem sự cố '+pgId,exact:true}).waitFor();await page.getByRole('button',{name:'PYTHON_BASELINE · Xem sự cố '+pgId,exact:true}).click();await detailed(page);check('Detection opens explicit incident link',await page.locator('.incident-hero').isVisible());
    await nav(page,'Python Detection');await page.getByRole('button',{name:'Đánh giá & chỉ số',exact:true}).click();await page.getByText(/Chưa có kết quả đo/).waitFor();check('No fabricated detection metrics when no independent evaluation exists',await page.getByText(/Chưa có kết quả đo/).isVisible());
    await page.getByRole('button',{name:'Lượt phân tích',exact:true}).click();await page.getByText('Synthetic analysis',{exact:true}).waitFor();check('Detection run history retained',await page.getByText('Synthetic analysis',{exact:true}).isVisible());
    await page.getByRole('button',{name:'Cấu hình luật',exact:true}).click();await page.getByRole('heading',{name:/Luật baseline/}).waitFor();check('Admin existing detection settings remain available',await page.getByRole('button',{name:'Lưu cấu hình',exact:true}).isVisible());
    const menuLabels=await page.locator('.shell-sidebar nav button').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label')));
    for(const label of menuLabels){await nav(page,label);await page.locator('#main-content h1').first().waitFor();check('Admin menu renders '+label,await page.locator('#main-content h1').first().isVisible());}
    await page.keyboard.press('Control+k');await page.getByLabel('Tìm chức năng trong hệ thống').fill('nhật ký');await page.getByRole('dialog').getByRole('button',{name:/Nhật ký truy cập/}).click();await page.getByRole('table',{name:'Nhật ký truy cập',exact:true}).waitFor();check('Keyboard command palette navigates existing access journal',await page.getByRole('heading',{name:'Nhật ký truy cập',exact:true}).first().isVisible());
    await page.getByLabel('Tìm nhật ký',{exact:true}).fill('FIXTURE_DENIAL');await page.getByRole('table',{name:'Nhật ký truy cập',exact:true}).getByText('FIXTURE_DENIAL',{exact:true}).first().waitFor();check('Existing local journal search uses real API',await page.getByRole('table',{name:'Nhật ký truy cập',exact:true}).isVisible());
    await page.getByRole('button',{name:'Chi tiết',exact:true}).first().click();await page.getByRole('dialog',{name:'Chi tiết truy cập'}).waitFor();check('Existing local event detail retained',await page.getByRole('dialog',{name:'Chi tiết truy cập'}).isVisible());await page.keyboard.press('Escape');
    await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Mở menu',exact:true}).click();await page.getByRole('dialog',{name:'Điều hướng',exact:true}).getByRole('button',{name:'Cảnh báo',exact:true}).click();await loaded(page);check('Mobile menu navigates and closes dialog',await page.getByRole('dialog').count()===0);
    check('Mobile list has no document horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await shot(page,'security-list-mobile');
    await page.getByRole('group',{name:'Kho sự cố'}).getByRole('button',{name:'Cảnh báo cục bộ · SQLite',exact:true}).click();await loaded(page);
    await page.getByLabel('Tìm sự cố trên máy chủ').fill('Fixture incident 00');await loaded(page);await page.getByRole('button',{name:'Xem sự cố '+primary,exact:true}).click();await detailed(page);check('Mobile incident has no document horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await shot(page,'security-incident-mobile');
    await page.setViewportSize({width:768,height:1024});check('Tablet incident has no document horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await shot(page,'security-incident-tablet');
    await page.setViewportSize({width:320,height:740});check('Small mobile incident remains contained',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await ctx.close();
    ({ctx,page}=await login('auditor','alerts'));await loaded(page);check('Auditor menu hides account administration and access approvals',await page.locator('.shell-sidebar nav button').count()===16&&await page.locator('.shell-sidebar nav').getByRole('button',{name:'Tài khoản',exact:true}).count()===0);
    await page.getByLabel('Tìm sự cố trên máy chủ').fill('Fixture incident 00');await loaded(page);await page.getByRole('button',{name:'Xem sự cố '+primary,exact:true}).click();await detailed(page);check('Auditor reads actual local evidence and full detail without write controls',await page.getByRole('table',{name:'Bằng chứng',exact:true}).isVisible()&&await page.locator('.incident-detail form').count()===0);
    await page.evaluate(id=>location.hash='/incident/audit/'+id,pgId);await detailed(page);check('Auditor reads central detail through actual backend RBAC',await page.locator('.incident-hero').innerText().then(s=>s.includes(pgId)));
    await nav(page,'Python Detection');await page.getByRole('button',{name:'Cấu hình luật',exact:true}).click();await page.getByRole('heading',{name:/Luật baseline/}).waitFor();check('Auditor cannot change existing Detection configuration',await page.getByRole('button',{name:'Lưu cấu hình',exact:true}).count()===0&&await page.getByLabel('Login failure / 5 phút').isDisabled());
    fixture.mode.centralDown=true;await page.evaluate(id=>location.hash='/incident/audit/'+id,pgId);await page.getByRole('button',{name:'Kiểm tra kết nối lại',exact:true}).waitFor();check('Central outage pauses product via existing AuthGate',!(await page.locator('.incident-hero').isVisible()));fixture.mode.centralDown=false;await page.getByRole('button',{name:'Kiểm tra kết nối lại',exact:true}).click();await page.getByRole('button',{name:'Thử lại',exact:true}).click();await detailed(page);check('Central detail recovers on explicit retry',await page.locator('.incident-hero').isVisible());
    step='loading state';fixture.mode.detailDelay=700;await page.getByRole('button',{name:'Tải lại chi tiết',exact:true}).click();await page.getByText('Đang tải dữ liệu từ máy chủ…',{exact:true}).waitFor();check('Detail loading removes stale actionable content',await page.locator('.incident-hero').count()===0);await detailed(page);fixture.mode.detailDelay=0;
    await page.route('**/fixture-api/api/security/alerts/'+primary+'?*',r=>r.fulfill({status:403,contentType:'application/json',body:JSON.stringify({code:'SYNTHETIC_DENIED',message:'Synthetic denied'})}));await page.evaluate(id=>location.hash='/incident/sqlite/'+id,primary);await page.getByText('Bạn không đủ quyền xem dữ liệu này.',{exact:true}).waitFor();check('Detail permission denial is explicit and reveals no facts',await page.locator('.incident-hero').count()===0);
    await page.unroute('**/fixture-api/api/security/alerts/'+primary+'?*');await page.getByRole('button',{name:'Thử lại',exact:true}).click();await detailed(page);check('Permission error supports deliberate retry',await page.locator('.incident-hero').isVisible());
    await page.route('**/fixture-api/api/security/alerts/'+primary+'?*',r=>r.fulfill({status:401,contentType:'application/json',body:JSON.stringify({code:'INVALID_TOKEN',message:'Synthetic session ended'})}));await page.getByRole('button',{name:'Tải lại chi tiết',exact:true}).click();await page.getByRole('button',{name:'Đăng nhập lại',exact:true}).waitFor();check('Expired session uses existing shared AuthGate',await page.locator('.incident-detail').count()===0);await ctx.close();
    check('Incident UI made zero incident/remediation writes',!fixture.mutations.some(m=>/\/alerts\/|\/incidents\/|\/actions|\/sessions\/revoke/.test(m.route)));
    check('Browser had no application JavaScript errors',jsErrors===0);check('No requests reached real services',externalRequests===0);check('SQLite fixture remained in memory',fixture.store.db.location()===null||fixture.store.db.location()==='');
  }finally{await browser.close();await fixture.close();}
}
main().then(()=>{fs.writeFileSync(path.join(OUT,'security-browser-results.json'),JSON.stringify({kind:'real-express-memory-synthetic-oidc-and-central-audit',liveServices:false,checks},null,2));console.log('Security browser: '+checks.length+' checks PASS.');}).catch(async e=>{
  fs.writeFileSync(path.join(OUT,'security-browser-results.json'),JSON.stringify({kind:'real-express-memory-synthetic-oidc-and-central-audit',liveServices:false,checks,failedStep:step,failureType:e.name,failureHint:(e.message||'').match(/strict mode violation|Timeout|Assertion/)?.[0]||'Other',locations:(e.stack||'').match(/security-browser\.cjs:\d+:\d+/g)||[]},null,2));console.error('Security browser failed at '+step+'; no URL/body/credential recorded.');await browser?.close().catch(()=>{});fixture.server.closeAllConnections();fixture.server.close();process.exitCode=1;
});
