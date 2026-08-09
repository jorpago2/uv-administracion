[CmdletBinding()]
param(
    [string]$Source,
    [string]$Output
)

$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($Source)) {
    $Source = Join-Path $PSScriptRoot '..\MANUAL_PROCEDIMIENTOS.md'
}
if ([string]::IsNullOrWhiteSpace($Output)) {
    $Output = Join-Path $PSScriptRoot '..\web\data\manual.json'
}
$sourcePath = [System.IO.Path]::GetFullPath($Source)
$outputPath = [System.IO.Path]::GetFullPath($Output)

if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
    throw "No existe el manual de origen: $sourcePath"
}

$markdown = Get-Content -LiteralPath $sourcePath -Raw -Encoding utf8
if ([string]::IsNullOrWhiteSpace($markdown)) {
    throw 'El manual de origen está vacío.'
}

$metadata = [ordered]@{}
$frontMatterPattern = '(?s)\A---\r?\n(?<frontMatter>.*?)\r?\n---\r?\n'
$frontMatterMatch = [regex]::Match($markdown, $frontMatterPattern)
if ($frontMatterMatch.Success) {
    foreach ($line in ($frontMatterMatch.Groups['frontMatter'].Value -split '\r?\n')) {
        if ($line -match '^\s*(?<key>[A-Za-z0-9_]+)\s*:\s*"?(?<value>.*?)"?\s*$') {
            $metadata[$Matches['key']] = $Matches['value'].Trim('"')
        }
    }
    $markdown = $markdown.Substring($frontMatterMatch.Length)
}

$outputDirectory = Split-Path -Parent $outputPath
if (-not (Test-Path -LiteralPath $outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory | Out-Null
}

$payload = [ordered]@{
    schemaVersion = 1
    generatedAt = (Get-Date).ToString('o')
    source = 'MANUAL_PROCEDIMIENTOS.md'
    meta = $metadata
    markdown = $markdown.Trim()
}

$json = $payload | ConvertTo-Json -Depth 6
$utf8WithoutBom = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText($outputPath, $json, $utf8WithoutBom)

$webRoot = Split-Path -Parent (Split-Path -Parent $outputPath)
$publicRoot = Join-Path $webRoot 'public'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$publicCatalogs = Join-Path $publicRoot 'catalogos'
New-Item -ItemType Directory -Path $publicCatalogs -Force | Out-Null
Copy-Item -LiteralPath $sourcePath -Destination (Join-Path $publicRoot 'MANUAL_PROCEDIMIENTOS.md') -Force
Copy-Item -LiteralPath (Join-Path $repositoryRoot 'ALERTAS.md') -Destination (Join-Path $publicRoot 'ALERTAS.md') -Force
Copy-Item -LiteralPath (Join-Path $repositoryRoot 'README.md') -Destination (Join-Path $publicRoot 'REPOSITORIO.md') -Force
Get-ChildItem -LiteralPath (Join-Path $repositoryRoot 'catalogos') -Filter '*.csv' -File | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $publicCatalogs $_.Name) -Force
}

$sectionCount = ([regex]::Matches($markdown, '(?m)^##\s+\d+\.\s+')).Count

& node (Join-Path $PSScriptRoot 'generar_glosario.mjs')
if ($LASTEXITCODE -ne 0) {
    throw 'No se pudo generar el glosario Markdown.'
}

Write-Host "Generado: $outputPath"
Write-Host "Capítulos detectados: $sectionCount"
