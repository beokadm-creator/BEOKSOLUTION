$filePath = "c:\Users\whhol\Documents\trae_projects\eRegi\functions\src\index.ts"
$content = Get-Content $filePath -Raw

# Fix pattern: approvalResult?.method -> (approvalResult as { method?: string })?.method
$content = $content -replace 'approvalResult\?\.method', '(approvalResult as { method?: string })?.method'

# Fix pattern: error.message in console.log
$content = $content -replace 'console\.log\(error\.message\)', 'console.log(error instanceof Error ? error.message : String(error))'

# Fix pattern: e.message in console.log
$content = $content -replace 'console\.log\(e\.message\)', 'console.log(e instanceof Error ? e.message : String(e))'

# Fix pattern: claimError.message
$content = $content -replace 'claimError\.message', '(claimError instanceof Error ? claimError.message : String(claimError))'

# Fix pattern: error.message in functions.logger
$content = $content -replace 'functions\.logger\.error\([^,]+, error\.message\)', 'functions.logger.error($1, error instanceof Error ? error.message : String(error))'

# Save the file
Set-Content -Path $filePath -Value $content -NoNewline

Write-Host "Fixed type errors in index.ts"
