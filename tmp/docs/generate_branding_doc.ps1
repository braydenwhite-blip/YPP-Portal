$ErrorActionPreference = "Stop"

function Get-HexColorFromValue {
  param([string]$Value)
  $v = $Value.Trim()
  if ($v -match "^#(?<hex>[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$") {
    $hex = $Matches["hex"].ToLowerInvariant()
    if ($hex.Length -eq 3) {
      $r = $hex.Substring(0, 1); $g = $hex.Substring(1, 1); $b = $hex.Substring(2, 1)
      return "#$r$r$g$g$b$b"
    }
    if ($hex.Length -eq 8) { return "#$($hex.Substring(0,6))" } # drop alpha
    return "#$hex"
  }
  return $null
}

function Convert-HexToWdColor {
  param([string]$Hex)
  $h = $Hex.TrimStart("#")
  $r = [Convert]::ToInt32($h.Substring(0, 2), 16)
  $g = [Convert]::ToInt32($h.Substring(2, 2), 16)
  $b = [Convert]::ToInt32($h.Substring(4, 2), 16)
  # Word WdColor is 0x00BBGGRR (BGR)
  return ($b * 65536) + ($g * 256) + $r
}

function Extract-CssRootVars {
  param([string]$CssText)
  $rootMatch = [regex]::Match($CssText, ":root\s*\{(?<body>[\s\S]*?)\n\}", [System.Text.RegularExpressions.RegexOptions]::Multiline)
  if (-not $rootMatch.Success) { return @() }

  $body = $rootMatch.Groups["body"].Value
  $vars = New-Object System.Collections.Generic.List[object]
  $re = [regex]"--(?<name>[a-zA-Z0-9_-]+)\s*:\s*(?<value>[^;]+);"
  foreach ($m in $re.Matches($body)) {
    $vars.Add([pscustomobject]@{
      Name = "--$($m.Groups["name"].Value)"
      Value = $m.Groups["value"].Value.Trim()
      Hex = (Get-HexColorFromValue -Value $m.Groups["value"].Value)
    })
  }
  return $vars
}

function Extract-SeasonalColors {
  param([string]$TsxText)
  $items = New-Object System.Collections.Generic.List[object]
  $re = [regex]'(?<season>SPRING|SUMMER|FALL|WINTER):\s*\{\s*[\s\S]*?color:\s*"(?<c1>#[0-9a-fA-F]{3,8})"\s*,\s*color2:\s*"(?<c2>#[0-9a-fA-F]{3,8})"'
  foreach ($m in $re.Matches($TsxText)) {
    $items.Add([pscustomobject]@{
      Season = $m.Groups["season"].Value
      Color1 = (Get-HexColorFromValue -Value $m.Groups["c1"].Value)
      Color2 = (Get-HexColorFromValue -Value $m.Groups["c2"].Value)
    })
  }
  return $items
}

function Extract-BrandLockup {
  param([string]$TsxText)
  $title = ([regex]::Match($TsxText, 'portal-brand-title"[^>]*>(?<t>[^<]+)<')).Groups["t"].Value.Trim()
  $tagline = ([regex]::Match($TsxText, 'portal-brand-tagline"[^>]*>(?<t>[^<]+)<')).Groups["t"].Value.Trim()
  $mark = ([regex]::Match($TsxText, 'src="(?<src>/[^"]+)"')).Groups["src"].Value.Trim()
  return [pscustomobject]@{
    Title = $title
    Tagline = $tagline
    MarkPath = $mark
  }
}

function Extract-LayoutMeta {
  param([string]$TsxText)
  $theme = ([regex]::Match($TsxText, 'themeColor:\s*"(?<c>#[0-9a-fA-F]{3,8})"')).Groups["c"].Value.Trim()
  $title = ([regex]::Match($TsxText, 'title:\s*"(?<t>[^"]+)"')).Groups["t"].Value.Trim()
  $desc = ([regex]::Match($TsxText, 'description:\s*"(?<d>[^"]+)"')).Groups["d"].Value.Trim()
  return [pscustomobject]@{
    Title = $title
    Description = $desc
    ThemeColor = (Get-HexColorFromValue -Value $theme)
    Fonts = @("DM Sans", "Playfair Display", "Nunito", "Lora")
  }
}

