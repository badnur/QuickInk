/**
 * PayStation Payment Gateway Integration for PrintKoro / QuickInk
 * Official PSO Payment Gateway in Bangladesh (MFS: bKash, Nagad, Rocket, Upay, Cards)
 */

let cachedToken = null
let tokenExpiry = 0

/**
 * Get config from environment variables
 */
function getConfig() {
  const storeId = process.env.PAYSTATION_STORE_ID || '6817-1790658194'
  const password = process.env.PAYSTATION_PASSWORD || 'ku6d@RY6x4y'
  const baseUrl = process.env.PAYSTATION_BASE_URL || 'https://api.paystation.com.bd'

  return { storeId, password, baseUrl }
}

/**
 * Obtain authorization Grant Token from PayStation
 */
export async function getPayStationToken() {
  const now = Date.now()
  if (cachedToken && tokenExpiry > now) {
    return cachedToken
  }

  const { storeId, password, baseUrl } = getConfig()

  const res = await fetch(`${baseUrl}/grant-token`, {
    method: 'POST',
    headers: {
      'merchantId': storeId,
      'password': password,
      'Content-Type': 'application/json'
    }
  })

  if (!res.ok) {
    throw new Error(`Failed to obtain PayStation grant token: HTTP ${res.status}`)
  }

  const data = await res.json()

  if (String(data?.status_code) !== '200' || !data?.token) {
    throw new Error(data?.message || 'Invalid PayStation merchant credentials.')
  }

  cachedToken = data.token
  // Token valid for 10 minutes, refresh at 8 minutes
  tokenExpiry = now + (8 * 60 * 1000)

  return cachedToken
}

/**
 * Create a new payment session on PayStation
 *
 * @param {Object} params
 * @param {string} params.invoiceNumber - Unique invoice ID (e.g. PK-PRINT-...)
 * @param {number} params.amount - Amount in BDT
 * @param {string} [params.reference] - Internal reference / order ID
 * @param {string} [params.customerName] - Customer display name
 * @param {string} [params.customerPhone] - 11-digit mobile number
 * @param {string} [params.customerEmail] - Customer email address
 * @param {string} [params.callbackUrl] - Server redirect URL upon completion
 */
export async function createPayStationPayment({
  invoiceNumber,
  amount,
  reference = '',
  customerName = 'PrintKoro Customer',
  customerPhone = '01700000000',
  customerEmail = 'support@printkoro.com',
  customerAddress = 'Dhaka, Bangladesh',
  callbackUrl
}) {
  const { baseUrl } = getConfig()
  const token = await getPayStationToken()

  const effectiveCallback = callbackUrl || `${process.env.NEXT_PUBLIC_BASE_URL || 'https://printkoro.com'}/api/payment/paystation/callback`

  const payload = {
    invoice_number: invoiceNumber,
    currency: 'BDT',
    payment_amount: Number(amount),
    reference: String(reference || invoiceNumber).slice(0, 100),
    cust_name: String(customerName || 'Customer').slice(0, 100),
    cust_phone: String(customerPhone || '01700000000').slice(0, 20),
    cust_email: String(customerEmail || 'customer@printkoro.com').slice(0, 100),
    cust_address: String(customerAddress || 'Dhaka, Bangladesh').slice(0, 150),
    callback_url: effectiveCallback
  }

  const res = await fetch(`${baseUrl}/create-payment`, {
    method: 'POST',
    headers: {
      'token': token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  if (!res.ok) {
    throw new Error(`PayStation payment creation failed: HTTP ${res.status}`)
  }

  const data = await res.json()

  if (String(data?.status_code) !== '200' || !data?.payment_url) {
    throw new Error(data?.message || 'Could not initiate PayStation payment session.')
  }

  return {
    success: true,
    invoiceNumber: data.invoice_number || invoiceNumber,
    paymentUrl: data.payment_url,
    amount: Number(data.payment_amount || amount),
    raw: data
  }
}

/**
 * Verify a transaction status from PayStation
 *
 * @param {Object} params
 * @param {string} params.invoiceNumber - The invoice number to query
 * @param {string} [params.trxId] - Optional transaction ID
 */
export async function verifyPayStationPayment({ invoiceNumber, trxId }) {
  const { storeId, baseUrl } = getConfig()

  if (!invoiceNumber && !trxId) {
    throw new Error('Invoice number or Transaction ID is required for verification.')
  }

  const payload = {}
  if (invoiceNumber) payload.invoice_number = invoiceNumber
  if (trxId) payload.trx_id = trxId

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 6000)

    const res = await fetch(`${baseUrl}/transaction-status`, {
      method: 'POST',
      headers: {
        'merchantId': storeId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    })
    clearTimeout(timeout)

    if (!res.ok) {
      console.warn(`[PayStation] S2S check returned HTTP ${res.status}`)
      return {
        success: false,
        isPaid: false,
        status: `HTTP ${res.status}`,
        message: 'Could not contact PayStation verification API'
      }
    }

    const data = await res.json().catch(() => null)

    if (String(data?.status_code) === '200' && data?.data) {
      const tx = data.data
      const statusLower = String(tx.trx_status || '').toLowerCase()
      const isPaid = statusLower === 'success' || statusLower === 'successful'

      return {
        success: true,
        isPaid,
        status: tx.trx_status || 'Unknown',
        invoiceNumber: tx.invoice_number,
        trxId: tx.trx_id,
        amount: parseFloat(tx.payment_amount || tx.request_amount || 0),
        paymentMethod: tx.payment_method || 'PayStation',
        payerMobile: tx.payer_mobile_no,
        orderDateTime: tx.order_date_time,
        reference: tx.reference,
        raw: tx
      }
    }

    return {
      success: false,
      isPaid: false,
      status: data?.message || 'Failed',
      statusCode: data?.status_code,
      message: data?.message || 'Transaction not found or not completed'
    }
  } catch (err) {
    console.warn('[PayStation] verifyPayStationPayment fetch error:', err.message)
    return {
      success: false,
      isPaid: false,
      status: 'NetworkError',
      message: err.message
    }
  }
}
