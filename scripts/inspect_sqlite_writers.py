"""Read-only Windows inventory for an operator's Administrator console.

Never applies, opens SQLite, stops services, changes policy, or requests elevation.
Reports candidates for human review, not a claim that future writes are impossible.
"""
import argparse
import ctypes
from ctypes import wintypes as w
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import socket
import subprocess
import uuid

ROOT = Path(__file__).resolve().parents[1]

PS_INVENTORY = r'''
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false)
function Safe-Entry([string]$command) {
  $m=[regex]::Match($command, '^\s*(?:"[^"]+"|\S+)\s+(?:"([^"\r\n]+\.(?:js|cjs|mjs|py|pyw|ps1))"|([^\s"=]+\.(?:js|cjs|mjs|py|pyw|ps1)))(?:\s|$)', 'IgnoreCase')
  if($m.Success) {
    $entry=$m.Groups[1].Value
    if(-not $entry){$entry=$m.Groups[2].Value}
    if($entry -notmatch '^[-]|[=`?]' -and $entry -notmatch '://'){return $entry}
  }
  return $null
}
$result=[ordered]@{processes=@{status='UNAVAILABLE';items=@()};services=@{status='UNAVAILABLE';items=@()};tasks=@{status='UNAVAILABLE';items=@()}}
try {
  $all=@(Get-CimInstance Win32_Process)
  $result.processes.enumeratedCount=$all.Count
  $result.processes.items=@($all | Where-Object {
    $_.ProcessId -ne $PID -and $_.ProcessId -ne __OWN_PID__ -and (
      $_.Name -match 'node|python|sqlite|dbeaver|sqlitestudio|pm2|nssm|powershell|pwsh|cmd|wscript|cscript|wsl|bash' -or
      $_.CommandLine -match 'ZeroTrust|attendance\.sqlite|staff\.json' -or
      $_.ProcessId -in @(__HANDLE_PIDS__))
  } | ForEach-Object {
    $p=$_; $entry=Safe-Entry $p.CommandLine
    $parent=$all | Where-Object {$_.ProcessId -eq $p.ParentProcessId} | Select-Object -First 1
    [pscustomobject]@{pid=$p.ProcessId;parentPid=$p.ParentProcessId;name=$p.Name;executable=$p.ExecutablePath;started=$p.CreationDate
      entrypoint=$entry;parentName=$parent.Name;parentEntrypoint=(Safe-Entry $parent.CommandLine)
      codexEntrypoint=([bool]($p.Name -match '^node(\.exe)?$' -and $entry -match '[/\\]@openai[/\\]codex[/\\]bin[/\\]codex\.js$'))
      projectHint=([bool]($p.CommandLine -match 'ZeroTrust'))
      workerHint=([bool]($p.CommandLine -match 'server\.js|process_governance|directory_user|restore_week|setup_week|reconcile_staff_ids|fix-admin'))
      commandLineOmitted=$true}
  })
  $result.processes.status='OK'
} catch {$result.processes.errorCategory=[string]$_.CategoryInfo.Category}
try {
  $candidatePids=@($result.processes.items | ForEach-Object {$_.pid})
  $services=@(Get-CimInstance Win32_Service)
  $result.services.enumeratedCount=$services.Count
  $result.services.items=@($services | Where-Object {
    $_.PathName -match 'ZeroTrust|node|python|sqlite|nssm|pm2|powershell|pwsh|cmd|wscript|cscript|wsl|bash' -or ($_.ProcessId -ne 0 -and $_.ProcessId -in $candidatePids)
  } | ForEach-Object {
    [pscustomobject]@{name=$_.Name;state=$_.State;startMode=$_.StartMode;pid=$_.ProcessId
      entrypoint=(Safe-Entry $_.PathName);projectHint=([bool]($_.PathName -match 'ZeroTrust|attendance\.sqlite|staff\.json'))
      commandLineOmitted=$true}
  })
  $result.services.status='OK'
} catch {$result.services.errorCategory=[string]$_.CategoryInfo.Category}
try {
  $tasks=@(Get-ScheduledTask)
  $result.tasks.enumeratedCount=$tasks.Count
  $result.tasks.items=@($tasks | Where-Object {
    ($_.Actions.Execute -join ' ') -match 'node|python|sqlite|powershell|pwsh|cmd|wscript|cscript|wsl|bash|ZeroTrust' -or
    ($_.Actions.Arguments -join ' ') -match 'ZeroTrust|attendance\.sqlite|staff\.json|server\.js' -or
    ($_.Actions.WorkingDirectory -join ' ') -match 'ZeroTrust'
  } | ForEach-Object {
    [pscustomobject]@{name=$_.TaskName;path=$_.TaskPath;state=[string]$_.State;enabled=$_.Settings.Enabled
      actions=@($_.Actions | ForEach-Object {
        [pscustomobject]@{executable=$_.Execute;workingDirectory=$_.WorkingDirectory
          entrypoint=(Safe-Entry ('"'+$_.Execute+'" '+$_.Arguments))
          projectHint=([bool]($_.Arguments -match 'ZeroTrust|attendance\.sqlite|staff\.json'));argumentsOmitted=$true}
      })}
  })
  $result.tasks.status='OK'
} catch {$result.tasks.errorCategory=[string]$_.CategoryInfo.Category}
$result | ConvertTo-Json -Depth 9 -Compress
'''


