Add-Type -AssemblyName System.Drawing

$public = Join-Path $PSScriptRoot "..\public"
$brand = Join-Path $public "hoot-brand.png"
$mark = Join-Path $public "hoot-mark.png"

function Save-Crop {
    param(
        [string]$SrcPath,
        [int]$X,
        [int]$Y,
        [int]$W,
        [int]$H,
        [string]$OutName
    )
    $img = [System.Drawing.Image]::FromFile($SrcPath)
    $bmp = New-Object System.Drawing.Bitmap $W, $H
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $srcRect = New-Object System.Drawing.Rectangle $X, $Y, $W, $H
    $dstRect = New-Object System.Drawing.Rectangle 0, 0, $W, $H
    $g.DrawImage($img, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()
    $img.Dispose()
    $outPath = Join-Path $public $OutName
    $bmp.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host "Created $OutName (${W}x${H})"
}

# Brand 501x704 — owl ~top 60%, wordmark ~bottom 34%
Save-Crop -SrcPath $brand -X 0 -Y 0 -W 501 -H 422 -OutName "hoot-owl.png"
Save-Crop -SrcPath $brand -X 0 -Y 455 -W 501 -H 249 -OutName "hoot-wordmark.png"

# Mark 1024x1024 — owl only ~top 72%
Save-Crop -SrcPath $mark -X 0 -Y 0 -W 1024 -H 737 -OutName "hoot-owl-mark.png"

# Favicon square from brand owl center
Save-Crop -SrcPath $brand -X 100 -Y 40 -W 300 -H 300 -OutName "hoot-favicon.png"