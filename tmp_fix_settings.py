from pathlib import Path

path = Path('D:/projects/HootAi/ui/src/pages/SettingsPage.tsx')
text = path.read_text(encoding='utf-8')

repls = [
("interface LlamaCppSettings {\n  enabled: boolean;\n  binary: string;\n  modelPath: string;\n  host: string;\n  port: number;\n  contextSize: number;\n  nGpuLayers: number;\n  threads: number;\n  extraArgs: string;\n}\n\ninterface HootBrainSettings {",
"interface LlamaCppSettings {\n  enabled: boolean;\n  binary: string;\n  modelPath: string;\n  host: string;\n  port: number;\n  contextSize: number;\n  nGpuLayers: number;\n  threads: number;\n  extraArgs: string;\n}\n\ninterface LmStudioSettings {\n  enabled: boolean;\n  host: string;\n  port: number;\n  protocol: string;\n  basePath: string;\n  defaultModel: string;\n}\n\ninterface HootBrainSettings {"),
("  localInference: {\n    preferredBackend: string;\n    llamacpp: LlamaCppSettings;\n  };",
"  localInference: {\n    preferredBackend: string;\n    lmstudio: LmStudioSettings;\n    llamacpp: LlamaCppSettings;\n  };")
]
for old, new in repls:
    if old in text:
        text = text.replace(old, new, 1)

text = text.replace(
"    setPageContext({\n      llamacppEnabled: Boolean(serverSettings?.localInference?.llamacpp?.enabled),\n      llamacppInterest: Boolean(scanHints?.llamacpp?.present || scanHints?.llamacpp?.server?.reachable),\n      vaultKeyCount: vaultKeys.length,\n    });",
"    setPageContext({\n      preferredLocalBackend: serverSettings?.localInference?.preferredBackend || 'ollama',\n      lmstudioEnabled: Boolean(serverSettings?.localInference?.lmstudio?.enabled),\n      lmstudioInterest: Boolean(scanHints?.lmstudio?.present || scanHints?.lmstudio?.server?.reachable),\n      llamacppEnabled: Boolean(serverSettings?.localInference?.llamacpp?.enabled),\n      llamacppInterest: Boolean(scanHints?.llamacpp?.present || scanHints?.llamacpp?.server?.reachable),\n      vaultKeyCount: vaultKeys.length,\n    });",
1,
)
text = text.replace(
"  const updateLlama = (patch: Partial<LlamaCppSettings>) => {\n    setServerSettings((prev) =>\n      prev\n        ? {\n            ...prev,\n            localInference: {\n              ...prev.localInference,\n              llamacpp: { ...prev.localInference.llamacpp, ...patch },\n            },\n          }\n        : prev\n    );\n  };",
"  const updateLlama = (patch: Partial<LlamaCppSettings>) => {\n    setServerSettings((prev) =>\n      prev\n        ? {\n            ...prev,\n            localInference: {\n              ...prev.localInference,\n              llamacpp: { ...prev.localInference.llamacpp, ...patch },\n            },\n          }\n        : prev\n    );\n  };\n\n  const updateLmStudio = (patch: Partial<LmStudioSettings>) => {\n    setServerSettings((prev) =>\n      prev\n        ? {\n            ...prev,\n            localInference: {\n              ...prev.localInference,\n              lmstudio: { ...prev.localInference.lmstudio, ...patch },\n            },\n          }\n        : prev\n    );\n  };",
1,
)
text = text.replace('Auto uses Ollama when detected, then llama.cpp, then screen-aware rules. Cloud uses API keys below.','Auto uses Ollama when detected, then LM Studio, then llama.cpp, then screen-aware rules. Cloud uses API keys below.',1)
text = text.replace('["auto", "ollama", "llamacpp", "cloud"]','["auto", "ollama", "lmstudio", "llamacpp", "cloud"]',1)
text = text.replace(
"        {serverSettings?.hoot_brain?.mode === \"ollama\" && (\n          <input\n            value={serverSettings.hoot_brain.ollama_model || \"\"}\n            onChange={(e) => updateHootBrain({ ollama_model: e.target.value })}\n            placeholder=\"Ollama model override (e.g. llama3.2:3b)\"\n            style={{ ...inputStyle, marginBottom: 12 }}\n          />\n        )}",
"        {serverSettings?.hoot_brain?.mode === \"ollama\" && (\n          <input\n            value={serverSettings.hoot_brain.ollama_model || \"\"}\n            onChange={(e) => updateHootBrain({ ollama_model: e.target.value })}\n            placeholder=\"Ollama model override (e.g. llama3.2:3b)\"\n            style={{ ...inputStyle, marginBottom: 12 }}\n          />\n        )}\n        {serverSettings?.hoot_brain?.mode === \"lmstudio\" && (\n          <input\n            value={serverSettings.localInference.lmstudio.defaultModel || \"\"}\n            onChange={(e) => updateLmStudio({ defaultModel: e.target.value })}\n            placeholder=\"LM Studio model id override (optional)\"\n            style={{ ...inputStyle, marginBottom: 12 }}\n          />\n        )}",
1,
)
old_block = '''          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <Cpu size={16} color="#4ade80" />
            <h3 style={{ fontSize: 14, margin: 0, color: "#f5f5f5" }}>Local Inference (llama.cpp)</h3>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={serverSettings.localInference.llamacpp.enabled}
              onChange={(e) => updateLlama({ enabled: e.target.checked })}
            />
            Enable llama.cpp backend
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              ["binary", "Binary (llama-server)", "text"],
              ["modelPath", "GGUF model path", "text"],
              ["host", "Host", "text"],
              ["port", "Port", "number"],
            ].map(([key, label, type]) => (
              <div key={key} style={{ gridColumn: key === "modelPath" ? "1 / -1" : undefined }}>
                <label style={{ fontSize: 11, opacity: 0.5, display: "block", marginBottom: 4 }}>{label}</label>
                <input
                  type={type}
                  value={String((serverSettings.localInference.llamacpp as Record<string, unknown>)[key] ?? "")}
                  onChange={(e) =>
                    updateLlama({
                      [key]: type === "number" ? Number(e.target.value) : e.target.value,
                    } as Partial<LlamaCppSettings>)
                  }
                  style={inputStyle}
                />
              </div>
            ))}
          </div>'''
