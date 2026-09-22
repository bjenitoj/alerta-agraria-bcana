$ErrorActionPreference = "Stop"
$app = Split-Path -Parent $MyInvocation.MyCommand.Path
$bat = Join-Path $app "Iniciar.bat"
$taskName = "AlertaAgrariaCyL"

schtasks /Create /F /TN $taskName /SC DAILY /ST 07:00 /RL LIMITED /TR "`"$bat`"" | Out-Host
Write-Host ""
Write-Host "Tarea creada: cada dia a las 07:00 se abre la aplicacion y consulta las fuentes oficiales."
Write-Host "Para quitarla: schtasks /Delete /TN $taskName /F"
