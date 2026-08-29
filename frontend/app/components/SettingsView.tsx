'use client';

import React, { useState, useEffect } from "react";

interface SettingsViewProps {
  showToast: (msg: string, type: "success" | "error" | "info") => void;
}

export default function SettingsView({ showToast }: SettingsViewProps) {
  const [apiMode, setApiMode] = useState<string>("mock");
  const [apiUrl, setApiUrl] = useState<string>("");
  const [userId, setUserId] = useState<string>("usr_dev_default");
  const [userPoolId, setUserPoolId] = useState<string>("");
  const [clientId, setClientId] = useState<string>("");
  const [region, setRegion] = useState<string>("us-east-1");

  useEffect(() => {
    const mode = localStorage.getItem("ultra_api_mode") || "mock";
    const url = localStorage.getItem("ultra_api_url") || "";
    const uid = localStorage.getItem("ultra_user_id") || "usr_dev_default";
    const storedPoolId = localStorage.getItem("ultra_cognito_user_pool_id") || "";
    const storedClientId = localStorage.getItem("ultra_cognito_client_id") || "";
    const storedRegion = localStorage.getItem("ultra_cognito_region") || "us-east-1";

    setApiMode(mode);
    setApiUrl(url);
    setUserId(uid);
    setUserPoolId(storedPoolId);
    setClientId(storedClientId);
    setRegion(storedRegion);
  }, []);

  const handleSave = () => {
    localStorage.setItem("ultra_api_mode", apiMode);
    localStorage.setItem("ultra_api_url", apiUrl.trim());
    localStorage.setItem("ultra_user_id", userId.trim() || "usr_dev_default");
    localStorage.setItem("ultra_cognito_user_pool_id", userPoolId.trim());
    localStorage.setItem("ultra_cognito_client_id", clientId.trim());
    localStorage.setItem("ultra_cognito_region", region.trim());

    showToast("Configurações salvas! Recarregando contexto...", "success");
    
    // Forçar recarga após 1 segundo para atualizar o cliente Amplify
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-text-primary">Configurações de Integração AWS Cloud & Cognito</h2>
        <p className="text-xs text-text-secondary mt-1">
          Configure a URL do API Gateway e os identificadores do Amazon Cognito para autenticação e persistência na AWS.
        </p>
      </div>

      <div className="bg-bg-card border border-border-color rounded-2xl p-8 max-w-2xl flex flex-col gap-5">
        
        {/* Modo de Operação */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-text-secondary tracking-wider">Modo de Operação</label>
          <select 
            value={apiMode}
            onChange={(e) => setApiMode(e.target.value)}
            className="bg-bg-input border border-border-color text-text-primary px-4 py-3 rounded-xl outline-none text-sm focus:border-accent-blue focus:bg-bg-input-focus transition-all duration-300 cursor-pointer"
          >
            <option value="mock">Modo Offline (Simulador / Dados Mockados locais)</option>
            <option value="aws">AWS Backend Integrado (Amazon Cognito + Lambdas)</option>
          </select>
        </div>

        {/* Campos de Integração AWS */}
        {apiMode === "aws" && (
          <div className="flex flex-col gap-5 animate-slide-in">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-text-secondary tracking-wider">URL Base do API Gateway (HTTP API v2)</label>
              <input 
                type="url" 
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://abcde12345.execute-api.us-east-1.amazonaws.com"
                className="bg-bg-input border border-border-color text-text-primary px-4 py-3 rounded-xl outline-none text-sm focus:border-accent-blue focus:bg-bg-input-focus transition-all duration-300"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-text-secondary tracking-wider">Cognito User Pool ID</label>
                <input 
                  type="text" 
                  value={userPoolId}
                  onChange={(e) => setUserPoolId(e.target.value)}
                  placeholder="us-east-1_xxxxxxxxx"
                  className="bg-bg-input border border-border-color text-text-primary px-4 py-3 rounded-xl outline-none text-sm focus:border-accent-blue focus:bg-bg-input-focus transition-all duration-300"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-text-secondary tracking-wider">Cognito App Client ID</label>
                <input 
                  type="text" 
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="1example234567890abcdef"
                  className="bg-bg-input border border-border-color text-text-primary px-4 py-3 rounded-xl outline-none text-sm focus:border-accent-blue focus:bg-bg-input-focus transition-all duration-300"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-text-secondary tracking-wider">Região AWS</label>
                <input 
                  type="text" 
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="us-east-1"
                  className="bg-bg-input border border-border-color text-text-primary px-4 py-3 rounded-xl outline-none text-sm focus:border-accent-blue focus:bg-bg-input-focus transition-all duration-300"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-text-secondary tracking-wider">User ID de Fallback (Offline)</label>
                <input 
                  type="text" 
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="usr_dev_default"
                  className="bg-bg-input border border-border-color text-text-primary px-4 py-3 rounded-xl outline-none text-sm focus:border-accent-blue focus:bg-bg-input-focus transition-all duration-300"
                />
              </div>
            </div>
          </div>
        )}

        <button 
          onClick={handleSave}
          className="bg-accent-blue hover:bg-accent-blue/90 text-white font-bold px-6 py-2.5 rounded-full mt-4 self-start cursor-pointer transition-all duration-300"
        >
          Salvar Configurações
        </button>

      </div>
    </div>
  );
}
