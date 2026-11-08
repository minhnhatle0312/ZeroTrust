param(
    [Parameter(Mandatory=$true)][string]$DocumentPath,
    [Parameter(Mandatory=$true)][string]$PdfPath
)
$ErrorActionPreference = 'Stop'
$wordApp = $null
$doc = $null
try {
    $wordApp = New-Object -ComObject Word.Application
    $wordApp.Visible = $false
    $wordApp.DisplayAlerts = 0
    $wordApp.AutomationSecurity = 3
    $doc = $wordApp.Documents.Open($DocumentPath, $false, $true, $false)
    $doc.Repaginate()
    $doc.ExportAsFixedFormat($PdfPath, 17)
    $pageCount = $doc.ComputeStatistics(2)
    Write-Output "Rendered pages: $pageCount"
    for ($pageNumber = 1; $pageNumber -le $pageCount; $pageNumber++) {
        $range = $doc.GoTo(1, 1, $pageNumber)
        $nextRange = if ($pageNumber -lt $pageCount) { $doc.GoTo(1, 1, ($pageNumber + 1)) } else { $null }
        $end = if ($null -ne $nextRange) { $nextRange.Start } else { $doc.Content.End }
        $pageRange = $doc.Range($range.Start, $end)
        $summary = $pageRange.Text -replace '[\r\n\x07\x0C]', ' '
        $summary = $summary.Substring(0, [Math]::Min(180, $summary.Length))
        Write-Output "Page ${pageNumber}: $summary"
        $pageRange.Text | Set-Content -Encoding UTF8 -LiteralPath ([System.IO.Path]::ChangeExtension($PdfPath, ".page$pageNumber.txt"))
    }
    Write-Output "PDF: $PdfPath"
}
finally {
    $saveOption = 0
    if ($null -ne $doc) { $doc.Close([ref]$saveOption); [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($doc) }
    if ($null -ne $wordApp) { $wordApp.Quit([ref]$saveOption); [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($wordApp) }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
}