def read_paths(root=ROOT):
    env = {}
    path = root / 'backend/.env'
    if path.exists():
        for line in path.read_text(encoding='utf-8-sig').splitlines():
            if line.strip() and not line.lstrip().startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                if k.strip() in {'ATTENDANCE_DB', 'STAFF_FILE'}:
                    env[k.strip()] = v.strip().strip('"\'')
    # Follow configured file paths only; never import a provisioning module.
    db = (root/'backend'/env.get('ATTENDANCE_DB', 'data/attendance.sqlite')).resolve()
    seed = (root/'backend'/env.get('STAFF_FILE', 'data/staff.json')).resolve()
    return db, seed


class UniqueProcess(ctypes.Structure):
    _fields_ = [('pid', w.DWORD), ('started', w.FILETIME)]


class ProcessInfo(ctypes.Structure):
    _fields_ = [('process', UniqueProcess), ('app', w.WCHAR*256), ('service', w.WCHAR*64),
                ('kind', w.DWORD), ('status', w.ULONG), ('session', w.DWORD), ('restartable', w.BOOL)]


def file_users(paths):
    """Register resources and query users only. Never calls RmShutdown/RmRestart."""
    files = [str(p) for p in paths if p.exists()]
    result = {'status': 'UNAVAILABLE', 'files': files, 'processes': []}
    if not files:
        result['error'] = 'TARGET_FILES_MISSING'
        return result
    rm = ctypes.WinDLL('Rstrtmgr')
    rm.RmStartSession.argtypes = [ctypes.POINTER(w.DWORD), w.DWORD, w.LPWSTR]
    rm.RmRegisterResources.argtypes = [w.DWORD,w.UINT,ctypes.POINTER(w.LPCWSTR),w.UINT,ctypes.POINTER(UniqueProcess),w.UINT,ctypes.POINTER(w.LPCWSTR)]
    rm.RmGetList.argtypes = [w.DWORD,ctypes.POINTER(w.UINT),ctypes.POINTER(w.UINT),ctypes.POINTER(ProcessInfo),ctypes.POINTER(w.DWORD)]
    rm.RmEndSession.argtypes = [w.DWORD]
    session = w.DWORD()
    key = ctypes.create_unicode_buffer(33)
    code = rm.RmStartSession(ctypes.byref(session), 0, key)
    result['startCode'] = code
    if code:
        return result
    try:
        code = rm.RmRegisterResources(session, len(files), (w.LPCWSTR*len(files))(*files), 0, None, 0, None)
        result['registerCode'] = code
        if code:
            return result
        capacity = 0
        for _ in range(3):
            rows = (ProcessInfo*capacity)() if capacity else None
            count, needed, reason = w.UINT(capacity), w.UINT(), w.DWORD()
            code = rm.RmGetList(session, ctypes.byref(needed), ctypes.byref(count), rows, ctypes.byref(reason))
            result['listCode'] = code
            if code == 0:
                result['processes'] = [{'pid': rows[i].process.pid, 'applicationType': rows[i].kind,
                                        'session': rows[i].session} for i in range(count.value)]
                result['status'] = 'OK'
                break
            if code != 234:
                break
            capacity = needed.value
    finally:
        rm.RmEndSession(session)
    return result


