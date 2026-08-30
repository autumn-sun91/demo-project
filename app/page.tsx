"use client";

import { useRef, useState } from "react";
import type { AnalysisResult } from "@/types/analysis";

const MAX_SIZE = 5 * 1024 * 1024;

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(bytes < 1024 * 1024 ? 0 : 1)} ${bytes < 1024 * 1024 ? "KB" : "MB"}`;
}

function UploadIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4a2 2 0 002 2h10a2 2 0 002-2v-4" /></svg>;
}

function FileIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7a2 2 0 01-2-2V5a2 2 0 012-2zM14 3v5h5M9 13h6M9 17h4" /></svg>;
}

function Results({ result, onReset }: { result: AnalysisResult; onReset: () => void }) {
  const exportMarkdown = () => {
    const lines = [
      `# ${result.fileName} 분석 결과`, "", "## 요약", result.summary.overview, "",
      ...result.summary.keyPoints.map((point) => `- ${point}`), "", "## 액션 아이템",
      ...(result.actionItems.length
        ? result.actionItems.map((item) => `- [ ] ${item.text}${item.assignee ? ` — 담당: ${item.assignee}` : ""}${item.dueDate ? ` / 기한: ${item.dueDate}` : ""}`)
        : ["- 발견된 액션 아이템이 없습니다."]),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${result.fileName.replace(/\.csv$/i, "")}-analysis.md`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <section className="results" aria-live="polite">
      <div className="results-heading">
        <div><span className="eyebrow">ANALYSIS COMPLETE</span><h2>대화 분석 결과</h2><p>{result.fileName}</p></div>
        <div className="result-actions">
          <button className="button button-secondary" onClick={exportMarkdown}>Markdown 저장</button>
          <button className="button button-ghost" onClick={onReset}>다른 파일 분석</button>
        </div>
      </div>

      {result.warnings.length > 0 && <div className="warning-box">{result.warnings.map((warning) => <p key={warning}>ⓘ {warning}</p>)}</div>}

      <div className="stat-grid">
        <article className="stat-card"><span>메시지</span><strong>{result.totalMessages.toLocaleString()}</strong><small>분석 완료</small></article>
        <article className="stat-card"><span>참여자</span><strong>{result.participantCount.toLocaleString()}</strong><small>고유 발신자</small></article>
        <article className="stat-card"><span>액션 아이템</span><strong>{result.actionItems.length.toLocaleString()}</strong><small>실행 문장 감지</small></article>
      </div>

      <div className="result-grid">
        <article className="panel summary-panel">
          <div className="panel-title"><span className="panel-icon">✦</span><h3>대화 요약</h3></div>
          <p className="overview">{result.summary.overview}</p>
          {result.summary.topics.length > 0 && <div className="topics" aria-label="주요 주제">{result.summary.topics.map((topic) => <span key={topic}>#{topic}</span>)}</div>}
          <h4>핵심 내용</h4>
          <ul className="key-points">{result.summary.keyPoints.map((point) => <li key={point}>{point}</li>)}</ul>
        </article>

        <article className="panel participant-panel">
          <div className="panel-title"><span className="panel-icon">◌</span><h3>참여 현황</h3></div>
          <div className="participant-list">
            {result.participants.slice(0, 6).map((participant) => (
              <div className="participant" key={participant.name}>
                <div><strong>{participant.name}</strong><span>{participant.messageCount}개 · {participant.percentage}%</span></div>
                <div className="bar"><span style={{ width: `${participant.percentage}%` }} /></div>
              </div>
            ))}
          </div>
          {(result.dateRange.start || result.dateRange.end) && <div className="date-range"><span>대화 기간</span><strong>{result.dateRange.start}{result.dateRange.end && result.dateRange.end !== result.dateRange.start ? ` — ${result.dateRange.end}` : ""}</strong></div>}
        </article>
      </div>

      <article className="panel action-panel">
        <div className="panel-title action-title"><div><span className="panel-icon">✓</span><h3>액션 아이템</h3></div><span className="count-badge">{result.actionItems.length}</span></div>
        {result.actionItems.length ? (
          <ol className="action-list">
            {result.actionItems.map((item) => (
              <li key={item.id}><span className="check-box" aria-hidden="true" /><div><p>{item.text}</p><div className="action-meta">
                {item.assignee && <span>담당 · {item.assignee}</span>}
                {item.dueDate && <span>기한 · {item.dueDate}</span>}
                <span>출처 · {item.sourceUser}{item.sourceTimestamp ? `, ${item.sourceTimestamp}` : ""}</span>
              </div></div></li>
            ))}
          </ol>
        ) : <div className="empty-state"><span>✓</span><p>명시적인 요청이나 할 일 문장을 찾지 못했습니다.</p></div>}
      </article>
    </section>
  );
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const chooseFile = (nextFile: File | null) => {
    setError(""); setResult(null);
    if (!nextFile) return setFile(null);
    if (!nextFile.name.toLowerCase().endsWith(".csv")) { setFile(null); return setError("CSV 파일만 선택할 수 있습니다."); }
    if (nextFile.size > MAX_SIZE) { setFile(null); return setError("파일 크기는 5MB 이하여야 합니다."); }
    setFile(nextFile);
  };

  const analyze = async () => {
    if (!file) return setError("분석할 CSV 파일을 선택해 주세요.");
    setLoading(true); setError("");
    const formData = new FormData(); formData.append("csvFile", file);
    try {
      const response = await fetch("/api/process-csv", { method: "POST", body: formData });
      const data = await response.json() as AnalysisResult | { error?: string };
      if (!response.ok) throw new Error("error" in data && data.error ? data.error : "파일 분석에 실패했습니다.");
      setResult(data as AnalysisResult);
      requestAnimationFrame(() => document.querySelector(".results")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "파일 분석에 실패했습니다."); }
    finally { setLoading(false); }
  };

  const reset = () => {
    setFile(null); setResult(null); setError("");
    if (inputRef.current) inputRef.current.value = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Briefly 홈"><span className="brand-mark">B</span><span>Briefly</span></a>
        <span className="privacy-note"><i /> 파일을 저장하지 않습니다</span>
      </header>

      <div id="top" className="page-shell">
        <section className="hero"><span className="eyebrow">CHAT TO CLARITY</span><h1>흩어진 대화에서<br /><em>핵심만 선명하게.</em></h1><p>채팅 CSV를 올리면 주요 내용을 요약하고<br className="mobile-break" /> 바로 실행할 액션 아이템을 정리합니다.</p></section>

        <section className="upload-card" aria-label="CSV 업로드">
          <div className={`drop-zone${dragging ? " dragging" : ""}${file ? " has-file" : ""}`}
            onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => { if (event.currentTarget === event.target) setDragging(false); }}
            onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files[0] ?? null); }}>
            <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={(event) => chooseFile(event.target.files?.[0] ?? null)} />
            {file ? <div className="selected-file"><span className="file-icon"><FileIcon /></span><div><strong>{file.name}</strong><span>{formatFileSize(file.size)}</span></div><button aria-label="선택한 파일 제거" onClick={(event) => { event.stopPropagation(); chooseFile(null); if (inputRef.current) inputRef.current.value = ""; }}>×</button></div>
              : <button className="drop-button" onClick={() => inputRef.current?.click()}><span className="upload-icon"><UploadIcon /></span><strong>CSV 파일을 여기에 놓으세요</strong><span>또는 <u>파일 찾아보기</u></span></button>}
          </div>
          <div className="upload-footer"><div className="format-help"><span>지원 헤더</span><code>timestamp</code><code>user</code><code>message</code><span className="separator">·</span><span>최대 5MB</span></div>
            <button className="button button-primary" disabled={!file || loading} onClick={analyze}>{loading ? <><span className="spinner" /> 분석 중...</> : <>대화 분석하기 <span>→</span></>}</button>
          </div>
          {error && <p className="error-message" role="alert">{error}</p>}
        </section>

        <section className="feature-strip" aria-label="분석 기능"><div><span>01</span><strong>핵심 요약</strong><p>대화의 주요 논점을 한눈에</p></div><div><span>02</span><strong>참여 분석</strong><p>메시지와 참여 비중을 정리</p></div><div><span>03</span><strong>액션 추출</strong><p>담당자와 기한까지 자동 감지</p></div></section>
        {result && <Results result={result} onReset={reset} />}
      </div>
      <footer><span>Briefly</span><p>CSV는 분석 후 즉시 폐기되며 서버에 저장되지 않습니다.</p></footer>
    </main>
  );
}
