$outputFolder='D:\IAM-ZeroTrust\docs\ban_giao'
$wordApp=New-Object -ComObject Word.Application
$wordApp.Visible=$false
$wordApp.DisplayAlerts=0
try {
    $reportDoc=$wordApp.Documents.Open((Join-Path $outputFolder 'BaoCaoTongHop_IAM_Tuan5-10_DRAFT.docx'),$false,$true)
    $reportDoc.ExportAsFixedFormat((Join-Path $outputFolder 'BaoCaoTongHop_IAM_Tuan5-10_DRAFT.pdf'),17)
    Write-Output ('Word pages: '+$reportDoc.ComputeStatistics(2))
    $reportDoc.Close(0)
} finally { $wordApp.Quit() }
$pptApp=New-Object -ComObject PowerPoint.Application
try {
    $presentation=$pptApp.Presentations.Open((Join-Path $outputFolder 'BaoVe_IAM_Tuan5-10_DRAFT.pptx'),$true,$false,$false)
    $presentation.SaveAs((Join-Path $outputFolder 'BaoVe_IAM_Tuan5-10_DRAFT.pdf'),32)
    $presentation.Slides.Item(12).Export('D:\IAM-ZeroTrust\evidence\release\slide-results-final.png','PNG',1600,900)
    Write-Output ('PowerPoint slides: '+$presentation.Slides.Count)
    $presentation.Close()
} finally { $pptApp.Quit() }
