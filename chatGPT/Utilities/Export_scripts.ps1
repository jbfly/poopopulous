$fileList = "file_list.txt"
$outputFile = "concatenated_scripts.txt"

Set-Content -Path $outputFile -Value ""

Get-Content -Path $fileList | ForEach-Object {
    $path = $_

    if (Test-Path -Path $path -PathType Container) {
        Get-ChildItem -Path $path -Filter *.cs -Recurse | ForEach-Object {
            $fileName = $_.Name
            $filePath = $_.FullName

            Add-Content -Path $outputFile -Value "==== $fileName ===="
            Add-Content -Path $outputFile -Value (Get-Content -Path $filePath)
            Add-Content -Path $outputFile -Value "`n"
        }
    } elseif (Test-Path -Path $path -PathType Leaf) {
        $fileName = (Get-Item -Path $path).Name
        $filePath = (Get-Item -Path $path).FullName

        Add-Content -Path $outputFile -Value "==== $fileName ===="
        Add-Content -Path $outputFile -Value (Get-Content -Path $filePath)
        Add-Content -Path $outputFile -Value "`n"
    }
}

Get-Content -Path $outputFile
