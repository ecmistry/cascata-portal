import * as XLSX from 'xlsx';

interface ExportData {
  company: {
    name: string;
    description?: string;
  };
  forecasts: Array<{
    year: number;
    quarter: number;
    region: string;
    sqlType: string;
    predictedSqls: number;
    predictedOpps: number;
    predictedRevenueNew: number;
    predictedRevenueUpsell: number;
  }>;
  sqlHistory: Array<{
    year: number;
    quarter: number;
    region: string;
    sqlType: string;
    volume: number;
  }>;
  conversionRates: Array<{
    region: string;
    sqlType: string;
    oppCoverageRatio: number;
    winRateNew: number;
    winRateUpsell: number;
  }>;
  dealEconomics: Array<{
    region: string;
    acvNew: number;
    acvUpsell: number;
  }>;
}

export function exportToExcel(data: ExportData) {
  const workbook = XLSX.utils.book_new();

  // Summary sheet
  const summaryData = [
    ['Cascade Model Export'],
    ['Company', data.company.name],
    ['Description', data.company.description || ''],
    ['Generated', new Date().toLocaleDateString()],
    [],
    ['Total Forecasts', data.forecasts.length],
    ['Historical Records', data.sqlHistory.length],
    ['Conversion Rates', data.conversionRates.length],
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  // Forecasts sheet
  if (data.forecasts.length > 0) {
    const forecastsData = data.forecasts.map(f => ({
      Period: `${f.year}-Q${f.quarter}`,
      Region: f.region,
      'SQL Type': f.sqlType,
      'Predicted SQLs': f.predictedSqls,
      'Predicted Opps': f.predictedOpps,
      'Revenue (New)': (f.predictedRevenueNew / 100).toFixed(2),
      'Revenue (Upsell)': (f.predictedRevenueUpsell / 100).toFixed(2),
      'Total Revenue': ((f.predictedRevenueNew + f.predictedRevenueUpsell) / 100).toFixed(2),
    }));
    const forecastsSheet = XLSX.utils.json_to_sheet(forecastsData);
    XLSX.utils.book_append_sheet(workbook, forecastsSheet, 'Forecasts');
  }

  // SQL History sheet
  if (data.sqlHistory.length > 0) {
    const historyData = data.sqlHistory.map(h => ({
      Period: `${h.year}-Q${h.quarter}`,
      Region: h.region,
      'SQL Type': h.sqlType,
      Volume: h.volume,
    }));
    const historySheet = XLSX.utils.json_to_sheet(historyData);
    XLSX.utils.book_append_sheet(workbook, historySheet, 'SQL History');
  }

  // Conversion Rates sheet
  if (data.conversionRates.length > 0) {
    const ratesData = data.conversionRates.map(r => ({
      Region: r.region,
      'SQL Type': r.sqlType,
      'SQL→Opp %': (r.oppCoverageRatio / 100).toFixed(2),
      'Win Rate (New) %': (r.winRateNew / 100).toFixed(2),
      'Win Rate (Upsell) %': (r.winRateUpsell / 100).toFixed(2),
    }));
    const ratesSheet = XLSX.utils.json_to_sheet(ratesData);
    XLSX.utils.book_append_sheet(workbook, ratesSheet, 'Conversion Rates');
  }

  // Deal Economics sheet
  if (data.dealEconomics.length > 0) {
    const economicsData = data.dealEconomics.map(e => ({
      Region: e.region,
      'ACV (New)': (e.acvNew / 100).toFixed(2),
      'ACV (Upsell)': (e.acvUpsell / 100).toFixed(2),
    }));
    const economicsSheet = XLSX.utils.json_to_sheet(economicsData);
    XLSX.utils.book_append_sheet(workbook, economicsSheet, 'Deal Economics');
  }

  // Generate Excel file
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  
  // Download
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${data.company.name.replace(/\s+/g, '_')}_Cascade_Model_${new Date().toISOString().split('T')[0]}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToPDF(data: ExportData) {
  // Create a printable HTML version
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Popup blocked. Please allow popups for this site.');
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${data.company.name} - Cascade Model Report</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 40px;
          color: #333;
        }
        h1 {
          color: #2563eb;
          border-bottom: 2px solid #2563eb;
          padding-bottom: 10px;
        }
        h2 {
          color: #1e40af;
          margin-top: 30px;
          border-bottom: 1px solid #ddd;
          padding-bottom: 5px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: left;
        }
        th {
          background-color: #f3f4f6;
          font-weight: bold;
        }
        tr:nth-child(even) {
          background-color: #f9fafb;
        }
        .summary {
          background-color: #eff6ff;
          padding: 15px;
          border-radius: 5px;
          margin: 20px 0;
        }
        .summary p {
          margin: 5px 0;
        }
        @media print {
          body {
            margin: 20px;
          }
          h2 {
            page-break-before: always;
          }
          table {
            page-break-inside: avoid;
          }
        }
      </style>
    </head>
    <body>
      <h1>${data.company.name} - Cascade Model Report</h1>
      
      <div class="summary">
        <p><strong>Description:</strong> ${data.company.description || 'N/A'}</p>
        <p><strong>Generated:</strong> ${new Date().toLocaleDateString()}</p>
        <p><strong>Total Forecasts:</strong> ${data.forecasts.length}</p>
        <p><strong>Historical Records:</strong> ${data.sqlHistory.length}</p>
      </div>

      <h2>Revenue Forecasts</h2>
      <table>
        <thead>
          <tr>
            <th>Period</th>
            <th>Region</th>
            <th>SQL Type</th>
            <th>Predicted SQLs</th>
            <th>Predicted Opps</th>
            <th>Revenue (New)</th>
            <th>Revenue (Upsell)</th>
            <th>Total Revenue</th>
          </tr>
        </thead>
        <tbody>
          ${data.forecasts.slice(0, 50).map(f => `
            <tr>
              <td>${f.year}-Q${f.quarter}</td>
              <td>${f.region}</td>
              <td>${f.sqlType}</td>
              <td>${f.predictedSqls}</td>
              <td>${f.predictedOpps}</td>
              <td>$${(f.predictedRevenueNew / 100).toFixed(0)}</td>
              <td>$${(f.predictedRevenueUpsell / 100).toFixed(0)}</td>
              <td>$${((f.predictedRevenueNew + f.predictedRevenueUpsell) / 100).toFixed(0)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <h2>Conversion Rates</h2>
      <table>
        <thead>
          <tr>
            <th>Region</th>
            <th>SQL Type</th>
            <th>SQL→Opp %</th>
            <th>Win Rate (New) %</th>
            <th>Win Rate (Upsell) %</th>
          </tr>
        </thead>
        <tbody>
          ${data.conversionRates.map(r => `
            <tr>
              <td>${r.region}</td>
              <td>${r.sqlType}</td>
              <td>${(r.oppCoverageRatio / 100).toFixed(2)}%</td>
              <td>${(r.winRateNew / 100).toFixed(2)}%</td>
              <td>${(r.winRateUpsell / 100).toFixed(2)}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <h2>Deal Economics</h2>
      <table>
        <thead>
          <tr>
            <th>Region</th>
            <th>ACV (New)</th>
            <th>ACV (Upsell)</th>
          </tr>
        </thead>
        <tbody>
          ${data.dealEconomics.map(e => `
            <tr>
              <td>${e.region}</td>
              <td>$${(e.acvNew / 100).toFixed(2)}</td>
              <td>$${(e.acvUpsell / 100).toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}
