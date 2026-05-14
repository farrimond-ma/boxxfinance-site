Add-Type -AssemblyName System.Drawing
$imagePath = "c:\Users\MarkFarrimond\Boxx Commercial Finance\logo.png"
$outputPath = "c:\Users\MarkFarrimond\Boxx Commercial Finance\logo-optimized.png"

$img = [System.Drawing.Image]::FromFile($imagePath)
# Resize to 336x168 (2x for retina)
$newImg = New-Object System.Drawing.Bitmap(336, 168)
$g = [System.Drawing.Graphics]::FromImage($newImg)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($img, 0, 0, 336, 168)
$newImg.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
$img.Dispose()
$newImg.Dispose()
$g.Dispose()
Write-Host "Logo optimized and saved to logo-optimized.png"
