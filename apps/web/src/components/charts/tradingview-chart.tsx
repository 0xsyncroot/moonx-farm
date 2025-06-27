'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { 
  createChart, 
  ColorType, 
  IChartApi, 
  ISeriesApi, 
  Time, 
  CandlestickData,
  CandlestickSeries,
  createSeriesMarkers
} from 'lightweight-charts'
import { PriceDataPoint } from '@/lib/price-data-api'
import { cn } from '@/lib/utils'

interface MarkerConfig {
  id: string
  price: number
  type: 'tp' | 'sl' | 'dca' | 'current'
  color: string
  label: string
}

interface TradingViewChartProps {
  data: PriceDataPoint[]
  height?: number
  theme?: 'light' | 'dark'
  showMarkers?: boolean
  onPriceClick?: (price: number) => void
  markers?: MarkerConfig[]
  className?: string
  title?: string
  loading?: boolean
}

export function TradingViewChart({
  data,
  height = 400,
  theme = 'dark',
  showMarkers = false,
  onPriceClick,
  markers = [],
  className,
  title,
  loading = false
}: TradingViewChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chart = useRef<IChartApi | null>(null)
  const candlestickSeries = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const [selectedPrice, setSelectedPrice] = useState<number | null>(null)

  // Chart colors based on theme
  const chartColors = {
    light: {
      backgroundColor: '#ffffff',
      lineColor: '#2962FF',
      textColor: '#191919',
      areaTopColor: '#2962FF',
      areaBottomColor: 'rgba(41, 98, 255, 0.28)',
      gridColor: '#e1e1e1',
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderUpColor: '#26a69a',
      borderDownColor: '#ef5350',
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350'
    },
    dark: {
      backgroundColor: '#1a1a1a',
      lineColor: '#ff7842',
      textColor: '#d1d4dc',
      areaTopColor: '#ff7842',
      areaBottomColor: 'rgba(255, 120, 66, 0.28)',
      gridColor: '#2a2a2a',
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444'
    }
  }

  const colors = chartColors[theme]

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return

    // Create chart with v5 API
    chart.current = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: colors.backgroundColor },
        textColor: colors.textColor,
      },
      grid: {
        vertLines: { color: colors.gridColor },
        horzLines: { color: colors.gridColor },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: colors.gridColor,
      },
      timeScale: {
        borderColor: colors.gridColor,
        timeVisible: true,
        secondsVisible: false,
      },
      width: chartContainerRef.current.clientWidth,
      height: height,
    })

    // Add candlestick series with v5 API
    candlestickSeries.current = chart.current.addSeries(CandlestickSeries, {
      upColor: colors.upColor,
      downColor: colors.downColor,
      borderDownColor: colors.borderDownColor,
      borderUpColor: colors.borderUpColor,
      wickDownColor: colors.wickDownColor,
      wickUpColor: colors.wickUpColor,
    })

    // Handle click events for limit orders
    if (showMarkers && onPriceClick) {
      chart.current.subscribeClick((param) => {
        if (param.point && param.time) {
          const price = candlestickSeries.current?.coordinateToPrice(param.point.y)
          if (price && typeof price === 'number') {
            setSelectedPrice(price)
            onPriceClick(price)
          }
        }
      })
    }

    // Handle resize
    const handleResize = () => {
      if (chart.current && chartContainerRef.current) {
        chart.current.applyOptions({ 
          width: chartContainerRef.current.clientWidth 
        })
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (chart.current) {
        chart.current.remove()
      }
    }
  }, [height, theme, showMarkers, onPriceClick, colors])

  // Update chart data
  useEffect(() => {
    if (!candlestickSeries.current || !data.length) return

    const chartData: CandlestickData[] = data.map(point => ({
      time: (point.timestamp / 1000) as Time,
      open: point.open,
      high: point.high,
      low: point.low,
      close: point.close,
    }))

    candlestickSeries.current.setData(chartData)

    // Fit content
    chart.current?.timeScale().fitContent()
  }, [data])

  // Update markers using series markers (v5 API)
  useEffect(() => {
    if (!candlestickSeries.current || !data.length) return

    // Create markers for the series using v5 API
    const seriesMarkers = markers.map(marker => {
      // Find the closest data point to place the marker
      const closestDataIndex = Math.floor(data.length / 2)
      const timeForMarker = data[closestDataIndex]?.timestamp || Date.now()
      
      return {
        time: (timeForMarker / 1000) as Time,
        position: 'inBar' as const,
        color: marker.color,
        shape: marker.type === 'tp' ? 'arrowUp' as const : 
               marker.type === 'sl' ? 'arrowDown' as const : 
               'circle' as const,
        text: marker.label,
      }
    })

    // Use createSeriesMarkers for v5 API
    if (seriesMarkers.length > 0) {
      createSeriesMarkers(candlestickSeries.current, seriesMarkers)
    }
  }, [markers, data])

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center bg-gray-900/50 rounded-2xl border border-gray-700/50", className)} style={{ height }}>
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
          <span className="text-white/70">Loading chart data...</span>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("bg-gray-900/50 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-4", className)}>
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          {showMarkers && (
            <div className="text-xs text-white/60">
              Click on chart to set price levels
            </div>
          )}
        </div>
      )}
      
      <div ref={chartContainerRef} className="w-full" />
      
      {selectedPrice && (
        <div className="mt-2 text-sm text-white/70">
          Selected Price: ${selectedPrice.toFixed(4)}
        </div>
      )}
      
      {/* Price Levels Display */}
      {showMarkers && markers.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="text-sm font-medium text-white/80">Price Levels</div>
          <div className="grid grid-cols-1 gap-2 text-xs">
            {markers.map((marker) => (
              <div key={marker.id} className="flex items-center justify-between bg-gray-800/30 rounded-lg p-2">
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: marker.color }}
                  />
                  <span className="text-white/80">{marker.type.toUpperCase()}</span>
                </div>
                <span className="text-white font-medium">${marker.price.toFixed(4)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chart Legend */}
      <div className="mt-4 flex items-center justify-center space-x-6 text-xs text-white/60">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-2 bg-green-500 rounded"></div>
          <span>Bullish Candle</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-2 bg-red-500 rounded"></div>
          <span>Bearish Candle</span>
        </div>
        {showMarkers && (
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
            <span>Price Levels</span>
          </div>
        )}
      </div>
    </div>
  )
}

// Hook for managing chart markers
export function useChartMarkers() {
  const [markers, setMarkers] = useState<MarkerConfig[]>([])

  const addMarker = useCallback((marker: Omit<MarkerConfig, 'id'>) => {
    const id = `marker_${Date.now()}_${Math.random()}`
    setMarkers(prev => [...prev, { ...marker, id }])
    return id
  }, [])

  const removeMarker = useCallback((id: string) => {
    setMarkers(prev => prev.filter(m => m.id !== id))
  }, [])

  const updateMarker = useCallback((id: string, updates: Partial<MarkerConfig>) => {
    setMarkers(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m))
  }, [])

  const clearMarkers = useCallback(() => {
    setMarkers([])
  }, [])

  const getMarkerByType = useCallback((type: MarkerConfig['type']) => {
    return markers.find(marker => marker.type === type)
  }, [markers])

  return {
    markers,
    addMarker,
    removeMarker,
    updateMarker,
    clearMarkers,
    getMarkerByType
  }
} 