new_block = '''          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <Cpu size={16} color="#4ade80" />
            <h3 style={{ fontSize: 14, margin: 0, color: "#f5f5f5" }}>Local Inference</h3>
          </div>
          <p style={{ fontSize: 12, opacity: 0.55, margin: "0 0 12px", lineHeight: 1.5 }}>
            HOOT can build local, cloud, and hybrid stacks from the backends it discovers. Pick the default local engine and tune each runtime below.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            {["ollama", "lmstudio", "llamacpp"].map((backend) => (
              <button
                key={backend}
                type="button"
                onClick={() =>
                  setServerSettings((prev) =>
                    prev ? { ...prev, localInference: { ...prev.localInference, preferredBackend: backend } } : prev
                  )
                }
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  border: "1px solid",
                  borderColor: serverSettings.localInference.preferredBackend === backend ? "rgba(74,222,128,0.4)" : "rgba(255,255,255,0.08)",
                  background: serverSettings.localInference.preferredBackend === backend ? "rgba(74,222,128,0.1)" : "rgba(255,255,255,0.02)",
                  color: serverSettings.localInference.preferredBackend === backend ? "#4ade80" : "#dadada",
                  cursor: "pointer",
                  fontSize: 12,
                  textTransform: "capitalize",
                }}
              >
                {backend === "lmstudio" ? "LM Studio" : backend}
              </button>
            ))}
          </div>
          <div style={{ marginBottom: 18, padding: 14, borderRadius: 10, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <strong style={{ fontSize: 13, color: "#f5f5f5" }}>LM Studio</strong>
              <span style={{ fontSize: 11, color: scanHints?.lmstudio?.server?.reachable ? "#4ade80" : scanHints?.lmstudio?.present ? "#fbbf24" : "rgba(255,255,255,0.45)" }}>
                {scanHints?.lmstudio?.server?.reachable ? "reachable" : scanHints?.lmstudio?.present ? "detected" : "not detected"}
              </span>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginBottom: 12 }}>
              <input
                type="checkbox"
                checked={serverSettings.localInference.lmstudio.enabled}
                onChange={(e) => updateLmStudio({ enabled: e.target.checked })}
              />
              Enable LM Studio OpenAI-compatible backend
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                ["host", "Host", "text"],
                ["port", "Port", "number"],
                ["protocol", "Protocol", "text"],
                ["basePath", "Base path", "text"],
                ["defaultModel", "Default model id", "text"],
              ].map(([key, label, type]) => (
                <div key={key} style={{ gridColumn: key === "defaultModel" ? "1 / -1" : undefined }}>
                  <label style={{ fontSize: 11, opacity: 0.5, display: "block", marginBottom: 4 }}>{label}</label>
                  <input
                    type={type}
                    value={String((serverSettings.localInference.lmstudio as Record<string, unknown>)[key] ?? "")}
                    onChange={(e) =>
                      updateLmStudio({
                        [key]: type === "number" ? Number(e.target.value) : e.target.value,
                      } as Partial<LmStudioSettings>)
                    }
                    style={inputStyle}
                  />
                </div>
              ))}
            </div>
            {scanHints?.lmstudio?.models?.length ? (
              <p style={{ fontSize: 11, color: "#93c5fd", margin: "10px 0 0" }}>
                Detected models: {scanHints.lmstudio.models.map((model) => model.name).filter(Boolean).slice(0, 4).join(", ")}
              </p>
            ) : (
              <p style={{ fontSize: 11, opacity: 0.5, margin: "10px 0 0" }}>
                Default endpoint: {serverSettings.localInference.lmstudio.protocol}://{serverSettings.localInference.lmstudio.host}:{serverSettings.localInference.lmstudio.port}{serverSettings.localInference.lmstudio.basePath}/chat/completions
              </p>
            )}
          </div>
          <div style={{ marginBottom: 6, padding: 14, borderRadius: 10, background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <strong style={{ fontSize: 13, color: "#f5f5f5" }}>llama.cpp</strong>
              <span style={{ fontSize: 11, color: scanHints?.llamacpp?.server?.reachable ? "#4ade80" : scanHints?.llamacpp?.present ? "#fbbf24" : "rgba(255,255,255,0.45)" }}>
                {scanHints?.llamacpp?.server?.reachable ? "reachable" : scanHints?.llamacpp?.present ? "detected" : "not detected"}
              </span>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginBottom: 12 }}>
              <input
                type="checkbox"
                checked={serverSettings.localInference.llamacpp.enabled}
                onChange={(e) => updateLlama({ enabled: e.target.checked })}
              />
              Enable llama.cpp backend
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                ["binary", "Binary (llama-server)", "text"],
                ["modelPath", "GGUF model path", "text"],
                ["host", "Host", "text"],
                ["port", "Port", "number"],
              ].map(([key, label, type]) => (
                <div key={key} style={{ gridColumn: key === "modelPath" ? "1 / -1" : undefined }}>
                  <label style={{ fontSize: 11, opacity: 0.5, display: "block", marginBottom: 4 }}>{label}</label>
                  <input
                    type={type}
                    value={String((serverSettings.localInference.llamacpp as Record<string, unknown>)[key] ?? "")}
                    onChange={(e) =>
                      updateLlama({
                        [key]: type === "number" ? Number(e.target.value) : e.target.value,
                      } as Partial<LlamaCppSettings>)
                    }
                    style={inputStyle}
                  />
                </div>
              ))}
            </div>
          </div>'''
if old_block in text:
    text = text.replace(old_block, new_block, 1)
path.write_text(text, encoding='utf-8')
print('ok')
