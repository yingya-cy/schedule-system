$action = New-ScheduledTaskAction -Execute "C:\Users\MR\Desktop\sc sys\scripts\auto_sync.bat"
$trigger = New-ScheduledTaskTrigger -Daily -At 3am
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -RunLevel Limited
Register-ScheduledTask -TaskName "SC-SYS-KB-AutoSync" -Action $action -Trigger $trigger -Principal $principal -Force
Write-Host "Task created successfully"
