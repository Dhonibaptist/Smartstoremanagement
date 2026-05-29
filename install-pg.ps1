Write-Host "Setting up password file..."
Set-Content -Path "pw.txt" -Value "postgres123"

Write-Host "Downloading PostgreSQL portable binaries..."
Invoke-WebRequest -Uri "https://get.enterprisedb.com/postgresql/postgresql-15.4-1-windows-x64-binaries.zip" -OutFile "postgres-bin.zip"

Write-Host "Extracting portable binaries..."
Expand-Archive -Path "postgres-bin.zip" -DestinationPath "postgres" -Force

Write-Host "Initializing PostgreSQL database cluster..."
.\postgres\pgsql\bin\initdb.exe -D .\postgres\data -U postgres --pwfile=pw.txt

Write-Host "Starting PostgreSQL server..."
.\postgres\pgsql\bin\pg_ctl.exe -D .\postgres\data -l logfile start
Start-Sleep -Seconds 5

Write-Host "Creating 'smartstore' database..."
.\postgres\pgsql\bin\createdb.exe -U postgres smartstore

Write-Host "PostgreSQL setup complete!"
