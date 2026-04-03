"use client";

import { useState } from "react";

const DEFAULT_INPUT = "用户注册时必须绑定手机号，密码至少8位";

export default function Home() {
  const [input, setInput] = useState<string>(DEFAULT_INPUT);
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const handleExtract = async () => {
    setLoading(true);
    setResult("");
    try {
      const res = await fetch("/requirement/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const data = await res.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (e) {
      setResult(`Error: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
      <h1>需求结构化抽取</h1>

      <div style={{ marginBottom: "1rem" }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={4}
          style={{ width: "100%", padding: "0.5rem", fontSize: "1rem" }}
          placeholder="输入需求描述..."
        />
      </div>

      <button
        onClick={handleExtract}
        disabled={loading}
        style={{
          padding: "0.5rem 1rem",
          fontSize: "1rem",
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "处理中..." : "提交"}
      </button>

      {result && (
        <div style={{ marginTop: "1rem" }}>
          <h3>结果:</h3>
          <pre
            style={{
              backgroundColor: "#f5f5f5",
              padding: "1rem",
              borderRadius: "4px",
              overflow: "auto",
            }}
          >
            {result}
          </pre>
        </div>
      )}
    </main>
  );
}
