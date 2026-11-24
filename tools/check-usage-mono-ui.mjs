// Monochrome usage chart (Details > Mono) with synthetic fixtures only; no user ledger is read or written.
// Run: PLAYWRIGHT_MODULE=<path to playwright/index.mjs> node tools/check-usage-mono-ui.mjs
import {readFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const repo=join(dirname(fileURLToPath(import.meta.url)),'..');
const [i18n,theme,inline,usage,pricing]=await Promise.all(['compat/i18n.cjs','compat/theme.cjs','compat/inline-widget.cjs','compat/usage-ui.cjs','compat/pricing.cjs'].map(f=>readFile(join(repo,f),'utf8')));
const extract=s=>s.slice(s.indexOf('module.exports = ')+17).trim().replace(/;$/,'');
const row=(total,ratio=[.14,.84,.005])=>{const uncached=Math.round(total*ratio[0]),cacheRead=Math.round(total*ratio[1]),cacheWrite=Math.round(total*ratio[2]);return {uncached,cacheRead,cacheWrite,output:total-uncached-cacheRead-cacheWrite,total,requests:Math.max(1,Math.round(total/60000))};};
const plan={1:{'Gemini 3.8 Flash':29.2e6,'Gemini 4 Argon':5.4e6,'Orchestrator (Argon)':1.0e6},3:{'Gemini 3.8 Flash':39.6e6},7:{'Gemini 3.8 Flash':17.8e6,'Claude Sonnet 4.6':2.3e6},13:{'Gemini 4 Hydrogen':81.8e6,'Gemini 4 Argon':2.1e6},14:{'Gemini 4 Hydrogen':48.6e6,'Gemini 4 Hydrogen (Orchestrator)':10.0e6},21:{'Claude Opus 4.6':7.2e6,'Gemini 4 Hydrogen':5.2e6}};
const mergedModelCount=5;
const days=Object.entries(plan).map(([d,models])=>({date:`2026-11-${String(d).padStart(2,'0')}`,models:Object.fromEntries(Object.entries(models).map(([m,v])=>[m,row(v)]))}));
const total=days.reduce((n,d)=>n+Object.values(d.models).reduce((a,r)=>a+r.total,0),0);
const fixture={accountKey:'fixture',scope:'local',today:'2026-11-22',timeZone:'Asia/Shanghai',models:[...new Set(days.flatMap(d=>Object.keys(d.models)))],days,todayTokens:0,weekTokens:0,monthTokens:total,totalTokens:total,requests:100,firstDate:days[0].date,syncing:false,unknownRequests:0,partialRequests:0,unreadableFiles:0,quotaWindows:{'gemini:weekly':{observedTokens:160e6,estimatedFullTokens:320e6,requests:2600,usedFraction:0.5},'gemini-argon-wtu-weekly:weekly':{observedTokens:8.5e6,estimatedFullTokens:34e6,requests:140,usedFraction:0.25}}};
const html=`<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#17181a;color:#ddd;font:13px 'Segoe UI';padding:50px}.rounded-composer{max-width:900px;margin:300px auto 0;background:#27282a;padding:12px;border-radius:18px}.editor{height:45px}.actions{display:flex;align-items:center;gap:5px}.left{display:flex;flex:1;min-width:0}.right{display:flex;gap:5px}button{background:transparent;border:0;color:inherit;height:28px}</style></head><body><div class="rounded-composer"><div class="editor" contenteditable="true" role="combobox" aria-label="Message input"></div><div class="actions"><div class="left"><button aria-label="Add context">＋</button><button data-testid="model-selector-trigger">Gemini 4 Hydrogen</button></div><div class="right"><button aria-label="Send message">➜</button></div></div></div><script>
history.replaceState({},'', '/c/11111111-1111-1111-1111-111111111111');window.testData=${JSON.stringify(fixture)};window.testPrefs={language:'zh-CN',languageGuideDismissed:true,usageGuideDismissed:true,revision:1};
window.agPulseHost={getMetrics:async()=>({connection:'live',usage:testData,preferences:testPrefs,groups:[],speed:null}),getPreferences:async()=>testPrefs,setPreferences:async x=>testPrefs={...testPrefs,...x,revision:testPrefs.revision+1}};
window.__agPulseI18nFactory=(${extract(i18n)});window.__agPulseThemeFactory=(${extract(theme)});window.__agPulsePricingFactory=(${extract(pricing)});window.__agPulseUsageFactory=(${extract(usage)});(${extract(inline)})();
</script></body></html>`;
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(html);});server.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE?pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const browser=await chromium.launch(process.platform==='win32'&&!process.env.CI?{channel:'msedge',headless:true}:{headless:true});
const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const out=join(repo,'.data/usage');await mkdir(out,{recursive:true});
const openDetails=async()=>{await page.locator('[data-card=cache]').click();await page.locator('#open-usage').click();await page.locator('#details-tab').click();};
const sameInk=()=>page.evaluate(()=>{const vs=document.getElementById('ag-pulse-status-bar').shadowRoot.getElementById('usage-dashboard').firstElementChild.shadowRoot;return getComputedStyle(vs.querySelector('#legend .dot')).backgroundColor===getComputedStyle(vs.querySelector('.iceberg .u-fresh')).fill;});
try{
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await openDetails();
  // Details always renders the monochrome instrument; stacked chart & toggle are gone.
  assert.equal(await page.locator('[data-chart-style]').count(),0,'No stacked/mono toggle remains');
  assert.equal(await page.locator('.bar-segment').count(),0,'No stacked bar segments remain');
  assert.equal(await page.locator('svg.iceberg').isVisible(),true);
  assert.equal(await page.locator('.iceberg [data-hit=bucket]').count(),30,'One iceberg column per November day');
  assert.equal(await page.locator('.punch .u-label.row').count(),mergedModelCount,'One punch-card row per merged model (Orchestrator rows merged)');
  assert.equal(await page.locator('.iceberg .u-fresh').count(),days.length);
  assert.equal(await page.locator('.iceberg .u-cache-box').count(),days.length);
  assert.equal(await page.locator('.iceberg .u-rest').count(),22-days.length,'Past empty days get a waterline marker; future days stay blank');
  assert.equal(await sameInk(),true,'Legend dots share the single ink');

  // Top overview KPI strip includes cumulative USD spend + predicted weekly quota USD,
  // fits cleanly in 6 single-row columns on desktop without text overflow or wrapping.
  const kpiCheck=await page.evaluate(()=>{
    const vs=document.getElementById('ag-pulse-status-bar').shadowRoot.getElementById('usage-dashboard').firstElementChild.shadowRoot;
    const cards=[...vs.querySelectorAll('#totals .metric')];
    return {
      count:cards.length,
      rows:new Set(cards.map(c=>Math.round(c.getBoundingClientRect().top))).size,
      items:cards.map(c=>{
        const lbl=c.querySelector('label'),val=c.querySelector('.value');
        return {
          label:lbl.textContent.trim(),
          value:val.textContent.trim(),
          title:c.title,
          lblOverflow:lbl.scrollWidth-lbl.clientWidth,
          valOverflow:val.scrollWidth-val.clientWidth,
          valHeight:Math.round(val.getBoundingClientRect().height),
        };
      }),
    };
  });
  assert.equal(kpiCheck.count,6,'Overview KPI strip renders 6 metrics (4 tokens + total cost + est. weekly)');
  assert.equal(kpiCheck.rows,1,'Desktop 6-card overview stays on a single clean row');
  assert.equal(kpiCheck.items[4].label,'累计金额');
  assert.ok(/^\$[\d,.]+K?USD$/.test(kpiCheck.items[4].value),'Cumulative cost shows USD: '+kpiCheck.items[4].value);
  assert.equal(kpiCheck.items[5].label,'预测周额度');
  assert.ok(/^≈\$[\d,.]+K?USD$/.test(kpiCheck.items[5].value),'Weekly quota prediction shows ≈ USD: '+kpiCheck.items[5].value);
  assert.ok(kpiCheck.items[5].title.includes('Gemini')&&kpiCheck.items[5].title.includes('Argon'),'Weekly quota tooltip breaks down pools: '+kpiCheck.items[5].title);
  assert.ok(kpiCheck.items.every(it=>it.lblOverflow<=1&&it.valOverflow<=1&&it.valHeight<=28),'No overview KPI label/value clips or wraps: '+JSON.stringify(kpiCheck.items));

  // Real pointer: a day column lights the bars, its punch-card column and the day label.
  await page.locator('.iceberg [data-hit=bucket][data-bucket="12"]').hover();
  await page.locator('#tip').waitFor({state:'visible'});
  const tip=await page.locator('#tip').textContent();
  assert.ok(tip.includes('2026-11-13')&&tip.includes('83,900,000'),'Day tooltip: '+tip);
  assert.ok(/新增/.test(tip)&&/缓存读取/.test(tip)&&/缓存命中/.test(tip)&&/换算金额/.test(tip)&&/\$/.test(tip),'Tooltip splits new tokens, cache reads and USD cost: '+tip);
  assert.equal(await page.locator('.mono-svg .u-band.show').count(),2,'Hover band spans both charts');
  assert.equal(await page.locator('.iceberg .u-fresh.on').count(),1);
  assert.equal(await page.locator('.punch .u-dot.on').count(),2,'Both models used on 11-13 light up');
  assert.notEqual(await page.locator('.iceberg .u-fresh.on').evaluate(n=>getComputedStyle(n).fill),await page.locator('.iceberg .u-fresh:not(.on)').first().evaluate(n=>getComputedStyle(n).fill),'Accent only marks the hovered bucket');
  await page.screenshot({path:join(out,'mono-hover-day.png')});

  // A single cell highlights one dot and its model row; the tooltip marks that model active.
  await page.locator('.punch [data-hit=cell][data-bucket="12"][data-model="gemini 4 argon"]').hover();
  assert.equal(await page.locator('.punch .u-dot.on').count(),1);
  assert.equal(await page.locator('.punch .u-label.row.on').evaluate(n=>n.firstChild.textContent),'Argon');
  assert.equal(await page.locator('.punch .u-label.row.on title').textContent(),'Gemini 4 Argon');
  assert.equal(await page.locator('#tip .tip-model.active').count(),1);

  // Row label hover focuses the whole model row without a tooltip.
  await page.locator('.punch [data-hit=row][data-model="gemini 3.8 flash"]').hover();
  assert.equal(await page.locator('.mono-chart.row-focus').count(),1);
  assert.equal(await page.locator('.punch .u-dot.on').count(),3);
  assert.equal(await page.locator('#tip').isVisible(),false);

  // Table rows drive the same model focus, merge Orchestrator into base model,
  // omit Cache write, and render Cache hit bar + USD cost without horizontal overflow.
  const tableCheck=await page.evaluate(()=>{
    const vs=document.getElementById('ag-pulse-status-bar').shadowRoot.getElementById('usage-dashboard').firstElementChild.shadowRoot;
    const headers=[...vs.querySelectorAll('#table-head th')].map(n=>n.textContent.trim());
    const legendLabels=[...vs.querySelectorAll('#legend button')].map(n=>n.textContent.trim());
    const hRow=vs.querySelector('#table-body tr[data-model="gemini 4 hydrogen"]');
    const aRow=vs.querySelector('#table-body tr[data-model="gemini 4 argon"]');
    const table=vs.querySelector('.table'),wrap=vs.querySelector('.table-wrap');
    return {
      headers,
      legendLabels,
      summary:vs.querySelector('.chart-summary')?.textContent||'',
      hCells:hRow?[...hRow.children].map(td=>td.textContent.trim()):[],
      hTitle:hRow?.children[0]?.title||'',
      hHasBar:Boolean(hRow?.querySelector('.cache-bar i')),
      hCostTitle:hRow?.querySelector('.col-cost')?.title||'',
      hTotalTitle:hRow?.children[1]?.title||'',
      aTotal:aRow?.children[1]?.textContent.trim()||'',
      overflow:table.scrollWidth-wrap.clientWidth,
    };
  });
  assert.deepEqual(tableCheck.headers,['模型','总 Token','未缓存输入','缓存读取','输出','缓存率','换算金额'],'Table replaces Cache write with Cache hit + Est. cost');
  assert.equal(tableCheck.legendLabels.some(l=>/orchestrator/i.test(l)),false,'Orchestrator must merge into base models: '+JSON.stringify(tableCheck.legendLabels));
  assert.ok(tableCheck.legendLabels.includes('Hydrogen')&&tableCheck.legendLabels.includes('Argon'),'Gemini 4 models display concise element names: '+JSON.stringify(tableCheck.legendLabels));
  assert.equal(tableCheck.hCells[0],'Hydrogen');
  assert.equal(tableCheck.hTitle,'Gemini 4 Hydrogen');
  assert.equal(tableCheck.hCells[1],'146M','Hydrogen total includes merged Orchestrator usage (81.8+48.6+10+5.2M), shown with 3 significant digits');
  assert.equal(tableCheck.hTotalTitle,'145,600,000 Token','Compact table cell keeps the exact value in its title');
  assert.equal(tableCheck.aTotal,'8.50M','Argon total includes merged Orchestrator (Argon) usage (5.4+1.0+2.1M)');
  assert.ok(tableCheck.hCells.slice(1,5).every(v=>v.length<=5&&/^(\d{1,3}|\d+(\.\d+)?[KMBT])$/.test(v)),'Token cells use bounded K/M/B/T units: '+JSON.stringify(tableCheck.hCells));
  assert.equal(tableCheck.hHasBar,true,'Cache hit column includes inline monochrome bar');
  assert.ok(/%$/.test(tableCheck.hCells[5]),'Cache hit percentage rendered: '+tableCheck.hCells[5]);
  assert.ok(/^\$[\d,]+\.\d{2}$/.test(tableCheck.hCells[6]),'USD cost rendered: '+tableCheck.hCells[6]);
  assert.ok(tableCheck.hCostTitle.includes('$1.5/M')&&tableCheck.hCostTitle.includes('$7.5/M'),'Cost cell tooltip lists official unit rates: '+tableCheck.hCostTitle);
  assert.ok(/约 \$[\d,]+\.\d{2}/.test(tableCheck.summary),'Summary includes USD estimate: '+tableCheck.summary);
  assert.ok(tableCheck.overflow<=1,'7-column table fits without horizontal overflow: '+tableCheck.overflow);
  await page.locator('#table-body tr[data-model="gemini 4 hydrogen"]').hover();
  assert.equal(await page.locator('.punch .u-dot.on').count(),3);
  const hTip=await page.locator('#tip').textContent();
  assert.ok(hTip.includes('Gemini 4 Hydrogen')&&hTip.includes('Orchestrator'),'Merged row hover tooltip lists full name and Orchestrator mode: '+hTip);
  assert.ok(await page.locator('#tip .tier-cost').count()>=2&&/\$[\d,.]+/.test(hTip),'Tier tooltip displays per-tier USD costs: '+hTip);
  assert.ok(await page.locator('#tip .tip-foot').isVisible()&&hTip.includes('$1.5/M')&&hTip.includes('1M 统一价'),'Tier tooltip includes official pricing policy footer: '+hTip);

  await page.mouse.move(5,5);
  assert.equal(await page.locator('.mono-svg .on').count(),0,'Leaving clears every highlight');
  assert.equal(await page.locator('#tip').isVisible(),false);

  // Keyboard focus reaches past buckets and shows the same tooltip.
  await page.locator('.iceberg [data-hit=bucket][data-bucket="0"]').focus();
  assert.equal(await page.locator('#tip').isVisible(),true);
  assert.equal(await page.locator('.iceberg [data-hit=bucket][data-bucket="29"]').getAttribute('tabindex'),null,'Future days are not focus stops');

  // Period changes redraw the instrument.
  await page.locator('[data-period=week]').click();
  assert.equal(await page.locator('.iceberg [data-hit=bucket]').count(),12);
  await page.locator('[data-period=month]').click();
  assert.equal(await page.locator('.iceberg [data-hit=bucket]').count(),12);
  await page.locator('[data-period=day]').click();
  await page.screenshot({path:join(out,'mono-month.png')});

  // Model filters still apply.
  await page.locator('#legend button[data-model="gemini 4 hydrogen"]').click();
  assert.equal(await page.locator('.punch .u-label.row').count(),mergedModelCount-1);
  await page.locator('#legend button[data-model="gemini 4 hydrogen"]').click();

  // Empty month keeps an explicit empty state.
  await page.locator('#previous').click();
  assert.equal(await page.locator('.mono-empty').isVisible(),true);
  await page.locator('#next').click();

  // Punch-card reference key text must never clip outside its SVG or chart wrap (even for 200M+).
  const keyClip=await page.evaluate(()=>{
    const vs=document.getElementById('ag-pulse-status-bar').shadowRoot.getElementById('usage-dashboard').firstElementChild.shadowRoot;
    const svg=vs.querySelector('.mono-key svg'),wrap=vs.querySelector('.chart-wrap');
    const sr=svg.getBoundingClientRect(),wr=wrap.getBoundingClientRect();
    return [...svg.querySelectorAll('text')].map(t=>{const r=t.getBoundingClientRect();return {text:t.textContent,overSvg:r.right-sr.right,overWrap:r.right-wr.right};});
  });
  assert.ok(keyClip.length>=1&&keyClip.every(k=>k.overSvg<=1&&k.overWrap<=1),'Reference key must not clip: '+JSON.stringify(keyClip));

  // Scroll preservation regression: live data polls, quota-only polls, legend toggles,
  // and composer parking/restoring must NEVER snap #page-body back to top.
  await page.setViewportSize({width:1280,height:660});
  await page.waitForTimeout(100);
  const scrolled=await page.evaluate(()=>{
    const vs=document.getElementById('ag-pulse-status-bar').shadowRoot.getElementById('usage-dashboard').firstElementChild.shadowRoot;
    const body=vs.getElementById('page-body');
    const max=body.scrollHeight-body.clientHeight;
    body.scrollTop=Math.min(220,max);
    return {max,top:body.scrollTop};
  });
  assert.ok(scrolled.max>=120&&scrolled.top>=120,'Details page body must be scrollable for regression test: '+JSON.stringify(scrolled));

  // 1) Non-weekly quota / timestamp-only poll must not redraw the chart or jump scroll.
  await page.evaluate(()=>{
    const vs=document.getElementById('ag-pulse-status-bar').shadowRoot.getElementById('usage-dashboard').firstElementChild.shadowRoot;
    window.__icebergRef=vs.querySelector('svg.iceberg');
    window.testData={...window.testData,updatedAt:new Date().toISOString(),quotaWindows:{...window.testData.quotaWindows,'gemini:5h':{observedTokens:12345,estimatedFullTokens:999999}}};
  });
  await page.waitForTimeout(2600);
  const afterNoopPoll=await page.evaluate(()=>{
    const vs=document.getElementById('ag-pulse-status-bar').shadowRoot.getElementById('usage-dashboard').firstElementChild.shadowRoot;
    return {sameSvg:vs.querySelector('svg.iceberg')===window.__icebergRef,top:vs.getElementById('page-body').scrollTop};
  });
  assert.equal(afterNoopPoll.sameSvg,true,'Unused quotaWindows/updatedAt changes must not redraw chart');
  assert.ok(Math.abs(afterNoopPoll.top-scrolled.top)<=1,'Scroll must stay stable after metadata poll: '+JSON.stringify(afterNoopPoll));

  // 2) Live data poll with genuinely increased tokens triggers full render()+renderMono() without resetting scrollTop.
  await page.evaluate(()=>{
    const nextDays=window.testData.days.map(d=>({...d,models:{...d.models}}));
    nextDays.push({date:'2026-11-22',models:{'Gemini 4 Hydrogen':{uncached:1200000,cacheRead:198000000,cacheWrite:0,output:800000,total:200000000,requests:42}}});
    window.testData={...window.testData,days:nextDays,todayTokens:200000000,weekTokens:200000000,monthTokens:window.testData.monthTokens+200000000,totalTokens:window.testData.totalTokens+200000000,requests:window.testData.requests+42};
  });
  await page.waitForFunction(()=>document.getElementById('ag-pulse-status-bar').shadowRoot.getElementById('usage-dashboard').firstElementChild.shadowRoot.getElementById('coverage').textContent.includes('142'));
  const afterLivePoll=await page.evaluate(()=>{
    const vs=document.getElementById('ag-pulse-status-bar').shadowRoot.getElementById('usage-dashboard').firstElementChild.shadowRoot;
    const svg=vs.querySelector('.mono-key svg'),wrap=vs.querySelector('.chart-wrap');
    const sr=svg.getBoundingClientRect(),wr=wrap.getBoundingClientRect();
    const clips=[...svg.querySelectorAll('text')].map(t=>{const r=t.getBoundingClientRect();return {text:t.textContent,overSvg:r.right-sr.right,overWrap:r.right-wr.right};});
    return {top:vs.getElementById('page-body').scrollTop,clips};
  });
  assert.ok(Math.abs(afterLivePoll.top-scrolled.top)<=2,'Live usage poll must preserve scrollTop (expected ~'+scrolled.top+', got '+afterLivePoll.top+')');
  assert.ok(afterLivePoll.clips.some(c=>c.text==='200M')&&afterLivePoll.clips.every(c=>c.overSvg<=1&&c.overWrap<=1),'200M reference label must not clip: '+JSON.stringify(afterLivePoll.clips));

  // 3) Toggling a legend filter while scrolled must not snap back to top.
  await page.evaluate(()=>{
    const vs=document.getElementById('ag-pulse-status-bar').shadowRoot.getElementById('usage-dashboard').firstElementChild.shadowRoot;
    vs.querySelector('#legend button[data-model=\"claude opus 4.6\"]').click();
  });
  const afterFilter=await page.evaluate(()=>document.getElementById('ag-pulse-status-bar').shadowRoot.getElementById('usage-dashboard').firstElementChild.shadowRoot.getElementById('page-body').scrollTop);
  assert.ok(afterFilter>=scrolled.top-40&&afterFilter>0,'Legend filter toggle must keep scroll position: '+afterFilter);
  await page.evaluate(()=>{
    const vs=document.getElementById('ag-pulse-status-bar').shadowRoot.getElementById('usage-dashboard').firstElementChild.shadowRoot;
    vs.querySelector('#legend button[data-model=\"claude opus 4.6\"]').click();
  });

  // 4) Parking the shadow host when composer hides must restore scrollTop via restoreModal().
  const beforePark=await page.evaluate(async()=>{
    const vs=document.getElementById('ag-pulse-status-bar').shadowRoot.getElementById('usage-dashboard').firstElementChild.shadowRoot;
    const body=vs.getElementById('page-body');
    body.scrollTop=Math.min(180,body.scrollHeight-body.clientHeight);
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    return body.scrollTop;
  });
  await page.evaluate(()=>{document.querySelector('.rounded-composer').style.display='none';});
  await page.waitForFunction(()=>document.getElementById('ag-pulse-status-bar').parentElement===document.body&&document.getElementById('ag-pulse-status-bar').shadowRoot.getElementById('usage-dashboard').matches(':popover-open'));
  const afterPark=await page.evaluate(()=>document.getElementById('ag-pulse-status-bar').shadowRoot.getElementById('usage-dashboard').firstElementChild.shadowRoot.getElementById('page-body').scrollTop);
  assert.ok(Math.abs(afterPark-beforePark)<=2,'Composer park/restoreModal must preserve scrollTop (expected ~'+beforePark+', got '+afterPark+')');
  await page.evaluate(()=>{document.querySelector('.rounded-composer').style.display='';});
  await page.setViewportSize({width:1280,height:900});

  // Hover tooltip preservation regression: live background polls (data updates or syncing toggles)
  // must NEVER interrupt an active punch-card dot, iceberg column, table row, or heatmap tooltip.
  await page.locator('.punch [data-hit=cell][data-bucket="12"][data-model="gemini 4 argon"]').hover();
  await page.locator('#tip').waitFor({state:'visible'});
  await page.evaluate(()=>{
    window.testData={...window.testData,syncing:true,requests:window.testData.requests+5};
  });
  await page.waitForFunction(()=>document.getElementById('ag-pulse-status-bar').shadowRoot.getElementById('usage-dashboard').firstElementChild.shadowRoot.getElementById('coverage').textContent.includes('147'));
  assert.equal(await page.locator('#tip').isVisible(),true,'Punch-card dot tooltip must stay open across live background refresh');
  const dotTipAfterPoll=await page.locator('#tip').textContent();
  assert.ok(dotTipAfterPoll.includes('2026-11-13')&&dotTipAfterPoll.includes('83,900,000'),'Preserved punch-card tooltip retains exact bucket details: '+dotTipAfterPoll);
  assert.equal(await page.locator('.punch .u-dot.on').count(),1,'Preserved punch-card dot highlight stays lit');
  assert.equal(await page.locator('.mono-svg .u-band.show').count(),2,'Preserved hover band stays visible across both charts');

  // Hovering today's bucket updates the open tooltip live when today's tokens grow.
  await page.locator('.iceberg [data-hit=bucket][data-bucket="21"]').hover();
  await page.locator('#tip').waitFor({state:'visible'});
  assert.ok((await page.locator('#tip').textContent()).includes('200,000,000'));
  await page.evaluate(()=>{
    const nextDays=window.testData.days.map(d=>d.date==='2026-11-22'?{...d,models:{'Gemini 4 Hydrogen':{uncached:2200000,cacheRead:207000000,cacheWrite:0,output:800000,total:210000000,requests:48}}}:d);
    window.testData={...window.testData,days:nextDays,todayTokens:210000000,weekTokens:210000000,monthTokens:window.testData.monthTokens+10000000,totalTokens:window.testData.totalTokens+10000000,requests:window.testData.requests+6,syncing:false};
  });
  await page.waitForFunction(()=>document.getElementById('ag-pulse-status-bar').shadowRoot.getElementById('usage-dashboard').firstElementChild.shadowRoot.getElementById('coverage').textContent.includes('153'));
  assert.equal(await page.locator('#tip').isVisible(),true,'Active iceberg tooltip stays open during live token growth');
  assert.ok((await page.locator('#tip').textContent()).includes('210,000,000'),'Open iceberg tooltip updates live to refreshed total');

  // Table multi-tier tooltip stays open across live refresh and closes when pointer leaves.
  await page.locator('#table-body tr[data-model="gemini 4 hydrogen"]').hover();
  await page.locator('#tip').waitFor({state:'visible'});
  await page.evaluate(()=>{window.testData={...window.testData,requests:window.testData.requests+2};});
  await page.waitForFunction(()=>document.getElementById('ag-pulse-status-bar').shadowRoot.getElementById('usage-dashboard').firstElementChild.shadowRoot.getElementById('coverage').textContent.includes('155'));
  assert.equal(await page.locator('#tip').isVisible(),true,'Table row tooltip stays open across live background refresh');
  await page.mouse.move(5,5);
  assert.equal(await page.locator('#tip').isVisible(),false,'Moving pointer away dismisses restored table tooltip cleanly');

  // Overview heatmap tooltip also survives live background refresh.
  await page.locator('#overview-tab').click();
  await page.locator('#heat button[data-from="2026-11-13"]').hover();
  await page.locator('#tip').waitFor({state:'visible'});
  await page.evaluate(()=>{window.testData={...window.testData,requests:window.testData.requests+2};});
  await page.waitForFunction(()=>document.getElementById('ag-pulse-status-bar').shadowRoot.getElementById('usage-dashboard').firstElementChild.shadowRoot.getElementById('coverage').textContent.includes('157'));
  assert.equal(await page.locator('#tip').isVisible(),true,'Overview heatmap tooltip stays open across live background refresh');
  await page.mouse.move(5,5);
  assert.equal(await page.locator('#tip').isVisible(),false,'Moving pointer away dismisses restored heatmap tooltip cleanly');
  await page.locator('#details-tab').click();

  // Dynamic future model compatibility (Solution 1):
  // - New codenames (e.g. Gemini 4 Krypton + Orchestrator (Krypton) + orchestrator-krypton)
  //   merge dynamically into one concise "Krypton" row with full title "Gemini 4 Krypton" and "—" cost.
  // - Generic tier names (e.g. Gemini 5 Pro) keep their full name without stripping to "Pro".
  // - Same codename across two generations (Gemini 4 Xenon + Gemini 5 Xenon) stays distinct.
  await page.evaluate(()=>{
    const extra={
      'Orchestrator (Krypton)':{uncached:200000,cacheRead:800000,cacheWrite:0,output:50000,total:1050000,requests:5},
      'Gemini 4 Krypton':{uncached:300000,cacheRead:1700000,cacheWrite:0,output:100000,total:2100000,requests:10},
      'orchestrator-krypton':{uncached:100000,cacheRead:400000,cacheWrite:0,output:20000,total:520000,requests:3},
      'Gemini 5 Pro':{uncached:100000,cacheRead:900000,cacheWrite:0,output:50000,total:1050000,requests:4},
      'Gemini 4 Xenon':{uncached:100000,cacheRead:500000,cacheWrite:0,output:30000,total:630000,requests:2},
      'Gemini 5 Xenon':{uncached:100000,cacheRead:500000,cacheWrite:0,output:30000,total:630000,requests:2},
      'GPT 5.4 (High)':{uncached:400000,cacheRead:600000,cacheWrite:0,output:100000,total:1100000,requests:2},
      'Claude Haiku 5.5':{uncached:100000,cacheRead:900000,cacheWrite:0,output:20000,total:1020000,requests:5},
    };
    const nextDays=window.testData.days.map(d=>d.date==='2026-11-22'?{...d,models:{...d.models,...extra}}:d);
    window.testData={...window.testData,models:[...window.testData.models,...Object.keys(extra)],days:nextDays,requests:window.testData.requests+33};
  });
  await page.waitForFunction(()=>document.getElementById('ag-pulse-status-bar').shadowRoot.getElementById('usage-dashboard').firstElementChild.shadowRoot.getElementById('coverage').textContent.includes('190'));
  const futureCheck=await page.evaluate(()=>{
    const vs=document.getElementById('ag-pulse-status-bar').shadowRoot.getElementById('usage-dashboard').firstElementChild.shadowRoot;
    const labels=[...vs.querySelectorAll('#legend button')].map(b=>b.textContent.trim());
    const kRow=vs.querySelector('#table-body tr[data-model="gemini 4 krypton"]');
    const kRows=[...vs.querySelectorAll('#table-body tr')].filter(r=>r.children[0].textContent.trim()==='Krypton').length;
    const gptRow=vs.querySelector('#table-body tr[data-model="gpt 5.4"]');
    const haikuRow=vs.querySelector('#table-body tr[data-model="claude haiku 5.5"]');
    return {
      labels,
      kRows,
      kTotal:kRow?.children[1]?.textContent.trim()||'',
      kTitle:kRow?.children[0]?.title||'',
      kCost:kRow?.querySelector('.col-cost')?.textContent.trim()||'',
      gptCost:gptRow?.querySelector('.col-cost')?.textContent.trim()||'',
      gptHint:gptRow?.querySelector('.col-cost')?.title||'',
      haikuCost:haikuRow?.querySelector('.col-cost')?.textContent.trim()||'',
    };
  });
  assert.equal(futureCheck.kRows,1,'Gemini 4 Krypton + Orchestrator (Krypton) + orchestrator-krypton merge into 1 Krypton row');
  assert.equal(futureCheck.kTotal,'3.67M','Merged Krypton total sums all 3 variants (1.05M + 2.1M + 0.52M)');
  assert.equal(futureCheck.kTitle,'Gemini 4 Krypton','Krypton retains full official name on hover');
  assert.equal(futureCheck.kCost,'—','Unpriced future model degrades cleanly to —');
  assert.equal(futureCheck.gptCost,'$4.55','GPT 5.4 >272K avg prompt (500K/req) applies official long-context tier ($5/$0.5/$22.5)');
  assert.ok(futureCheck.gptHint.includes('>272K'),'GPT 5.4 cost hint notes >272K long-context tier: '+futureCheck.gptHint);
  assert.equal(futureCheck.haikuCost,'$0.15','Claude Haiku 5.5 >100K avg prompt (200K/req) applies official >100K tier ($0.5/$0.05/$2.5)');
  assert.equal(futureCheck.labels.some(l=>/orchestrator/i.test(l)),false,'No standalone Orchestrator row for future codename');
  assert.ok(futureCheck.labels.includes('Gemini 5 Pro')&&!futureCheck.labels.includes('Pro'),'Generic Pro tier is never stripped to bare Pro: '+JSON.stringify(futureCheck.labels));
  assert.ok(futureCheck.labels.includes('Gemini 4 Xenon')&&futureCheck.labels.includes('Gemini 5 Xenon'),'Cross-generation codename collision keeps full versioned names: '+JSON.stringify(futureCheck.labels));

  // Renderer restart continues rendering the monochrome instrument directly.
  await page.locator('#usage-dashboard #close').click();
  await page.evaluate(`window.__agPulseDispose();(${extract(inline)})();`);
  await openDetails();
  assert.equal(await page.locator('svg.iceberg').isVisible(),true,'Mono instrument renders after restart');
  assert.equal(await page.locator('[data-chart-style]').count(),0);
  assert.equal(await page.locator('.bar-segment').count(),0);

  assert.deepEqual(errors,[],'No page errors');
  console.log('Mono usage chart checks passed.');
}finally{await browser.close();server.close();}
