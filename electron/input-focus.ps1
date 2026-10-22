$ErrorActionPreference = 'Stop'

Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class SalesBuddyInputFocusNative {
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")]
    public static extern bool IsWindowEnabled(IntPtr window);
    [DllImport("user32.dll")]
    public static extern IntPtr GetWindow(IntPtr window, uint command);
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
}
'@

while ($null -ne ($line = [Console]::ReadLine())) {
    $request = $line | ConvertFrom-Json
    $window = [IntPtr]::new([long]::Parse($request.hwnd))
    $foreground = [SalesBuddyInputFocusNative]::GetForegroundWindow()
    $foregroundPid = [uint32]0
    [void][SalesBuddyInputFocusNative]::GetWindowThreadProcessId($foreground, [ref]$foregroundPid)
    $owner = [SalesBuddyInputFocusNative]::GetWindow($window, 4)
    $result = @{
        id = $request.id
        capturedAt = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
        windowHandle = $window.ToInt64().ToString()
        foregroundHandle = $foreground.ToInt64().ToString()
        ownerHandle = $owner.ToInt64().ToString()
        foregroundPid = $foregroundPid
        enabled = [SalesBuddyInputFocusNative]::IsWindowEnabled($window)
        foregroundIsSelf = ($foreground -eq $window)
    }
    [Console]::Out.WriteLine(($result | ConvertTo-Json -Compress))
    [Console]::Out.Flush()
}
