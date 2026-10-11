"""Rebuild source-only Customer API contracts; never treats route presence as runtime PASS."""
import ast,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
routes=[]
for file in sorted((ROOT/'backend').glob('*.py')):
    tree=ast.parse(file.read_text())
    for fn in ast.walk(tree):
        if not isinstance(fn,(ast.AsyncFunctionDef,ast.FunctionDef)): continue
        for dec in fn.decorator_list:
            if not isinstance(dec,ast.Call) or not isinstance(dec.func,ast.Attribute) or dec.func.attr not in ('get','post','put','patch','delete'): continue
            if not dec.args or not isinstance(dec.args[0],ast.Constant) or not isinstance(dec.args[0].value,str): continue
            params=fn.args.args
            auth=[ast.unparse(x) for x in fn.args.defaults if 'Depends(' in ast.unparse(x)]
            models=[ast.unparse(x.annotation) for x in params if x.annotation and ast.unparse(x.annotation) not in ('Request','Response','str','int','float','bool','UploadFile')]
            returns=[ast.unparse(x.value)[:450] for x in ast.walk(fn) if isinstance(x,ast.Return) and x.value]
            errors=[ast.unparse(x.args[0]) for x in ast.walk(fn) if isinstance(x,ast.Call) and ast.unparse(x.func)=='HTTPException' and x.args]
            routes.append(dict(method=dec.func.attr.upper(),path=dec.args[0].value,function=fn.name,file=str(file.relative_to(ROOT)),auth=auth or ['public / inspect delegated dependencies'],request_model=models or ['path/query/form'],response=returns, http_statuses=sorted(set(errors))))
api=(ROOT/'frontend/src/lib/api.ts').read_text();calls=json.loads((ROOT/'docs/CUSTOMER_API_CALLERS_20261004.json').read_text())
contract=[]
for m in re.finditer(r"api\.(get|post|put|patch|delete)\(\s*(['\"`])(.+?)\2",api):
    method,_,client_path=m.groups()
    paths=[client_path.replace('${provider}',p) for p in ('google','apple')] if '${provider}' in client_path else [client_path]
    for client_path in paths:
        pattern='^'+re.escape(client_path)+'$'
        pattern=re.sub(r'\\\$\\\{[^}]+\\\}',r'\\{[^}]+\\}',pattern)
        matches=[r for r in routes if r['method']==method.upper() and re.fullmatch(pattern,r['path'])]
        context=api[max(0,m.start()-300):m.start()]
        group=re.findall(r'export const (\w+)\s*=\s*\{',api[:m.start()])[-1]
        functions=re.findall(r'(\w+):\s*(?:async\s*)?\(',context)
        caller_name=functions[-1] if functions else 'inspect source'
        callers=[c for c in calls if c['api']==group and c['method']==caller_name]
        contract.append(dict(method=method.upper(),client_path=client_path,wrapper=f'{group}.{caller_name}',backend=matches,mobile_callers=callers,status='PARTIAL: source mapped; authenticated runtime unverified' if matches else 'FAIL: no backend route mapped',timeout_ms=30000,retry='No blanket mutation retries; trip/payment reconciliation in callers',request_arguments='See wrapper in frontend/src/lib/api.ts',role_scope='unused legacy shared definitions' if group=='driverApi' and not callers else 'Customer caller or exported definition'))
# Calls made directly by support/push modules are part of the Customer contract too.
for caller in calls:
    if caller['api'] != 'api' or caller['file'] == 'frontend/src/lib/api.ts' or caller['method'] not in ('get','post','put','patch','delete'): continue
    match = re.match(r"['\"`]([^'\"`]+)['\"`]", caller['args'])
    if not match: continue
    p = match.group(1); method = caller['method'].upper()
    paths=[p.replace('${provider}',provider) for provider in ('google','apple')] if '${provider}' in p else [p]
    for client_path in paths:
        pattern='^'+re.escape(client_path)+'$'
        pattern=re.sub(r'\\\$\\\{[^}]+\\\}',r'\\{[^}]+\\}',pattern)
        matches=[r for r in routes if r['method']==method and re.fullmatch(pattern,r['path'])]
        contract.append(dict(method=method, client_path=client_path, wrapper='api.'+caller['method'], backend=matches,mobile_callers=[caller],status='PARTIAL: source mapped; native runtime unverified',timeout_ms=30000,retry='explicit user action',request_arguments=caller['args'],role_scope='Customer direct caller'))
# Protected image GETs use authenticated Image sources, not axios.
for p,wrapper in [('/me/profile-photo','customerProfileApi.photoSource'),('/trips/{trip_id}/driver-photo','tripDriverPhotoSource')]:
    contract.append(dict(method='GET',client_path=p,wrapper=wrapper,backend=[r for r in routes if r['method']=='GET' and r['path']==p],mobile_callers='Image source; bearer header; no public customer id',status='PARTIAL: source mapped; native image load unverified',timeout_ms='native Image transport',retry='user reload/replace',request_arguments='version query or trip_id',role_scope='Customer'))
(ROOT/'docs/CUSTOMER_BACKEND_ROUTES_20261004.json').write_text(json.dumps(routes,indent=2)+'\n')
(ROOT/'docs/CUSTOMER_API_CONTRACT_20261004.json').write_text(json.dumps(contract,indent=2)+'\n')
print(json.dumps({'routes':len(routes),'contracts':len(contract),'unmapped':[(x['method'],x['client_path']) for x in contract if not x['backend']]}))
