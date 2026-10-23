"""Controlled font-dialog cases in an explicitly selected TINA editor.
Uses native controls observed in native-text-font-dialog.png; no format writes.
"""
import ctypes, importlib.util, pathlib, sys, time
spec=importlib.util.spec_from_file_location('oracle',pathlib.Path(__file__).with_name('native-oracle.py'))
o=importlib.util.module_from_spec(spec);spec.loader.exec_module(o)
pid,editor=map(int,sys.argv[1:3])
o.u.SendMessageW.argtypes=[ctypes.c_void_p,ctypes.c_uint,ctypes.c_size_t,ctypes.c_void_p]
def wait_window(cls,present=True):
 for _ in range(100):
  found=[r for r in o.windows(pid) if r['visible'] and r['class']==cls]
  if bool(found)==present:return found[0] if found else None
  time.sleep(.03)
 raise RuntimeError('Window wait failed: '+cls)
def click(h):
 o.u.PostMessageW(h,0x201,1,(12<<16)|12);o.u.PostMessageW(h,0x202,0,(12<<16)|12)
def control(parent,ident):return next(r['hwnd'] for r in o.windows(pid,parent) if r['control_id']==ident)
def text_buttons(h):return sorted([r for r in o.windows(pid,h) if r['class']=='TBitBtn'],key=lambda r:r['rect'][1])
# A caller may leave the owned font editor open from an inspected experiment.
for r in o.windows(pid):
 if r['visible'] and r['class']=='#32770':o.u.PostMessageW(r['hwnd'],0x111,2,0);time.sleep(.1)
for r in o.windows(pid):
 if r['visible'] and r['class']=='TCSysTextDlg':click(text_buttons(r['hwnd'])[1]['hwnd']);time.sleep(.1)
for name,style,effect in [('bold','полужирный',None),('italic','курсив',None),('bold_italic','полужирный курсив',None),('underline','обычный',1041),('strike','обычный',1040)]:
 o.dialog_file(6,'reports/oracle-cases/text_style_baseline.TSC',editor);wait_window('#32770',False);time.sleep(.5)
 o.u.PostMessageW(editor,0x111,64,0);time.sleep(.15);o.u.PostMessageW(editor,0x111,69,0)
 t=wait_window('TCSysTextDlg');click(text_buttons(t['hwnd'])[3]['hwnd']);f=wait_window('#32770');h=control(f['hwnd'],1137)
 choices=[]
 for i in range(o.u.SendMessageW(h,0x146,0,None)):
  b=ctypes.create_unicode_buffer(256);o.u.SendMessageW(h,0x148,i,b);choices.append(b.value)
 i=choices.index(style);o.u.SendMessageW(h,0x14e,i,None);o.u.SendMessageW(f['hwnd'],0x111,(1<<16)|1137,ctypes.c_void_p(h))
 if effect:o.u.SendMessageW(control(f['hwnd'],effect),0xf5,0,None)
 o.u.PostMessageW(f['hwnd'],0x111,1,0);wait_window('#32770',False);click(text_buttons(t['hwnd'])[0]['hwnd']);wait_window('TCSysTextDlg',False)
 out=pathlib.Path('reports/oracle-cases/text_native_'+name+'.TSC');o.dialog_file(10,out,editor)
 for _ in range(100):
  if out.exists():break
  time.sleep(.03)
 print(out,flush=True)