function Add-Heading {
  param($Selection, [string]$Text, [int]$Level = 1)
  $Selection.Style = "Heading $Level"
  $Selection.TypeText($Text)
  $Selection.TypeParagraph()
  $Selection.Style = "Normal"
}

function Add-Paragraph {
  param($Selection, [string]$Text)
  $Selection.Style = "Normal"
  $Selection.TypeText($Text)
  $Selection.TypeParagraph()
}

function Add-TableWithColorSwatches {
  param(
    $Doc,
    $Selection,
    [string]$Title,
    [object[]]$Rows,
    [string]$Col1Header,
    [string]$Col2Header
  )
  Add-Heading -Selection $Selection -Text $Title -Level 2

  $table = $Doc.Tables.Add($Selection.Range, $Rows.Count + 1, 3)
  $table.Style = "Table Grid"
  $table.Rows(1).Range.Bold = $true
  $table.Cell(1, 1).Range.Text = $Col1Header
  $table.Cell(1, 2).Range.Text = $Col2Header
  $table.Cell(1, 3).Range.Text = "Preview"

  for ($i = 0; $i -lt $Rows.Count; $i++) {
    $r = $i + 2
    $table.Cell($r, 1).Range.Text = [string]$Rows[$i].Key
    $table.Cell($r, 2).Range.Text = [string]$Rows[$i].Value
    $hex = $Rows[$i].Hex
    if ($null -ne $hex) {
      $wdColor = Convert-HexToWdColor -Hex $hex
      $table.Cell($r, 3).Shading.BackgroundPatternColor = $wdColor
      $table.Cell($r, 3).Range.Text = $hex
      $table.Cell($r, 3).Range.Font.Color = 0xFFFFFF
    } else {
      $table.Cell($r, 3).Range.Text = ""
    }
  }

  $Selection.MoveDown() | Out-Null
  $Selection.TypeParagraph()
}

$root = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $root # .../tmp/docs -> repo root

$globalsCssPath = Join-Path $repoRoot "app\globals.css"
$layoutPath = Join-Path $repoRoot "app\layout.tsx"
$brandLockupPath = Join-Path $repoRoot "components\brand-lockup.tsx"
$seasonalThemePath = Join-Path $repoRoot "components\world\scene\seasonal-theme.tsx"
$outPath = Join-Path $repoRoot "output\doc\YPP-Portal-Branding-Reference.docx"

$globalsCss = Get-Content -Raw -Path $globalsCssPath -Encoding UTF8
$layoutTsx = Get-Content -Raw -Path $layoutPath -Encoding UTF8
$brandTsx = Get-Content -Raw -Path $brandLockupPath -Encoding UTF8
$seasonalTsx = Get-Content -Raw -Path $seasonalThemePath -Encoding UTF8

$vars = Extract-CssRootVars -CssText $globalsCss
$layout = Extract-LayoutMeta -TsxText $layoutTsx
$brand = Extract-BrandLockup -TsxText $brandTsx
$seasons = Extract-SeasonalColors -TsxText $seasonalTsx

