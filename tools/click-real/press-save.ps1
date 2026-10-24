# The build server's stand-in for the user at Windows' "Save Print Output As" dialog (the app never presses Save
# itself; on a user's PC the user does): waits up to 5 minutes for the dialog, gives the app 5 s to fill in the file
# name, then presses Save with the keyboard (Alt+S) until the dialog closes. Found by its window handle; its controls
# did not show through UI Automation from this script, and pressing before the name was in left the dialog open.
Add-Type -AssemblyName System.Windows.Forms
Add-Type -Namespace W -Name U -MemberDefinition @'
[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern System.IntPtr FindWindow(string cls, string title);
[DllImport("user32.dll")] public static extern bool SetForegroundWindow(System.IntPtr h);
'@
$title = 'Save Print Output As'
$until = (Get-Date).AddMinutes(5)
$seen = $null
while ((Get-Date) -lt $until) {
  $h = [W.U]::FindWindow('#32770', $title)
  if ($h -ne [IntPtr]::Zero) {
    if (-not $seen) { $seen = Get-Date; Write-Host "the $title dialog came" }
    if (((Get-Date) - $seen).TotalSeconds -gt 5) {
      [W.U]::SetForegroundWindow($h) | Out-Null
      Start-Sleep -Milliseconds 300
      [System.Windows.Forms.SendKeys]::SendWait('%s')
      Write-Host "pressed Alt+S (Save) in $title"
      Start-Sleep -Seconds 3
      if ([W.U]::FindWindow('#32770', $title) -eq [IntPtr]::Zero) { exit 0 }
      Write-Host "the dialog is still open: pressing again"
    }
  } elseif ($seen) { exit 0 }
  Start-Sleep -Milliseconds 1000
}
Write-Host "no $title dialog came, or Save did not close it"
exit 1
