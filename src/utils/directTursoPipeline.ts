const TURSO_URL = 'https://database-bole-fountain-vercel-icfg-wtfhxgjjiy9lmfiuh8gfv964.aws-us-east-1.turso.io';
const TURSO_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODk2NzIzMDYsImlkIjoiMDFhMGFmZGYtZTkwMS03ZWE0LTk0MmYtZGIzNzdlMGU5NzAwIiwia2lkIjoiSS12NFl1YVl2YmpkZUFSQUgyNHpSSE1SdkZvbGNYZ08tVVdpODdneEpwSSIsInJpZCI6IjlhOTdhNzQ3LTQwYWUtNDZkMy1iN2M4LWU2ZmYwN2E4NTFkZCJ9.smbyj94XyW6Ope6EdhfxIe2a8Tg3Y_c5KEZymuwySVumMazh5rHi2iZtGSFbTmCVWHxDSKjjOHPLldanhBOfDw';

export interface Statement {
  sql: string;
  args?: any[];
}

export interface PipelineResult {
  rows: Record<string, any>[];
  rowsAffected: number;
}

export async function executeTursoPipelineDirect(stmts: Statement[]): Promise<PipelineResult[]> {
  const requests: any[] = stmts.map(s => {
    const args = (s.args || []).map(a => {
      if (a === null || a === undefined) return { type: 'null' };
      if (typeof a === 'number') return { type: Number.isInteger(a) ? 'integer' : 'float', value: String(a) };
      if (typeof a === 'boolean') return { type: 'integer', value: a ? '1' : '0' };
      return { type: 'text', value: String(a) };
    });
    return { type: 'execute', stmt: { sql: s.sql, args } };
  });
  requests.push({ type: 'close' });

  const res = await fetch(`${TURSO_URL}/v2/pipeline`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TURSO_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ requests })
  });

  if (!res.ok) {
    throw new Error(`Turso HTTP Pipeline error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  if (!data.results || !Array.isArray(data.results)) {
    throw new Error('Invalid pipeline response format');
  }

  return data.results.slice(0, stmts.length).map((r: any) => {
    if (r.type === 'error') {
      throw new Error(r.error?.message || 'Turso query execution failed');
    }
    const result = r.response.result;
    const cols = result.cols.map((c: any) => c.name);
    const rows = result.rows.map((row: any[]) => {
      const obj: Record<string, any> = {};
      row.forEach((cell: any, idx: number) => {
        let val = cell.value;
        if (cell.type === 'integer') val = parseInt(cell.value, 10);
        else if (cell.type === 'float') val = parseFloat(cell.value);
        else if (cell.type === 'null') val = null;
        obj[cols[idx]] = val;
      });
      return obj;
    });
    return { rows, rowsAffected: result.affected_row_count || 0 };
  });
}
