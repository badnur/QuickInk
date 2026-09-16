import PrintOrderPage from '../page'

export default async function DevicePrintPage({ params }) {
  const resolvedParams = await params
  const deviceId = resolvedParams?.deviceId

  return <PrintOrderPage initialDeviceId={deviceId} />
}
