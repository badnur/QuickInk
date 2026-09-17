import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const GITHUB_OWNER = 'badnur'
const GITHUB_REPO = 'QuickInk'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format')

  try {
    // 1. Fetch releases from GitHub API
    const res = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'QuickInk-Website-Download'
      },
      cache: 'no-store'
    })

    if (res.ok) {
      const releases = await res.json()
      
      // Find the first release that has a Windows .exe installer
      let exeAsset = null
      let targetRelease = null

      for (const r of releases || []) {
        const found = (r.assets || []).find((a) => a.name.toLowerCase().endsWith('.exe'))
        if (found) {
          exeAsset = found
          targetRelease = r
          break
        }
      }

      if (exeAsset) {
        if (format === 'json') {
          return NextResponse.json({
            version: targetRelease.tag_name,
            fileName: exeAsset.name,
            sizeBytes: exeAsset.size,
            sizeMB: (exeAsset.size / (1024 * 1024)).toFixed(1),
            publishedAt: targetRelease.published_at,
            downloadUrl: exeAsset.browser_download_url
          })
        }

        // 2. Resolve direct CDN URL via asset API endpoint
        // GitHub redirects asset.url -> release-assets.githubusercontent.com (Direct File Download)
        try {
          const assetRes = await fetch(exeAsset.url, {
            headers: {
              'Accept': 'application/octet-stream',
              'User-Agent': 'QuickInk-Website-Download'
            },
            redirect: 'manual'
          })

          const cdnLocation = assetRes.headers.get('location')
          if (cdnLocation) {
            // Direct 1-click download attachment via CDN
            return NextResponse.redirect(cdnLocation, 302)
          }
        } catch (cdnErr) {
          console.warn('[Desktop Download] Direct CDN resolve warning:', cdnErr.message)
        }

        // Fallback to browser_download_url
        return NextResponse.redirect(exeAsset.browser_download_url, 302)
      }
    }
  } catch (err) {
    console.error('[Desktop Download] Error resolving release:', err.message)
  }

  // Fallback direct URL
  return NextResponse.redirect(
    `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest/download/QuickInk-Station-Setup-1.0.0.exe`,
    302
  )
}
