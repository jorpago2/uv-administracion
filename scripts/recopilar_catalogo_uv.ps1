param(
    [string]$Salida = (Join-Path $PSScriptRoot "..\catalogos\uv_reglamentos.csv")
)

$ErrorActionPreference = "Stop"

$paginasIniciales = @(
    "https://www.uv.es/uvweb/registro-general/es/reglamentos-uv/secretaria-gral-/reglamentos-1285894353407.html"
)

function Convertir-HtmlATexto {
    param([string]$Html)

    $texto = $Html -replace "<br\s*/?>", " "
    $texto = $texto -replace "</p>", " "
    $texto = $texto -replace "<[^>]+>", " "
    $texto = [System.Net.WebUtility]::HtmlDecode($texto)
    return ($texto -replace "\s+", " ").Trim()
}

function Resolver-Url {
    param(
        [string]$Base,
        [string]$Href
    )

    if ([string]::IsNullOrWhiteSpace($Href)) {
        return ""
    }
    $urlAbsoluta = ([Uri]::new([Uri]$Base, $Href)).AbsoluteUri
    if ($urlAbsoluta -match "^http://(?:www\.)?(?:dogv|docv)\.gva\.es/") {
        $urlAbsoluta = $urlAbsoluta -replace "^http://", "https://"
    }
    $urlAbsoluta = $urlAbsoluta.Replace("https://www.dogv.gva.es/", "https://dogv.gva.es/")
    $urlAbsoluta = $urlAbsoluta.Replace("https://www.docv.gva.es/", "https://docv.gva.es/")
    return $urlAbsoluta
}

$cola = [System.Collections.Generic.Queue[string]]::new()
$paginasIniciales | ForEach-Object { $cola.Enqueue($_) }
$visitadas = @{}
$registros = [System.Collections.Generic.List[object]]::new()

while ($cola.Count -gt 0) {
    $urlPagina = $cola.Dequeue()
    if ($visitadas.ContainsKey($urlPagina)) {
        continue
    }
    $visitadas[$urlPagina] = $true

    Write-Host "Procesando $urlPagina"
    $respuesta = Invoke-WebRequest -Uri $urlPagina -UseBasicParsing -TimeoutSec 45

    foreach ($enlace in $respuesta.Links.href) {
        $urlEnlace = Resolver-Url -Base $urlPagina -Href $enlace
        if ($urlEnlace -match "^https://www\.uv\.es/uvweb/registro-general/es/reglamentos-uv/.+\.html(?:\?.*)?$") {
            $urlLimpia = $urlEnlace.Split("?")[0]
            if (-not $visitadas.ContainsKey($urlLimpia)) {
                $cola.Enqueue($urlLimpia)
            }
        }
    }

    $categoria = if ($urlPagina -match "/reglamentos-uv/([^/]+)/") { $Matches[1] } else { "sin_categoria" }
    $filas = [regex]::Matches($respuesta.Content, "<tr[^>]*>(.*?)</tr>", "Singleline,IgnoreCase")

    foreach ($fila in $filas) {
        $celdas = [regex]::Matches($fila.Groups[1].Value, "<td[^>]*>(.*?)</td>", "Singleline,IgnoreCase")
        if ($celdas.Count -lt 2) {
            continue
        }

        $referencia = Convertir-HtmlATexto $celdas[0].Groups[1].Value
        $titulo = Convertir-HtmlATexto $celdas[1].Groups[1].Value
        if ([string]::IsNullOrWhiteSpace($referencia) -and [string]::IsNullOrWhiteSpace($titulo)) {
            continue
        }

        $documentos = if ($celdas.Count -ge 3) {
            [regex]::Matches($celdas[2].Groups[1].Value, '<a[^>]+href=["'']([^"'']+)["''][^>]*>(.*?)</a>', "Singleline,IgnoreCase")
        } else {
            @()
        }

        if ($documentos.Count -eq 0) {
            $registros.Add([pscustomobject]@{
                ambito = "UV"
                categoria = $categoria
                referencia = $referencia
                titulo = $titulo
                etiqueta_documento = ""
                url_documento = ""
                url_catalogo = $urlPagina
                fecha_consulta = (Get-Date -Format "yyyy-MM-dd")
            })
            continue
        }

        foreach ($documento in $documentos) {
            $registros.Add([pscustomobject]@{
                ambito = "UV"
                categoria = $categoria
                referencia = $referencia
                titulo = $titulo
                etiqueta_documento = Convertir-HtmlATexto $documento.Groups[2].Value
                url_documento = Resolver-Url -Base $urlPagina -Href ([System.Net.WebUtility]::HtmlDecode($documento.Groups[1].Value))
                url_catalogo = $urlPagina
                fecha_consulta = (Get-Date -Format "yyyy-MM-dd")
            })
        }
    }
}

$carpetaSalida = Split-Path -Parent $Salida
New-Item -ItemType Directory -Force -Path $carpetaSalida | Out-Null

$registros |
    Sort-Object categoria, referencia, titulo, url_documento -Unique |
    Export-Csv -Path $Salida -NoTypeInformation -Encoding UTF8

Write-Host ("Páginas procesadas: {0}" -f $visitadas.Count)
Write-Host ("Registros exportados: {0}" -f $registros.Count)
Write-Host ("Salida: {0}" -f (Resolve-Path $Salida))
