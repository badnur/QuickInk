import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const GITHUB_OWNER = 'badnur'
const GITHUB_REPO = 'QuickInk'
const LATEST_RELEASE_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`
const FALLBACK_DOWNLOAD_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest/download/QuickInk-Station-Setup.exe`

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format')

  try {
    const res = await fetch(LATEST_RELEASE_API, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'QuickInk-App-Download'
      },
      next: { revalidate: 60 } // Cache for 60 seconds
    })

    if (res.ok) {
      const release = await res.json()
      // Find .exe asset
      const exeAsset = release.assets?.find((a) => a.name.endsWith('.exe'))
      const downloadUrl = exeAsset?.browser_download_url || FALLBACK_DOWNLOAD_URL

      if (format === 'json') {
        return NextResponse.json({
          version: release.tag_name,
          name: release.name,
          downloadUrl,
          publishedAt: release.published_at,
          notes: release.body
        })
      }

      return NextResponse.redirect(downloadUrl, 302)
    }
  } catch (err) {
    console.warn('[Desktop Download API] Could not fetch GitHub release:', err.message)
  }

  // Fallback direct redirect
  return NextResponse.redirect(FALLBACK_DOWNLOAD_URL, 302)
}
