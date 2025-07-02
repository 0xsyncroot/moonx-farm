'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useTheme } from 'next-themes'
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
  const { theme, systemTheme } = useTheme()

  // Get current theme (light/dark)
  const currentTheme = theme === 'system' ? systemTheme : theme
  const isDark = currentTheme === 'dark'

  // Chart colors based on theme
  const chartColors = {
    light: {
      backgroundColor: '#ffffff',
      lineColor: '#2962FF',
      textColor: '#1f2937',
      areaTopColor: '#2962FF',
      areaBottomColor: 'rgba(41, 98, 255, 0.28)',
      gridColor: '#e5e7eb',
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444'
    },
    dark: {
      backgroundColor: '#0f172a',
      lineColor: '#ff7842',
      textColor: '#f1f5f9',
      areaTopColor: '#ff7842',
      areaBottomColor: 'rgba(255, 120, 66, 0.28)',
      gridColor: '#334155',
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444'
    }
  }

  const colors = chartColors[isDark ? 'dark' : 'light']

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return

    // Create chart with theme-aware colors
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

    // Add candlestick series with theme-aware colors
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
  }, [colors, height, showMarkers, onPriceClick])

  // Update chart data
  useEffect(() => {
    if (!candlestickSeries.current || !data.length) return

    // Sort data by timestamp in ascending order to fix TradingView assertion error
    const sortedData = [...data].sort((a, b) => a.timestamp - b.timestamp)
    
    // Remove duplicate timestamps to prevent TradingView errors
    const uniqueData = sortedData.filter((point, index, array) => {
      if (index === 0) return true
      return point.timestamp !== array[index - 1].timestamp
    })

    const chartData: CandlestickData[] = uniqueData.map(point => ({
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

  // Update markers using series markers
  useEffect(() => {
    if (!candlestickSeries.current || !data.length) return

    // Sort data by timestamp in ascending order (same as chart data)
    const sortedData = [...data].sort((a, b) => a.timestamp - b.timestamp)
    
    // Remove duplicate timestamps (same as chart data)
    const uniqueData = sortedData.filter((point, index, array) => {
      if (index === 0) return true
      return point.timestamp !== array[index - 1].timestamp
    })

    // Create markers for the series
    const seriesMarkers = markers.map(marker => {
      // Find the closest data point to place the marker
      const closestDataIndex = Math.floor(uniqueData.length / 2)
      const timeForMarker = uniqueData[closestDataIndex]?.timestamp || Date.now()
      
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
      <div className={cn("flex items-center justify-center bg-card/50 backdrop-blur-sm border border-border rounded-2xl", className)} style={{ height }}>
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="text-muted-foreground">Loading chart data...</span>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("bg-card/50 backdrop-blur-xl border border-border rounded-2xl p-6", className)}>
      {title && (
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          {showMarkers && (
            <div className="text-xs text-muted-foreground">
              Click on chart to set price levels
            </div>
          )}
        </div>
      )}
      
      <div ref={chartContainerRef} className="w-full" />
      
      {selectedPrice && (
        <div className="mt-3 text-sm text-muted-foreground">
          Selected Price: <span className="text-foreground font-medium">${selectedPrice.toFixed(4)}</span>
        </div>
      )}
      
      {/* Price Levels Display */}
      {showMarkers && markers.length > 0 && (
        <div className="mt-6 space-y-3">
          <div className="text-sm font-medium text-foreground">Price Levels</div>
          <div className="grid grid-cols-1 gap-2 text-xs">
            {markers.map((marker) => (
              <div key={marker.id} className="flex items-center justify-between bg-muted/30 border border-border rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: marker.color }}
                  />
                  <span className="text-foreground font-medium">{marker.type.toUpperCase()}</span>
                </div>
                <span className="text-foreground font-semibold">${marker.price.toFixed(4)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chart Legend */}
      <div className="mt-6 flex items-center justify-center space-x-6 text-xs text-muted-foreground">
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
            <div className="w-3 h-3 bg-primary rounded-full"></div>
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