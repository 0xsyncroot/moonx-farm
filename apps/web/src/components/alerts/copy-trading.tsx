'use client'

import { useState } from 'react'
import { Copy, TrendingUp, Users, Star } from 'lucide-react'

interface CopyTradingProps {
  // Add props as needed
}

export function CopyTrading({}: CopyTradingProps) {
  const [followedTraders, setFollowedTraders] = useState(0)

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-[#ff7842] to-[#ff4d00] rounded-xl flex items-center justify-center">
          <Copy className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Copy Trading</h3>
          <p className="text-sm text-gray-400">Follow successful traders</p>
        </div>
      </div>

      {/* Mock content */}
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
              <Star className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-medium text-white">Top Trader</div>
              <div className="text-xs text-gray-400">+125% this month</div>
            </div>
          </div>
          <button className="px-3 py-1 bg-[#ff7842] text-white rounded-lg text-sm">
            Follow
          </button>
        </div>

        <div className="text-center py-8 text-gray-400">
          <TrendingUp className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Copy trading coming soon</p>
        </div>
      </div>
    </div>
  )
}

// Default export cho compatibility
export default CopyTrading 