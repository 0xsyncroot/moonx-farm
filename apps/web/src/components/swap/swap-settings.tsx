'use client'

import { useState } from 'react'
import { X, AlertTriangle } from 'lucide-react'
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-6 w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Transaction Settings</h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Slippage Tolerance */}
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-300 mb-3 block">
              Slippage Tolerance
            </label>
            
            {/* Preset Buttons */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              {SLIPPAGE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => handlePresetSlippage(preset)}
                  className={cn(
                    "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    slippage === preset && !customSlippage
                      ? "bg-[#ff7842] text-white"
                      : "bg-gray-800 text-gray-300 hover:bg-gray-700"
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
                placeholder="Custom"
                value={customSlippage}
                onChange={(e) => handleCustomSlippage(e.target.value)}
                min="0"
                max="50"
                step="0.1"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg 
                         text-white placeholder-gray-500 focus:border-[#ff7842] focus:outline-none
                         [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                %
              </span>
            </div>

            {/* Warning Message */}
            {warning && (
              <div className={cn(
                "flex items-center gap-2 p-3 rounded-lg text-sm mt-3",
                warning.type === 'error' 
                  ? "bg-red-500/10 text-red-400 border border-red-500/20"
                  : "bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"
              )}>
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{warning.message}</span>
              </div>
            )}
          </div>

          {/* MEV Protection (placeholder for future) */}
          <div>
            <label className="text-sm font-medium text-gray-300 mb-3 block">
              MEV Protection
            </label>
            <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
              <div>
                <div className="text-sm text-white">Frontrunning Protection</div>
                <div className="text-xs text-gray-400">Protect against MEV attacks</div>
              </div>
              <div className="w-10 h-6 bg-gray-700 rounded-full relative">
                <div className="w-4 h-4 bg-gray-500 rounded-full absolute top-1 left-1 transition-transform" />
              </div>
            </div>
          </div>

          {/* Advanced Settings */}
          <div>
            <label className="text-sm font-medium text-gray-300 mb-3 block">
              Advanced
            </label>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                <div>
                  <div className="text-sm text-white">Expert Mode</div>
                  <div className="text-xs text-gray-400">Allow high price impact swaps</div>
                </div>
                <div className="w-10 h-6 bg-gray-700 rounded-full relative">
                  <div className="w-4 h-4 bg-gray-500 rounded-full absolute top-1 left-1 transition-transform" />
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-gray-800 rounded-lg">
                <div>
                  <div className="text-sm text-white">Auto Router</div>
                  <div className="text-xs text-gray-400">Automatically find best routes</div>
                </div>
                <div className="w-10 h-6 bg-[#ff7842] rounded-full relative">
                  <div className="w-4 h-4 bg-white rounded-full absolute top-1 right-1 transition-transform" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-gray-800">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 bg-[#ff7842] hover:bg-[#ff7842]/90 text-white 
                     rounded-lg font-medium transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  )
} 