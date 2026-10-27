const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {inspectExport}=require('./prepare-final-qa-web.cjs');
test('QA artifact guard accepts the active QA bundle and rejects production/missing targets',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'snar-qa-guard-'));
 try{
  const folder=path.join(root,'_expo/static/js/web');fs.mkdirSync(folder,{recursive:true});
  fs.writeFileSync(path.join(root,'index.html'),'<script src="/_expo/static/js/web/entry.js"></script>');
  const entry=path.join(folder,'entry.js');
  fs.writeFileSync(entry,'const api="https://api-qa.snarapp.no"');
  assert.equal(inspectExport(root)[0].api,'https://api-qa.snarapp.no');
  fs.writeFileSync(entry,'const api="https://api.kjappapp.no"');assert.throws(()=>inspectExport(root),/approved QA API/);
  fs.writeFileSync(entry,'const api="https://api-qa.snarapp.no"; const fallback="https://api.kjappapp.no"');assert.throws(()=>inspectExport(root),/approved QA API/);
  fs.writeFileSync(path.join(root,'index.html'),'<html></html>');assert.throws(()=>inspectExport(root),/No entry bundle/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
