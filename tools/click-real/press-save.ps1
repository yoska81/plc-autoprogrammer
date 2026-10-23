# The build server's stand-in for the user at Windows' "Save Print Output As" dialog (the app never presses Save
# itself; on a user's PC the user does): waits up to 5 minutes for the dialog and for the app to fill in the file name
# (a .pdf), then presses Save (the dialog's button 1). By window handles: a search of the UI Automation tree from the
# desktop missed the dialog, and pressing before the name was in left the dialog open.
Add-Type -Namespace W -Name U -MemberDefinition @'
[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern System.IntPtr FindWindow(string cls, string title);
[DllImport("user32.dll")] public static extern System.IntPtr GetDlgItem(System.IntPtr h, int id);
[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern System.IntPtr SendMessage(System.IntPtr h, uint msg, System.IntPtr w, System.Text.StringBuilder l);
[DllImport("user32.dll")] public static extern System.IntPtr SendMessage(System.IntPtr h, uint msg, System.IntPtr w, System.IntPtr l);
[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern System.IntPtr FindWindowEx(System.IntPtr parent, System.IntPtr after, string cls, string title);
[DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(System.IntPtr h, System.Text.StringBuilder sb, int max);
[DllImport("user32.dll")] public static extern int GetDlgCtrlID(System.IntPtr h);
'@
$title = 'Save Print Output As'

# the File name box: the Edit (id 1001) inside the dialog's combo box, at any depth
function NameBox($h) {
  $stack = New-Object System.Collections.Stack; $stack.Push($h)
  while ($stack.Count) {
    $p = $stack.Pop(); $c = [IntPtr]::Zero
    while (($c = [W.U]::FindWindowEx($p, $c, $null, $null)) -ne [IntPtr]::Zero) {
      $cls = New-Object System.Text.StringBuilder 64
      [void][W.U]::GetClassName($c, $cls, 64)
      if ($cls.ToString() -eq 'Edit' -and [W.U]::GetDlgCtrlID($c) -eq 1001) { return $c }
      $stack.Push($c)
    }
  }
  return [IntPtr]::Zero
}

function TextOf($h) {
  $sb = New-Object System.Text.StringBuilder 1024
  [void][W.U]::SendMessage($h, 0x000D <# WM_GETTEXT #>, [IntPtr]1024, $sb)
  return $sb.ToString()
}

$until = (Get-Date).AddMinutes(5)
while ((Get-Date) -lt $until) {
  $h = [W.U]::FindWindow('#32770', $title)
  if ($h -ne [IntPtr]::Zero) {
    $box = NameBox $h
    $name = if ($box -ne [IntPtr]::Zero) { TextOf $box } else { '' }
    if ($name -match '\.pdf$') {
      Start-Sleep -Milliseconds 700
      $save = [W.U]::GetDlgItem($h, 1)
      [void][W.U]::SendMessage($save, 0x00F5 <# BM_CLICK #>, [IntPtr]::Zero, [IntPtr]::Zero)
      Write-Host "pressed Save in $title ($name)"
      Start-Sleep -Seconds 3
      if ([W.U]::FindWindow('#32770', $title) -eq [IntPtr]::Zero) { exit 0 }
      Write-Host "the dialog is still open: pressing again"
    }
  }
  Start-Sleep -Milliseconds 500
}
Write-Host "no $title dialog came, or its file name was not filled in"
exit 1
