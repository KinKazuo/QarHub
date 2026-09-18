$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
$qarForm = New-Object System.Windows.Forms.Form
$qarForm.Text = 'QarHub — подключить ngrok'
$qarForm.Size = New-Object System.Drawing.Size(570, 270)
$qarForm.StartPosition = 'CenterScreen'
$qarForm.FormBorderStyle = 'FixedDialog'
$qarForm.MaximizeBox = $false
$qarLabel = New-Object System.Windows.Forms.Label
$qarLabel.Text = "Войди в dashboard.ngrok.com/get-started/your-authtoken.`r`nСкопируй только Authtoken и вставь его ниже.`r`nТокен сохранится локально, вне проекта и GitHub."
$qarLabel.Location = New-Object System.Drawing.Point(20, 20)
$qarLabel.Size = New-Object System.Drawing.Size(520, 65)
$qarForm.Controls.Add($qarLabel)
$qarInput = New-Object System.Windows.Forms.TextBox
$qarInput.UseSystemPasswordChar = $true
$qarInput.Location = New-Object System.Drawing.Point(20, 95)
$qarInput.Size = New-Object System.Drawing.Size(510, 28)
$qarForm.Controls.Add($qarInput)
$qarStatus = New-Object System.Windows.Forms.Label
$qarStatus.Location = New-Object System.Drawing.Point(20, 132)
$qarStatus.Size = New-Object System.Drawing.Size(510, 30)
$qarForm.Controls.Add($qarStatus)
$qarSave = New-Object System.Windows.Forms.Button
$qarSave.Text = 'Подключить'
$qarSave.Location = New-Object System.Drawing.Point(390, 175)
$qarSave.Size = New-Object System.Drawing.Size(140, 35)
$qarSave.Add_Click({
  $qarToken = $qarInput.Text.Trim()
  if ($qarToken -notmatch '^[A-Za-z0-9_]{20,200}$') { $qarStatus.Text = 'Вставь только токен, без команды и кавычек.'; return }
  try {
    $qarConfigDir = Join-Path $env:LOCALAPPDATA 'QarHub'
    [IO.Directory]::CreateDirectory($qarConfigDir) | Out-Null
    $qarConfigFile = Join-Path $qarConfigDir 'ngrok.yml'
    $qarYaml = "version: '3'`nagent:`n  authtoken: $qarToken`n  web_addr: 127.0.0.1:4047`n  console_ui: false`n  remote_management: false`n"
    [IO.File]::WriteAllText($qarConfigFile, $qarYaml, (New-Object Text.UTF8Encoding($false)))
    $qarInput.Clear()
    $qarToken = $null
    $qarYaml = $null
    $qarForm.DialogResult = [System.Windows.Forms.DialogResult]::OK
    $qarForm.Close()
  } catch { $qarStatus.Text = 'Не удалось сохранить настройки. Попробуй ещё раз.' }
})
$qarForm.Controls.Add($qarSave)
$qarForm.AcceptButton = $qarSave
$qarForm.Add_Shown({ $qarInput.Focus() })
[void]$qarForm.ShowDialog()
$qarForm.Dispose()
