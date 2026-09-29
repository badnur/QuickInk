'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Star, CheckCircle2, MessageSquare, Sparkles, Send } from 'lucide-react'

export default function PrintFeedbackBox({ jobId, otpCode, deviceId, lang = 'en' }) {
  const [rating, setRating] = useState(5)
  const [hoverRating, setHoverRating] = useState(0)
  const [selectedTags, setSelectedTags] = useState([])
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const isBn = lang === 'bn'

  const quickTags = isBn ? [
    '⚡ দ্রুত ও এক্সপ্রেস প্রিন্ট',
    '🌟 দারুণ কোয়ালিটি',
    '💰 শিক্ষার্থী-বান্ধব রেট',
    '📱 পেনড্রাইভ ছাড়া সহজ',
    '⚠️ মেশিনে সমস্যা বা অপেক্ষা',
  ] : [
    '⚡ Super Fast Print',
    '🌟 Crisp Quality',
    '💰 Affordable Rate',
    '📱 Smooth Mobile Flow',
    '⚠️ Machine or Delay Issue',
  ]

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId,
          otpCode,
          deviceId,
          rating,
          tags: selectedTags,
          message,
        }),
      })

      if (res.ok) {
        setIsSubmitted(true)
      }
    } catch (err) {
      console.warn('Feedback submit notice:', err)
      setIsSubmitted(true) // Graceful display
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSubmitted) {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 text-center animate-in fade-in zoom-in duration-200">
        <CheckCircle2 className="w-8 h-8 text-[#00bf63] mx-auto mb-2" />
        <h4 className="text-sm font-bold text-white mb-0.5">
          {isBn ? 'মতামত দেওয়ার জন্য ধন্যবাদ!' : 'Thank you for your feedback!'}
        </h4>
        <p className="text-xs text-gray-300">
          {isBn
            ? 'আপনার মূল্যবান মতামত প্রিন্টকোরোকে আরও উন্নত করতে সাহায্য করবে।'
            : 'Your feedback helps us make PrintKoro better every day.'}
        </p>
      </div>
    )
  }

  return (
    <Card className="bg-[#111827] border border-gray-800 rounded-2xl p-4 sm:p-5 text-left text-white shadow-none animate-in fade-in duration-200">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#00bf63]/15 text-[#00bf63] flex items-center justify-center">
            <MessageSquare className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">
              {isBn ? 'আপনার অভিজ্ঞতা কেমন ছিল?' : 'How was your experience?'}
            </h4>
            <span className="text-[10px] text-gray-400">
              {isBn ? 'এক ক্লিকে স্টার রেটিং দিন' : 'Rate your order in 5 seconds'}
            </span>
          </div>
        </div>

        {/* Interactive Star Rating */}
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => {
            const active = (hoverRating || rating) >= star
            return (
              <button
                key={star}
                type="button"
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setRating(star)}
                className="p-1 hover:scale-110 transition-transform"
                title={`${star} Star`}
              >
                <Star
                  className={`w-5 h-5 transition-colors ${
                    active
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-gray-600 hover:text-gray-400'
                  }`}
                />
              </button>
            )
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 mt-3">
        {/* Quick Tags Selection */}
        <div className="flex flex-wrap gap-1.5">
          {quickTags.map((tag) => {
            const isSelected = selectedTags.includes(tag)
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                  isSelected
                    ? 'bg-[#00bf63]/20 border-[#00bf63] text-[#00bf63] font-semibold'
                    : 'bg-gray-800/80 border-gray-700 text-gray-300 hover:bg-gray-800'
                }`}
              >
                {tag}
              </button>
            )
          })}
        </div>

        {/* Optional Message Textarea */}
        <div className="relative">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            placeholder={
              isBn
                ? 'কোনো পরামর্শ বা সমস্যার কথা লিখুন (ঐচ্ছিক)...'
                : 'Any thoughts, machine experience, or suggestions? (Optional)...'
            }
            className="text-xs bg-gray-900 border-gray-800 text-gray-200 placeholder:text-gray-500 rounded-xl resize-none focus:border-[#00bf63] focus:ring-1 focus:ring-[#00bf63]"
          />
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting}
            className="h-8 px-4 text-xs font-bold bg-[#00bf63] hover:bg-[#00a656] text-black rounded-lg shadow-none flex items-center gap-1.5"
          >
            {isSubmitting ? (
              <span>{isBn ? 'পাঠানো হচ্ছে...' : 'Submitting...'}</span>
            ) : (
              <>
                <Send className="w-3 h-3" />
                <span>{isBn ? 'মতামত পাঠান' : 'Submit Feedback'}</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </Card>
  )
}
