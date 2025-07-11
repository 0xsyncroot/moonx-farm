'use client'

import { useState } from 'react'
import { X, AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SwapSettingsProps {
  isOpen: boolean
  onClose: () => void
  slippage: number
  onSlippageChange: (slippage: number) => void
}

const SLIPPAGE_PRESETS = [0.1, 0.5, 1.0, 3.0]

export function SwapSettings({
  isOpen,
  onClose,
  slippage,
  onSlippageChange
}: SwapSettingsProps) {
  const [customSlippage, setCustomSlippage] = useState('')

  if (!isOpen) return null

  const handlePresetSlippage = (value: number) => {
    onSlippageChange(value)
    setCustomSlippage('')
  }

  const handleCustomSlippage = (value: string) => {
    setCustomSlippage(value)
    const numValue = parseFloat(value)
    
    if (!isNaN(numValue) && numValue >= 0 && numValue <= 50) {
      onSlippageChange(numValue)
    }
  }

  const getSlippageWarning = (value: number) => {
    if (value < 0.1) return { type: 'error', message: 'Slippage too low, transaction may fail' }
    if (value > 5) return { type: 'warning', message: 'High slippage may result in unfavorable rates' }
    if (value > 15) return { type: 'error', message: 'Very high slippage, consider lowering' }
    return null
  }

  const warning = getSlippageWarning(slippage)

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 transition-opacity duration-300"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl 
                       pointer-events-auto transform transition-all duration-300 
                       animate-in slide-in-from-bottom-8 fade-in-0 border border-gray-200 dark:border-gray-700">
          
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Transaction Settings</h3>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 
                       hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Slippage Tolerance */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <label className="text-sm font-semibold text-gray-900 dark:text-white">
                  Slippage Tolerance
                </label>
                <div className="group relative">
                  <Info className="w-4 h-4 text-gray-400 cursor-help" />
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 
                                bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg opacity-0 
                                group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                    Maximum price difference you&apos;re willing to accept
                  </div>
                </div>
              </div>
              
              {/* Preset Buttons */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                {SLIPPAGE_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => handlePresetSlippage(preset)}
                    className={cn(
                      "px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]",
                      slippage === preset && !customSlippage
                        ? "bg-gradient-to-r from-[#ff7842] to-[#ff4d00] text-white shadow-lg shadow-orange-500/25"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
                    )}
                  >
                    {preset}%
                  </button>
                ))}
              </div>

              {/* Custom Input */}
              <div className="relative">
                <input
                  type="number"
                  placeholder="Custom slippage"
                  value={customSlippage}
                  onChange={(e) => handleCustomSlippage(e.target.value)}
                  min="0"
                  max="50"
                  step="0.1"
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 
                           rounded-xl text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400
                           focus:border-[#ff7842] focus:ring-4 focus:ring-orange-500/10 focus:outline-none
                           transition-all duration-300 hover:border-gray-300 dark:hover:border-gray-600
                           [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm font-medium">
                  %
                </span>
              </div>

              {/* Warning Message */}
              {warning && (
                <div className={cn(
                  "flex items-start gap-3 p-4 rounded-xl text-sm mt-4 border",
                  warning.type === 'error' 
                    ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800"
                    : "bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800"
                )}>
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{warning.message}</span>
                </div>
              )}
            </div>

            {/* Current Settings Summary */}
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Current Settings</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Slippage Tolerance:</span>
                  <span className="font-medium text-gray-900 dark:text-white">{slippage}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Transaction Deadline:</span>
                  <span className="font-medium text-gray-900 dark:text-white">20 minutes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Gas Priority:</span>
                  <span className="font-medium text-gray-900 dark:text-white">Standard</span>
                </div>
              </div>
            </div>

            {/* Information Box */}
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Info className="w-4 h-4 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-orange-700 dark:text-orange-300">
                  <div className="font-medium mb-1">About Slippage</div>
                  <div>
                    Slippage is the difference between expected and actual trade prices. 
                    Higher slippage allows trades to complete in volatile markets but may result in worse prices.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-2xl">
            <button
              onClick={onClose}
              className="w-full px-4 py-3 bg-gradient-to-r from-[#ff7842] to-[#ff4d00] hover:from-[#ff4d00] hover:to-[#e63900] text-white 
                       rounded-xl font-medium transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] 
                       shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/30"
            >
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </>
  )
} 