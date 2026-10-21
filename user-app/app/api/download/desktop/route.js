import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const GITHUB_OWNER = 'badnur'
const GITHUB_REPO = 'QuickInk'
const CURRENT_VERSION = '1.2.4'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format')
  const requestedType = (searchParams.get('type') || '').toLowerCase() // 'zip' | 'exe' | ''

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
      
      let targetRelease = null
      let exeAsset = null
      let zipAsset = null

      for (const r of releases || []) {
        const assets = r.assets || []
        const foundExe = assets.find((a) => a.name.toLowerCase().endsWith('.exe'))
        const foundZip = assets.find((a) => a.name.toLowerCase().endsWith('.zip'))

        if (foundExe || foundZip) {
          targetRelease = r
          exeAsset = foundExe
          zipAsset = foundZip
          break
        }
      }

      if (format === 'json') {
        return NextResponse.json({
          version: targetRelease?.tag_name || `v${CURRENT_VERSION}`,
          publishedAt: targetRelease?.published_at,
          zip: zipAsset ? {
            fileName: zipAsset.name,
            sizeMB: (zipAsset.size / (1024 * 1024)).toFixed(1),
            downloadUrl: zipAsset.browser_download_url
          } : {
            fileName: `PrintKoro-Station-Setup-${CURRENT_VERSION}.zip`,
            downloadUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest/download/PrintKoro-Station-Setup-${CURRENT_VERSION}.zip`
          },
          exe: exeAsset ? {
            fileName: exeAsset.name,
            sizeMB: (exeAsset.size / (1024 * 1024)).toFixed(1),
            downloadUrl: exeAsset.browser_download_url
          } : {
            fileName: `PrintKoro-Station-Setup-${CURRENT_VERSION}.exe`,
            downloadUrl: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest/download/PrintKoro-Station-Setup-${CURRENT_VERSION}.exe`
          }
        })
      }

      // Choose which asset to deliver
      let selectedAsset = null
      if (requestedType === 'exe') {
        selectedAsset = exeAsset || zipAsset
      } else if (requestedType === 'zip') {
        selectedAsset = zipAsset || exeAsset
      } else {
        // Default: prefer zip to eliminate SmartScreen block warnings
        selectedAsset = zipAsset || exeAsset
      }

      if (selectedAsset) {
        // Attempt fast CDN direct attachment redirect
        try {
          const assetRes = await fetch(selectedAsset.url, {
            headers: {
              'Accept': 'application/octet-stream',
              'User-Agent': 'QuickInk-Website-Download'
            },
            redirect: 'manual'
          })

          const cdnLocation = assetRes.headers.get('location')
          if (cdnLocation) {
            return NextResponse.redirect(cdnLocation, 302)
          }
        } catch (cdnErr) {
          console.warn('[Desktop Download] Direct CDN resolve warning:', cdnErr.message)
        }

        return NextResponse.redirect(selectedAsset.browser_download_url, 302)
      }
    }
  } catch (err) {
    console.error('[Desktop Download] Error resolving release:', err.message)
  }

  // Fallback direct URL based on requested type
  const ext = requestedType === 'exe' ? 'exe' : 'zip'
  return NextResponse.redirect(
    `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest/download/PrintKoro-Station-Setup-${CURRENT_VERSION}.${ext}`,
    302
  )
}
