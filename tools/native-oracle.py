import ctypes,json,pathlib,sys
from ctypes import wintypes as w
u=ctypes.windll.user32
u.GetWindowTextW.argtypes=[w.HWND,w.LPWSTR,ctypes.c_int];u.GetClassNameW.argtypes=[w.HWND,w.LPWSTR,ctypes.c_int]
def windows(pid,children=None):
 out=[]
 @ctypes.WINFUNCTYPE(w.BOOL,w.HWND,w.LPARAM)
 def cb(h,l):
  p=w.DWORD();u.GetWindowThreadProcessId(h,ctypes.byref(p))
  if pid is None or p.value==pid:
   t=ctypes.create_unicode_buffer(2048);cl=ctypes.create_unicode_buffer(256);u.GetWindowTextW(h,t,2048);u.GetClassNameW(h,cl,256);r=w.RECT();u.GetWindowRect(h,ctypes.byref(r));out.append({'hwnd':int(h),'title':t.value,'class':cl.value,'visible':bool(u.IsWindowVisible(h)),'rect':[r.left,r.top,r.right,r.bottom],'control_id':u.GetDlgCtrlID(h)})
  return True
 if children:u.EnumChildWindows(children,cb,0)
 else:u.EnumWindows(cb,0)
 return out
if __name__=='__main__':
 if sys.argv[1]=='windows':print(json.dumps([r for r in windows(int(sys.argv[2])) if r['visible']],ensure_ascii=True))
 if sys.argv[1]=='children':print(json.dumps(windows(int(sys.argv[2]),int(sys.argv[3])),ensure_ascii=True))
 if sys.argv[1]=='command':u.PostMessageW(int(sys.argv[2]),0x111,int(sys.argv[3]),0)
 if sys.argv[1]=='capture':
  from PIL import ImageGrab
  ImageGrab.grab(window=int(sys.argv[2])).save(sys.argv[3]);print(sys.argv[3])
import time

def dialog_file(command,path,target=None):
 # Resolve the current process/editor instead of retaining a stale HWND after restart.
 editors=[r for r in windows(None) if r['visible'] and r['class']=='TSchematicEditor']
 if len(editors)!=1:raise RuntimeError('Expected one visible TINA editor')
 process_id=w.DWORD();u.GetWindowThreadProcessId(editors[0]['hwnd'],ctypes.byref(process_id));pid=process_id.value
 if target is not None:
  target_pid=w.DWORD();u.GetWindowThreadProcessId(target,ctypes.byref(target_pid))
  if target_pid.value!=pid:raise RuntimeError('Target does not belong to the TINA editor process')
 u.PostMessageW(target or editors[0]['hwnd'],0x111,command,0)
 for _ in range(100):
  matches=[r for r in windows(pid) if r['visible'] and r['class']=='#32770']
  if len(matches)==1:break
  time.sleep(.05)
 else:raise RuntimeError('Expected one file dialog')
 dlg=matches[0]['hwnd'];edits=[r for r in windows(pid,dlg) if r['class']=='Edit' and r['control_id']==1148];assert len(edits)==1
 u.SendMessageW.argtypes=[w.HWND,w.UINT,ctypes.c_size_t,ctypes.c_void_p];s=ctypes.create_unicode_buffer(str(pathlib.Path(path).resolve()));u.SendMessageW(edits[0]['hwnd'],0xC,0,ctypes.cast(s,ctypes.c_void_p));u.PostMessageW(dlg,0x111,1,0)
if __name__=='__main__' and sys.argv[1]=='open':dialog_file(6,sys.argv[2])
if __name__=='__main__' and sys.argv[1]=='export-pspice':dialog_file(25,sys.argv[2])
