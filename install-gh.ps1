$url = "https://github.com/cli/cli/releases/download/v2.70.0/gh_2.70.0_windows_amd64.msi"
$output = "gh_installer.msi"
$start_time = Get-Date

Write-Host "Downloading GitHub CLI installer..."
Invoke-WebRequest -Uri $url -OutFile $output

Write-Host "Installing GitHub CLI..."
Start-Process msiexec.exe -Wait -ArgumentList "/i $output /quiet"

Write-Host "Cleaning up..."
Remove-Item $output

Write-Host "Installation complete! Please restart your terminal."
$end_time = Get-Date
$time_taken = $end_time - $start_time
Write-Host "Time taken: $($time_taken.TotalSeconds) seconds" 