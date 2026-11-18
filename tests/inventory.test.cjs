// Validate coverage and traceability; no browser, authentication or network.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {parse} = require('../web-a/node_modules/@babel/parser');
const inventory = require(process.env.IAM_INVENTORY_PHASE==='5b'?'../docs/interaction-inventory-phase5b.json':process.env.IAM_INVENTORY_PHASE==='5a'?'../docs/interaction-inventory-phase5a.json':process.env.IAM_INVENTORY_PHASE==='3'?'../docs/interaction-inventory-phase3.json':'../docs/interaction-inventory-phase2.json');
const root = path.resolve(__dirname, '..');

test('inventory covers every JSX source file with native or shared interaction sites', () => {
  const declared = new Set(Object.keys(inventory.sourceHashes));
  const tags = new Set(['button','a','form','input','select','textarea','summary','dialog',
    'Search','ExportButton','DataTable','StatCard','FeatureGrid','Dialog','Modal','Note']);
  let nativeAndWidgetSites = 0;
  function visit(node, file) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {node.forEach(n=>visit(n,file));return;}
    if (node.type === 'JSXElement' && tags.has(node.openingElement.name.name)) {
      assert.ok(declared.has(file), 'Uninventoried source: ' + file);
      const matches = inventory.controls.filter(c=>c.source===file && c.line===node.loc.start.line
        && c.column===node.loc.start.column+1 && c.tag===node.openingElement.name.name);
      assert.equal(matches.length,1,'Missing or duplicated JSX position: '+file+':'+node.loc.start.line);
      nativeAndWidgetSites++;
    }
    for (const [key,value] of Object.entries(node)) {
      if (!['loc','start','end','extra','comments','tokens'].includes(key)) visit(value,file);
    }
  }
  for (const folder of ['web-a/src','web-b/src','shared']) {
    for (const entry of fs.readdirSync(path.join(root,folder))) {
      if (!entry.endsWith('.jsx')) continue;
      const file = folder+'/'+entry;
      visit(parse(fs.readFileSync(path.join(root,file),'utf8'),{sourceType:'module',plugins:['jsx']}),file);
    }
  }
  assert.equal(nativeAndWidgetSites, inventory.controls.filter(c=>!['field()','input()'].includes(c.tag)).length);
});

test('every interaction has access policy, API context, source, group and honest status', () => {
  const groups = new Set(inventory.groups.map(g=>g.id));
  assert.equal(new Set(inventory.controls.map(c=>c.id)).size,inventory.controls.length);
  for (const control of inventory.controls) {
    assert.ok(groups.has(control.group));
    assert.ok(control.access.length > 0);
    assert.ok(control.apiContext.length > 0);
    assert.ok(control.label.length > 0);
    assert.equal(control.staticReview,'REVIEWED');
    assert.equal(control.liveRetestPhase1,'NOT_RUN');
    assert.ok(fs.existsSync(path.join(root,control.source)));
    for (const reference of control.testReferences) assert.ok(fs.existsSync(path.join(root,reference)));
  }
});

test('page roles and interaction references preserve application boundary', () => {
  assert.equal(inventory.pages.filter(p=>p.app==='A').length,11);
  assert.equal(inventory.pages.filter(p=>p.app==='B').length,18);
  const ids = new Set(inventory.controls.map(c=>c.id));
  for (const page of inventory.pages) {
    assert.ok(page.apis.length && page.controlIds.length);
    for (const id of page.controlIds) assert.ok(ids.has(id));
    if (page.app === 'B') assert.ok(page.roles.every(r=>['admin','auditor'].includes(r)));
  }
  for (const id of ['B:accounts','B:access-approvals']) {
    assert.deepEqual(inventory.pages.find(p=>p.id===id).roles,['admin']);
  }
});

test('inventory explicitly records auditor write exceptions and destructive retention', () => {
  assert.match(inventory.groups.find(g=>g.id==='label').access,/auditor/);
  assert.match(inventory.groups.find(g=>g.id==='review').access,/auditor/);
  assert.match(inventory.groups.find(g=>g.id==='audit-settings').behavior,/KHÔNG chạy/);
  assert.ok(!inventory.controls.some(c=>Object.hasOwn(c,'inputValue')));
});