def powershell_inventory(handle_pids):
    numbers = ','.join(str(int(pid)) for pid in handle_pids) or '0'
    command = PS_INVENTORY.replace('__OWN_PID__',str(os.getpid())).replace('__HANDLE_PIDS__',numbers)
    completed = subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-Command',command],
                               capture_output=True,text=True,encoding='utf-8',timeout=45)
    if completed.returncode:
        return {'status':'UNAVAILABLE','error':'POWERSHELL_FAILED','exitCode':completed.returncode}
    return json.loads(completed.stdout)


def docker_mounts():
    listed = subprocess.run(['docker','ps','-q'],capture_output=True,text=True,timeout=15)
    if listed.returncode:
        return {'status':'UNAVAILABLE','error':'DOCKER_QUERY_FAILED','items':[]}
    items=[]
    for container in listed.stdout.split():
        if not container.isalnum():
            raise ValueError('Invalid container ID')
        queried=subprocess.run(['docker','inspect','--format','{{json .Mounts}}',container],capture_output=True,text=True,timeout=15)
        if queried.returncode:
            return {'status':'UNAVAILABLE','error':'DOCKER_MOUNT_QUERY_FAILED','items':items}
        items.append({'containerId':container,'mounts':[{'type':m.get('Type'),'source':m.get('Source'),
                      'destination':m.get('Destination'),'rw':m.get('RW')} for m in json.loads(queried.stdout)]})
    return {'status':'OK','items':items}


def collect(root=ROOT):
    db,seed=read_paths(root)
    report={'checkedAt':datetime.now(timezone.utc).isoformat(),'database':str(db),'seed':str(seed),
            'purpose':'READ_ONLY_INVENTORY_NOT_AUTHORIZATION','policyChanged':False,'processesStopped':False,
            'environmentOverridesPresent':[k for k in ('IAM_BACKEND_ENV','ATTENDANCE_DB','STAFF_FILE') if k in os.environ]}
    try: report['administrator']=bool(ctypes.windll.shell32.IsUserAnAdmin())
    except Exception: report['administrator']=None
    try: report['fileUsers']=file_users([db,Path(str(db)+'-wal'),Path(str(db)+'-shm'),seed])
    except Exception as e: report['fileUsers']={'status':'UNAVAILABLE','errorType':type(e).__name__}
    try: report['windows']=powershell_inventory([p['pid'] for p in report['fileUsers'].get('processes',[])])
    except Exception as e: report['windows']={'status':'UNAVAILABLE','errorType':type(e).__name__}
    try: report['docker']=docker_mounts()
    except Exception as e: report['docker']={'status':'UNAVAILABLE','errorType':type(e).__name__}
    report['listeners']={}
    for port in (3001,5173,5174):
        with socket.socket() as s:
            s.settimeout(1)
            report['listeners'][str(port)]=s.connect_ex(('127.0.0.1',port))==0
    report['queryComplete']=not report['environmentOverridesPresent'] and all(report.get(section,{}).get('status')=='OK' for section in ('fileUsers','docker')) and all(
        report.get('windows',{}).get(section,{}).get('status')=='OK' for section in ('processes','services','tasks'))
    report['status']='REVIEW_REQUIRED' if report['queryComplete'] else 'BLOCKED_INVENTORY'
    return report


def main():
    argparse.ArgumentParser(description=__doc__).parse_args()
    if os.name!='nt':
        raise SystemExit('Windows host required; nothing changed.')
    report=collect()
    folder=ROOT/'.runtime/writer-inventory'
    folder.mkdir(parents=True,exist_ok=True)
    target=folder/(datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'-'+uuid.uuid4().hex[:8]+'.json')
    with target.open('x',encoding='utf-8') as out:
        json.dump(report,out,ensure_ascii=False,indent=2)
    print(report['status'])
    print('Report: '+str(target))
    print('No raw command lines, arguments, credentials, process stops or database writes.')
    return 0 if report['queryComplete'] else 2


if __name__=='__main__':
    raise SystemExit(main())
