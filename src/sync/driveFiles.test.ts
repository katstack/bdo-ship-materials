import { afterEach, describe, expect, it, vi } from 'vitest'
import { freshSample } from '../storage'
import { DriveRequestError, getDriveFile, saveDriveFile } from './driveFiles'

afterEach(() => vi.unstubAllGlobals())
describe('Drive appData file boundary', () => {
  it('looks only in appDataFolder and accepts an empty result', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ files: [] }))
    vi.stubGlobal('fetch', fetcher)
    expect(await getDriveFile('token')).toBeNull()
    expect(new URL(String(fetcher.mock.calls[0][0])).searchParams.get('spaces')).toBe(
      'appDataFolder',
    )
  })
  it.each([null, {}, { files: 'bad' }, { files: [{}] }])(
    'rejects malformed file lists: %j',
    async (body) => {
      vi.stubGlobal('fetch', async () => Response.json(body))
      await expect(getDriveFile('token')).rejects.toThrow('응답')
    },
  )
  it('exposes HTTP status without leaking a Google error response', async () => {
    vi.stubGlobal('fetch', async () => new Response('private details', { status: 401 }))
    await expect(getDriveFile('token')).rejects.toBeInstanceOf(DriveRequestError)
    await expect(getDriveFile('token')).rejects.toMatchObject({ status: 401 })
    await expect(getDriveFile('token')).rejects.not.toThrow('private details')
  })
  it('creates only the app-specific backup and validates its returned id', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => Response.json({ id: 'file' }))
    vi.stubGlobal('fetch', fetcher)
    expect(await saveDriveFile('token', freshSample())).toEqual({ id: 'file' })
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: 'POST' })
    expect(fetcher.mock.calls[0][1]?.body).toContain('appDataFolder')
    expect(fetcher.mock.calls[0][1]?.body).toContain('bdo-ship-materials.json')
    vi.stubGlobal('fetch', async () => Response.json({ id: 42 }))
    await expect(saveDriveFile('token', freshSample(), 'file')).rejects.toThrow('응답')
  })
})
