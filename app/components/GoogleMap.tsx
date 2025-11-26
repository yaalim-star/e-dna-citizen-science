'use client'

import { GoogleMap, LoadScript, Marker, OverlayView } from '@react-google-maps/api'
import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip as RechartsTooltip } from 'recharts'
import { FishData } from '@/lib/csv-utils'

const containerStyle = {
  width: '100%',
  height: '600px',
}

const defaultCenter = {
  lat: 37.5665,
  lng: 126.9780, // 서울시청 좌표
}

// 물고기 모양 SVG 아이콘 (Font Awesome Fish)
const fishIcon = {
  path: 'M546.2 9.7c-5.6-12.5-21.6-13-28.3-1.2C486.9 62.4 431.4 96 368 96h-80C182 96 96 182 96 288c0 7 .8 13.7 1.5 20.5C161.3 262.2 253.4 224 384 224c8.8 0 16 7.2 16 16s-7.2 16-16 16C253.4 256 161.3 293.8 97.5 343.5c-.8 6.8-1.5 13.5-1.5 20.5 0 106 86 192 192 192h80c63.4 0 118.9 33.6 149.9 87.5 6.7 11.8 22.7 11.3 28.3-1.2 5.5-12.3 1.2-27-13-31-34.2-9.6-58.3-41.3-58.3-76.9V107.7c0-35.6 24.1-67.3 58.3-76.9 14.2-4 18.5-18.7 13-31zM352 352c-17.7 0-32-14.3-32-32s14.3-32 32-32 32 14.3 32 32-14.3 32-32 32z',
  fillColor: '#4285F4',
  fillOpacity: 1,
  strokeColor: '#ffffff',
  strokeWeight: 2,
  scale: 0.06,
  anchor: { x: 288, y: 256 },
}

interface MarkerData {
  position: { lat: number; lng: number }
  label?: string
  title?: string
  summary?: string
  fishData?: FishData[]
}

interface GoogleMapComponentProps {
  apiKey: string
  center?: { lat: number; lng: number }
  zoom?: number
  markers?: MarkerData[]
}

// 차트 색상 팔레트
const COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8',
  '#82CA9D', '#FFC658', '#FF7C7C', '#8DD1E1', '#D084D0',
  '#FFB347', '#87CEEB', '#DDA0DD', '#98D8C8', '#F7DC6F'
]

function PieChartComponent({ fishData }: { fishData: FishData[] }) {
  // reads_count 기준으로 정렬
  const sortedData = [...fishData]
    .sort((a, b) => b.reads_count - a.reads_count)
  
  // 상위 5개만 표시
  const top5 = sortedData.slice(0, 5)
  
  // 나머지는 Others로 묶기
  const others = sortedData.slice(5)
  const othersTotal = others.reduce((sum, fish) => sum + fish.reads_count, 0)
  
  const chartData = top5.map(fish => ({
    name: fish.common_name,
    value: fish.reads_count,
  }))
  
  // Others가 있으면 추가
  if (othersTotal > 0) {
    chartData.push({
      name: 'Others',
      value: othersTotal,
    })
  }

  const totalReads = fishData.reduce((sum, fish) => sum + fish.reads_count, 0)

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
            outerRadius={70}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <RechartsTooltip 
            formatter={(value: number) => [
              `${value.toLocaleString()} (${((value / totalReads) * 100).toFixed(1)}%)`,
              '읽기 수'
            ]}
            labelFormatter={(label) => label}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

function TooltipOverlay({
  position,
  title,
  summary,
  fishData,
  onClose,
}: {
  position: { lat: number; lng: number }
  title?: string
  summary?: string
  fishData?: FishData[]
  onClose: () => void
}) {
  return (
    <OverlayView
      position={position}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
      getPixelPositionOffset={(width, height) => ({
        x: -(width / 2),
        y: -(height + 10),
      })}
    >
      <div
        className={cn(
          "relative bg-popover text-popover-foreground",
          "rounded-md border shadow-md",
          "px-3 py-1.5 min-w-[280px] max-w-sm max-h-[400px]",
          "animate-in fade-in-0 zoom-in-95",
          "pointer-events-auto flex flex-col"
        )}
        onWheel={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        <div className="font-semibold mb-2 flex-shrink-0">
          {title || '어류 정보'}
        </div>
        {fishData && fishData.length > 0 && (
          <div className="mb-3 flex-shrink-0">
            <PieChartComponent fishData={fishData} />
          </div>
        )}
        <div 
          className="text-sm whitespace-pre-line overflow-y-auto flex-1"
          onWheel={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          {summary}
        </div>
        <button
          onClick={onClose}
          className="absolute top-1 right-1 text-muted-foreground hover:text-foreground text-lg leading-none z-10"
          aria-label="닫기"
        >
          ×
        </button>
      </div>
    </OverlayView>
  )
}

function MapContent({
  center = defaultCenter,
  zoom = 13,
  markers = [],
  selectedMarkerIndex,
  setSelectedMarkerIndex,
}: {
  center: { lat: number; lng: number }
  zoom: number
  markers: MarkerData[]
  selectedMarkerIndex: number | null
  setSelectedMarkerIndex: (index: number | null) => void
}) {
  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={center}
      zoom={zoom}
      onClick={() => {
        setSelectedMarkerIndex(null)
      }}
      options={{
        zoomControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        gestureHandling: 'greedy',
        styles: [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }],
          },
          {
            featureType: "landscape",
            elementType: "labels",
            stylers: [{ visibility: "off" }],
          },
          {
            featureType: "road",
            elementType: "labels",
            stylers: [{ visibility: "off" }],
          },
        ],
      }}
    >
      {markers.map((marker, index) => (
        <Marker
          key={index}
          position={marker.position}
          icon={fishIcon}
          title={marker.title || marker.label}
          onClick={() => {
            setSelectedMarkerIndex(index)
          }}
        />
      ))}
      {selectedMarkerIndex !== null && 
       markers[selectedMarkerIndex]?.summary && (
        <TooltipOverlay
          position={markers[selectedMarkerIndex].position}
          title={markers[selectedMarkerIndex].title || markers[selectedMarkerIndex].label}
          summary={markers[selectedMarkerIndex].summary}
          fishData={markers[selectedMarkerIndex].fishData}
          onClose={() => setSelectedMarkerIndex(null)}
        />
      )}
    </GoogleMap>
  )
}

export default function GoogleMapComponent({
  apiKey,
  center = defaultCenter,
  zoom = 13,
  markers = [],
}: GoogleMapComponentProps) {
  const libraries = useMemo(() => ['places'], [])
  const [selectedMarkerIndex, setSelectedMarkerIndex] = useState<number | null>(null)

  return (
    <LoadScript googleMapsApiKey={apiKey} libraries={libraries}>
      <MapContent
        center={center}
        zoom={zoom}
        markers={markers}
        selectedMarkerIndex={selectedMarkerIndex}
        setSelectedMarkerIndex={setSelectedMarkerIndex}
      />
    </LoadScript>
  )
}

