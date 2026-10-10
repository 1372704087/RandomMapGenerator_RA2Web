# Drive MapGenerator.exe (G:\MapGenerator) headlessly via Win32 messages.
# - Finds windows by pid + class via EnumWindows (FindWindow is unreliable here)
# - Sets combo selections by control ID (CB_SETCURSEL)
# - Clicks the Generate button (WM_COMMAND, BN_CLICKED)
# - Waits for the result MessageBox (class #32770, title 生成结果) and dismisses it
# - Prints the seeds the run actually used (from rmg_diag.log)
#
# Params (all optional):
#   -Env 0..4      (0群岛 1大岛屿 2大岛屿群 3内陆 4山地)
#   -Time 0..3     (0早晨 1下午 2黄昏 3夜晚)
#   -Theater 0..1  (0温带 1雪地)
#   -Size 0..3     (0小 1中 2大 3特大)
#   -Ore 0..3
#   -Players 0..6  (0=2人 .. 6=8人)
#   -GameType 0..1 (0单人.map 1多人.yrm)
param(
    [int]$Env = 0,
    [int]$Time = 0,
    [int]$Theater = 0,
    [int]$Size = 0,
    [int]$Ore = 0,
    [int]$Players = 0,
    [int]$GameType = 0,
    [int]$TimeoutSec = 600
)

$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class Win32O {
    public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr hWndParent, EnumProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(IntPtr hWnd, System.Text.StringBuilder lpClassName, int nMaxCount);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, System.Text.StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr hWnd, int nIndex);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);

    // top-level window of `pid` whose class == `cls` ("" = any)
    public static IntPtr FindByPidClass(uint pid, string cls) {
        IntPtr found = IntPtr.Zero;
        EnumProc cb = delegate(IntPtr h, IntPtr l) {
            uint wpid;
            GetWindowThreadProcessId(h, out wpid);
            if (wpid != pid) return true;
            if (cls.Length > 0) {
                System.Text.StringBuilder sb = new System.Text.StringBuilder(256);
                GetClassName(h, sb, 256);
                if (sb.ToString() != cls) return true;
            }
            found = h;
            return false;
        };
        EnumWindows(cb, IntPtr.Zero);
        return found;
    }
}
"@

function Get-CtlId([IntPtr]$h) {
    return [int](([Win32O]::GetWindowLong($h, -12)) -band 0xFFFF)  # GWL_ID
}

$exeDir = 'G:/MapGenerator_inst/x64/Release'
$exe = Join-Path $exeDir 'MapGenerator.exe'
if (-not (Test-Path $exe)) { throw "exe not found: $exe" }

$diagLog = Join-Path $exeDir 'rmg_diag.log'

Stop-Process -Name MapGenerator -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 300

$proc = Start-Process -FilePath $exe -WorkingDirectory $exeDir -PassThru
try {
    $mainHwnd = [IntPtr]::Zero
    $deadline = (Get-Date).AddSeconds(20)
    while ($mainHwnd -eq [IntPtr]::Zero -and (Get-Date) -lt $deadline) {
        Start-Sleep -Milliseconds 200
        if ($proc.HasExited) { throw "process exited early: $($proc.ExitCode)" }
        $mainHwnd = [Win32O]::FindByPidClass([uint32]$proc.Id, 'MapGeneratorWindowClass')
    }
    if ($mainHwnd -eq [IntPtr]::Zero) { throw 'main window not found' }
    [Win32O]::SetForegroundWindow($mainHwnd) | Out-Null

    $children = @{}
    $cb = [Win32O+EnumProc]{
        param($h, $l)
        $script:children[(Get-CtlId $h)] = $h
        return $true
    }
    [Win32O]::EnumChildWindows($mainHwnd, $cb, [IntPtr]::Zero) | Out-Null

    # combo IDs from WinMain.cpp: 110 env 111 time 112 theater 113 size
    # 114 ore 115 players 118 gametype
    $sel = @{ 110 = $Env; 111 = $Time; 112 = $Theater; 113 = $Size; 114 = $Ore; 115 = $Players; 118 = $GameType }
    foreach ($id in $sel.Keys) {
        if ($children.ContainsKey($id)) { [Win32O]::SendMessage($children[$id], 0x014E, [IntPtr]$sel[$id], [IntPtr]::Zero) | Out-Null }  # CB_SETCURSEL
        else { Write-Warning "control $id not found" }
    }

    $before = @(Get-ChildItem -Path $exeDir -Filter 'rmg_*' -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName })

    if (-not $children.ContainsKey(101)) { throw 'generate button (101) not found' }
    [Win32O]::PostMessage($mainHwnd, 0x0111, [IntPtr]101, $children[101]) | Out-Null  # WM_COMMAND BN_CLICKED

    # confirm generation started: diag log gains the GLOBAL-SEED line
    $started = $false
    $deadline = (Get-Date).AddSeconds(15)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Milliseconds 300
        if ((Test-Path $diagLog) -and (Get-Content $diagLog -Raw -ErrorAction SilentlyContinue) -match 'GLOBAL-SEED') { $started = $true; break }
    }
    if (-not $started) { Write-Warning 'diag log never appeared - click may have been blocked' }

    $resultHwnd = [IntPtr]::Zero
    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        Start-Sleep -Milliseconds 500
        $h = [Win32O]::FindByPidClass([uint32]$proc.Id, '#32770')
        if ($h -ne [IntPtr]::Zero) { $resultHwnd = $h; break }
        if ($proc.HasExited) { throw 'process exited while generating' }
    }
    if ($resultHwnd -eq [IntPtr]::Zero) { throw 'timed out waiting for result dialog' }

    $dlgText = ''
    $cb3 = [Win32O+EnumProc]{
        param($h, $l)
        $cls = New-Object System.Text.StringBuilder 256
        [Win32O]::GetClassName($h, $cls, 256) | Out-Null
        if ($cls.ToString() -eq 'Static') {
            $txt = New-Object System.Text.StringBuilder 4096
            [Win32O]::GetWindowText($h, $txt, 4096) | Out-Null
            $script:dlgText += $txt.ToString() + "`n"
        }
        return $true
    }
    [Win32O]::EnumChildWindows($resultHwnd, $cb3, [IntPtr]::Zero) | Out-Null

    [Win32O]::PostMessage($resultHwnd, 0x0111, [IntPtr]1, [IntPtr]::Zero) | Out-Null  # IDOK
    Start-Sleep -Milliseconds 300

    $newMaps = @(Get-ChildItem -Path $exeDir -Filter 'rmg_*' -ErrorAction SilentlyContinue |
        ForEach-Object { $_.FullName } |
        Where-Object { $before -notcontains $_ })

    Write-Output '=== DIALOG ==='
    Write-Output $dlgText
    Write-Output '=== DIAG LOG ==='
    if (Test-Path $diagLog) { Get-Content $diagLog }
    Write-Output '=== NEW MAPS ==='
    $newMaps | ForEach-Object { Write-Output $_ }
}
finally {
    if (-not $proc.HasExited) {
        $proc.CloseMainWindow() | Out-Null
        Start-Sleep -Milliseconds 800
        if (-not $proc.HasExited) { $proc.Kill() }
    }
}
