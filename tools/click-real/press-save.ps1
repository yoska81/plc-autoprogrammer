# The build server's stand-in for the user at Windows' "Save Print Output As" dialog (the app never presses Save
# itself; on a user's PC the user does): waits up to 3 minutes for the dialog, then presses its Save button.
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
$until = (Get-Date).AddMinutes(3)
while ((Get-Date) -lt $until) {
  $cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::NameProperty, 'Save Print Output As')
  $dlg = [System.Windows.Automation.AutomationElement]::RootElement.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond)
  if ($dlg) {
    Start-Sleep -Milliseconds 1500  # the app fills in the file name first
    $btns = $dlg.FindAll([System.Windows.Automation.TreeScope]::Descendants, (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button)))
    foreach ($b in $btns) {
      if ($b.Current.Name -match '^(Save|&Save)$') {
        $b.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
        Write-Host "pressed Save in Save Print Output As"
        exit 0
      }
    }
  }
  Start-Sleep -Milliseconds 500
}
Write-Host "no Save Print Output As dialog came"
exit 1
