import os,sys,json,urllib.request,pathlib,subprocess
key=os.environ.get('OPENROUTER_API_KEY') or subprocess.check_output(['powershell','-NoProfile','-Command',"[Environment]::GetEnvironmentVariable('OPENROUTER_API_KEY','User')"],text=True).strip()
if not key:raise SystemExit('Missing API key in environment')
prompt=pathlib.Path(sys.argv[1]).read_text(encoding='utf-8')
payload={'model':'deepseek/deepseek-v4.1-flash-1017','messages':[{'role':'user','content':prompt}],'max_tokens':16000,'reasoning':{'enabled':False,'exclude':True}}
req=urllib.request.Request('https://openrouter.ai/api/v1/chat/completions',data=json.dumps(payload).encode(),headers={'Authorization':'Bearer '+key,'Content-Type':'application/json'})
with urllib.request.urlopen(req,timeout=150) as r:d=json.load(r)
base=pathlib.Path(sys.argv[2]);base.with_suffix('.txt').write_text(d['choices'][0]['message'].get('content') or '',encoding='utf-8');base.with_suffix('.json').write_text(json.dumps({'model':d.get('model'),'usage':d.get('usage')},indent=2),encoding='utf-8');print('Response saved. Cost:',d.get('usage',{}).get('cost'))
