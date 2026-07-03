// app/dashboard/page.tsx
'use client';

import React, { useState } from 'react';
import { generateCompliancePacket, CompliancePacket } from '../api/clauseEngine';
import { Clipboard, Check, Lock, ShieldAlert, CheckCircle } from 'lucide-react';
import { toggleItem, copyToClipboard } from '../lib/utils';
import { StepHeader } from '../components/StepHeader';
import { SelectionButton } from '../components/SelectionButton';
import { ContinueButton } from '../components/ContinueButton';

export default function ComplyQuickWorkspace() {
  const [step, setStep] = useState(1);
  const [copied, setCopied] = useState(false);
  const [isAssembling, setIsAssembling] = useState(false);
  const [packet, setPacket] = useState<CompliancePacket | null>(null);

  const [formData, setFormData] = useState({
    persona: 'developer',
    techStack: [] as string[],
    nexus: 'US-TX',
    jurisdictions: [] as string[],
    vertical: 'Standard Apparel'
  });

  const toggleField = (field: 'techStack' | 'jurisdictions', value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: toggleItem(prev[field], value),
    }));
  };

  const runGeneration = () => {
    setIsAssembling(true);
    setTimeout(() => {
      // @ts-ignore
      const result = generateCompliancePacket(formData);
      setPacket(result);
      setIsAssembling(false);
      setStep(6);
    }, 2500);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans antialiased flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        
        {/* Step 1: Persona Selection */}
        {step === 1 && (
          <div>
            <StepHeader
              title="Select Your Professional Profile"
              description="We calibrate the contract structures to match your structural business risk profile."
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {['developer', 'agency', 'merchant'].map((p) => (
                <SelectionButton
                  key={p}
                  label={p}
                  selected={formData.persona === p}
                  onClick={() => { setFormData(prev => ({ ...prev, persona: p })); setStep(2); }}
                  className="p-6 text-left capitalize"
                >
                  <div className="font-semibold text-lg">{p}</div>
                  <div className="text-xs text-slate-400 mt-2">Generate target structural waivers tailored for a custom {p} footprint.</div>
                </SelectionButton>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Tech Stack Grid */}
        {step === 2 && (
          <div>
            <StepHeader
              title="Integrate Technical Architecture Components"
              description="Select all operational components actively running inside your client's stack."
            />
            <div className="grid grid-cols-2 gap-4 mb-6">
              {['Shopify', 'Klaviyo', 'Meta Pixel', 'Google Analytics'].map((tech) => (
                <SelectionButton
                  key={tech}
                  label={tech}
                  selected={formData.techStack.includes(tech)}
                  onClick={() => toggleField('techStack', tech)}
                  className="text-center"
                />
              ))}
            </div>
            <ContinueButton onClick={() => setStep(3)} label="Continue to Boundaries" />
          </div>
        )}

        {/* Step 3: Regional Definitions */}
        {step === 3 && (
          <div>
            <StepHeader
              title="Define Nexus and Target Jurisdictions"
              description="Where is the corporate entity registered, and where do targeted consumers reside?"
            />
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
                    <SelectionButton
                      key={jur}
                      label={jur}
                      selected={formData.jurisdictions.includes(jur)}
                      onClick={() => toggleField('jurisdictions', jur)}
                      className="flex-1 p-3 text-sm"
                    />
                  ))}
                </div>
              </div>
            </div>
            <ContinueButton onClick={() => setStep(4)} label="Define Risk Profile" />
          </div>
        )}

        {/* Step 4: Vertical Categorization */}
        {step === 4 && (
          <div>
            <StepHeader
              title="Categorize Store Operational Vertical"
              description="High-risk industries trigger strict specialized structural warnings automatically."
            />
            <select 
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:outline-none focus:border-teal-500 mb-6"
              onChange={(e) => setFormData(prev => ({ ...prev, vertical: e.target.value }))}
            >
              <option value="Standard Apparel">Standard Apparel & Accessories</option>
              <option value="Dietary Supplements">Dietary Supplements & Nutraceuticals</option>
              <option value="Kids Goods">Children's Products & Toys (COPPA Risk)</option>
            </select>
            <ContinueButton onClick={runGeneration} label="Generate Architectural Shield" variant="primary" />
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
                <button onClick={() => copyToClipboard(packet.inwardContractShield, setCopied)} className="text-slate-400 hover:text-white flex items-center gap-1 text-sm bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 transition-all">
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
