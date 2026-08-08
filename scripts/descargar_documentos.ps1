param(
    [Parameter(Mandatory = $true)]
    [string]$Catalogo,

    [Parameter(Mandatory = $true)]
    [string]$Destino,

    [Parameter(Mandatory = $true)]
    [string]$Inventario,

    [string]$ColumnaUrl = "url_pdf",
    [string]$ColumnaCategoria = "nivel",
    [string]$ColumnaReferencia = "referencia",
    [string]$ColumnaTitulo = "titulo",
    [switch]$SoloPdf,
    [switch]$ForzarPdf
)

$ErrorActionPreference = "Stop"

function Convertir-Slug {
    param(
        [string]$Texto,
        [int]$LongitudMaxima = 90
    )

    if ([string]::IsNullOrWhiteSpace($Texto)) {
        return "documento"
    }

    $normalizado = $Texto.Normalize([Text.NormalizationForm]::FormD)
    $sinDiacriticos = -join ($normalizado.ToCharArray() | Where-Object {
        [Globalization.CharUnicodeInfo]::GetUnicodeCategory($_) -ne [Globalization.UnicodeCategory]::NonSpacingMark
    })
    $slug = $sinDiacriticos -replace "[^A-Za-z0-9._-]+", "_"
    $slug = $slug.Trim("_", ".")
    if ($slug.Length -gt $LongitudMaxima) {
        $slug = $slug.Substring(0, $LongitudMaxima).TrimEnd("_", ".")
    }
    return $slug
}

function Obtener-Extension {
    param([string]$Url)

    if ($ForzarPdf) {
        return ".pdf"
    }

    try {
        $extension = [IO.Path]::GetExtension(([Uri]$Url).AbsolutePath)
    } catch {
        $extension = ""
    }
    if ([string]::IsNullOrWhiteSpace($extension) -or $extension.Length -gt 8) {
        return ".pdf"
    }
    return $extension.ToLowerInvariant()
}

$rutaCatalogo = (Resolve-Path $Catalogo).Path
$registros = Import-Csv $rutaCatalogo
$documentos = $registros | Where-Object {
    $url = $_.$ColumnaUrl
    -not [string]::IsNullOrWhiteSpace($url) -and
        (-not $SoloPdf -or $ForzarPdf -or $url -match "\.pdf(?:$|\?)")
} | Group-Object $ColumnaUrl | ForEach-Object { $_.Group[0] }

New-Item -ItemType Directory -Force -Path $Destino | Out-Null
$resultados = [System.Collections.Generic.List[object]]::new()
$contador = 0

foreach ($registro in $documentos) {
    $contador++
    $url = $registro.$ColumnaUrl
    $categoria = Convertir-Slug $registro.$ColumnaCategoria 50
    $referencia = Convertir-Slug $registro.$ColumnaReferencia 45
    $titulo = Convertir-Slug $registro.$ColumnaTitulo 65
    $extension = Obtener-Extension $url
    $hashUrl = [BitConverter]::ToString(
        [Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($url))
    ).Replace("-", "").Substring(0, 10).ToLowerInvariant()

    $carpetaCategoria = Join-Path $Destino $categoria
    New-Item -ItemType Directory -Force -Path $carpetaCategoria | Out-Null
    $nombreArchivo = "{0}_{1}_{2}{3}" -f $referencia, $titulo, $hashUrl, $extension
    $rutaArchivo = Join-Path $carpetaCategoria $nombreArchivo
    $estado = "descargado"
    $errorDescarga = ""
    $sha256 = ""
    $tamano = 0

    Write-Host ("[{0}/{1}] {2}" -f $contador, $documentos.Count, $url)

    try {
        if (-not (Test-Path -LiteralPath $rutaArchivo)) {
            Invoke-WebRequest -Uri $url -UseBasicParsing -OutFile $rutaArchivo -TimeoutSec 90
        } else {
            $estado = "ya_existia"
        }

        $archivo = Get-Item -LiteralPath $rutaArchivo
        $tamano = $archivo.Length
        if ($tamano -eq 0) {
            throw "El archivo descargado está vacío"
        }

        if ($extension -eq ".pdf") {
            $cabecera = [IO.File]::ReadAllBytes($rutaArchivo)[0..3]
            $firma = [Text.Encoding]::ASCII.GetString($cabecera)
            if ($firma -ne "%PDF") {
                throw "La respuesta no contiene un PDF válido (firma: $firma)"
            }
        }

        $sha256 = (Get-FileHash -LiteralPath $rutaArchivo -Algorithm SHA256).Hash.ToLowerInvariant()
    } catch {
        $estado = "error"
        $errorDescarga = $_.Exception.Message
        if (Test-Path -LiteralPath $rutaArchivo) {
            Remove-Item -LiteralPath $rutaArchivo -Force
        }
    }

    $resultados.Add([pscustomobject]@{
        categoria = $registro.$ColumnaCategoria
        referencia = $registro.$ColumnaReferencia
        titulo = $registro.$ColumnaTitulo
        url = $url
        estado = $estado
        ruta_local = if ($estado -ne "error") { $rutaArchivo } else { "" }
        bytes = $tamano
        sha256 = $sha256
        error = $errorDescarga
        fecha_descarga = Get-Date -Format "yyyy-MM-ddTHH:mm:ssK"
    })
}

$carpetaInventario = Split-Path -Parent $Inventario
New-Item -ItemType Directory -Force -Path $carpetaInventario | Out-Null
$resultados | Export-Csv -Path $Inventario -NoTypeInformation -Encoding UTF8

Write-Host ("Documentos procesados: {0}" -f $resultados.Count)
Write-Host ("Descargas correctas: {0}" -f ($resultados | Where-Object { $_.estado -ne "error" }).Count)
Write-Host ("Errores: {0}" -f ($resultados | Where-Object { $_.estado -eq "error" }).Count)
