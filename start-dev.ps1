:PATH = 'C:\Program Files\nodejs;' + [System.Environment]::GetEnvironmentVariable('PATH','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('PATH','User')
Set-Location C:\Users\PC\ab-eduflow
npm run dev
