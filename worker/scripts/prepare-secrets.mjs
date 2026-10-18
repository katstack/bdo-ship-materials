import { randomBytes } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const directory = join(homedir(), '.config', 'bdo-ship-auth')
const path = join(directory, 'secrets.json')
const args = process.argv.slice(2)
const prepareOnly = args.includes('--prepare-only')
const jsonIndex = args.indexOf('--client-json')

async function hiddenPrompt() {
  if (!process.stdin.isTTY) throw new Error('TTY_REQUIRED')
  process.stdout.write('Google Client Secret (입력 내용은 표시되지 않음): ')
  const wasRaw = process.stdin.isRaw
  process.stdin.setRawMode(true)
  process.stdin.resume()
  return new Promise((resolve, reject) => {
    let value = ''
    const finish = () => {
      process.stdin.off('data', input)
      process.stdin.setRawMode(Boolean(wasRaw))
      process.stdin.pause()
      process.stdout.write('\n')
    }
    const input = (bytes) => {
      for (const char of bytes.toString('utf8')) {
        if (char === '\u0003') {
          finish()
          reject(new Error('CANCELLED'))
          return
        }
        if (char === '\r' || char === '\n') {
          finish()
          resolve(value.trim())
          return
        }
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1)
        else if (char >= ' ') value += char
      }
    }
    process.stdin.on('data', input)
  })
}

try {
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  chmodSync(directory, 0o700)
  const secrets = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {}
  if (jsonIndex >= 0) {
    const client = JSON.parse(readFileSync(args[jsonIndex + 1], 'utf8')).web
    if (
      client?.client_id !==
      '865764819056-o9i2pcvdqeb1r94fms5e4v19v24hn1ma.apps.googleusercontent.com'
    )
      throw new Error('CLIENT_MISMATCH')
    secrets.GOOGLE_CLIENT_SECRET = client.client_secret
  } else if (!prepareOnly) {
    secrets.GOOGLE_CLIENT_SECRET = await hiddenPrompt()
  }
  if (!prepareOnly && typeof secrets.GOOGLE_CLIENT_SECRET !== 'string')
    throw new Error('INVALID_SECRET')
  if (!prepareOnly && secrets.GOOGLE_CLIENT_SECRET.length < 20) throw new Error('INVALID_SECRET')
  // Preserve the key forever across re-deploys. Re-generating it would strand encrypted credentials.
  secrets.TOKEN_ENCRYPTION_KEY ||= randomBytes(32).toString('base64url')
  if (!secrets.TURSO_AUTH_TOKEN) {
    const turso = join(homedir(), '.local', 'bin', 'turso')
    try {
      secrets.TURSO_AUTH_TOKEN = execFileSync(turso, ['db', 'tokens', 'create', 'bdo'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim()
    } catch {
      throw new Error('TURSO_TOKEN_FAILED')
    }
    if (!secrets.TURSO_AUTH_TOKEN) throw new Error('TURSO_TOKEN_FAILED')
  }
  writeFileSync(path, JSON.stringify(secrets, null, 2) + '\n', { mode: 0o600 })
  chmodSync(path, 0o600)
  console.log(`서버 전용 비밀 설정 저장 완료: ${path}`)
  console.log('값은 출력하지 않았습니다. 이 파일은 저장소 밖에 있으며 소유자만 읽을 수 있습니다.')
  if (prepareOnly)
    console.log(
      'Google Client Secret 입력 전입니다. 실제 배포 전에 이 명령을 --prepare-only 없이 실행하세요.',
    )
} catch (error) {
  const messages = {
    TTY_REQUIRED: '대화형 WSL 터미널에서 실행하거나 --client-json 경로를 지정하세요.',
    CLIENT_MISMATCH:
      'JSON의 OAuth Client ID가 앱과 다릅니다. 기존 웹 클라이언트 파일을 사용하세요.',
    INVALID_SECRET: 'Google Client Secret이 비어 있거나 올바르지 않습니다.',
    CANCELLED: '입력을 취소했습니다. 비밀 설정은 변경하지 않았습니다.',
    TURSO_TOKEN_FAILED: 'Turso 토큰 발급에 실패했습니다. CLI 로그인과 DB 상태를 확인하세요.',
  }
  console.error(
    messages[error.message] || '비밀 설정 준비에 실패했습니다. 경로와 파일 권한을 확인하세요.',
  )
  process.exitCode = 1
}
