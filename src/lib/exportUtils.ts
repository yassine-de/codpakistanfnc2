export function exportToCSV(data: Record<string, any>[], columns: { key: string; label: string }[], filename: string) {
  const header = columns.map(c => c.label).join(',');
  const rows = data.map(row =>
    columns.map(col => {
      const val = String(row[col.key] ?? '').replace(/"/g, '""');
      return `"${val}"`;
    }).join(',')
  );
  const csv = [header, ...rows].join('\n');
  downloadFile(csv, `${filename}.csv`, 'text/csv');
}

export function exportToExcel(data: Record<string, any>[], columns: { key: string; label: string }[], filename: string) {
  // Simple XML-based Excel export
  const header = columns.map(c => `<th>${escapeXml(c.label)}</th>`).join('');
  const rows = data.map(row =>
    '<tr>' + columns.map(col => `<td>${escapeXml(String(row[col.key] ?? ''))}</td>`).join('') + '</tr>'
  ).join('');

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Worksheet ss:Name="Sheet1">
    <Table>
      <Row>${columns.map(c => `<Cell><Data ss:Type="String">${escapeXml(c.label)}</Data></Cell>`).join('')}</Row>
      ${data.map(row => '<Row>' + columns.map(col => {
        const val = row[col.key];
        const isNum = typeof val === 'number' || (!isNaN(Number(val)) && val !== '' && val !== null);
        return `<Cell><Data ss:Type="${isNum ? 'Number' : 'String'}">${escapeXml(String(val ?? ''))}</Data></Cell>`;
      }).join('') + '</Row>').join('\n      ')}
    </Table>
  </Worksheet>
</Workbook>`;

  downloadFile(xml, `${filename}.xls`, 'application/vnd.ms-excel');
}

function escapeXml(str: string) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
