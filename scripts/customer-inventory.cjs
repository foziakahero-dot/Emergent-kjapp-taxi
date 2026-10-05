const fs = require('fs'), path = require('path');
const ts = require('../frontend/node_modules/typescript');
const root = path.resolve(__dirname,'..');
function files(dir) { return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]); }
const actions=[], calls=[];
const seenIDs = new Set();
for (const file of [...files(root+'/frontend/app'),...files(root+'/frontend/src')].filter(x=>/\.tsx?$/.test(x))) {
  const text = fs.readFileSync(file,'utf8'); const source = ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  let additions=[];
  function visit(node) {
    if (ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node)) {
      const tag=node.tagName.getText(source), attrs=node.attributes.properties;
      const map=Object.fromEntries(attrs.filter(ts.isJsxAttribute).map(a=>[a.name.getText(source),a.initializer?.getText(source)||'true']));
      const event=Object.keys(map).filter(k=>/^on(Press|SubmitEditing|ChangeText|ValueChange|Change)$/.test(k));
      if (event.length) {
        const line=source.getLineAndCharacterOfPosition(node.pos).line+1;
        let testID=map.testID;
        if (!testID && ['Pressable','Button','Text'].includes(tag) && map.onPress) {
          const id='customer-'+path.relative(root+'/frontend',file).replace(/[^a-zA-Z0-9]+/g,'-').replace(/-tsx?$/,'')+'-'+line+'-'+actions.length;
          additions.push({at:node.tagName.end,text:` testID="${id}"`}); testID=JSON.stringify(id);
        }
        actions.push({file:path.relative(root,file),line,component:tag,testID:testID||'MISSING (wrapper/input)',label:map.label||map.accessibilityLabel||(ts.isJsxElement(node.parent) ? node.parent.children.filter(ts.isJsxText).map(x=>x.getText(source).trim()).filter(Boolean).join(' ') : '')||'text child/dynamic',handlers:Object.fromEntries(event.map(k=>[k,map[k]])),destination:(map.onPress||'').match(/(?:push|replace|openURL)\(([^)]*)/)?.[1]||'handler/local state',authenticated:!/(index|login|register|permissions|forgot-password|reset-password)/.test(file),disabled:map.disabled||map.loading||'not declared',backendCalls:'See CUSTOMER_API_CALLERS_20261004.json for this file and handler',success:'SOURCE ONLY; see screen matrix',error:'SOURCE ONLY; see screen matrix',verification:'SOURCE INVENTORY; device behavior unverified'});
      }
    }
    if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)){
      const receiver=node.expression.expression.getText(source),name=node.expression.name.text;
      if(/Api$/.test(receiver)||receiver==='api')calls.push({file:path.relative(root,file),line:source.getLineAndCharacterOfPosition(node.pos).line+1,api:receiver,method:name,args:node.arguments.map(a=>a.getText(source)).join(', ')});
    }
    ts.forEachChild(node,visit);
  }
  visit(source);
  if(process.argv.includes('--stamp')){let updated=text;for(const a of additions.sort((a,b)=>b.at-a.at))updated=updated.slice(0,a.at)+a.text+updated.slice(a.at);fs.writeFileSync(file,updated);}
}
fs.mkdirSync(root+'/docs',{recursive:true});fs.writeFileSync(root+'/docs/CUSTOMER_ACTION_INVENTORY_20261004.json',JSON.stringify(actions,null,2)+'\n');fs.writeFileSync(root+'/docs/CUSTOMER_API_CALLERS_20261004.json',JSON.stringify(calls,null,2)+'\n');console.log(JSON.stringify({actions:actions.length,calls:calls.length}));
