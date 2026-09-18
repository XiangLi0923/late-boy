import React, { useState, useCallback } from 'react';
import { useEngine } from '../hooks/useEngine';

interface DiagResult {
  check: string;
  module: string;
  status: string;
  detail: string;
}

const DiagnosePanel: React.FC = () => {
  const [results, setResults] = useState<DiagResult[]>([]);
  const [running, setRunning] = useState(false);
  const { runDiagnostics, isWasm } = useEngine();

  const handleDiagnose = useCallback(async () => {
    setRunning(true);
    try {
      const engineResults = await runDiagnostics();
      setResults(engineResults);
    } catch (err: any) {
      setResults([
        { check: 'engine_error', module: 'SYSTEM', status: 'FAIL', detail: err.message || 'Unknown error' },
      ]);
    } finally {
      setRunning(false);
    }
  }, [runDiagnostics]);

  const passCount = results.filter((r) => r.status === 'PASS').length;
  const failCount = results.filter((r) => r.status === 'FAIL').length;
  const repairedCount = results.filter((r) => r.status === 'REPAIRED').length;

  return (
    <div className="diagnose-panel">
      <h2>系统诊断</h2>
      <p className="engine-mode">引擎: {isWasm ? 'WASM (C++)' : 'JS 模拟器'}</p>
      <button
        className="btn btn-primary"
        onClick={handleDiagnose}
        disabled={running}
      >
        {running ? '⏳ 诊断中...' : '🔍 运行诊断'}
      </button>

      {results.length > 0 && (
        <>
          <div className="diagnose-summary">
            <span className="pass">✓ {passCount} PASS</span>
            {failCount > 0 && <span className="fail">✗ {failCount} FAIL</span>}
            {repairedCount > 0 && <span className="repaired">🔧 {repairedCount} REPAIRED</span>}
          </div>

          <table className="diagnose-table">
            <thead>
              <tr>
                <th>模块</th>
                <th>检查项</th>
                <th>状态</th>
                <th>详情</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i} className={`row-${r.status.toLowerCase()}`}>
                  <td>{r.module}</td>
                  <td>{r.check}</td>
                  <td>
                    <span className={`badge badge-${r.status.toLowerCase()}`}>
                      {r.status}
                    </span>
                  </td>
                  <td>{r.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
};

export default DiagnosePanel;
