import {
  GoogleMap,
  LoadScript,
  Marker,
} from "@react-google-maps/api";
import { useMemo, useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import { FishData } from "@/lib/csv-utils";

const containerStyle = {
  width: "100%",
  height: "600px",
};

const defaultCenter = {
  lat: 37.5665,
  lng: 126.978, // 서울시청 좌표
};

// taxa별 마커 이미지 경로 매핑
const getTaxaMarkerImage = (taxa?: string): string => {
  if (!taxa) return '/marker/어류.png';
  
  // taxa에 따라 다른 이미지를 사용 (한국어와 영어 모두 지원)
  const taxaImageMap: Record<string, string> = {
    // 한국어 taxa (엑셀 파일에서 사용)
    '어류': '/marker/어류.png',
    '조류': '/marker/조류.png',
    '포유류': '/marker/포유류.png',
    '양서파충류': '/marker/양서파충류.png',
    
    // 영어 taxa (기존 데이터 호환성)
    'Actinopterygii': '/marker/어류.png',      // 조기어류
    'Chondrichthyes': '/marker/어류.png',      // 연골어류
    'Sarcopterygii': '/marker/어류.png',       // 육기어류
    'Agnatha': '/marker/어류.png',             // 무악류
    'Aves': '/marker/조류.png',                // 조류
    'Mammalia': '/marker/포유류.png',          // 포유류
    'Amphibia': '/marker/양서파충류.png',      // 양서류
    'Reptilia': '/marker/양서파충류.png',      // 파충류
  };
  
  // taxa가 있으면 해당 이미지 사용, 없으면 기본 이미지 (어류)
  return taxaImageMap[taxa] || '/marker/어류.png';
};

// 귀여운 만화 스타일 물고기 SVG 아이콘 (fallback용)
// SVG를 data URL로 변환하여 사용 (useMemo로 최적화)
const getFishIcon = (isGrayscale: boolean = false) => {
  // 흑백일 경우 회색 톤 사용
  const fillColor = isGrayscale ? "#808080" : "#4285F4";
  const strokeColor = isGrayscale ? "#CCCCCC" : "#ffffff";
  const eyeColor = isGrayscale ? "#666666" : "#000000";
  
  const svg = `
    <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="fishShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.3"/>
        </filter>
      </defs>
      <g filter="url(#fishShadow)">
        <!-- 꼬리 -->
        <path d="M 38 24 C 42 18 46 18 46 24 C 46 30 42 30 38 24 Z" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.5" stroke-linejoin="round"/>
        
        <!-- 몸체 (둥근 모양) -->
        <ellipse cx="22" cy="24" rx="16" ry="13" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.5"/>
        
        <!-- 등 지느러미 -->
        <path d="M 20 11 C 18 6 26 6 26 11" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.5" stroke-linejoin="round"/>
        
        <!-- 배 지느러미 -->
        <path d="M 20 37 C 18 42 26 42 26 37" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.5" stroke-linejoin="round"/>
        
        <!-- 가슴 지느러미 -->
        <path d="M 24 28 C 22 30 22 34 26 32" fill="${fillColor}" stroke="${strokeColor}" stroke-width="1.5" stroke-linejoin="round"/>

        <!-- 흰색 줄무늬 (니모 특징) -->
        <path d="M 17 12 C 14 18 14 30 17 36" stroke="${strokeColor}" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.9"/>
        <path d="M 29 12 C 27 18 27 30 29 36" stroke="${strokeColor}" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.9"/>

        <!-- 큰 눈 -->
        <circle cx="14" cy="21" r="4.5" fill="${strokeColor}"/>
        <circle cx="14" cy="21" r="2.5" fill="${eyeColor}"/>
        <circle cx="15.5" cy="20" r="1" fill="${strokeColor}" opacity="0.8"/>
        
        <!-- 미소 -->
        <path d="M 12 27 C 14 29 16 27 16 27" stroke="${strokeColor}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      </g>
    </svg>
  `.trim();
  
  return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
};

// 이미지를 흑백으로 변환하는 함수 (Canvas 사용)
// 흰색 테두리는 유지하고 내부만 흑백으로 변환
const convertImageToGrayscale = (imageUrl: string, size: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }
      
      // 이미지 그리기
      ctx.drawImage(img, 0, 0, size, size);
      
      // 이미지 데이터 가져오기
      const imageData = ctx.getImageData(0, 0, size, size);
      const data = imageData.data;
      
      // 흑백 변환 (흰색 테두리는 유지)
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const alpha = data[i + 3];
        
        // 흰색에 가까운 픽셀(밝기 240 이상)은 그대로 유지 (테두리)
        const brightness = (r + g + b) / 3;
        const isWhiteBorder = brightness >= 240 && alpha > 200;
        
        if (isWhiteBorder) {
          // 흰색 테두리는 그대로 유지
          continue;
        }
        
        // 나머지 부분은 흑백 변환 (밝기 조정 포함)
        const gray = r * 0.299 + g * 0.587 + b * 0.114;
        const adjustedGray = gray * 0.7; // 밝기 조정
        data[i] = adjustedGray;     // R
        data[i + 1] = adjustedGray;  // G
        data[i + 2] = adjustedGray; // B
        // alpha 채널은 그대로 유지
      }
      
      // 변환된 데이터 다시 그리기
      ctx.putImageData(imageData, 0, 0);
      
      // Data URL로 변환
      resolve(canvas.toDataURL());
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    img.src = imageUrl;
  });
};

// 이미지 URL을 캐시하는 Map (성능 최적화)
const grayscaleImageCache = new Map<string, string>();

// 마커 원본 이미지의 자연 크기(가로/세로)를 캐시 (종횡비 유지용)
const imageSizeCache = new Map<string, { width: number; height: number }>();

const getImageNaturalSize = (imageUrl: string): Promise<{ width: number; height: number }> => {
  if (imageSizeCache.has(imageUrl)) {
    return Promise.resolve(imageSizeCache.get(imageUrl)!);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      if (!width || !height) {
        reject(new Error('Invalid image dimensions'));
        return;
      }
      const result = { width, height };
      imageSizeCache.set(imageUrl, result);
      resolve(result);
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageUrl;
  });
};

