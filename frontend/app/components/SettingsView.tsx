'use client';

import React, { useState, useEffect } from "react";

interface SettingsViewProps {
  showToast: (msg: string, type: "success" | "error" | "info") => void;
}

export default function SettingsView({ showToast }: SettingsViewProps) {
  const [apiUrl, setApiUrl] = useState<string>("");
  const [userPoolId, setUserPoolId] = useState<string>("");
  const [clientId, setClientId] = useState<string>("");
  const [region, setRegion] = useState<string>("us-east-1");

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_API_URL || localStorage.getItem("ultra_api_url") || "";
    const storedPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || localStorage.getItem("ultra_cognito_user_pool_id") || "";
    const storedClientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID || localStorage.getItem("ultra_cognito_client_id") || "";
    const storedRegion = process.env.NEXT_PUBLIC_AWS_REGION || localStorage.getItem("ultra_cognito_region") || "us-east-1";

    setApiUrl(url);
    setUserPoolId(storedPoolId);
    setClientId(storedClientId);
    setRegion(storedRegion);
  }, []);

  const handleSave = () => {
    localStorage.setItem("ultra_api_url", apiUrl.trim());
    localStorage.setItem("ultra_cognito_user_pool_id", userPoolId.trim());
    localStorage.setItem("ultra_cognito_client_id", clientId.trim());
    localStorage.setItem("ultra_cognito_region", region.trim());

    showToast("Configurações AWS salvas com sucesso! Recarregando...", "success");
    
    setTimeout(() => {
      window.location.reload();
    }, 800);
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto pb-12 animate-fade-in">
      <div className="mb-2">
        <h1 className="text-2xl md:text-3xl font-black text-text-primary tracking-tight">
          Configurações AWS Cloud & Cognito
        </h1>
        <p className="text-xs text-text-secondary mt-1">
          Toda a persistência e inteligência do sistema operam 100% integradas na sua infraestrutura AWS Serverless (API Gateway, DynamoDB, Bedrock e Cognito).
        </p>
      </div>

      <div className="bg-bg-card border border-border-color rounded-3xl p-8 flex flex-col gap-6 shadow-xl">
        
        {/* Status de Integração */}
        <div className="flex items-center gap-3 bg-accent-purple/10 border border-accent-purple/30 p-4 rounded-2xl">
          <span className="material-symbols-outlined text-accent-purple text-2xl">cloud_done</span>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-accent-purple uppercase tracking-wider">Modo 100% AWS Serverless</span>
            <span className="text-xs text-text-secondary">Autenticação via Amazon Cognito e chamadas protegidas com Bearer JWT.</span>
          </div>
        </div>

        {/* Campos de Integração AWS */}
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-text-secondary tracking-wider">
              URL Base do API Gateway (HTTP API v2)
            </label>
            <input 
              type="url" 
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://xyz123.execute-api.us-east-1.amazonaws.com"
              className="bg-bg-input border border-border-color text-text-primary px-5 py-3.5 rounded-2xl outline-none text-sm focus:border-accent-purple focus:bg-bg-input-focus transition-all duration-300"
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
                className="bg-bg-input border border-border-color text-text-primary px-5 py-3.5 rounded-2xl outline-none text-sm focus:border-accent-purple focus:bg-bg-input-focus transition-all duration-300"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-text-secondary tracking-wider">Cognito App Client ID</label>
              <input 
                type="text" 
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="1example234567890abcdef"
                className="bg-bg-input border border-border-color text-text-primary px-5 py-3.5 rounded-2xl outline-none text-sm focus:border-accent-purple focus:bg-bg-input-focus transition-all duration-300"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-text-secondary tracking-wider">Região AWS</label>
            <input 
              type="text" 
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="us-east-1"
              className="bg-bg-input border border-border-color text-text-primary px-5 py-3.5 rounded-2xl outline-none text-sm focus:border-accent-purple focus:bg-bg-input-focus transition-all duration-300"
            />
          </div>
        </div>

        <button 
          onClick={handleSave}
          className="bg-gradient-to-r from-accent-purple to-purple-700 hover:opacity-95 text-white font-bold px-8 py-3.5 rounded-2xl mt-2 self-start cursor-pointer shadow-lg shadow-accent-purple/20 transition-all duration-300 flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">save</span>
          <span>Salvar Credenciais AWS</span>
        </button>

      </div>
    </div>
  );
}
