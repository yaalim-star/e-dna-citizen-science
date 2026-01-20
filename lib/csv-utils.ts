export interface FishData {
  scientific_name: string;
  common_name: string;
  reads_count: number;
  taxa?: string; // taxa 분류 정보 (선택적)
}

export function parseCSV(csvText: string): FishData[] {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',');
  
  return lines.slice(1).map(line => {
    const values = line.split(',');
    return {
      scientific_name: values[0]?.trim() || '',
      common_name: values[1]?.trim() || '',
      reads_count: parseInt(values[2]?.trim() || '0', 10),
    };
  }).filter(fish => fish.scientific_name && fish.common_name);
}

// taxa를 한국어로 변환하는 함수
function translateTaxa(taxa: string): string {
  const taxaMap: Record<string, string> = {
    'Actinopterygii': '조기어류',
    'Chondrichthyes': '연골어류',
    'Sarcopterygii': '육기어류',
    'Agnatha': '무악류',
  };
  
  return taxaMap[taxa] || taxa;
}

export function summarizeFishData(fishData: FishData[], taxa?: string): string {
  if (fishData.length === 0) {
    return '데이터가 없습니다.';
  }

  const totalReads = fishData.reduce((sum, fish) => sum + fish.reads_count, 0);
  const speciesCount = fishData.length;
  const topSpecies = fishData
    .sort((a, b) => b.reads_count - a.reads_count)
    .slice(0, 3);

  let summary = '';
  
  // taxa 정보가 있으면 포함
  if (taxa) {
    const taxaKorean = translateTaxa(taxa);
    summary += `분류: ${taxaKorean} (${taxa})\n`;
  }
  
  summary += `총 ${speciesCount}종의 어류가 발견되었습니다.\n`;
  summary += `총 읽기 수: ${totalReads.toLocaleString()}\n\n`;
  summary += `주요 종류:\n`;
  
  topSpecies.forEach((fish, index) => {
    summary += `${index + 1}. ${fish.common_name} (${fish.scientific_name})\n`;
    summary += `   읽기 수: ${fish.reads_count.toLocaleString()}\n`;
  });

  return summary;
}

