
Add-Type -AssemblyName System.Drawing

$sourcePath = "c:\Users\MarkFarrimond\.gemini\antigravity\playground\pyro-quasar\public\logo.png"
$destPath = "c:\Users\MarkFarrimond\.gemini\antigravity\playground\pyro-quasar\public\logo_solid.png"

Write-Host "Loading image from $sourcePath..."
$bmp = [System.Drawing.Bitmap]::FromFile($sourcePath)
$width = $bmp.Width
$height = $bmp.Height

# Create a new bitmap for the output
$newBmp = New-Object System.Drawing.Bitmap($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($newBmp)
$graphics.DrawImage($bmp, 0, 0, $width, $height)
$graphics.Dispose()

# We need a way to track visited pixels for the flood fill
# Using a 2D array of bools or similar. 
# Since PS is slow with large arrays, we'll use a flattened array or simple logic.
# Actually, we can use a "visited" bitmap or just modify the $newBmp in place if we are careful.

# Target background color (Black)
$bgColor = $bmp.GetPixel(0, 0)
$tolerance = 30 

function Is-Match($c1, $c2) {
    return ([Math]::Abs($c1.R - $c2.R) -lt $tolerance) -and 
    ([Math]::Abs($c1.G - $c2.G) -lt $tolerance) -and 
    ([Math]::Abs($c1.B - $c2.B) -lt $tolerance)
}

# Queue for BFS
$queue = new-object System.Collections.Queue
$queue.Enqueue(@{X = 0; Y = 0 })

# Use a separate bitmap to track "Background" status to avoid modifying colors yet
# Or just set them to Transparent immediately?
# If we set them to Transparent, we can distinguish them from "internal black".
# Converting Black -> Transparent for background.
# Remaining Black -> White.

# Set (0,0) to Transparent immediately and add to queue
$transparent = [System.Drawing.Color]::Transparent
$white = [System.Drawing.Color]::White

# However, we need to know if a pixel has been visited to avoid loops.
# Let's use a HashSet of coordinates "x,y"
$visited = New-Object System.Collections.Generic.HashSet[string]
$visited.Add("0,0") | Out-Null

$newBmp.SetPixel(0, 0, $transparent)

Write-Host "Starting Flood Fill to remove background..."
# This might be slow in PS, but let's try.
# Optimization: System.Collections.Generic.Queue is faster.

$q = New-Object System.Collections.Generic.Queue[System.Drawing.Point]
$q.Enqueue([System.Drawing.Point]::new(0, 0))

while ($q.Count -gt 0) {
    $pt = $q.Dequeue()
    $x = $pt.X
    $y = $pt.Y

    # Check 4 neighbors
    $neighbors = @(
        [System.Drawing.Point]::new($x + 1, $y),
        [System.Drawing.Point]::new($x - 1, $y),
        [System.Drawing.Point]::new($x, $y + 1),
        [System.Drawing.Point]::new($x, $y - 1)
    )

    foreach ($n in $neighbors) {
        if ($n.X -ge 0 -and $n.X -lt $width -and $n.Y -ge 0 -and $n.Y -lt $height) {
            # Check if this pixel is Black (Background)
            $pixelColor = $newBmp.GetPixel($n.X, $n.Y)
            
            # If it's already Transparent, it's visited/processed
            if ($pixelColor.A -eq 0) { continue }

            if (Is-Match $pixelColor $bgColor) {
                # It is background. Make transparent and add to queue.
                $newBmp.SetPixel($n.X, $n.Y, $transparent)
                $q.Enqueue($n)
            }
        }
    }
}

Write-Host "Flood fill complete. Converting remaining black holes to white..."

# Now scan the whole image. 
# Any pixel that is NOT transparent and IS CloseToBlack (the holes) -> White.
for ($x = 0; $x -lt $width; $x++) {
    for ($y = 0; $y -lt $height; $y++) {
        $pixel = $newBmp.GetPixel($x, $y)
        
        # If not transparent
        if ($pixel.A -gt 0) {
            # If it looks like black (the internal holes that weren't reached by flood fill)
            if (Is-Match $pixel $bgColor) {
                $newBmp.SetPixel($x, $y, $white)
            }
        }
    }
}

Write-Host "Saving to $destPath..."
$newBmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
$newBmp.Dispose()
$bmp.Dispose()
Write-Host "Done."
