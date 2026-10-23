# The build server's stand-in for the user at Windows' "Save Print Output As" dialog (the app never presses Save
# itself; on a user's PC the user does): waits up to 5 minutes for the dialog, then presses its Save button.
# The dialog is found by its window handle (a search of the whole UI Automation tree from the desktop missed it).
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, System.Windows.Forms
Add-Type -Namespace W -Name U -MemberDefinition @'
[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern System.IntPtr FindWindow(string cls, string title);
[DllImport("user32.dll")] public static extern bool SetForegroundWindow(System.IntPtr h);
'@
$title = 'Save Print Output As'
$until = (Get-Date).AddMinutes(5)
while ((Get-Date) -lt $until) {
  $h = [W.U]::FindWindow('#32770', $title)
  if ($h -ne [IntPtr]::Zero) {
    Start-Sleep -Milliseconds 2500  # the app fills in the file name first
    $dlg = [System.Windows.Automation.AutomationElement]::FromHandle($h)
    $btns = $dlg.FindAll([System.Windows.Automation.TreeScope]::Descendants, (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button)))
    foreach ($b in $btns) {
      if ($b.Current.Name -match '^&?Save$') {
        $b.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
        Write-Host "pressed Save in $title"
        exit 0
      }
    }
    # no Save button found by name: Alt+S, as a user's keyboard would
    [W.U]::SetForegroundWindow($h) | Out-Null
    [System.Windows.Forms.SendKeys]::SendWait('%s')
    Write-Host "pressed Alt+S in $title"
    exit 0
  }
  Start-Sleep -Milliseconds 500
}
Write-Host "no $title dialog came"
exit 1
