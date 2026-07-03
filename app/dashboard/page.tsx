// app/dashboard/page.tsx
'use client';

import React, { useState } from 'react';
import { generateCompliancePacket, GenerationInput, CompliancePacket } from '../api/clauseEngine';
import { Clipboard, Check, Lock, ShieldAlert, CheckCircle } from 'lucide-react';

export default function ComplyQuickWorkspace() {
  const [step, setStep] = useState(1);
  const [copied, setCopied] = useState(false);
  const [isAssembling, setIsAssembling] = useState(false);
  const [packet, setPacket] = useState<CompliancePacket | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<GenerationInput>({
    persona: 'developer',
    techStack: [],
    nexus: 'US-TX',
    jurisdictions: [],
    vertical: 'Standard Apparel'
  });

  const toggleTech = (tech: string) => {
    setFormData(prev => ({
      ...prev,
      techStack: prev.techStack.includes(tech) ? prev.techStack.filter(t => t !== tech) : [...prev.techStack, tech]
    }));
  };

  const toggleJurisdiction = (jur: string) => {
    setFormData(prev => ({
      ...prev,
      jurisdictions: prev.jurisdictions.includes(jur) ? prev.jurisdictions.filter(j => j !== jur) : [...prev.jurisdictions, jur]
    }));
  };

  const runGeneration = () => {
    setIsAssembling(true);
    setError(null);
    setTimeout(() => {
      try {
        const result = generateCompliancePacket(formData);
        setPacket(result);
        setStep(6);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to generate compliance packet';
        setError(message);
        console.error('Compliance generation failed:', err);
      } finally {
        setIsAssembling(false);
      }
    }, 2500);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Clipboard write failed:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans antialiased flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        
        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-red-950/50 border border-red-800 rounded-xl flex items-start gap-3">
            <ShieldAlert size={18} className="text-red-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-400">Generation Failed</p>
              <p className="text-xs text-red-300/80 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Step 1: Persona Selection */}
        {step === 1 && (
          <div>
            <h2 className="text-2xl font-bold mb-2">Select Your Professional Profile</h2>
            <p className="text-slate-400 mb-6">We calibrate the contract structures to match your structural business risk profile.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {['developer', 'agency', 'merchant'].map((p) => (
                <button 
                  key={p}
                  onClick={() => { setFormData(prev => ({ ...prev, persona: p as GenerationInput['persona'] })); setStep(2); }}
                  className={`p-6 rounded-xl border transition-all text-left capitalize ${formData.persona === p ? 'border-teal-500 bg-teal-950/30' : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'}`}
                >
                  <div className="font-semibold text-lg">{p}</div>
                  <div className="text-xs text-slate-400 mt-2">Generate target structural waivers tailored for a custom {p} footprint.</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Tech Stack Grid */}
        {step === 2 && (
          <div>
            <h2 className="text-2xl font-bold mb-2">Integrate Technical Architecture Components</h2>
            <p className="text-slate-400 mb-6">Select all operational components actively running inside your client's stack.</p>
            <div className="grid grid-cols-2 gap-4 mb-6">
              {['Shopify', 'Klaviyo', 'Meta Pixel', 'Google Analytics'].map((tech) => (
                <button
                  key={tech}
                  onClick={() => toggleTech(tech)}
                  className={`p-4 rounded-xl border text-center font-medium transition-all ${formData.techStack.includes(tech) ? 'border-teal-500 bg-teal-950/20 text-teal-400' : 'border-slate-800 bg-slate-900'}`}
                >
                  {tech}
                </button>
              ))}
            </div>
            <button onClick={() => setStep(3)} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3 rounded-xl transition-all">Continue to Boundaries</button>
          </div>
        )}

        {/* Step 3: Regional Definitions */}
        {step === 3 && (
          <div>
            <h2 className="text-2xl font-bold mb-2">Define Nexus and Target Jurisdictions</h2>
            <p className="text-slate-400 mb-6">Where is the corporate entity registered, and where do targeted consumers reside?</p>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Merchant Registration Country</label>
                <select 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:outline-none focus:border-teal-500"
                  onChange={(e) => setFormData(prev => ({ ...prev, nexus: e.target.value }))}
                >
                  <option value="US-TX">United States (Texas Nexus)</option>
                  <option value="US-CA">United States (California Nexus)</option>
                  <option value="UK">United Kingdom</option>
                  <option value="EU">European Union Member State</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Target Consumer Markets</label>
                <div className="flex gap-2">
                  {['General US', 'California/CCPA', 'EU/GDPR'].map(jur => (
                    <button
                      key={jur}
                      type="button"
                      onClick={() => toggleJurisdiction(jur)}
                      className={`flex-1 p-3 border rounded-xl font-medium transition-all text-sm ${formData.jurisdictions.includes(jur) ? 'border-teal-500 bg-teal-950/20 text-teal-400' : 'border-slate-800 bg-slate-900'}`}
                    >
                      {jur}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={() => setStep(4)} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3 rounded-xl transition-all">Define Risk Profile</button>
          </div>
        )}

        {/* Step 4: Vertical Categorization */}
        {step === 4 && (
          <div>
            <h2 className="text-2xl font-bold mb-2">Categorize Store Operational Vertical</h2>
            <p className="text-slate-400 mb-6">High-risk industries trigger strict specialized structural warnings automatically.</p>
            <select 
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:outline-none focus:border-teal-500 mb-6"
              onChange={(e) => setFormData(prev => ({ ...prev, vertical: e.target.value }))}
            >
              <option value="Standard Apparel">Standard Apparel & Accessories</option>
              <option value="Dietary Supplements">Dietary Supplements & Nutraceuticals</option>
              <option value="Kids Goods">Children's Products & Toys (COPPA Risk)</option>
            </select>
            <button onClick={runGeneration} className="w-full bg-gradient-to-r from-teal-500 to-indigo-600 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-teal-500/20">Generate Architectural Shield</button>
          </div>
        )}

        {/* Step 5: Loading State Engine Simulation */}
        {isAssembling && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
            <p className="text-sm font-mono text-slate-400 animate-pulse">Mapping technical systems to regional legislative clauses...</p>
          </div>
        )}

        {/* Step 6: Split Delivery Studio & Paywall Matrix */}
        {step === 6 && packet && (
          <div className="space-y-6">
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-bold text-teal-400 flex items-center gap-2"><CheckCircle size={18}/> Inward Contract Waiver Layer (Unlocked)</h3>
                <button onClick={() => copyToClipboard(packet.inwardContractShield)} className="text-slate-400 hover:text-white flex items-center gap-1 text-sm bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 transition-all">
                  {copied ? <Check size={14} className="text-green-400"/> : <Clipboard size={14}/>} {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                {packet.inwardContractShield}
              </pre>
            </div>

            {/* Premium Package Blur Section */}
            <div className="relative border border-slate-800 rounded-xl p-6 bg-slate-950/50">
              <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md rounded-xl z-10 flex flex-col items-center justify-center p-6 text-center">
                <div className="bg-slate-900 border border-slate-800 p-3 rounded-full mb-3 text-teal-400 shadow-xl shadow-teal-500/5"><Lock size={24}/></div>
                <h4 className="text-xl font-bold mb-2">Unlock Client Privacy Policies & Dev Checklist</h4>
                <p className="text-xs text-slate-400 max-w-md mb-6">Get the tailored store footprint policies and tactical configurations mapped for this exact technical stack.</p>
                
                <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
                  <a href="https://buy.stripe.com/3cIcN47Yy7sk1iwdEJdAk01" target="_blank" rel="noopener noreferrer" className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 px-4 rounded-xl text-xs text-center border border-slate-700 transition-all">
                    Unlock Single Pass ($12)
                  </a>
                  <a href="https://buy.stripe.com/aFabJ0a6G5kc4uI449dAk00" target="_blank" rel="noopener noreferrer" className="flex-1 bg-gradient-to-r from-teal-500 to-indigo-600 text-white font-semibold py-2.5 px-4 rounded-xl text-xs text-center transition-all shadow-lg shadow-teal-500/20">
                    Unlimited Agency Pro ($29/mo)
                  </a>
                </div>
              </div>

              {/* Fake Content Underneath Blur Layer for Premium UI Aesthetics */}
              <div className="opacity-20 pointer-events-none font-mono text-xs space-y-4">
                <div className="h-4 bg-slate-800 rounded w-3/4"></div>
                <div className="h-4 bg-slate-800 rounded w-5/6"></div>
                <div className="h-4 bg-slate-800 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