$word = $null
$doc = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $doc = $word.Documents.Add()
  $sel = $word.Selection

  # Title page-ish
  $sel.Style = "Title"
  $sel.TypeText("Branding Reference - YPP Pathways Portal")
  $sel.TypeParagraph()
  $sel.Style = "Subtitle"
  $sel.TypeText((Get-Date).ToString("yyyy-MM-dd"))
  $sel.TypeParagraph()
  $sel.Style = "Normal"
  $sel.TypeParagraph()

  Add-Heading -Selection $sel -Text "Brand identity" -Level 1
  Add-Paragraph -Selection $sel -Text ("Product title: " + $layout.Title)
  Add-Paragraph -Selection $sel -Text ("Description: " + $layout.Description)
  Add-Paragraph -Selection $sel -Text ("Lockup title text: " + $brand.Title)
  Add-Paragraph -Selection $sel -Text ("Tagline: " + $brand.Tagline)
  Add-Paragraph -Selection $sel -Text ("Logo mark path (expected): " + $brand.MarkPath)
  Add-Paragraph -Selection $sel -Text ("Icon paths (expected): /favicon.ico, /logo.png")
  $sel.TypeParagraph()

  Add-Heading -Selection $sel -Text "Typography" -Level 1
  Add-Paragraph -Selection $sel -Text ("Fonts (from app layout): " + ($layout.Fonts -join ", "))
  Add-Paragraph -Selection $sel -Text "CSS uses variables: --font-dm-sans, --font-playfair, --font-nunito, --font-lora"
  $sel.TypeParagraph()

  Add-Heading -Selection $sel -Text "Colors" -Level 1
  Add-Paragraph -Selection $sel -Text ("Theme color (viewport): " + $layout.ThemeColor)
  $sel.TypeParagraph()

  function Select-VarsByPrefix {
    param([string]$Prefix)
    return $vars | Where-Object { $_.Name.StartsWith($Prefix) }
  }

  function Map-VarsToRows {
    param([object[]]$Items)
    $rows = New-Object System.Collections.Generic.List[object]
    foreach ($i in $Items) {
      $rows.Add([pscustomobject]@{ Key = $i.Name; Value = $i.Value; Hex = $i.Hex })
    }
    return $rows.ToArray()
  }

  Add-TableWithColorSwatches -Doc $doc -Selection $sel -Title "Brand palette (purple scale)" -Rows (Map-VarsToRows (Select-VarsByPrefix "--ypp-purple-")) -Col1Header "Token" -Col2Header "Value"
  Add-TableWithColorSwatches -Doc $doc -Selection $sel -Title "Brand palette (nav purple)" -Rows (Map-VarsToRows (Select-VarsByPrefix "--nav-purple-")) -Col1Header "Token" -Col2Header "Value"
  Add-TableWithColorSwatches -Doc $doc -Selection $sel -Title "Brand palette (ypp core tokens)" -Rows (Map-VarsToRows ($vars | Where-Object { $_.Name -in @("--ypp-deep","--ypp-primary-brand","--ypp-mid","--ypp-light-brand","--ypp-lavender","--ypp-blush","--ypp-ink","--ypp-muted-brand","--ypp-pathways","--ypp-global","--ypp-white") })) -Col1Header "Token" -Col2Header "Value"
  Add-TableWithColorSwatches -Doc $doc -Selection $sel -Title "Accent aliases" -Rows (Map-VarsToRows ($vars | Where-Object { $_.Name -in @("--accent","--accent-2","--accent-3","--focus-ring","--border","--border-light","--bg","--bg-2","--surface","--text","--muted") })) -Col1Header "Token" -Col2Header "Value"
  Add-TableWithColorSwatches -Doc $doc -Selection $sel -Title "Status / progress colors" -Rows (Map-VarsToRows (Select-VarsByPrefix "--progress-")) -Col1Header "Token" -Col2Header "Value"
  Add-TableWithColorSwatches -Doc $doc -Selection $sel -Title "Neutral grays" -Rows (Map-VarsToRows (Select-VarsByPrefix "--gray-")) -Col1Header "Token" -Col2Header "Value"

  Add-Heading -Selection $sel -Text "World / seasonal accent colors" -Level 1
  if ($seasons.Count -gt 0) {
    $rows = New-Object System.Collections.Generic.List[object]
    foreach ($s in $seasons) {
      $rows.Add([pscustomobject]@{ Key = "$($s.Season) color"; Value = $s.Color1; Hex = $s.Color1 })
      $rows.Add([pscustomobject]@{ Key = "$($s.Season) color2"; Value = $s.Color2; Hex = $s.Color2 })
    }
    Add-TableWithColorSwatches -Doc $doc -Selection $sel -Title "Seasonal particle colors" -Rows $rows.ToArray() -Col1Header "Context" -Col2Header "Hex"
  } else {
    Add-Paragraph -Selection $sel -Text "No seasonal colors detected."
  }

  Add-Heading -Selection $sel -Text "Notes / gaps" -Level 1
  Add-Paragraph -Selection $sel -Text "This repo references image assets at /ypp-logo-mark.png, /favicon.ico, and /logo.png. Those files were not found in this checkout, so the paths are documented as expected locations."

  $doc.SaveAs([string]$outPath)
  Write-Host "Wrote $outPath"
}
finally {
  if ($null -ne $doc) { try { $doc.Close($false) } catch {} }
  if ($null -ne $word) { try { $word.Quit() } catch {} }
}

