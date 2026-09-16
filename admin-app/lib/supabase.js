import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xhzfrmpbhasnipirccnt.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_5QRgqfQTgNnpH3PN2wfz1g_4wwy5k8I'

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Key is missing. Check your .env.local file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Redeem an OTP at a specific kiosk or shop terminal
 * @param {string} code - The 6-character OTP code
 * @param {string} deviceId - The UUID of the redeeming device
 */
export async function redeemOtp(code, deviceId) {
  const { data, error } = await supabase.rpc('redeem_otp', {
    p_code: code,
    p_device_id: deviceId,
  })

  if (error) {
    throw new Error(error.message)
  }

  return data
}

/**
 * Fetch the active OTP for a customer's owned print job
 * @param {string} jobId - The UUID of the print job
 */
export async function getMyJobOtp(jobId) {
  const { data, error } = await supabase.rpc('get_my_job_otp', {
    p_job_id: jobId,
  })

  if (error) {
    throw new Error(error.message)
  }

  return data
}
