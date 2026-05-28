# ============================================================
# backup-reailize.ps1
# Backup automático de la base de datos Reailize Portal
# Destino: OneDrive B.Yond → Documents → Repositorio Claude
# ============================================================

$backupDir    = "C:\Users\User\OneDrive - B.Yond\Documents\Repositorio Claude\Backups\ReailizeDB"
$containerName = "reailize_db"
$dbName       = "reailize_portal"
$dbUser       = "reailize_user"
$maxBackups   = 48   # conserva los últimos 48 backups (48 horas)

$timestamp  = Get-Date -Format "yyyy-MM-dd_HH-mm"
$backupFile = "$backupDir\reailize_$timestamp.sql"

# Crear carpeta si no existe
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
}

# Ejecutar pg_dump dentro del contenedor Docker
# Usar cmd /c para piping directo → evita que PowerShell reinterprete bytes UTF-8 como CP437
$errorFile = "$backupDir\error_$timestamp.txt"
cmd /c "docker exec $containerName pg_dump -U $dbUser $dbName > `"$backupFile`" 2>`"$errorFile`""

if ($LASTEXITCODE -eq 0) {
    # Eliminar archivo de error vacío si todo fue bien
    if (Test-Path $errorFile) { Remove-Item $errorFile -Force }
    Write-Host "✅ Backup guardado: $backupFile"

    # Eliminar backups viejos, conservar solo los últimos $maxBackups
    $backups = Get-ChildItem -Path $backupDir -Filter "reailize_*.sql" | Sort-Object LastWriteTime -Descending
    if ($backups.Count -gt $maxBackups) {
        $backups | Select-Object -Skip $maxBackups | Remove-Item -Force
        Write-Host "🗑️  Backups antiguos eliminados (conservados: $maxBackups)"
    }
} else {
    $errorContent = if (Test-Path $errorFile) { Get-Content $errorFile -Raw } else { "Unknown error" }
    $errorMsg = "❌ Error al crear backup: $errorContent"
    Write-Host $errorMsg
    # Eliminar el backup incompleto si existe
    if (Test-Path $backupFile) { Remove-Item $backupFile -Force }
}
