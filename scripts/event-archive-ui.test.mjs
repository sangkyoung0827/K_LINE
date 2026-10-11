import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { createCanvas } from "@napi-rs/canvas";
import { chromium } from "playwright";

test("archive desktop/mobile bilingual UI with local DB/files, review, exact copy/download and scoped reads", {timeout:120000}, async()=>{
  const server=spawn(process.execPath,["scripts/event-archive-ui-server.mjs"],{env:{...process.env,EVENT_ARCHIVE_UI_PORT:"3355"},stdio:["ignore","pipe","pipe"]});
  let browser,stderr="";
  server.stderr.on("data",b=>{stderr+=b;});
  try{
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error("Fixture startup timed out "+stderr)),40000);
      server.stdout.on("data",b=>{if(String(b).includes("Archive UI fixture:")){clearTimeout(timer);resolve();}});
      server.once("exit",code=>{clearTimeout(timer);reject(Error(`Fixture exited ${code}: ${stderr}`));});
    });
    browser=await chromium.launch({headless:true});
    const context=await browser.newContext({permissions:["clipboard-read","clipboard-write"],locale:"ko-KR",viewport:{width:1440,height:1000}});
    const page=await context.newPage(),errors=[];
    page.on("pageerror",e=>errors.push(e.message));
    const origin="http://127.0.0.1:3355";
    await page.goto(origin);await page.getByRole("button",{name:"KR",exact:true}).click();
    await page.getByRole("button",{name:"Import Center",exact:true}).click();
    const original="  🏹🎯🎉🎊🎈🧘🌏🌍🌎🍵📚📝🖼️🎵📅⏰✅⚠️💬🤝🚶🔔  ECC × 한활\n\n띄어  쓰기\t Englis typo! e\u0301\nhttps://example.test/old\n  ";
    await page.getByLabel("Original notice 1",{exact:true}).fill(original);
    const png=createCanvas(8,8).toBuffer("image/png");
    const pdf=Buffer.from("%PDF-1.4\ntrailer << /Root 1 0 R >>\n%%EOF\n");
    await page.getByLabel("Original files",{exact:true}).setInputFiles([
      {name:"poster.png",mimeType:"image/png",buffer:png},
      {name:"notice.pdf",mimeType:"application/pdf",buffer:pdf}
    ]);
    await page.getByRole("button",{name:"비공개 저장",exact:true}).click();
    await page.getByText("모든 원본이 검증되어 저장되었습니다.",{exact:true}).waitFor();
    const result=await (await page.request.get(origin+"/api/event-archive")).json();
    assert.equal(result.items.length,3);
    const textItem=result.items.find(i=>i.original_text!==null), imageItem=result.items.find(i=>i.assets[0]?.original_filename==="poster.png");
    assert.equal(textItem.original_text,original);
    await page.getByRole("button",{name:"저장된 원본 열기",exact:true}).first().click();
    const dialog=page.getByRole("dialog");
    await dialog.getByRole("button",{name:"Copy original",exact:true}).click();
    assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),original);
    await dialog.getByRole("button",{name:"Edit labels",exact:true}).click();
    await dialog.getByLabel("제목",{exact:true}).fill("ECC archive reviewed notice");
    await dialog.getByLabel("태그",{exact:true}).fill("Culture, Gathering");
    await dialog.getByRole("button",{name:"분류 저장",exact:true}).click();
    await dialog.getByText("ECC archive reviewed notice",{exact:true}).waitFor();
    await dialog.getByText("검수 · 공개 설정",{exact:true}).click();
    assert.equal(await dialog.getByRole("button",{name:"검수 승인 · 공개",exact:true}).isEnabled(),false);
    for(const name of ["개인정보 확인","저작권 확인","출처 확인"])await dialog.getByRole("checkbox",{name,exact:true}).check();
    await dialog.getByRole("button",{name:"검수 승인 · 공개",exact:true}).click();
    await dialog.getByText("ECC · public · approved",{exact:true}).waitFor();
    await page.keyboard.press("Escape");await dialog.waitFor({state:"hidden"});
    await page.getByRole("button",{name:"Event Archive",exact:true}).click();
    await page.getByLabel("자료 검색",{exact:true}).fill("Englis");
    await page.getByRole("button",{name:"검색",exact:true}).click();
    await page.getByRole("heading",{name:"ECC archive reviewed notice",exact:true}).waitFor();
    assert.equal(await page.locator("button").filter({has:page.locator("h2")}).count(),1);
    await mkdir("artifacts/event-archive",{recursive:true});
    await page.screenshot({path:"artifacts/event-archive/desktop.png",fullPage:true});
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.getByRole("heading",{name:"ECC archive reviewed notice",exact:true}).click();
    const bounds=await dialog.boundingBox();assert.ok(bounds.y>=0&&bounds.y+bounds.height<=844);
    await page.screenshot({path:"artifacts/event-archive/mobile-original.png"});
    await page.keyboard.press("Escape");
    await page.getByRole("button",{name:"EN",exact:true}).click();
    await page.getByLabel("Search archive",{exact:true}).waitFor();
    await page.screenshot({path:"artifacts/event-archive/mobile-en.png",fullPage:true});
    await page.goto(origin+"?archive="+imageItem.id);
    await page.getByRole("dialog").waitFor();
    const downloadPromise=page.waitForEvent("download");
    await page.getByRole("button",{name:/Download original|원본 다운로드/}).click();
    const download=await downloadPromise;
    assert.deepEqual(await readFile(await download.path()),png);
    const returned=await (await page.request.get(origin+`/api/event-archive?id=${imageItem.id}`)).json();
    assert.equal(returned.item.assets[0].sha256,createHash("sha256").update(png).digest("hex"));
    const member=await browser.newContext({viewport:{width:390,height:844}});
    const memberPage=await member.newPage();await memberPage.goto(origin+"?role=member");
    await memberPage.getByRole("alert").filter({hasText:"DEVELOPER_REQUIRED"}).waitFor();
    assert.equal(await memberPage.getByRole("heading",{name:"ECC archive reviewed notice",exact:true}).count(),0);
    assert.equal(await memberPage.getByRole("button",{name:"Import Center",exact:true}).count(),0);
    assert.equal((await memberPage.request.get(origin+`/api/event-archive?id=${imageItem.id}`)).status(),403);
    assert.equal(await memberPage.getByRole("button",{name:"Edit labels",exact:true}).count(),0);
    const readOnly=await browser.newContext();const ro=await readOnly.newPage();await ro.goto(origin+"?role=readonly");
    await ro.getByRole("heading",{name:"ECC archive reviewed notice",exact:true}).waitFor();
    assert.equal(await ro.getByRole("button",{name:"Import Center",exact:true}).count(),0);
    await page.goto(origin);
    await page.getByRole("button",{name:"KR",exact:true}).click();
    const recoveryText="  refresh recovery original e\u0301\n  ";
    const prepared=await page.request.post(origin+"/api/event-archive/ingest",{headers:{Origin:origin},data:{
      clubKey:"ecc",idempotencyKey:randomUUID(),texts:[recoveryText],files:[{
        name:"recovery.png",size:png.length,mimeType:"image/png",sha256:createHash("sha256").update(png).digest("hex")
      }],sourceKind:"upload",aiConsent:false
    }});
    assert.equal(prepared.status(),200);
    const batch=(await prepared.json()).batch_id;
    await page.reload();
    await page.getByRole("button",{name:"Import Center",exact:true}).click();
    await page.getByRole("button",{name:"이어서 저장",exact:true}).click();
    await page.getByLabel("Recovery original files",{exact:true}).setInputFiles({name:"recovery.png",mimeType:"image/png",buffer:png});
    await page.getByRole("button",{name:"원본 확인 · 이어서 저장",exact:true}).click();
    await page.getByText("저장 결과 · saved",{exact:true}).waitFor();
    await page.getByText("미완료 작업이 없습니다.",{exact:true}).waitFor();
    const recovered=await (await page.request.post(origin+"/api/event-archive/ingest",{headers:{Origin:origin},data:{action:"status",batchId:batch}})).json();
    assert.equal(recovered.status,"saved");
    const recoveredOriginal=await (await page.request.get(origin+"/api/event-archive?id="+recovered.results[0].archiveId)).json();
    assert.equal(recoveredOriginal.item.original_text,recoveryText);
    assert.deepEqual(errors,[]);
  }finally{
    await browser?.close();server.kill("SIGTERM");
    if(server.exitCode===null)await new Promise(resolve=>server.once("exit",resolve));
  }
});
