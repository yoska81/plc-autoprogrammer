# The build server's stand-in for the user at Windows' "Save Print Output As" dialog (the app never presses Save
# itself; on a user's PC the user does): waits up to 5 minutes for the dialog and for the app to fill in the file name
# (a .pdf), then presses Save. The dialog is found by its window handle (a search of the UI Automation tree from the
# desktop missed it), its controls through UI Automation (pressing before the name was in left the dialog open).
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
Add-Type -Namespace W -Name U -MemberDefinition @'
[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern System.IntPtr FindWindow(string cls, string title);
'@
$A = [System.Windows.Automation.AutomationElement]
$title = 'Save Print Output As'
$all = [System.Windows.Automation.Condition]::TrueCondition
$until = (Get-Date).AddMinutes(5)
$seen = $null
while ((Get-Date) -lt $until) {
  $h = [W.U]::FindWindow('#32770', $title)
  if ($h -ne [IntPtr]::Zero) {
    if (-not $seen) { $seen = Get-Date; Write-Host "the $title dialog came" }
    try {
      $dlg = $A::FromHandle($h)
      $els = $dlg.FindAll([System.Windows.Automation.TreeScope]::Descendants, $all)
      $name = ''; $save = $null
      foreach ($e in $els) {
        $c = $e.Current
        if ($c.AutomationId -eq '1001') {
          try { $name = $e.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).Current.Value } catch { }
        }
        if ($c.ControlType -eq [System.Windows.Automation.ControlType]::Button -and $c.Name -match '^&?Save$') { $save = $e }
      }
      Write-Host "file name: '$name'; Save button: $([bool]$save)"
      # the app fills the name in within a second or two: the name, or 5 s since the dialog came
      if ($save -and ($name -match '\.pdf$' -or ((Get-Date) - $seen).TotalSeconds -gt 5)) {
        $save.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
        Write-Host "pressed Save in $title"
        Start-Sleep -Seconds 3
        if ([W.U]::FindWindow('#32770', $title) -eq [IntPtr]::Zero) { exit 0 }
        Write-Host "the dialog is still open: pressing again"
      }
    } catch { Write-Host "reading the dialog: $($_.Exception.Message)" }
  }
  Start-Sleep -Milliseconds 1000
}
Write-Host "no $title dialog came, or Save did not close it"
exit 1