// 주어진 maxSize(정사각 박스) 안에 종횡비를 유지한 채로 맞추는 크기 계산
const fitSizePreserveAspect = (
  width: number,
  height: number,
  maxSize: number
): { width: number; height: number } => {
  if (width <= 0 || height <= 0) return { width: maxSize, height: maxSize };
  const scale = Math.min(maxSize / width, maxSize / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

// taxa별 마커 아이콘 생성 함수 (비동기 버전)
const createTaxaMarkerIconAsync = async (
  taxa?: string,
  isGrayscale: boolean = false,
  size: number = 48,
  offsetX: number = 0,
  offsetY: number = 0
): Promise<google.maps.Icon | google.maps.Symbol> => {
  if (typeof window !== 'undefined' && window.google?.maps) {
    const imageUrl = getTaxaMarkerImage(taxa);
    
    let finalImageUrl = imageUrl;
    
    // 흑백 변환이 필요한 경우
    if (isGrayscale) {
      const cacheKey = `${imageUrl}_${size}`;
      
      if (grayscaleImageCache.has(cacheKey)) {
        finalImageUrl = grayscaleImageCache.get(cacheKey)!;
      } else {
        try {
          const grayscaleUrl = await convertImageToGrayscale(imageUrl, size);
          grayscaleImageCache.set(cacheKey, grayscaleUrl);
          finalImageUrl = grayscaleUrl;
        } catch (error) {
          console.warn('Failed to convert image to grayscale:', error);
          // 실패 시 원본 이미지 사용
        }
      }
    }

    // 종횡비 유지: 원본 PNG는 가로로 긴 비율이라 (size, size)로 강제하면 찌그러짐
    // - dataURL(흑백 변환 결과)은 이미 size x size 캔버스라 정사각형 유지
    // - 그 외에는 원본 자연 크기를 읽어서 size 박스 안에 fit
    let finalWidth = size;
    let finalHeight = size;
    if (!finalImageUrl.startsWith('data:')) {
      try {
        const natural = await getImageNaturalSize(finalImageUrl);
        const fitted = fitSizePreserveAspect(natural.width, natural.height, size);
        finalWidth = fitted.width;
        finalHeight = fitted.height;
      } catch (error) {
        console.warn('Failed to read image natural size (using square):', error);
      }
    }

    return {
      url: finalImageUrl,
      scaledSize: new google.maps.Size(finalWidth, finalHeight),
      anchor: new google.maps.Point(finalWidth / 2 + offsetX, finalHeight / 2 + offsetY),
    };
  }
  
  // Google Maps API가 로드되지 않았을 때는 기본 path 사용
  return {
    path: "M 0,0 C -15,-20 -25,-15 -30,-5 C -35,5 -30,15 -20,20 C -10,25 0,25 10,20 C 20,15 25,5 20,-5 C 15,-15 5,-20 0,0 Z",
    fillColor: isGrayscale ? "#808080" : "#4285F4",
    fillOpacity: isGrayscale ? 0.5 : 1,
    strokeColor: "#ffffff",
    strokeWeight: 1.5,
    scale: size / 60,
    anchor: { x: 0, y: 0 },
  } as any;
};

// taxa별 마커 아이콘 생성 함수 (동기 버전 - 흑백 미지원, 기본 아이콘용)
const createTaxaMarkerIcon = (
  taxa?: string,
  isGrayscale: boolean = false,
  size: number = 48,
  offsetX: number = 0,
  offsetY: number = 0
): google.maps.Icon | google.maps.Symbol => {
  if (typeof window !== 'undefined' && window.google?.maps) {
    const imageUrl = getTaxaMarkerImage(taxa);
    
    // 동기 버전은 이미지 로딩을 기다릴 수 없으므로,
    // 현재 사용 중인 마커 PNG 비율을 URL 기준으로 안전하게 추정하여 찌그러짐을 줄인다.
    const aspectByUrl: Record<string, number> = {
      '/marker/어류.png': 514 / 282,
      '/marker/조류.png': 540 / 272,
      '/marker/포유류.png': 514 / 284,
      '/marker/양서파충류.png': 514 / 284,
    };
    const aspect = aspectByUrl[imageUrl];
    let finalWidth = size;
    let finalHeight = size;
    if (aspect && isFinite(aspect) && aspect > 0) {
      // size 박스 안에 fit (가로로 긴 이미지 → width=size, height=size/aspect)
      finalWidth = size;
      finalHeight = Math.max(1, Math.round(size / aspect));
    }

    return {
      url: imageUrl,
      scaledSize: new google.maps.Size(finalWidth, finalHeight),
      anchor: new google.maps.Point(finalWidth / 2 + offsetX, finalHeight / 2 + offsetY),
    };
  }
  
  // Google Maps API가 로드되지 않았을 때는 기본 path 사용
  return {
    path: "M 0,0 C -15,-20 -25,-15 -30,-5 C -35,5 -30,15 -20,20 C -10,25 0,25 10,20 C 20,15 25,5 20,-5 C 15,-15 5,-20 0,0 Z",
    fillColor: isGrayscale ? "#808080" : "#4285F4",
    fillOpacity: isGrayscale ? 0.5 : 1,
    strokeColor: "#ffffff",
    strokeWeight: 1.5,
    scale: size / 60,
    anchor: { x: 0, y: 0 },
  } as any;
};

// fishIcon을 함수로 변경하여 필요할 때 생성 (fallback용)
const createFishIcon = (isGrayscale: boolean = false) => {
  if (typeof window !== 'undefined' && window.google?.maps) {
    return {
      url: getFishIcon(isGrayscale),
      scaledSize: new google.maps.Size(48, 48),
      anchor: new google.maps.Point(24, 24),
    };
  }
  // Google Maps API가 로드되지 않았을 때는 기본 path 사용
  return {
    path: "M 0,0 C -15,-20 -25,-15 -30,-5 C -35,5 -30,15 -20,20 C -10,25 0,25 10,20 C 20,15 25,5 20,-5 C 15,-15 5,-20 0,0 Z",
    fillColor: isGrayscale ? "#808080" : "#4285F4",
    fillOpacity: isGrayscale ? 0.5 : 1,
    strokeColor: "#ffffff",
    strokeWeight: 1.5,
    scale: 0.8,
    anchor: { x: 0, y: 0 },
  } as any;
};

interface DateSpecificData {
  date: number;
  sampling: number;
  fishData: FishData[];
  metadata: {
    date: number;
    sampling?: number | null;
    object?: string | null;
    do?: number | null;
    spc?: number | null;
    pH?: number | null;
    primer?: string | null;
    manager?: string | null;
    marker?: string | null;
  };
}

interface MarkerData {
  position: { lat: number; lng: number };
  label?: string;
  title?: string;
  summary?: string;
  fishData?: FishData[];
  taxa?: string;
  dateData?: DateSpecificData[];
  avgMetadata?: {
    do?: number | null;
    spc?: number | null;
    pH?: number | null;
  };
  metadata?: {
    location?: {
      lat: number;
      lon: number;
    };
    taxa?: string;
    marker?: string | null;
    manager?: string | null;
    primer?: string | null;
    object?: string | null;
  };
}

interface GoogleMapComponentProps {
  apiKey: string;
  center?: { lat: number; lng: number };
  zoom?: number;
  markers?: MarkerData[];
}

// taxa를 한국어로 변환하는 함수
function translateTaxa(taxa: string): string {
  // 이미 한국어인 경우 그대로 반환
  const koreanTaxa = ['어류', '조류', '포유류', '양서파충류'];
  if (koreanTaxa.includes(taxa)) {
    return taxa;
  }
  
  // 영어 taxa를 한국어로 변환
  const taxaMap: Record<string, string> = {
    'Actinopterygii': '조기어류',
    'Chondrichthyes': '연골어류',
    'Sarcopterygii': '육기어류',
    'Agnatha': '무악류',
    'Aves': '조류',
    'Mammalia': '포유류',
    'Amphibia': '양서류',
    'Reptilia': '파충류',
  };
  
  return taxaMap[taxa] || taxa;
}

// 차트 색상 팔레트
const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#8884D8",
  "#82CA9D",
  "#FFC658",
  "#FF7C7C",
  "#8DD1E1",
  "#D084D0",
  "#FFB347",
  "#87CEEB",
  "#DDA0DD",
  "#98D8C8",
  "#F7DC6F",
];

function PieChartComponent({ fishData }: { fishData: FishData[] }) {
  // reads_count 기준으로 정렬
  const sortedData = [...fishData].sort(
    (a, b) => b.reads_count - a.reads_count
  );

  // 상위 5개만 표시
  const top5 = sortedData.slice(0, 5);

  // 나머지는 Others로 묶기
  const others = sortedData.slice(5);
  const othersTotal = others.reduce((sum, fish) => sum + fish.reads_count, 0);

  const chartData = top5.map((fish) => ({
    name: fish.common_name,
    value: fish.reads_count,
    scientificName: fish.scientific_name,
  }));

  // Others가 있으면 추가
  if (othersTotal > 0) {
    chartData.push({
      name: "Others",
      value: othersTotal,
      scientificName: "",
    });
  }

  const totalReads = fishData.reduce((sum, fish) => sum + fish.reads_count, 0);

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={300}>
        <PieChart margin={{ top: 30, right: 70, bottom: 20, left: 70 }}>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent, cx, cy, midAngle, innerRadius, outerRadius, payload }: any) => {
              const percentageValue = (percent || 0) * 100;
              if (percentageValue <= 3) return "";
              
              const percentage = percentageValue.toFixed(1);
              const RADIAN = Math.PI / 180;
              
              // 각 세그먼트의 중앙 각도에 정확히 맞춰 레이블 배치
              // midAngle은 이미 각 세그먼트의 중앙 각도를 나타냄
              const labelRadius = outerRadius + 10; // 차트 외부에 더 가깝게 배치
              const fontSize = 12;
              
              // 각도 계산 (midAngle은 도 단위이므로 라디안으로 변환)
              const angle = -midAngle * RADIAN;
              
              // 각 세그먼트의 중앙 방향으로 레이블 위치 계산
              const x = cx + labelRadius * Math.cos(angle);
              const y = cy + labelRadius * Math.sin(angle);
              
              // x 위치에 따라 텍스트 정렬 방향 결정
              const textAnchor = x > cx ? "start" : "end";
              
              // 데이터 색상 가져오기
              const dataIndex = chartData.findIndex((d) => d.name === name);
              const labelColor = dataIndex >= 0 ? COLORS[dataIndex % COLORS.length] : "#374151";
              
              return (
                <g>
                  {/* 흰색 테두리 텍스트 (배경) */}
                  <text
                    x={x}
                    y={y}
                    fill="white"
                    stroke="white"
                    strokeWidth={4}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    textAnchor={textAnchor}
                    dominantBaseline="central"
                    fontSize={fontSize}
                    fontWeight={600}
                    opacity={0.9}
                  >
                    <tspan x={x} dx={x > cx ? 5 : -5} dy="-5">{name}</tspan>
                    <tspan x={x} dx={x > cx ? 5 : -5} dy="16">{percentage}%</tspan>
                  </text>
                  {/* 실제 색상 텍스트 (전경) */}
                  <text
                    x={x}
                    y={y}
                    fill={labelColor}
                    textAnchor={textAnchor}
                    dominantBaseline="central"
                    fontSize={fontSize}
                    fontWeight={600}
                  >
                    <tspan x={x} dx={x > cx ? 5 : -5} dy="-5">{name}</tspan>
                    <tspan x={x} dx={x > cx ? 5 : -5} dy="16">{percentage}%</tspan>
                  </text>
                </g>
              );
            }}
            outerRadius={100}
            innerRadius={50}
            fill="#8884d8"
            dataKey="value"
            stroke="#fff"
            strokeWidth={2}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <RechartsTooltip
            formatter={(value: number, payload: any) => {
              const percentage = ((value / totalReads) * 100).toFixed(1);
              const data = Array.isArray(payload) ? payload[0] : payload;
              const name = data?.payload?.name || data?.name || "";
              const scientificName = data?.payload?.scientificName || "";
              const label = scientificName
                ? `${name}\n${scientificName}\n읽기 수: ${value.toLocaleString()} (${percentage}%)`
                : `${name}\n읽기 수: ${value.toLocaleString()} (${percentage}%)`;
              return [label, "읽기 수"];
            }}
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #e5e7eb",
              borderRadius: "8px",
              padding: "12px",
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              whiteSpace: "pre-line",
            }}
            labelStyle={{
              fontWeight: "600",
              marginBottom: "4px",
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* 범례 */}
      <div className="grid grid-cols-2 gap-2 text-xs mt-2">
        {chartData.slice(0, 6).map((entry, index) => (
          <div key={index} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{entry.name}</div>
              {entry.scientificName && (
                <div className="text-muted-foreground text-[10px] truncate">
                  {entry.scientificName}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TooltipOverlay({
  title,
  fishData,
  onClose,
}: {
  title?: string;
  fishData?: FishData[];
  onClose: () => void;
}) {
  // 초기 위치는 top-4 right-4 (16px)에 해당
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 초기 위치 설정 (컴포넌트 마운트 시)
  useEffect(() => {
    if (tooltipRef.current && containerRef.current && position === null) {
      const container = containerRef.current;
      const tooltip = tooltipRef.current;
      
      // top-4 right-4 위치 계산 (16px from top and right)
      // 컨테이너의 크기를 기준으로 계산
      const initialX = container.offsetWidth - tooltip.offsetWidth - 16;
      const initialY = 16;
      
      setPosition({ x: initialX, y: initialY });
    }
  }, [position]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // 닫기 버튼이나 내부 요소 클릭 시 드래그 방지
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    if (!position || !containerRef.current) return;
    
    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    
    setIsDragging(true);
    // 드래그 시작 위치를 컨테이너 기준 상대 좌표로 계산
    setDragStart({
      x: e.clientX - containerRect.left - position.x,
      y: e.clientY - containerRect.top - position.y,
    });
    e.stopPropagation();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && tooltipRef.current && containerRef.current) {
        const container = containerRef.current;
        const containerRect = container.getBoundingClientRect();
        
        // 마우스 위치를 컨테이너 기준 상대 좌표로 변환
        const newX = e.clientX - containerRect.left - dragStart.x;
        const newY = e.clientY - containerRect.top - dragStart.y;
        
        // 지도 컨테이너 내부로 제한
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const maxX = containerRect.width - tooltipRect.width;
        const maxY = containerRect.height - tooltipRect.height;
        
        const clampedX = Math.max(0, Math.min(newX, maxX));
        const clampedY = Math.max(0, Math.min(newY, maxY));
        
        setPosition({
          x: clampedX,
          y: clampedY,
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-50"
      style={{ pointerEvents: 'none' }}
    >
      <div
        ref={tooltipRef}
        className={cn(
          "relative bg-white text-gray-900",
          "rounded-xl border border-gray-200 shadow-2xl",
          "px-6 py-4 min-w-[360px] max-w-[500px]",
          "animate-in fade-in-0 zoom-in-95",
          "pointer-events-auto flex flex-col",
          "backdrop-blur-sm",
          isDragging && "cursor-move"
        )}
        style={
          position
            ? {
                position: 'absolute',
                left: `${position.x}px`,
                top: `${position.y}px`,
              }
            : {
                position: 'absolute',
                right: '16px',
                top: '16px',
              }
        }
        onWheel={(e) => e.stopPropagation()}
        onMouseDown={handleMouseDown}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        {/* 닫기 버튼 */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-900 flex items-center justify-center transition-colors z-20 shadow-sm"
        aria-label="닫기"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      {/* 제목 - 드래그 핸들 */}
      <div 
        className="pr-8 mb-2 cursor-move select-none"
        onMouseDown={handleMouseDown}
      >
        <h3 className="text-xl font-bold text-gray-900">
          {title || "어류 정보"}
        </h3>
      </div>

      {/* 파이 차트와 통계 */}
      {fishData && fishData.length > 0 && (
        <>
          <PieChartComponent fishData={fishData} />
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
              <div className="text-xs text-blue-600 font-medium mb-1">
                발견된 종류
              </div>
              <div className="text-2xl font-bold text-blue-900">
                {fishData.length}
                <span className="text-sm font-normal text-blue-700 ml-1">
                  종
                </span>
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 border border-green-100">
              <div className="text-xs text-green-600 font-medium mb-1">
                총 읽기 수
              </div>
              <div className="text-2xl font-bold text-green-900">
                {fishData.reduce((sum, fish) => sum + fish.reads_count, 0).toLocaleString()}
              </div>
            </div>
          </div>
        </>
      )}
      </div>
    </div>
  );
}

function MarkerListPanel({
  markers,
  onMarkerClick,
}: {
  markers: MarkerData[];
  onMarkerClick: (index: number) => void;
}) {
  return (
    <div className="h-full bg-white border border-gray-200 rounded-lg flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-900">
          마커 목록
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          {markers.length}개의 마커
        </p>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2">
        {markers.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <p className="text-xs">표시할 마커가 없습니다</p>
          </div>
        ) : (
          markers.map((marker, index) => {
            const speciesCount = marker.fishData?.length || 0;
            const totalReads =
              marker.fishData?.reduce(
                (sum, fish) => sum + fish.reads_count,
                0
              ) || 0;

            // taxa별 reads 수 계산 (reads 수가 큰 순서대로 정렬)
            const taxaStats = (() => {
              if (!marker.fishData || marker.fishData.length === 0) return [];
              
              const taxaMap = new Map<string, number>();
              marker.fishData.forEach((fish) => {
                const taxa = fish.taxa || '미분류';
                taxaMap.set(taxa, (taxaMap.get(taxa) || 0) + fish.reads_count);
              });
              
              return Array.from(taxaMap.entries())
                .map(([taxa, reads]) => ({ taxa, reads }))
                .sort((a, b) => b.reads - a.reads);
            })();

            return (
              <button
                key={index}
                onClick={() => onMarkerClick(index)}
                className="w-full text-left bg-gray-50 hover:bg-gray-100 rounded-lg p-3 border border-gray-200 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1"></div>
                      <span className="text-sm font-semibold text-gray-900 truncate">
                        {marker.title || marker.label || `마커 ${index + 1}`}
                      </span>
                    </div>
                    <div className="ml-4 space-y-0.5">
                      {taxaStats.length > 0 && (
                        <div className="text-[10px] text-blue-600 font-medium space-y-0.5">
                          {/* 최대 4개 taxa만 표시 (2줄 x 2개) */}
                          {Array.from({ length: Math.min(2, Math.ceil(taxaStats.slice(0, 4).length / 2)) }, (_, rowIndex) => (
                            <div key={rowIndex} className="flex gap-2">
                              {taxaStats.slice(rowIndex * 2, rowIndex * 2 + 2).map((stat, statIndex) => {
                                const percentage = totalReads > 0 ? ((stat.reads / totalReads) * 100).toFixed(1) : '0.0';
                                const taxaKorean = translateTaxa(stat.taxa);
                                return (
                                  <div key={statIndex} className="flex items-center gap-1 flex-1">
                                    <span>
                                      {taxaKorean}
                                      {stat.taxa !== taxaKorean && ` (${stat.taxa})`}
                                    </span>
                                    <span className="text-gray-500">
                                      {percentage}%
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      )}
                      {marker.fishData && marker.fishData.length > 0 && (
                        <div className="text-[10px] text-gray-600">
                          {speciesCount}종 · {totalReads.toLocaleString()} 읽기
                        </div>
                      )}
                    </div>
                  </div>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 text-gray-400 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function DetailPanel({
  title,
  summary,
  fishData,
  dateData,
  avgMetadata,
  metadata,
  currentDateIndex,
  onDateChange,
}: {
  title?: string;
  summary?: string;
  fishData?: FishData[];
  dateData?: DateSpecificData[];
  avgMetadata?: {
    do?: number | null;
    spc?: number | null;
    pH?: number | null;
  };
  metadata?: {
    location?: {
      lat: number;
      lon: number;
    };
    taxa?: string;
    marker?: string | null;
    manager?: string | null;
    primer?: string | null;
    object?: string | null;
  };
  currentDateIndex: number;
  onDateChange: (index: number) => void;
}) {
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // 날짜별 데이터가 있으면 사용, 없으면 전체 데이터 사용
  const hasDateData = dateData && dateData.length > 0;
  
  // currentDateIndex가 -1이면 전체 데이터, 아니면 해당 날짜 데이터
  // fishData는 이미 상위 컴포넌트에서 currentDateIndex에 맞게 필터링되어 전달됨
  // 따라서 여기서는 받은 데이터를 그대로 표시하면 됨
  
  // 메타데이터 표시를 위한 로직
  const displayMetadata = currentDateIndex >= 0 && hasDateData 
    ? dateData![currentDateIndex].metadata 
    : null;

  const totalReads =
    fishData?.reduce((sum, fish) => sum + fish.reads_count, 0) || 0;
  const speciesCount = fishData?.length || 0;
  const topSpecies = fishData
    ? [...fishData].sort((a, b) => b.reads_count - a.reads_count)
    : [];

  // taxa별 reads 수 계산 (reads 수가 큰 순서대로 정렬)
  const taxaStats = useMemo(() => {
    if (!fishData || fishData.length === 0) return [];
    
    const taxaMap = new Map<string, number>();
    fishData.forEach((fish) => {
      const taxa = fish.taxa || '미분류';
      taxaMap.set(taxa, (taxaMap.get(taxa) || 0) + fish.reads_count);
    });
    
    return Array.from(taxaMap.entries())
      .map(([taxa, reads]) => ({ taxa, reads }))
      .sort((a, b) => b.reads - a.reads);
  }, [fishData]);

  // 날짜 포맷팅 함수
  const formatDate = (date?: number | null): string => {
    if (!date) return '-';
    const dateStr = date.toString();
    if (dateStr.length === 8) {
      return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
    }
    return dateStr;
  };

  // 터치 이벤트 핸들러
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd || !hasDateData) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    // 왼쪽 스와이프: 다음 날짜 (인덱스 증가)
    if (isLeftSwipe && currentDateIndex < dateData!.length - 1) {
      onDateChange(currentDateIndex + 1);
    }
    // 오른쪽 스와이프: 이전 날짜 (인덱스 감소)
    // -1 (전체)까지 갈 수 있음
    if (isRightSwipe && currentDateIndex > -1) {
      onDateChange(currentDateIndex - 1);
    }
  };

  // 마우스 클릭으로도 네비게이션 가능
  const goToPrevious = () => {
    if (hasDateData && currentDateIndex > -1) {
      onDateChange(currentDateIndex - 1);
    }
  };

  const goToNext = () => {
    if (hasDateData && currentDateIndex < dateData!.length - 1) {
      onDateChange(currentDateIndex + 1);
    }
  };

  return (
    <div 
      className="h-full bg-white border border-gray-200 rounded-lg flex flex-col"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div className="p-4 border-b border-gray-200">
        {/* 제목과 좌우 화살표 버튼 */}
        <div className="flex items-center justify-between gap-3 mb-2">
          {hasDateData && dateData && dateData.length > 0 && (
            <button
              onClick={goToPrevious}
              disabled={currentDateIndex === -1}
              className={cn(
                "flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg transition-all shadow-sm",
                currentDateIndex === -1
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700 shadow-md hover:shadow-lg"
              )}
              aria-label="이전 날짜"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900 truncate">
              {title || "상세 정보"}
            </h2>
            {hasDateData && dateData && dateData.length > 0 && (
              <div className="text-xs text-gray-500 mt-0.5">
                {currentDateIndex === -1 ? (
                  <span className="font-medium text-blue-600">전체 기간 합계</span>
                ) : (
                  <span>
                    {formatDate(dateData[currentDateIndex].date)} ({currentDateIndex + 1}/{dateData.length})
                  </span>
                )}
              </div>
            )}
          </div>
          
          {hasDateData && dateData && dateData.length > 0 && (
            <button
              onClick={goToNext}
              disabled={currentDateIndex === dateData.length - 1}
              className={cn(
                "flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg transition-all shadow-sm",
                currentDateIndex === dateData.length - 1
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700 shadow-md hover:shadow-lg"
              )}
              aria-label="다음 날짜"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
        
        {/* 날짜별 네비게이션 - 날짜 탭 목록 */}
        {hasDateData && dateData && dateData.length > 0 && (
          <div className="bg-blue-50 rounded-lg p-2 border border-blue-200 mb-2">
            {/* 날짜 탭 목록 */}
            <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-blue-300 scrollbar-track-blue-100">
              {/* 전체 탭 */}
              <button
                onClick={() => onDateChange(-1)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all flex-shrink-0",
                  currentDateIndex === -1
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-white text-blue-700 hover:bg-blue-100 border border-blue-200"
                )}
              >
                전체
              </button>
              
              {/* 개별 날짜 탭 */}
              {dateData.map((dateItem, index) => (
                <button
                  key={index}
                  onClick={() => onDateChange(index)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all flex-shrink-0",
                    currentDateIndex === index
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-white text-blue-700 hover:bg-blue-100 border border-blue-200"
                  )}
                >
                  {formatDate(dateItem.date)}
                </button>
              ))}
            </div>
            
            {/* 스와이프 힌트 */}
            <div className="text-[10px] text-blue-500 text-center mt-1.5 flex items-center justify-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
              좌우로 스와이프하여 날짜 변경
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        {/* 위치 및 기본 정보 */}
        {metadata && (
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
            <div className="text-xs font-semibold text-gray-700 mb-2">
              위치 정보
            </div>
            <div className="space-y-1 text-[10px] text-gray-600">
              {metadata.marker && (
                <div className="flex justify-between">
                  <span className="font-medium">마커:</span>
                  <span>{metadata.marker}</span>
                </div>
              )}
              {metadata.location && (
                <div className="flex justify-between">
                  <span className="font-medium">좌표:</span>
                  <span>{metadata.location.lat.toFixed(6)}, {metadata.location.lon.toFixed(6)}</span>
                </div>
              )}
              {taxaStats.length > 0 && (
                <div className="space-y-1">
                  <div className="font-medium mb-1">분류별 읽기 수:</div>
                  {taxaStats.map((stat, index) => {
                    const percentage = totalReads > 0 ? ((stat.reads / totalReads) * 100).toFixed(1) : '0.0';
                    return (
                      <div key={index} className="flex justify-between items-center pl-2">
                        <span className="text-[9px]">
                          {translateTaxa(stat.taxa)}
                          {stat.taxa !== translateTaxa(stat.taxa) && ` (${stat.taxa})`}
                        </span>
                        <span className="text-[9px] font-semibold">
                          {stat.reads.toLocaleString()} ({percentage}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              {displayMetadata && displayMetadata.object && (
                <div className="flex justify-between">
                  <span className="font-medium">목적:</span>
                  <span>{displayMetadata.object}</span>
                </div>
              )}
              {displayMetadata && displayMetadata.manager && (
                <div className="flex justify-between">
                  <span className="font-medium">담당자:</span>
                  <span>{displayMetadata.manager}</span>
                </div>
              )}
              {displayMetadata && displayMetadata.primer && (
                <div className="flex justify-between">
                  <span className="font-medium">프라이머:</span>
                  <span>{displayMetadata.primer}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 환경 파라미터 - 날짜별 데이터가 선택되었을 때만 해당 날짜 데이터 표시, 그 외(전체)는 평균 표시 */}
        {currentDateIndex >= 0 && displayMetadata && (displayMetadata.do !== undefined || displayMetadata.spc !== undefined || displayMetadata.pH !== undefined) ? (
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
            <div className="text-xs font-semibold text-blue-700 mb-2">
              환경 파라미터 (현재 날짜)
            </div>
            <div className="grid grid-cols-3 gap-2">
              {displayMetadata.do !== undefined && (
                <div className="text-center">
                  <div className="text-[9px] text-blue-600 font-medium mb-0.5">DO</div>
                  <div className="text-sm font-bold text-blue-900">{displayMetadata.do}</div>
                  <div className="text-[8px] text-blue-600">mg/L</div>
                </div>
              )}
              {displayMetadata.spc !== undefined && (
                <div className="text-center">
                  <div className="text-[9px] text-blue-600 font-medium mb-0.5">SPC</div>
                  <div className="text-sm font-bold text-blue-900">{displayMetadata.spc}</div>
                  <div className="text-[8px] text-blue-600">μS/cm</div>
                </div>
              )}
              {displayMetadata.pH !== undefined && (
                <div className="text-center">
                  <div className="text-[9px] text-blue-600 font-medium mb-0.5">pH</div>
                  <div className="text-sm font-bold text-blue-900">{displayMetadata.pH}</div>
                </div>
              )}
            </div>
          </div>
        ) : (
          avgMetadata && (avgMetadata.do !== undefined || avgMetadata.spc !== undefined || avgMetadata.pH !== undefined) && (
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
              <div className="text-xs font-semibold text-blue-700 mb-2">
                환경 파라미터 (평균)
              </div>
              <div className="grid grid-cols-3 gap-2">
                {avgMetadata.do !== undefined && avgMetadata.do !== null && (
                  <div className="text-center">
                    <div className="text-[9px] text-blue-600 font-medium mb-0.5">DO</div>
                    <div className="text-sm font-bold text-blue-900">{avgMetadata.do.toFixed(2)}</div>
                    <div className="text-[8px] text-blue-600">mg/L</div>
                  </div>
                )}
                {avgMetadata.spc !== undefined && avgMetadata.spc !== null && (
                  <div className="text-center">
                    <div className="text-[9px] text-blue-600 font-medium mb-0.5">SPC</div>
                    <div className="text-sm font-bold text-blue-900">{avgMetadata.spc.toFixed(2)}</div>
                    <div className="text-[8px] text-blue-600">μS/cm</div>
                  </div>
                )}
                {avgMetadata.pH !== undefined && avgMetadata.pH !== null && (
                  <div className="text-center">
                    <div className="text-[9px] text-blue-600 font-medium mb-0.5">pH</div>
                    <div className="text-sm font-bold text-blue-900">{avgMetadata.pH.toFixed(2)}</div>
                  </div>
                )}
              </div>
            </div>
          )
        )}

        {/* 통계 정보 */}
        {fishData && fishData.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className={cn(
                "rounded-lg p-3 border",
                currentDateIndex >= 0 ? "bg-green-50 border-green-100" : "bg-blue-50 border-blue-100"
              )}>
                <div className={cn(
                  "text-[10px] font-medium mb-1",
                  currentDateIndex >= 0 ? "text-green-600" : "text-blue-600"
                )}>
                  발견된 종류 ({currentDateIndex >= 0 ? '현재 날짜' : '전체'})
                </div>
                <div className={cn(
                  "text-lg font-bold",
                  currentDateIndex >= 0 ? "text-green-900" : "text-blue-900"
                )}>
                  {speciesCount}
                  <span className={cn(
                    "text-xs font-normal ml-1",
                    currentDateIndex >= 0 ? "text-green-700" : "text-blue-700"
                  )}>
                    종
                  </span>
                </div>
              </div>
              <div className={cn(
                "rounded-lg p-3 border",
                currentDateIndex >= 0 ? "bg-purple-50 border-purple-100" : "bg-indigo-50 border-indigo-100"
              )}>
                <div className={cn(
                  "text-[10px] font-medium mb-1",
                  currentDateIndex >= 0 ? "text-purple-600" : "text-indigo-600"
                )}>
                  총 읽기 수 ({currentDateIndex >= 0 ? '현재 날짜' : '전체'})
                </div>
                <div className={cn(
                  "text-lg font-bold",
                  currentDateIndex >= 0 ? "text-purple-900" : "text-indigo-900"
                )}>
                  {totalReads.toLocaleString()}
                </div>
              </div>
            </div>
          </>
        )}

        {/* 주요 종류 */}
        {topSpecies.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
            <div className="text-xs font-semibold text-gray-700 mb-2">
              주요 종류
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {topSpecies.map((fish, index) => {
                const percentage = (
                  (fish.reads_count / totalReads) *
                  100
                ).toFixed(1);
                return (
                  <div
                    key={index}
                    className="flex items-start justify-between gap-2 py-1 border-b border-gray-200 last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-semibold text-gray-500 w-3 flex-shrink-0">
                          {index + 1}.
                        </span>
                        <span className="text-xs font-semibold text-gray-900 truncate">
                          {fish.common_name}
                        </span>
                      </div>
                      <div className="text-[9px] text-gray-600 ml-4.5 mt-0.5 truncate">
                        {fish.scientific_name}
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-[10px] font-semibold text-gray-900">
                        {fish.reads_count.toLocaleString()}
                      </div>
                      <div className="text-[9px] text-gray-500">
                        {percentage}%
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 요약 텍스트 */}
        {summary && (
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
            <div className="text-xs font-semibold text-gray-700 mb-2">
              요약
            </div>
            <div className="text-[10px] text-gray-600 whitespace-pre-line leading-relaxed">
              {summary}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 여러 마커의 fishData를 합치는 함수
function mergeFishData(fishDataArrays: FishData[][]): FishData[] {
  const merged = new Map<string, FishData>();
  
  fishDataArrays.forEach((fishData) => {
    fishData.forEach((fish) => {
      const key = `${fish.scientific_name}|${fish.common_name}`;
      if (merged.has(key)) {
        const existing = merged.get(key)!;
        existing.reads_count += fish.reads_count;
      } else {
        merged.set(key, {
          ...fish,
        });
      }
    });
  });
  
  return Array.from(merged.values()).sort((a, b) => b.reads_count - a.reads_count);
}

// 마커 데이터에서 가장 높은 비율의 taxa를 계산하는 함수
function getDominantTaxa(marker: MarkerData): string | undefined {
  if (!marker.fishData || marker.fishData.length === 0) {
    return marker.taxa; // fishData가 없으면 metadata의 taxa 사용
  }
  
  const totalReads = marker.fishData.reduce((sum, fish) => sum + fish.reads_count, 0);
  if (totalReads === 0) {
    return marker.taxa;
  }
  
  const taxaMap = new Map<string, number>();
  marker.fishData.forEach((fish) => {
    const taxa = fish.taxa || '미분류';
    taxaMap.set(taxa, (taxaMap.get(taxa) || 0) + fish.reads_count);
  });
  
  // 가장 높은 reads 수를 가진 taxa 찾기
  let dominantTaxa: string | undefined;
  let maxReads = 0;
  
  taxaMap.forEach((reads, taxa) => {
    if (reads > maxReads) {
      maxReads = reads;
      dominantTaxa = taxa;
    }
  });
  
  return dominantTaxa || marker.taxa;
}

function MapContent({
  center = defaultCenter,
  zoom = 13,
  markers = [],
  selectedMarkerIndices,
  setSelectedMarkerIndices,
  currentDateIndex,
  setCurrentDateIndex,
}: {
  center: { lat: number; lng: number };
  zoom: number;
  markers: MarkerData[];
  selectedMarkerIndices: number[];
  setSelectedMarkerIndices: (indices: number[]) => void;
  currentDateIndex: number;
  setCurrentDateIndex: (index: number) => void;
}) {
  const selectedMarkers = selectedMarkerIndices.map((index) => markers[index]).filter(Boolean);
  const [mapBounds, setMapBounds] = useState<google.maps.LatLngBounds | null>(null);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(13);

  // 지도 bounds 및 zoom 업데이트 함수
  const updateBounds = useMemo(
    () => () => {
      if (mapInstance) {
        const bounds = mapInstance.getBounds();
        if (bounds) {
          setMapBounds(bounds);
        }
        const zoom = mapInstance.getZoom();
        if (zoom !== undefined) {
          setZoomLevel(zoom);
        }
      }
    },
    [mapInstance]
  );

  // 지도 로드 시 map 인스턴스 저장
  const onMapLoad = (map: google.maps.Map) => {
    setMapInstance(map);
  };

  // 지도 이벤트 리스너 등록 및 정리
  useEffect(() => {
    if (!mapInstance) return;

    // 여러 이벤트에서 bounds 업데이트
    const listeners: google.maps.MapsEventListener[] = [
      mapInstance.addListener("bounds_changed", updateBounds),
      mapInstance.addListener("idle", updateBounds),
      mapInstance.addListener("zoom_changed", updateBounds),
      mapInstance.addListener("center_changed", updateBounds),
    ];

    // 초기 bounds 설정
    updateBounds();

    // 컴포넌트 언마운트 시 리스너 제거
    return () => {
      listeners.forEach((listener) => {
        google.maps.event.removeListener(listener);
      });
    };
  }, [mapInstance, updateBounds]);

  // 현재 bounds 안에 있는 마커만 필터링
  const visibleMarkers = useMemo(() => {
    if (!mapBounds) return markers; // bounds가 없으면 모든 마커 표시

    // 원본 bounds 사용 (padding 제거)
    // Google Maps의 bounds는 이미 실제 viewport를 포함하므로 추가 축소 불필요
    return markers.filter((marker) => {
      const latLng = new google.maps.LatLng(marker.position.lat, marker.position.lng);
      return mapBounds.contains(latLng);
    });
  }, [markers, mapBounds]);

  // 같은 위치의 마커들을 그룹화하고 위치를 조정
  interface ProcessedMarker extends MarkerData {
    originalIndex: number;
    offsetX: number;
    offsetY: number;
    size: number;
  }

  const processedMarkers = useMemo(() => {
    // 위치별로 마커 그룹화 (위치가 매우 가까운 경우 같은 그룹으로 처리)
    const positionTolerance = 0.0001; // 약 11m 정도
    interface GroupItem {
      marker: MarkerData;
      index: number;
    }
    const groups: GroupItem[][] = [];
    const processed: boolean[] = new Array(markers.length).fill(false);

    markers.forEach((marker, index) => {
      if (processed[index]) return;

      const group: GroupItem[] = [{ marker, index }];
      processed[index] = true;

      // 같은 위치에 있는 다른 마커 찾기
      markers.forEach((otherMarker, otherIndex) => {
        if (processed[otherIndex] || index === otherIndex) return;

        const latDiff = Math.abs(marker.position.lat - otherMarker.position.lat);
        const lngDiff = Math.abs(marker.position.lng - otherMarker.position.lng);

        if (latDiff < positionTolerance && lngDiff < positionTolerance) {
          group.push({ marker: otherMarker, index: otherIndex });
          processed[otherIndex] = true;
        }
      });

      groups.push(group);
    });

    // 줌 레벨에 따른 오프셋 스케일 계산
    // 줌 레벨이 낮을수록(저배율) 더 큰 오프셋 필요
    // 줌 레벨 0-20 범위에서, 줌 레벨이 낮을수록 스케일이 커짐
    // 예: 줌 5 → 스케일 6.0, 줌 10 → 스케일 3.0, 줌 15 → 스케일 1.5, 줌 20 → 스케일 0.8
    const zoomScale = Math.max(0.5, Math.min(8.0, Math.pow(2, (12 - zoomLevel) / 2.5)));

    // 각 그룹을 처리하여 마커 생성
    const result: ProcessedMarker[] = [];

    groups.forEach((group) => {
      const isMultiple = group.length > 1;
      // 마커 크기를 키움 (줌 레벨과 무관하게 고정) - 체감 크기 10% 증가
      const baseSize = 70; // 64 * 1.1 ≈ 70
      const reducedSize = isMultiple ? 62 : baseSize; // 56 * 1.1 ≈ 62

      if (isMultiple) {
        // 여러 taxa가 있는 경우 원형으로 배치
        const angleStep = (2 * Math.PI) / group.length;
        // 줌 레벨에 따라 반지름 조정 (저배율일수록 더 큰 반지름)
        // baseRadius를 더 크게 설정하여 저배율에서 충분한 간격 확보
        const baseRadius = reducedSize * 0.8; // 0.6 → 0.8로 증가
        const radius = baseRadius * zoomScale; // 줌 레벨에 따라 스케일 조정

        group.forEach((groupItem, groupIndex) => {
          const angle = groupIndex * angleStep;
          // 위도/경도 오프셋 계산 (대략적인 변환)
          // 1도 ≈ 111km, 따라서 작은 오프셋은 미터 단위로 변환
          const offsetMeters = radius;
          const basePosition = group[0].marker.position;
          const latOffset = (offsetMeters * Math.cos(angle)) / 111000;
          const lngOffset = (offsetMeters * Math.sin(angle)) / (111000 * Math.cos(basePosition.lat * Math.PI / 180));

          result.push({
            ...groupItem.marker,
            originalIndex: groupItem.index,
            position: {
              lat: basePosition.lat + latOffset,
              lng: basePosition.lng + lngOffset,
            },
            offsetX: 0,
            offsetY: 0,
            size: reducedSize,
          });
        });
      } else {
        // 단일 마커
        result.push({
          ...group[0].marker,
          originalIndex: group[0].index,
          offsetX: 0,
          offsetY: 0,
          size: baseSize,
        });
      }
    });

    return result;
  }, [markers, zoomLevel]);

  // 마커 아이콘을 상태로 관리 (비동기 이미지 로딩 처리)
  const [markerIcons, setMarkerIcons] = useState<Map<number, google.maps.Icon | google.maps.Symbol>>(new Map());
  
  // 마커 아이콘을 미리 로드하고 캐시
  useEffect(() => {
    const loadMarkerIcons = async () => {
      const iconMap = new Map<number, google.maps.Icon | google.maps.Symbol>();
      
      for (const processedMarker of processedMarkers) {
        const marker = markers[processedMarker.originalIndex];
        if (!marker) continue;
        
        const dominantTaxa = getDominantTaxa(marker);
        // 요청사항: 마커는 항상 원본 PNG 컬러를 사용하고(=흑백 변환 X),
        // 선택되지 않은 마커는 opacity로만 약하게 처리하여 흰색 테두리를 유지한다.
        
        try {
          const icon = await createTaxaMarkerIconAsync(
            dominantTaxa,
            false,
            processedMarker.size,
            processedMarker.offsetX,
            processedMarker.offsetY
          );
          iconMap.set(processedMarker.originalIndex, icon);
        } catch (error) {
          console.warn('Failed to create marker icon:', error);
          // 실패 시 기본 아이콘 사용
          iconMap.set(processedMarker.originalIndex, createFishIcon(false));
        }
      }
      
      setMarkerIcons(iconMap);
    };
    
    loadMarkerIcons();
  }, [processedMarkers, selectedMarkerIndices, markers]);
  
  // 선택된 마커는 컬러, 선택되지 않은 마커는 흑백 아이콘 사용
  // 단, 아무것도 선택하지 않은 상태에서는 모든 마커가 컬러
  const getMarkerIcon = (index: number): google.maps.Icon | google.maps.Symbol => {
    // 캐시된 아이콘이 있으면 사용
    if (markerIcons.has(index)) {
      return markerIcons.get(index)!;
    }
    
    // 캐시에 없으면 기본 아이콘 사용 (로딩 중)
    return createFishIcon(false);
  };

  // 선택된 마커들의 데이터 합치기 (날짜 선택 반영)
  const mergedFishData = useMemo(() => {
    if (selectedMarkers.length === 0) return [];

    // 전체 보기 (-1) 일 때
    if (currentDateIndex === -1) {
      const allFishData = selectedMarkers
        .map((marker) => marker.fishData || [])
        .filter((data) => data.length > 0);
      return mergeFishData(allFishData);
    }

    // 특정 날짜 선택 시 (단일 마커 선택을 가정하거나, 다중 선택 시에도 해당 인덱스의 데이터가 있으면 합침)
    const dateSpecificFishData = selectedMarkers
      .map((marker) => {
        if (marker.dateData && marker.dateData.length > currentDateIndex) {
          return marker.dateData[currentDateIndex].fishData;
        }
        return [];
      })
      .filter((data) => data.length > 0);
      
    return mergeFishData(dateSpecificFishData);
  }, [selectedMarkers, currentDateIndex]);

  // 합쳐진 데이터의 요약 생성
  const mergedSummary = useMemo(() => {
    if (mergedFishData.length === 0) return "";
    const totalReads = mergedFishData.reduce((sum, fish) => sum + fish.reads_count, 0);
    const speciesCount = mergedFishData.length;
    const topSpecies = mergedFishData.slice(0, 3);
    const taxa = selectedMarkers[0]?.taxa || "";

    let summary = '';
    if (taxa) {
      const taxaKorean = translateTaxa(taxa);
      summary += `분류: ${taxaKorean} (${taxa})\n`;
    }
    
    // 날짜 정보 표시
    if (currentDateIndex !== -1 && selectedMarkers.length === 1 && selectedMarkers[0].dateData) {
      const date = selectedMarkers[0].dateData[currentDateIndex].date;
      const dateStr = date.toString();
      const formattedDate = dateStr.length === 8 
        ? `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`
        : dateStr;
      summary += `날짜: ${formattedDate}\n`;
    } else {
      summary += `기간: 전체 합계\n`;
    }

    summary += `선택된 위치: ${selectedMarkers.length}개\n`;
    summary += `총 ${speciesCount}종의 어류가 발견되었습니다.\n`;
    summary += `총 읽기 수: ${totalReads.toLocaleString()}\n\n`;
    summary += `주요 종류:\n`;
    
    topSpecies.forEach((fish, index) => {
      summary += `${index + 1}. ${fish.common_name} (${fish.scientific_name})\n`;
      summary += `   읽기 수: ${fish.reads_count.toLocaleString()}\n`;
    });

    return summary;
  }, [mergedFishData, selectedMarkers, currentDateIndex]);

  return (
    <div className="flex h-[600px] gap-4">
      {/* 지도 영역 */}
      <div className="relative flex-1" style={{ height: "600px" }}>
        <GoogleMap
          mapContainerStyle={{ width: "100%", height: "100%" }}
          center={center}
          zoom={zoom}
          onLoad={onMapLoad}
          onClick={() => {
            setSelectedMarkerIndices([]);
            setCurrentDateIndex(-1);
          }}
          options={{
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
            gestureHandling: "greedy",
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
          {processedMarkers.map((processedMarker, index) => (
            <Marker
              key={`${processedMarker.originalIndex}-${index}`}
              position={processedMarker.position}
              icon={getMarkerIcon(processedMarker.originalIndex)}
              opacity={
                selectedMarkerIndices.length > 0 &&
                !selectedMarkerIndices.includes(processedMarker.originalIndex)
                  ? 0.35
                  : 1
              }
              title={processedMarker.title || processedMarker.label}
              onClick={() => {
                const originalIndex = processedMarker.originalIndex;
                // 토글 방식: 이미 선택된 마커면 해제, 아니면 추가
                if (selectedMarkerIndices.includes(originalIndex)) {
                  setSelectedMarkerIndices(selectedMarkerIndices.filter((i) => i !== originalIndex));
                } else {
                  setSelectedMarkerIndices([...selectedMarkerIndices, originalIndex]);
                }
                // 마커 선택 변경 시 전체 보기로 초기화
                setCurrentDateIndex(-1);
              }}
            />
          ))}
        </GoogleMap>
        {selectedMarkers.length > 0 && (
          <TooltipOverlay
            title={
              selectedMarkers.length === 1
                ? selectedMarkers[0].title || selectedMarkers[0].label || "선택된 위치"
                : `${selectedMarkers.length}개 위치 선택됨`
            }
            fishData={mergedFishData} // 여기서 전달되는 데이터가 currentDateIndex에 따라 변경됨
            onClose={() => {
              setSelectedMarkerIndices([]);
              setCurrentDateIndex(-1);
            }}
          />
        )}
      </div>

      {/* 오른쪽 상세 정보 패널 - 항상 표시 */}
      <div className="w-[24rem] flex-shrink-0 h-full">
        {selectedMarkers.length > 0 ? (
          <DetailPanel
            title={
              selectedMarkers.length === 1
                ? selectedMarkers[0].title || selectedMarkers[0].label || "상세 정보"
                : `${selectedMarkers.length}개 위치 합계`
            }
            summary={mergedSummary}
            fishData={mergedFishData} // 이미 필터링된 데이터 전달
            dateData={selectedMarkers.length === 1 ? selectedMarkers[0].dateData : undefined}
            avgMetadata={selectedMarkers.length === 1 ? selectedMarkers[0].avgMetadata : undefined}
            metadata={selectedMarkers.length === 1 ? selectedMarkers[0].metadata : undefined}
            currentDateIndex={currentDateIndex}
            onDateChange={setCurrentDateIndex}
          />
        ) : (
          <MarkerListPanel
            markers={visibleMarkers}
            onMarkerClick={(index) => {
              // visibleMarkers의 인덱스를 원본 markers의 인덱스로 변환
              const visibleMarker = visibleMarkers[index];
              const originalIndex = markers.findIndex(
                (m) =>
                  m.position.lat === visibleMarker.position.lat &&
                  m.position.lng === visibleMarker.position.lng
              );
              if (originalIndex !== -1) {
                // 토글 방식으로 선택/해제
                if (selectedMarkerIndices.includes(originalIndex)) {
                  setSelectedMarkerIndices(selectedMarkerIndices.filter((i) => i !== originalIndex));
                } else {
                  setSelectedMarkerIndices([...selectedMarkerIndices, originalIndex]);
                }
                setCurrentDateIndex(-1);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

export default function GoogleMapComponent({
  apiKey,
  center = defaultCenter,
  zoom = 13,
  markers = [],
}: GoogleMapComponentProps) {
  const libraries: any[] = useMemo(() => ["places"], []);
  const [selectedMarkerIndices, setSelectedMarkerIndices] = useState<number[]>([]);
  const [currentDateIndex, setCurrentDateIndex] = useState<number>(-1); // -1: 전체, 0~: 특정 날짜 인덱스

  return (
    <LoadScript googleMapsApiKey={apiKey} libraries={libraries}>
      <MapContent
        center={center}
        zoom={zoom}
        markers={markers}
        selectedMarkerIndices={selectedMarkerIndices}
        setSelectedMarkerIndices={(indices) => {
          setSelectedMarkerIndices(indices);
          setCurrentDateIndex(-1); // 마커 변경 시 전체 보기로 초기화
        }}
        currentDateIndex={currentDateIndex}
        setCurrentDateIndex={setCurrentDateIndex}
      />
    </LoadScript>
  );
}
